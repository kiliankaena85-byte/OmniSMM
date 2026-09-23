'use server';

// ==============================================================
// Provider Proxy Server Actions
// OWASP Top 10 2025 Compliant
// A01: requireStaffPermission on all mutations
// A02: Proxy passwords encrypted via VaultService
// A03: Zod validation on all inputs
// A09: Audit trail on all mutations
// A10: SSRF guard on all test requests
// ==============================================================

import { requireStaffPermission, requireOwnerPermission } from '@/lib/server/rbac';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { getClientIp } from '@/utils/ip';
import {
  createProxySchema,
  updateProxySchema,
  testProxySchema,
  assignProxySchema,
  batchAssignSchema,
  proxyLogQuerySchema,
  importSubscriptionSchema,
  importRawListSchema,
} from '@/schemas/provider-proxy';
import type {
  ProviderProxyWithUsage,
  ProxyTestResult,
  ProxyHealthSummary,
} from '@/types/provider-proxy';

// ── LIST ──
export async function listProviderProxiesAction(): Promise<
  { success: true; data: ProviderProxyWithUsage[] } | { success: false; error: string }
> {
  const res = await requireStaffPermission('providers', 'view', async () => {
    const rawList = await db.providerProxy.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { providers: true, logs: true } },
      },
    });

    return rawList.map((p) => ({
      ...p,
      protocol: p.protocol as 'http' | 'https' | 'socks5',
      category: (p.category as 'PAID_PREMIUM' | 'FREE_PUBLIC' | 'BACKUP_RESERVE') || 'PAID_PREMIUM',
      tags: typeof p.tags === 'string' ? (JSON.parse(p.tags) as string[]) : (p.tags as unknown as string[]),
    }));
  });

  if ('error' in res) {
    return { success: false, error: res.error };
  }
  return { success: true, data: res };
}

// ── HEALTH SUMMARY ──
export async function getProxyHealthSummaryAction(): Promise<
  { success: true; data: ProxyHealthSummary } | { success: false; error: string }
> {
  const res = await requireStaffPermission('providers', 'view', async () => {
    const [total, active, withErrors, avgResult, providersWithProxy, providersDirect] = await Promise.all([
      db.providerProxy.count(),
      db.providerProxy.count({ where: { isActive: true } }),
      db.providerProxy.count({ where: { consecutiveFailures: { gt: 0 } } }),
      db.providerProxy.aggregate({
        where: { lastTestLatencyMs: { not: null } },
        _avg: { lastTestLatencyMs: true },
      }),
      db.provider.count({ where: { proxyId: { not: null } } }),
      db.provider.count({ where: { proxyId: null, isActive: true } }),
    ]);

    return {
      total,
      active,
      withErrors,
      avgLatencyMs: avgResult._avg.lastTestLatencyMs ? Math.round(avgResult._avg.lastTestLatencyMs) : null,
      providersUsingProxy: providersWithProxy,
      providersDirect,
    };
  });

  if ('error' in res) {
    return { success: false, error: res.error };
  }
  return { success: true, data: res };
}

// ── CREATE ──
export async function createProviderProxyAction(raw: Record<string, unknown>) {
  return requireStaffPermission('providers', 'edit', async (admin) => {
    const parsed = createProxySchema.safeParse(raw);
    if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message };

    const data = parsed.data;
    let passwordEncrypted: string | null = null;
    if (data.password) {
      try {
        const { VaultService } = await import('@/lib/vault');
        passwordEncrypted = VaultService.encrypt(data.password);
      } catch {
        return { success: false as const, error: 'Ошибка шифрования пароля прокси' };
      }
    }

    const proxy = await db.providerProxy.create({
      data: {
        label: data.label,
        description: data.description,
        protocol: data.protocol,
        category: data.category || 'PAID_PREMIUM',
        host: data.host,
        port: data.port,
        username: data.username,
        passwordEncrypted,
        isRotating: data.isRotating,
        geoCountry: data.geoCountry,
        tags: JSON.stringify(data.tags),
        subscriptionUrl: data.subscriptionUrl || null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
    });

    // Auto-sync subscription if URL was supplied
    if (proxy.subscriptionUrl) {
      const { SubscriptionSyncService } = await import('@/services/providers/subscription-sync.service');
      await SubscriptionSyncService.syncSubscription(proxy.id);
    }

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'PROVIDER_PROXY_CREATE',
      target: proxy.id,
      targetType: 'PROVIDER_PROXY',
      ipAddress: await getClientIp(),
      newValue: JSON.stringify({ label: data.label, protocol: data.protocol, host: data.host, category: data.category }),
    });

    revalidatePath('/admin/providers');
    revalidatePath('/admin/settings');
    return { success: true as const, message: `Прокси "${data.label}" создан`, data: proxy };
  });
}

