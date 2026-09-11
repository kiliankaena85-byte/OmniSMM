'use server';

import { db } from "@/lib/db";
import { requireStaffPermission } from "@/lib/server/rbac";
import { SafeRegexValidator } from "@/services/analyzer/safe-regex.validator";
import { AiRegexGenerator } from "@/services/analyzer/ai-regex-generator";
import { UrlCleaner } from "@/services/analyzer/url-cleaner";
import { revalidatePath } from "next/cache";

export interface PatternDTO {
  id: string;
  networkId: string;
  networkName: string;
  pattern: string;
  contentType: string;
  sort: number;
  createdAt: string;
}

/**
 * Fetch all configured URL patterns grouped by Network
 */
export async function getLinkPatternsAction(networkId?: string) {
  return requireStaffPermission('catalog', 'view', async () => {
    const patterns = await db.urlPattern.findMany({
      where: networkId ? { networkId } : undefined,
      include: {
        network: {
          select: { id: true, name: true, slug: true }
        }
      },
      orderBy: [
        { network: { name: 'asc' } },
        { sort: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    const networks = await db.network.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' }
    });

    const formatted: PatternDTO[] = patterns.map(p => ({
      id: p.id,
      networkId: p.networkId,
      networkName: p.network.name,
      pattern: p.pattern,
      contentType: p.contentType,
      sort: p.sort,
      createdAt: p.createdAt.toISOString()
    }));

    return {
      success: true,
      data: {
        patterns: formatted,
        networks
      }
    };
  });
}

/**
 * Create or update a URL pattern with ReDoS validation
 */
export async function saveLinkPatternAction(input: {
  id?: string;
  networkId: string;
  pattern: string;
  contentType: string;
  sort?: number;
}) {
  return requireStaffPermission('catalog', 'edit', async () => {
    const { id, networkId, pattern, contentType, sort = 0 } = input;

    if (!networkId || !pattern || !contentType) {
      return { success: false, error: 'Заполните обязательные поля: Соцсеть, Паттерн и Тип контента' };
    }

    // 1. Audit regex security
    const audit = SafeRegexValidator.staticAudit(pattern);
    if (!audit.isSafe) {
      return { success: false, error: audit.reason || 'Небезопасное регулярное выражение' };
    }

    // 2. Test compilation
    try {
      new RegExp(pattern, 'i');
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      return { success: false, error: `Синтаксическая ошибка в RegEx: ${err}` };
    }

    if (id) {
      await db.urlPattern.update({
        where: { id },
        data: {
          networkId,
          pattern: pattern.trim(),
          contentType: contentType.trim().toLowerCase(),
          sort
        }
      });
    } else {
      await db.urlPattern.create({
        data: {
          networkId,
          pattern: pattern.trim(),
          contentType: contentType.trim().toLowerCase(),
          sort
        }
      });
    }

    revalidatePath('/admin/catalog/patterns');
    revalidatePath('/admin/catalog');

    return { success: true };
  });
}

/**
 * Delete a pattern
 */
export async function deleteLinkPatternAction(id: string) {
  return requireStaffPermission('catalog', 'edit', async () => {
    if (!id) return { success: false, error: 'ID паттерна не передан' };

    await db.urlPattern.delete({
      where: { id }
    });

    revalidatePath('/admin/catalog/patterns');
    revalidatePath('/admin/catalog');

    return { success: true };
  });
}

/**
 * Live test of a pattern against a sample URL (Live Sandbox)
 */
export async function testLinkPatternAction(input: {
  pattern: string;
  sampleUrl: string;
}) {
  return requireStaffPermission('catalog', 'view', async () => {
    const { pattern, sampleUrl } = input;

    const cleanedUrl = UrlCleaner.clean(sampleUrl);
    const testResult = SafeRegexValidator.testPattern(pattern, cleanedUrl);

    return {
      success: true,
      data: {
        ...testResult,
        cleanedUrl
      }
    };
  });
}

/**
 * AI-powered Regex Generation via gemini-3-flash
 */
export async function generateAiPatternAction(input: {
  platformName: string;
  sampleUrls: string[];
  contentTypeHint?: string;
}) {
  return requireStaffPermission('catalog', 'edit', async () => {
    try {
      const cleanedUrls = input.sampleUrls.map(u => UrlCleaner.clean(u)).filter(Boolean);
      if (cleanedUrls.length === 0) {
        return { success: false, error: 'Введите хотя бы один пример ссылки' };
      }

      const generated = await AiRegexGenerator.generate({
        platformName: input.platformName,
        sampleUrls: cleanedUrls,
        contentTypeHint: input.contentTypeHint
      });

      return {
        success: true,
        data: generated
      };
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      return { success: false, error: err };
    }
  });
}

/**
 * Dry-run testing against historical order links
 */
export async function dryRunHistoryAction(pattern: string, limit: number = 200) {
  return requireStaffPermission('catalog', 'view', async (admin) => {
    const audit = SafeRegexValidator.staticAudit(pattern);
    if (!audit.isSafe) {
      return { success: false, error: audit.reason };
    }

    let regex: RegExp;
    try {
      regex = new RegExp(pattern, 'i');
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      return { success: false, error: `Ошибка регулярного выражения: ${err}` };
    }

    const tenantFilter = admin.tenantId ? { tenantId: admin.tenantId } : {};

    const orders = await db.order.findMany({
      where: { link: { not: '' }, ...tenantFilter },
      select: { id: true, link: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500)
    });

    const startTime = performance.now();
    let matchCount = 0;
    const matches: Array<{ orderId: string; url: string; matchGroups: string[] }> = [];

    for (const ord of orders) {
      const cleaned = UrlCleaner.clean(ord.link);
      const m = cleaned.match(regex);
      if (m) {
        matchCount++;
        if (matches.length < 10) {
          matches.push({
            orderId: ord.id,
            url: ord.link,
            matchGroups: m.slice(1)
          });
        }
      }
    }
    const endTime = performance.now();
    const durationMs = Number((endTime - startTime).toFixed(2));

    return {
      success: true,
      data: {
        totalTested: orders.length,
        matchCount,
        matchRate: orders.length > 0 ? Number(((matchCount / orders.length) * 100).toFixed(1)) : 0,
        executionTimeMs: durationMs,
        sampleMatches: matches
      }
    };
  });
}
