'use server';
import type { ApiMappingDTO } from '@/services/providers/universal.provider';

import { db } from "@/lib/db";
import { requireStaffPermission } from "@/lib/server/rbac";
import { VaultService } from "@/lib/vault";
import { auditAdminAwaitable } from "@/lib/admin-audit";
import { providerService } from "@/services/providers/provider.service";
import { getBaseUrlAsync } from "@/utils/get-base-url";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const apiMappingSchema = z.object({
  httpMethod: z.enum(['GET', 'POST']).optional().default('POST'),
  contentType: z.enum(['form', 'json']).optional().default('form'),
  auth: z.object({
    type: z.enum(['body', 'query', 'header']),
    field: z.string().min(1),
    prefix: z.string().optional()
  }),
  order: z.object({
    serviceField: z.string().min(1),
    linkField: z.string().min(1),
    quantityField: z.string().min(1),
  }),
  response: z.object({
    orderIdField: z.string().min(1),
    errorField: z.string().min(1),
  }),
  catalog: z.object({
    itemsPath: z.string().optional(),
    serviceIdField: z.string().optional(),
    nameField: z.string().optional(),
    priceField: z.string().optional(),
    minField: z.string().optional(),
    maxField: z.string().optional(),
    typeField: z.string().optional(),
    descField: z.string().optional(),
  }).optional(),
  balance: z.object({
    balancePath: z.string().optional(),
    currencyPath: z.string().optional(),
  }).optional()
});

const providerSchema = z.object({
  name: z.string().min(1, "Название панели обязательно").max(255),
  apiUrl: z.string().url("Некорректный формат URL (укажите полный адрес с https://)"),
  apiKey: z.string().min(1, "API-ключ обязателен"),
  isActive: z.boolean().default(false),
  balanceCurrency: z.string().length(3, "Код валюты должен состоять ровно из 3 букв (например, USD)").toUpperCase(),
  mapping: apiMappingSchema.nullable().optional(),
  ticketUrl: z.string()
    .trim()
    .transform(val => val === "" ? null : val)
    .pipe(
      z.string()
        .url("Некорректный формат URL (укажите полный адрес с https://)")
        .refine(val => val.startsWith("http://") || val.startsWith("https://"), "Разрешены только протоколы http и https")
        .nullable()
    )
    .optional(),
});

const idSchema = z.string().min(1);

/**
 * Maps low-level Prisma errors to human-readable Russian messages (AUD-10).
 */
function mapProviderDbError(err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? (err.meta!.target as string[]).join(', ') : String(err.meta?.target ?? '');
      if (target.includes('name') || target.includes('Provider_name_key')) {
        return 'Панель с таким названием уже подключена. Укажите другое имя.';
      }
      return `Нарушение уникальности данных (${target || err.code}). Проверьте заполненные поля.`;
    }
    if (err.code === 'P2025') {
      return 'Провайдер не найден (возможно, он уже был удалён). Обновите список.';
    }
    if (err.code === 'P2003') {
      return 'Удаление заблокировано: у провайдера есть связанные записи (маршруты). Сначала удалите маршруты.';
    }
  }
  return err instanceof Error ? err.message : String(err);
}

/**
 * AUD-01: Pre-delete summary for the confirmation modal.
 * Counts everything that will be affected by provider deletion.
 */
export async function getProviderDeleteInfoAction(rawId: string) {
  return requireStaffPermission('providers', 'view', async (admin) => {
    try {
      const id = idSchema.parse(rawId);
      const provider = await db.provider.findUnique({
        where: { id },
        select: { id: true, name: true, isActive: true },
      });
      if (!provider) {
        return { success: false as const, error: 'Провайдер не найден' };
      }

      const tenantFilter = admin.tenantId ? { tenantId: admin.tenantId } : {};

      const [services, routes, orders, shadowServices] = await Promise.all([
        db.service.count({ where: { providerId: id, ...tenantFilter } }),
        db.serviceRoute.count({ where: { providerId: id } }),
        db.order.count({ where: { providerId: id, ...tenantFilter } }),
        db.shadowService.count({ where: { providerId: id } }),
      ]);

      return {
        success: true as const,
        provider: { id: provider.id, name: provider.name, isActive: provider.isActive },
        counts: { services, routes, orders, shadowServices },
      };
    } catch (err) {
      return { success: false as const, error: mapProviderDbError(err) };
    }
  });
}