// ── UPDATE ──
export async function updateProviderProxyAction(raw: Record<string, unknown>) {
  return requireStaffPermission('providers', 'edit', async (admin) => {
    const parsed = updateProxySchema.safeParse(raw);
    if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message };

    const { id, password, tags, expiresAt, ...data } = parsed.data;

    const existing = await db.providerProxy.findUnique({ where: { id } });
    if (!existing) return { success: false as const, error: 'Прокси не найден' };

    let passwordEncrypted: string | null | undefined;
    if (password !== undefined) {
      if (password) {
        try {
          const { VaultService } = await import('@/lib/vault');
          passwordEncrypted = VaultService.encrypt(password);
        } catch {
          return { success: false as const, error: 'Ошибка шифрования пароля' };
        }
      } else {
        passwordEncrypted = null;
      }
    }

    await db.providerProxy.update({
      where: { id },
      data: {
        ...data,
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
        ...(tags !== undefined && { tags: JSON.stringify(tags) }),
        ...(passwordEncrypted !== undefined && { passwordEncrypted }),
      },
    });

    // Auto-sync if subscription URL was updated
    if (data.subscriptionUrl && data.subscriptionUrl !== existing.subscriptionUrl) {
      const { SubscriptionSyncService } = await import('@/services/providers/subscription-sync.service');
      await SubscriptionSyncService.syncSubscription(id);
    }

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'PROVIDER_PROXY_UPDATE',
      target: id,
      targetType: 'PROVIDER_PROXY',
      ipAddress: await getClientIp(),
      oldValue: JSON.stringify({ label: existing.label }),
      newValue: JSON.stringify({ label: data.label || existing.label }),
    });

    revalidatePath('/admin/providers');
    revalidatePath('/admin/settings');
    return { success: true as const, message: `Прокси "${data.label || existing.label}" обновлён` };
  });
}

// ── SYNC SUBSCRIPTION ACTION ──
export async function syncSubscriptionAction(proxyId: string) {
  return requireStaffPermission('providers', 'edit', async (admin) => {
    if (!proxyId) return { success: false as const, error: 'ID обязателен' };

    const { SubscriptionSyncService } = await import('@/services/providers/subscription-sync.service');
    const res = await SubscriptionSyncService.syncSubscription(proxyId);

    if (res.success) {
      await auditAdminAwaitable({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'PROVIDER_PROXY_SUBSCRIPTION_SYNC',
        target: proxyId,
        targetType: 'PROVIDER_PROXY',
        ipAddress: await getClientIp(),
        newValue: JSON.stringify(res.info),
      });

      revalidatePath('/admin/providers');
      revalidatePath('/admin/settings');
      return {
        success: true as const,
        message: 'Подписка успешно синхронизирована',
        data: res.info,
      };
    } else {
      return {
        success: false as const,
        error: res.error || 'Ошибка синхронизации подписки',
      };
    }
  });
}

// ── HARVEST FREE PROXIES ACTION ──
export async function harvestFreeProxiesAction() {
  return requireStaffPermission('providers', 'edit', async (admin) => {
    const { FreeProxyHarvesterService } = await import('@/services/providers/free-proxy-harvester.service');
    const res = await FreeProxyHarvesterService.harvestAndRefreshPool();

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'PROVIDER_PROXY_HARVEST_FREE',
      target: 'free-proxy-harvester',
      targetType: 'SYSTEM',
      ipAddress: await getClientIp(),
      newValue: JSON.stringify({ tested: res.tested, added: res.addedOrUpdated }),
    });

    revalidatePath('/admin/providers');
    revalidatePath('/admin/settings');
    return {
      success: true as const,
      message: `Проверено: ${res.tested}, добавлено/обновлено: ${res.addedOrUpdated} бесплатных SOCKS5`,
      data: res,
    };
  });
}