/**
 * AUD-01: Safe provider deletion.
 *
 * Data lifecycle on delete:
 * - ServiceRoute rows for this provider are removed first (FK onDelete: Restrict)
 * - Service.providerId / Order.providerId become NULL (onDelete: SetNull) — rows survive
 * - ShadowService rows are removed automatically (onDelete: Cascade)
 * - Historical order snapshots (providerServiceId, providerCost) are preserved
 */
export async function deleteProviderAction(rawId: string) {
  return requireStaffPermission('providers', 'edit', async (admin) => {
    try {
      const id = idSchema.parse(rawId);

      const provider = await db.provider.findUnique({
        where: { id },
        select: { id: true, name: true },
      });
      if (!provider) {
        return { success: false as const, error: 'Провайдер не найден (возможно, он уже был удалён).' };
      }

      const deleted = await db.$transaction(async (tx) => {
        // 1. Remove routing rules first (they Restrict provider deletion)
        await tx.serviceRoute.deleteMany({ where: { providerId: id } });
        // 2. Delete provider itself. Cascades: ShadowService. SetNull: Service.providerId, Order.providerId.
        return tx.provider.delete({ where: { id } });
      });

      await auditAdminAwaitable({
        adminId: admin.id,
        adminEmail: admin.email,
        action: "PROVIDER_DELETE",
        target: deleted.id,
        targetType: "PROVIDER",
        oldValue: { name: deleted.name, apiUrl: deleted.apiUrl },
        newValue: { deleted: true },
      });

      revalidatePath('/admin/providers');

      return { success: true as const, deletedName: deleted.name };
    } catch (err) {
      return { success: false as const, error: mapProviderDbError(err) };
    }
  });
}

export async function createProvider(rawData: {
  name: string;
  apiUrl: string;
  apiKey: string;
  isActive: boolean;
  balanceCurrency: string;
  ticketUrl?: string;
  mapping?: ApiMappingDTO | null;
}) {
  return requireStaffPermission('providers', 'edit', async (admin) => {
    try {
      const parsed = providerSchema.safeParse(rawData);
      if (!parsed.success) {
        return { 
          success: false as const, 
          errors: parsed.error.flatten().fieldErrors 
        };
      }
      const data = parsed.data;

      const normalizedApiUrl = data.apiUrl.trim().replace(/\/+$/, '');

      // SSRF Protection: Ensure target API URL is not resolving to private/internal IPs
      const { assertSafeUrl } = await import('@/utils/ssrf-guard');
      await assertSafeUrl(normalizedApiUrl);

      // Encrypt the API key before saving!
      const encryptedKey = VaultService.encrypt(data.apiKey);
      
      // Prepare metadata json
      const metadata = {
         mapping: data.mapping || null
      };

      const provider = await db.provider.create({
        data: {
          name: data.name,
          apiUrl: normalizedApiUrl,
          apiKey: encryptedKey,
          isActive: data.isActive,
          balanceCurrency: data.balanceCurrency,
          metadata: metadata,
          ticketUrl: data.ticketUrl || null,
        }
      });

      await auditAdminAwaitable({
        adminId: admin.id,
        adminEmail: admin.email,
        action: "PROVIDER_CREATE",
        target: provider.id,
        targetType: "PROVIDER",
        newValue: { name: provider.name, apiUrl: provider.apiUrl }
      });

      return { success: true as const, error: undefined, providerId: provider.id };
    } catch (err) {
      return { success: false as const, error: mapProviderDbError(err) || 'Ошибка сервера при создании провайдера' };
    }
  });
}