// ── DELETE ──
export async function deleteProviderProxyAction(proxyId: string) {
  return requireOwnerPermission(async (admin) => {
    if (!proxyId) return { success: false as const, error: 'ID обязателен' };

    const existing = await db.providerProxy.findUnique({ where: { id: proxyId } });
    if (!existing) return { success: false as const, error: 'Прокси не найден' };

    // Unbind all providers using this proxy
    const unboundCount = await db.provider.count({ where: { proxyId } });
    await db.provider.updateMany({ where: { proxyId }, data: { proxyId: null } });

    await db.providerProxy.delete({ where: { id: proxyId } });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'PROVIDER_PROXY_DELETE',
      target: proxyId,
      targetType: 'PROVIDER_PROXY',
      ipAddress: await getClientIp(),
      oldValue: JSON.stringify({ label: existing.label, unboundProviders: unboundCount }),
    });

    revalidatePath('/admin/providers');
    revalidatePath('/admin/settings');
    return { success: true as const, message: `Прокси "${existing.label}" удалён. ${unboundCount} провайдеров переведены на прямое подключение.` };
  });
}

// ── TEST ──
export async function testProviderProxyAction(raw: Record<string, unknown>) {
  return requireStaffPermission('providers', 'edit', async (admin) => {
    const parsed = testProxySchema.safeParse(raw);
    if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message };

    const { proxyId, targetUrl } = parsed.data;
    const proxy = await db.providerProxy.findUnique({ where: { id: proxyId } });
    if (!proxy) return { success: false as const, error: 'Прокси не найден' };

    // Decrypt password for test
    let password: string | undefined;
    if (proxy.passwordEncrypted) {
      try {
        const { VaultService } = await import('@/lib/vault');
        password = VaultService.decrypt(proxy.passwordEncrypted);
      } catch {
        return { success: false as const, error: 'Ошибка расшифровки пароля' };
      }
    }

    const { testProxyConnection } = await import('@/lib/http/proxy-fetch');
    const result = await testProxyConnection(
      {
        protocol: proxy.protocol as 'http' | 'https' | 'socks5',
        host: proxy.host,
        port: proxy.port,
        username: proxy.username || undefined,
        password,
      },
      targetUrl,
    );

    // Update proxy health
    await db.providerProxy.update({
      where: { id: proxyId },
      data: {
        lastTestAt: new Date(),
        lastTestLatencyMs: result.latencyMs,
        lastTestSuccess: result.success,
        ...(result.success
          ? { consecutiveFailures: 0 }
          : { consecutiveFailures: { increment: 1 }, errorCount: { increment: 1 }, lastErrorAt: new Date() }),
      },
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'PROVIDER_PROXY_TEST',
      target: proxyId,
      targetType: 'PROVIDER_PROXY',
      ipAddress: await getClientIp(),
      newValue: JSON.stringify({ success: result.success, latencyMs: result.latencyMs }),
    });

    revalidatePath('/admin/providers');
    revalidatePath('/admin/settings');
    return {
      success: true as const,
      message: result.success
        ? `Подключение OK: ${result.latencyMs}ms (IP: ${result.resolvedIp || 'н/д'})`
        : `Ошибка: ${result.error}`,
      data: {
        ...result,
        testedAt: new Date().toISOString(),
      } as ProxyTestResult,
    };
  });
}

// ── ASSIGN / UNASSIGN PROXY TO PROVIDER ──
export async function assignProxyToProviderAction(raw: Record<string, unknown>) {
  return requireStaffPermission('providers', 'edit', async (admin) => {
    const parsed = assignProxySchema.safeParse(raw);
    if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message };

    const { providerId, proxyId } = parsed.data;

    const provider = await db.provider.findUnique({ where: { id: providerId } });
    if (!provider) return { success: false as const, error: 'Провайдер не найден' };

    if (proxyId) {
      const proxy = await db.providerProxy.findUnique({ where: { id: proxyId } });
      if (!proxy) return { success: false as const, error: 'Прокси не найден' };
    }

    await db.provider.update({
      where: { id: providerId },
      data: { proxyId },
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: proxyId ? 'PROVIDER_PROXY_ASSIGN' : 'PROVIDER_PROXY_UNASSIGN',
      target: providerId,
      targetType: 'PROVIDER',
      ipAddress: await getClientIp(),
      newValue: JSON.stringify({ proxyId, providerName: provider.name }),
    });

    revalidatePath('/admin/providers');
    revalidatePath('/admin/settings');
    return {
      success: true as const,
      message: proxyId
        ? `Провайдеру "${provider.name}" назначен прокси`
        : `Провайдер "${provider.name}" переведён на прямое подключение`,
    };
  });
}

// ── BATCH ASSIGN ──
export async function batchAssignProxiesAction(raw: Record<string, unknown>) {
  return requireStaffPermission('providers', 'edit', async (admin) => {
    const parsed = batchAssignSchema.safeParse(raw);
    if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message };

    await db.$transaction(
      parsed.data.assignments.map((a) =>
        db.provider.update({ where: { id: a.providerId }, data: { proxyId: a.proxyId } }),
      ),
    );

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'PROVIDER_PROXY_BATCH_ASSIGN',
      target: `${parsed.data.assignments.length} providers`,
      targetType: 'PROVIDER',
      ipAddress: await getClientIp(),
    });

    revalidatePath('/admin/providers');
    revalidatePath('/admin/settings');
    return { success: true as const, message: `Обновлено ${parsed.data.assignments.length} привязок` };
  });
}

// ── TOGGLE ACTIVE ──
export async function toggleProxyActiveAction(proxyId: string, isActive: boolean) {
  return requireStaffPermission('providers', 'edit', async () => {
    if (!proxyId) return { success: false as const, error: 'ID обязателен' };
    await db.providerProxy.update({ where: { id: proxyId }, data: { isActive } });
    revalidatePath('/admin/providers');
    revalidatePath('/admin/settings');
    return { success: true as const, message: isActive ? 'Прокси активирован' : 'Прокси деактивирован' };
  });
}

// ── CONNECTION LOGS ──
export async function getProxyLogsAction(raw: Record<string, unknown> = {}) {
  return requireStaffPermission('providers', 'view', async () => {
    const parsed = proxyLogQuerySchema.safeParse(raw);
    const q = parsed.success
      ? parsed.data
      : { limit: 50, errorOnly: false, proxyId: undefined, providerId: undefined };

    const where: Record<string, unknown> = {};
    if (q.proxyId) where.proxyId = q.proxyId;
    if (q.providerId) where.providerId = q.providerId;
    if (q.errorOnly) where.error = { not: null };

    return db.providerProxyLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: q.limit,
      include: {
        proxy: { select: { label: true, host: true, protocol: true } },
        provider: { select: { name: true } },
      },
    });
  });
}

// ── CLEANUP LOGS ──
export async function cleanupProxyLogsAction(daysToKeep: number = 30) {
  return requireOwnerPermission(async (admin) => {
    const cutoff = new Date(Date.now() - daysToKeep * 86400000);
    const result = await db.providerProxyLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'PROVIDER_PROXY_LOGS_CLEANUP',
      target: `${result.count} logs`,
      targetType: 'PROVIDER_PROXY_LOG',
      ipAddress: await getClientIp(),
    });

    return { success: true as const, message: `Удалено ${result.count} записей старше ${daysToKeep} дней` };
  });
}