export async function updateProvider(rawId: string, rawData: {
  name: string;
  apiUrl: string;
  apiKey?: string; // If empty, we don't update
  isActive: boolean;
  balanceCurrency: string;
  ticketUrl?: string;
  mapping?: ApiMappingDTO | null;
}) {
  return requireStaffPermission('providers', 'edit', async (admin) => {
    try {
      const id = idSchema.parse(rawId);
      
      // Create an update schema dynamically to allow empty apikey
      const updateSchema = providerSchema.extend({
        apiKey: z.string().optional()
      });
      const parsed = updateSchema.safeParse(rawData);
      if (!parsed.success) {
        return { 
          success: false as const, 
          errors: parsed.error.flatten().fieldErrors 
        };
      }
      const data = parsed.data;
      
      const normalizedApiUrl = data.apiUrl.trim().replace(/\/+$/, '');

      // SSRF Protection: Ensure target API URL is not resolving to private/internal IPs
      const { assertSafeUrl } = await import('@/utils/ssrf-guard');
      await assertSafeUrl(normalizedApiUrl);

      const existing = await db.provider.findUnique({
        where: { id },
        select: { id: true, metadata: true },
      });
      if (!existing) {
        return { success: false as const, error: 'Провайдер не найден (возможно, он уже был удалён). Обновите страницу.' };
      }

      // AUD-10: merge metadata instead of overwriting — preserve foreign keys set by other subsystems
      const existingMeta = (existing.metadata && typeof existing.metadata === 'object'
        ? (existing.metadata as Record<string, unknown>)
        : {}) as Record<string, unknown>;

      const updateData: Record<string, unknown> = {
        name: data.name,
        apiUrl: normalizedApiUrl,
        isActive: data.isActive,
        balanceCurrency: data.balanceCurrency,
        metadata: {
           ...existingMeta,
           mapping: data.mapping || null,
        },
        ticketUrl: data.ticketUrl || null,
      };

      if (data.apiKey && data.apiKey.trim() !== "") {
         updateData.apiKey = VaultService.encrypt(data.apiKey);
      }

      const provider = await db.provider.update({
        where: { id },
        data: updateData
      });

      await auditAdminAwaitable({
        adminId: admin.id,
        adminEmail: admin.email,
        action: "PROVIDER_UPDATE",
        target: provider.id,
        targetType: "PROVIDER",
        newValue: { name: provider.name, isActive: provider.isActive }
      });

      return { success: true as const, error: undefined };
    } catch (err) {
      return { success: false as const, error: mapProviderDbError(err) || 'Ошибка сервера при обновлении провайдера' };
    }
  });
}

export async function checkProviderConnection(rawId: string) {
    return requireStaffPermission('providers', 'view', async () => {
        try {
            const id = idSchema.parse(rawId);
            const providerRecord = await db.provider.findUnique({ where: { id } });
            if (!providerRecord) throw new Error("Provider not found");
            
            const { ProviderDiagnosticService } = await import('@/services/admin/provider-diagnostic.service');
            const decryptedKey = VaultService.decrypt(providerRecord.apiKey) || providerRecord.apiKey;
            const mapping = providerRecord.metadata && typeof providerRecord.metadata === "object" ? ((providerRecord.metadata as Record<string, unknown>).mapping as unknown as ApiMappingDTO | undefined) : undefined;

            const probeResult = await ProviderDiagnosticService.probe(
              providerRecord.apiUrl,
              decryptedKey,
              mapping
            );

            if (!probeResult.success) {
              return { 
                success: false, 
                error: probeResult.errorMessage || "Connection failed",
                suggestedFix: probeResult.suggestedFix,
                suggestedUrl: probeResult.suggestedUrl,
                latencyMs: probeResult.latencyMs
              };
            }
            
            return { 
                success: true, 
                balance: probeResult.balance, 
                currency: probeResult.detectedCurrency || providerRecord.balanceCurrency,
                servicesCount: probeResult.servicesCount,
                latencyMs: probeResult.latencyMs
            };
        } catch (e: unknown) {
            const err = e instanceof Error ? e.message : "Connection failed";
            return { success: false, error: err };
        }
    });
}

export async function probeProviderAction(params: {
  providerId?: string;
  apiUrl?: string;
  apiKey?: string;
  mapping?: ApiMappingDTO | null;
}) {
  return requireStaffPermission('providers', 'view', async () => {
    const { ProviderDiagnosticService } = await import('@/services/admin/provider-diagnostic.service');
    
    let targetUrl = params.apiUrl || '';
    let targetKey = params.apiKey || '';
    let mapping = params.mapping as ApiMappingDTO | undefined;

    if (params.providerId) {
      const p = await db.provider.findUnique({ where: { id: params.providerId } });
      if (p) {
        if (!targetUrl) targetUrl = p.apiUrl;
        if (!targetKey && p.apiKey) {
          targetKey = VaultService.decrypt(p.apiKey) || p.apiKey;
        }
        if (!mapping && p.metadata && typeof p.metadata === 'object') {
          mapping = (p.metadata as Record<string, unknown>).mapping as unknown as ApiMappingDTO | undefined;
        }
      }
    }

    return await ProviderDiagnosticService.probe(targetUrl, targetKey, mapping);
  });
}

export async function getProviderCatalogPreviewAction(params: {
  providerId?: string;
  apiUrl?: string;
  apiKey?: string;
  mapping?: ApiMappingDTO | null;
}) {
  return requireStaffPermission('providers', 'view', async () => {
    let targetUrl = params.apiUrl || '';
    let targetKey = params.apiKey || '';
    let mapping = params.mapping as ApiMappingDTO | undefined;

    if (params.providerId) {
      const p = await db.provider.findUnique({ where: { id: params.providerId } });
      if (p) {
        if (!targetUrl) targetUrl = p.apiUrl;
        if (!targetKey && p.apiKey) {
          targetKey = VaultService.decrypt(p.apiKey) || p.apiKey;
        }
        if (!mapping && p.metadata && typeof p.metadata === 'object') {
          mapping = (p.metadata as Record<string, unknown>).mapping as unknown as ApiMappingDTO | undefined;
        }
      }
    }

    const { ProviderDiagnosticService } = await import('@/services/admin/provider-diagnostic.service');
    const { cleanUrl } = ProviderDiagnosticService.sanitizeUrl(targetUrl);
    const cleanKey = ProviderDiagnosticService.sanitizeKey(targetKey);

    if (!cleanUrl || !cleanKey) {
      return { success: false, error: 'URL и API-ключ обязательны для предпросмотра услуг.' };
    }

    try {
      const { assertSafeUrl } = await import('@/utils/ssrf-guard');
      await assertSafeUrl(cleanUrl);

      const { UniversalProvider } = await import('@/services/providers/universal.provider');
      const instance = new UniversalProvider(cleanUrl, cleanKey, { mapping: mapping || null });
      const services = await instance.getServices();

      return {
        success: true,
        total: services.length,
        services: services.slice(0, 50).map(s => ({
          service: String(s.service),
          name: s.name || 'Без названия',
          category: s.category || 'Общая категория',
          rate: String(s.rate),
          min: String(s.min),
          max: String(s.max),
          type: s.type || 'Default',
        }))
      };
    } catch (err: unknown) {
      const translated = ProviderDiagnosticService.translateError(err, cleanUrl);
      return { success: false, error: translated.message, suggestedFix: translated.suggestedFix };
    }
  });
}