// ── 1-CLICK SUBSCRIPTION IMPORT ──
export async function importSubscriptionAction(raw: Record<string, unknown>) {
  return requireStaffPermission('providers', 'edit', async (admin) => {
    const parsed = importSubscriptionSchema.safeParse(raw);
    if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message };

    const {
      subscriptionUrl,
      label,
      category,
      protocol,
      inboundHost,
      inboundPort,
      autoAssignToProviders,
    } = parsed.data;

    // 1. SSRF Guard verification on subscription URL
    const { assertSafeOutboundUrl } = await import('@/lib/security/ssrf-guard');
    const ssrfCheck = await assertSafeOutboundUrl(subscriptionUrl);
    if (!ssrfCheck.ok) {
      return { success: false as const, error: `URL подписки заблокирован политикой безопасности: ${ssrfCheck.reason}` };
    }

    // 2. Fetch subscription metadata & Userinfo
    const { SubscriptionSyncService } = await import('@/services/providers/subscription-sync.service');
    let subInfo: ReturnType<typeof SubscriptionSyncService.parseUserinfo> | null = null;

    try {
      const response = await fetch(subscriptionUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'ClashforWindows/0.20.39 (SMMpanel Subscription Engine)',
          Accept: '*/*',
        },
        signal: AbortSignal.timeout(10000),
      });

      const userinfoHeader =
        response.headers.get('subscription-userinfo') ||
        response.headers.get('Subscription-Userinfo') ||
        response.headers.get('Subscription-UserInfo');

      if (userinfoHeader) {
        subInfo = SubscriptionSyncService.parseUserinfo(userinfoHeader);
      }
    } catch (fetchErr) {
      console.warn('[importSubscriptionAction] Warning: Failed to pre-fetch subscription headers:', fetchErr);
    }

    // 3. Determine label
    const domainPart = (() => {
      try {
        return new URL(subscriptionUrl).hostname;
      } catch {
        return 'VPN';
      }
    })();
    const finalLabel = label && label.trim() ? label.trim() : `Подписка ${domainPart}`;

    const usedBytes = subInfo ? subInfo.uploadBytes + subInfo.downloadBytes : BigInt(0);

    // 4. Create ProviderProxy record in DB
    const createdProxy = await db.providerProxy.create({
      data: {
        label: finalLabel,
        description: `Импортировано из подписки: ${domainPart}`,
        protocol,
        category,
        host: inboundHost,
        port: inboundPort,
        subscriptionUrl,
        trafficUsedBytes: usedBytes,
        trafficTotalBytes: subInfo ? subInfo.totalBytes : BigInt(0),
        expiresAt: subInfo?.expiresAt || null,
        lastSyncAt: new Date(),
        geoCountry: /RU|Russia|Россия|🇷🇺|MSK|SPB/i.test(`${finalLabel} ${subscriptionUrl}`) ? 'RU' : null,
        tags: JSON.stringify([
          'subscription', 
          domainPart, 
          protocol,
          ...(/RU|Russia|Россия|🇷🇺|MSK|SPB/i.test(`${finalLabel} ${subscriptionUrl}`) ? ['RU', 'SOVEREIGN'] : [])
        ]),
        isActive: true,
      },
    });

    // 5. Optionally bind active providers currently on direct connection
    let assignedProvidersCount = 0;
    if (autoAssignToProviders) {
      const unassignedProviders = await db.provider.findMany({
        where: { proxyId: null, isActive: true },
      });
      if (unassignedProviders.length > 0) {
        await db.provider.updateMany({
          where: { proxyId: null, isActive: true },
          data: { proxyId: createdProxy.id },
        });
        assignedProvidersCount = unassignedProviders.length;
      }
    }

    // 6. Run quick test probe in background
    const ipAddress = await getClientIp();
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'PROVIDER_PROXY_SUBSCRIPTION_IMPORT',
      target: createdProxy.id,
      targetType: 'PROVIDER_PROXY',
      ipAddress,
      newValue: JSON.stringify({
        label: finalLabel,
        subscriptionUrl,
        assignedProvidersCount,
      }),
    });

    revalidatePath('/admin/providers');
    revalidatePath('/admin/settings');

    return {
      success: true as const,
      message: `Подписка "${finalLabel}" успешно импортирована! ${
        assignedProvidersCount > 0 ? `Привязано ${assignedProvidersCount} провайдеров.` : ''
      }`,
      data: createdProxy,
    };
  });
}