export async function getGlobalProviderLiquidity(forceRefresh = false) {
  return requireStaffPermission('providers', 'view', async () => {
    try {
      const { providerBalanceService } = await import('@/services/admin/provider-balance.service');
      const summary = await providerBalanceService.getGlobalLiquiditySummary(forceRefresh);
      return {
        success: true,
        totalRub: summary.totalRub,
        totalUsd: summary.totalUsd,
        activeCount: summary.activeCount,
        healthyCount: summary.healthyCount,
        warningCount: summary.warningCount,
        criticalCount: summary.criticalCount,
        errorCount: summary.errorCount,
        burnRate24h: summary.burnRate24hRub,
        runwayDays: summary.runwayDays,
        providers: summary.providers,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to calculate global liquidity';
      return { success: false, error: msg };
    }
  });
}

/**
 * Server Action for Zombie Eraser
 * Triggers a manual synchronization of the provider's catalog to find deleted/reappeared services.
 */
export async function syncProviderCatalogAction(rawId: string) {
    return requireStaffPermission('providers', 'edit', async (admin) => {
        try {
            const id = idSchema.parse(rawId);
            const { adminCatalogService } = await import('@/services/admin/catalog.service');
            
            const stats = await adminCatalogService.syncProviderCatalog(id, admin);
            
            return {
                success: true,
                stats
            };
        } catch (e: unknown) {
            const err = e instanceof Error ? e.message : "Connection failed";
            return { success: false, error: err };
        }
    });
}

export async function inferProviderSchema(apiUrl: string, apiKey: string, httpMethod: "GET" | "POST", contentType: "form" | "json", authConfig: ApiMappingDTO["auth"], providerId?: string) {
    return requireStaffPermission('providers', 'edit', async () => {
        try {
            let finalApiKey = apiKey;
            if (!finalApiKey && providerId) {
                const existing = await db.provider.findUnique({ where: { id: providerId } });
                if (existing && existing.apiKey) {
                    finalApiKey = VaultService.decrypt(existing.apiKey);
                }
            }

            const providerService = (await import('@/services/providers/provider.service')).providerService;
            const mockProvider = {
                id: 'mock',
                name: 'Mock',
                apiUrl,
                apiKey: VaultService.encrypt(finalApiKey),
                balanceCurrency: 'USD',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                metadata: {
                    mapping: {
                        httpMethod,
                        contentType,
                        auth: authConfig
                    }
                }
            };
            
            const instance = await providerService.getProviderInstance(mockProvider as unknown as Parameters<typeof providerService.getProviderInstance>[0]);
            const servicesResponse = await (instance as unknown as { request: (body: unknown, idx?: number) => Promise<unknown> }).request({ action: "services" }, 0);
            
            let servicesKeys: string[] = [];
            let itemsPath = '$';
            
            if (Array.isArray(servicesResponse) && servicesResponse.length > 0) {
                servicesKeys = Object.keys(servicesResponse[0]);
            } else if (typeof servicesResponse === 'object' && servicesResponse !== null) {
                for (const [key, val] of Object.entries(servicesResponse)) {
                    if (Array.isArray(val) && val.length > 0) {
                        itemsPath = key;
                        servicesKeys = Object.keys(val[0]);
                        break;
                    }
                }
            }

            const balanceResponse = await (instance as unknown as { request: (body: unknown, idx?: number) => Promise<unknown> }).request({ action: "balance" }, 0);
            let balanceKeys: string[] = [];
            if (typeof balanceResponse === 'object' && balanceResponse !== null) {
                balanceKeys = Object.keys(balanceResponse);
            }

            return {
                success: true,
                schema: {
                    catalog: { itemsPath, keys: servicesKeys },
                    balance: { keys: balanceKeys }
                }
            };
        } catch (e: unknown) {
            const err = e instanceof Error ? e.message : "Connection failed";
            return { success: false, error: err };
        }
    });
}

/**
 * ⚡ Quick Action: Toggle provider active status directly from table.
 */
export async function toggleProviderActiveAction(providerId: string, isActive: boolean) {
  return requireStaffPermission('providers', 'edit', async (admin) => {
    try {
      const id = idSchema.parse(providerId);
      const provider = await db.provider.update({
        where: { id },
        data: { isActive },
      });

      await auditAdminAwaitable({
        adminId: admin.id,
        adminEmail: admin.email,
        action: "PROVIDER_TOGGLE_ACTIVE",
        target: provider.id,
        targetType: "PROVIDER",
        newValue: { isActive: provider.isActive, name: provider.name },
      });

      return { success: true as const, isActive: provider.isActive };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return { success: false as const, error: errMsg };
    }
  });
}

/**
 * 🧹 Quick Action: Reset provider 5-minute error counter back to 0.
 */
export async function resetProviderErrorsAction(providerId: string) {
  return requireStaffPermission('providers', 'edit', async (admin) => {
    try {
      const id = idSchema.parse(providerId);
      const provider = await db.provider.update({
        where: { id },
        data: { errorCount5m: 0 },
      });

      await auditAdminAwaitable({
        adminId: admin.id,
        adminEmail: admin.email,
        action: "PROVIDER_RESET_ERRORS",
        target: provider.id,
        targetType: "PROVIDER",
        newValue: { errorCount5m: 0, name: provider.name },
      });

      return { success: true as const };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return { success: false as const, error: errMsg };
    }
  });
}

/**
 * 🧪 Quick Action: Connect local Mock Provider in 1 click for instant safe testing.
 */
export async function createMockProviderPresetAction() {
  return requireStaffPermission('providers', 'edit', async (admin) => {
    try {
      const existing = await db.provider.findFirst({
        where: { apiUrl: { contains: 'mock-provider' } },
      });

      if (existing) {
        // Just make sure it is active
        await db.provider.update({
          where: { id: existing.id },
          data: { isActive: true, errorCount5m: 0 },
        });
        return { success: true as const, message: "Mock Sandbox уже подключён и активирован!", providerId: existing.id };
      }

      const baseUrl = await getBaseUrlAsync();
      const mockUrl = `${baseUrl}/api/dev/mock-provider`;
      const mockKey = process.env.MOCK_PROVIDER_KEY || 'mock-dev-sandbox-key-2026';
      const encryptedKey = VaultService.encrypt(mockKey);

      const provider = await db.provider.create({
        data: {
          name: "Mock Provider (Песочница API)",
          apiUrl: mockUrl,
          apiKey: encryptedKey,
          isActive: true,
          balanceCurrency: "RUB",
        },
      });

      await auditAdminAwaitable({
        adminId: admin.id,
        adminEmail: admin.email,
        action: "PROVIDER_CREATE_MOCK_PRESET",
        target: provider.id,
        targetType: "PROVIDER",
        newValue: { name: provider.name, apiUrl: provider.apiUrl },
      });

      return { success: true as const, message: "Mock Sandbox успешно создан и активирован!", providerId: provider.id };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return { success: false as const, error: errMsg };
    }
  });
}