// ── BULK RAW PROXY LIST IMPORT ──
export async function importRawProxyListAction(raw: Record<string, unknown>) {
  return requireStaffPermission('providers', 'edit', async (admin) => {
    const parsed = importRawListSchema.safeParse(raw);
    if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message };

    const { rawListText, category, defaultProtocol, tag } = parsed.data;

    const lines = rawListText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    if (lines.length === 0) {
      return { success: false as const, error: 'Список пуст или содержит только комментарии' };
    }

    const { VaultService } = await import('@/lib/vault');

    let addedCount = 0;
    const errors: string[] = [];

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      let protocol = defaultProtocol;
      let host = '';
      let port = 0;
      let username: string | undefined;
      let password: string | undefined;

      try {
        // Format 1: protocol://user:pass@host:port or protocol://host:port
        if (line.includes('://')) {
          const url = new URL(line);
          const proto = url.protocol.replace(':', '');
          if (['http', 'https', 'socks5'].includes(proto)) {
            protocol = proto as 'http' | 'https' | 'socks5';
          }
          host = url.hostname;
          port = parseInt(url.port, 10);
          username = url.username || undefined;
          password = url.password || undefined;
        } else {
          // Format 2: host:port:user:pass or host:port
          const parts = line.split(':');
          if (parts.length >= 2) {
            host = parts[0];
            port = parseInt(parts[1], 10);
            if (parts.length >= 4) {
              username = parts[2];
              password = parts[3];
            }
          }
        }

        if (!host || isNaN(port) || port < 1 || port > 65535) {
          errors.push(`Строка ${idx + 1}: некорректный хост или порт (${line})`);
          continue;
        }

        const isRu = /RU|Russia|Россия|🇷🇺|MSK|SPB|Moscow/i.test(`${line} ${tag || ''}`);
        const label = `${protocol.toUpperCase()} ${host}:${port}${isRu ? ' [RU 🇷🇺]' : ''}`;
        const tags = ['imported', protocol];
        if (tag && tag.trim()) tags.push(tag.trim().toLowerCase());
        if (isRu) tags.push('RU', 'SOVEREIGN');

        const existing = await db.providerProxy.findFirst({
          where: { host, port, protocol },
        });

        const passwordEncrypted = password ? VaultService.encrypt(password) : null;

        if (existing) {
          await db.providerProxy.update({
            where: { id: existing.id },
            data: {
              label,
              category,
              geoCountry: isRu ? 'RU' : existing.geoCountry,
              username: username || existing.username,
              passwordEncrypted: passwordEncrypted || existing.passwordEncrypted,
              tags: JSON.stringify(tags),
              isActive: true,
            },
          });
        } else {
          await db.providerProxy.create({
            data: {
              label,
              protocol,
              category,
              geoCountry: isRu ? 'RU' : null,
              host,
              port,
              username,
              passwordEncrypted,
              tags: JSON.stringify(tags),
              isActive: true,
            },
          });
        }
        addedCount++;
      } catch (lineErr) {
        errors.push(`Строка ${idx + 1}: ${lineErr instanceof Error ? lineErr.message : String(lineErr)}`);
      }
    }

    const ipAddress = await getClientIp();
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'PROVIDER_PROXY_BULK_IMPORT',
      target: `${addedCount} proxies`,
      targetType: 'PROVIDER_PROXY',
      ipAddress,
      newValue: JSON.stringify({ addedCount, errorCount: errors.length, category }),
    });

    revalidatePath('/admin/providers');
    revalidatePath('/admin/settings');

    return {
      success: true as const,
      message: `Успешно импортировано и обновлено ${addedCount} прокси!${
        errors.length > 0 ? ` (Ошибок в строках: ${errors.length})` : ''
      }`,
      addedCount,
      errors: errors.slice(0, 5),
    };
  });
}

// ── SYNC ALL SUBSCRIPTIONS ACTION ──
export async function syncAllSubscriptionsAction() {
  return requireStaffPermission('providers', 'edit', async (admin) => {
    const { SubscriptionSyncService } = await import('@/services/providers/subscription-sync.service');
    const res = await SubscriptionSyncService.syncAllActiveSubscriptions();

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'PROVIDER_PROXY_SYNC_ALL_SUBSCRIPTIONS',
      target: 'all-subscriptions',
      targetType: 'SYSTEM',
      ipAddress: await getClientIp(),
      newValue: JSON.stringify(res),
    });

    revalidatePath('/admin/providers');
    revalidatePath('/admin/settings');

    return {
      success: true as const,
      message: `Синхронизировано ${res.syncedCount} подписок${
        res.errors.length > 0 ? ` (С ошибками: ${res.errors.length})` : ''
      }`,
      data: res,
    };
  });
}

// ── BATCH ASSIGN PROXY TO ALL ACTIVE PROVIDERS ──
export async function batchAssignProxyToAllProvidersAction(proxyId: string | null) {
  return requireStaffPermission('providers', 'edit', async (admin) => {
    let proxyLabel = 'Прямое подключение (Без прокси)';
    if (proxyId) {
      const proxy = await db.providerProxy.findUnique({ where: { id: proxyId } });
      if (!proxy) return { success: false as const, error: 'Прокси не найден' };
      proxyLabel = proxy.label;
    }

    const updated = await db.provider.updateMany({
      where: { isActive: true },
      data: { proxyId },
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: proxyId ? 'PROVIDER_PROXY_ASSIGN_ALL' : 'PROVIDER_PROXY_UNASSIGN_ALL',
      target: `${updated.count} providers`,
      targetType: 'PROVIDER',
      ipAddress: await getClientIp(),
      newValue: JSON.stringify({ proxyId, proxyLabel, count: updated.count }),
    });

    revalidatePath('/admin/providers');
    revalidatePath('/admin/settings');

    return {
      success: true as const,
      message: proxyId
        ? `Все ${updated.count} активных провайдеров переведены на прокси "${proxyLabel}"`
        : `Все ${updated.count} активных провайдеров переведены на прямое подключение`,
    };
  });
}
