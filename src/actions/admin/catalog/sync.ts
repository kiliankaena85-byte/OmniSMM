'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireStaffPermission } from '@/lib/server/rbac';

export interface GapRow {
  slug: string;
  name: string;
  networkName: string;
  categoryName: string;
  smmplan: { exists: boolean; pricePer1000Cents?: number; isActive?: boolean; serviceId?: string };
  flux:    { exists: boolean; pricePer1000Cents?: number; isActive?: boolean; serviceId?: string };
}

export type GapAnalysisResult = {
  success: boolean;
  rows?: GapRow[];
  stats?: { smmplan: number; flux: number; gap: number; both: number };
  error?: string;
};

export async function getGapAnalysisAction(): Promise<GapAnalysisResult> {
  return requireStaffPermission('CATALOG', 'view', async () => {
    const [smmplanServices, fluxServices] = await Promise.all([
      db.service.findMany({
        where: { tenantId: 'smmplan' },
        select: {
          id: true,
          slug: true,
          name: true,
          pricePer1000Cents: true,
          isActive: true,
          category: {
            select: {
              name: true,
              network: { select: { name: true } },
            },
          },
        },
      }),
      db.service.findMany({
        where: { tenantId: 'flux' },
        select: {
          id: true,
          slug: true,
          name: true,
          pricePer1000Cents: true,
          isActive: true,
          category: {
            select: {
              name: true,
              network: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    const map = new Map<string, GapRow>();

    for (const s of smmplanServices) {
      if (!s.slug) continue;
      map.set(s.slug, {
        slug: s.slug,
        name: s.name,
        networkName: s.category?.network?.name ?? '',
        categoryName: s.category?.name ?? '',
        smmplan: { exists: true, pricePer1000Cents: s.pricePer1000Cents, isActive: s.isActive, serviceId: s.id },
        flux: { exists: false },
      });
    }

    for (const s of fluxServices) {
      if (!s.slug) continue;
      const existing = map.get(s.slug);
      if (existing) {
        existing.flux = { exists: true, pricePer1000Cents: s.pricePer1000Cents, isActive: s.isActive, serviceId: s.id };
      } else {
        map.set(s.slug, {
          slug: s.slug,
          name: s.name,
          networkName: s.category?.network?.name ?? '',
          categoryName: s.category?.name ?? '',
          smmplan: { exists: false },
          flux: { exists: true, pricePer1000Cents: s.pricePer1000Cents, isActive: s.isActive, serviceId: s.id },
        });
      }
    }

    const rows = Array.from(map.values());
    const stats = {
      smmplan: smmplanServices.length,
      flux: fluxServices.length,
      both: rows.filter((r) => r.smmplan.exists && r.flux.exists).length,
      gap: rows.filter((r) => !r.smmplan.exists || !r.flux.exists).length,
    };

    return { success: true, rows, stats };
  });
}

const copySchema = z.object({
  serviceIds: z.array(z.string()).min(1).max(200),
  sourceTenantId: z.enum(['smmplan', 'flux']),
  targetTenantId: z.enum(['smmplan', 'flux']),
  markupMultiplier: z.number().min(0.5).max(5.0).default(1.0),
});

export type CopyResult = {
  success: boolean;
  copied?: number;
  skipped?: number;
  errors?: string[];
  error?: string;
};

export async function copyServicesToTenantAction(input: z.infer<typeof copySchema>): Promise<CopyResult> {
  return requireStaffPermission('CATALOG', 'edit', async () => {
    const parsed = copySchema.parse(input);
    if (parsed.sourceTenantId === parsed.targetTenantId) {
      return { success: false, copied: 0, skipped: 0, errors: ['Source and target must differ'], error: 'Source and target must differ' };
    }

    const sources = await db.service.findMany({
      where: { id: { in: parsed.serviceIds }, tenantId: parsed.sourceTenantId },
    });

    let copied = 0;
    const skipped: string[] = [];
    const errors: string[] = [];

    // Chunk by 50
    for (let i = 0; i < sources.length; i += 50) {
      const chunk = sources.slice(i, i + 50);
      await db.$transaction(async (tx) => {
        for (const src of chunk) {
          if (!src.slug) continue;
          try {
            const exists = await tx.service.findUnique({
              where: { tenantId_slug: { tenantId: parsed.targetTenantId, slug: src.slug } },
            });
            if (exists) {
              skipped.push(src.name);
              continue;
            }
            await tx.service.create({
              data: {
                tenantId: parsed.targetTenantId,
                slug: src.slug,
                name: src.name,
                description: src.description ?? undefined,
                categoryId: src.categoryId,
                providerId: src.providerId ?? undefined,
                externalId: src.externalId ?? undefined,
                rate: src.rate,
                providerCurrency: src.providerCurrency,
                markup: Math.round(src.markup * parsed.markupMultiplier * 100) / 100,
                minQty: src.minQty,
                maxQty: src.maxQty,
                targetType: src.targetType ?? 'POST',
                isActive: src.isActive,
                pricePer1000Cents: Math.round(src.pricePer1000Cents * parsed.markupMultiplier),
              },
            });
            copied++;
          } catch (e: unknown) {
            const errMsg = e instanceof Error ? e.message : String(e);
            errors.push(`${src.name}: ${errMsg}`);
          }
        }
      });
    }

    revalidatePath('/admin/catalog/sync');
    return { success: true, copied, skipped: skipped.length, errors };
  });
}

const alignSchema = z.object({
  slugs: z.array(z.string()).min(1).max(500),
  sourceTenantId: z.enum(['smmplan', 'flux']),
  targetTenantId: z.enum(['smmplan', 'flux']),
  markupMultiplier: z.number().min(0.5).max(5.0).default(1.0),
});

export type AlignResult = {
  success: boolean;
  updated?: number;
  error?: string;
};

export async function alignPricesAction(input: z.infer<typeof alignSchema>): Promise<AlignResult> {
  return requireStaffPermission('CATALOG', 'edit', async () => {
    const parsed = alignSchema.parse(input);

    const sourceServices = await db.service.findMany({
      where: { tenantId: parsed.sourceTenantId, slug: { in: parsed.slugs } },
      select: { slug: true, pricePer1000Cents: true, rate: true, providerCurrency: true },
    });

    let updated = 0;
    for (let i = 0; i < sourceServices.length; i += 50) {
      const chunk = sourceServices.slice(i, i + 50);
      await db.$transaction(async (tx) => {
        for (const src of chunk) {
          if (!src.slug) continue;
          const target = await tx.service.findUnique({
            where: { tenantId_slug: { tenantId: parsed.targetTenantId, slug: src.slug } },
          });
          if (!target) continue;

          const targetPrice = Math.round(src.pricePer1000Cents * parsed.markupMultiplier);
          const newMarkup =
            target.rate > 0
              ? Math.round((targetPrice / (target.rate * 100)) * 100) / 100
              : target.markup;

          await tx.service.update({
            where: { id: target.id },
            data: { pricePer1000Cents: targetPrice, markup: newMarkup },
          });
          updated++;
        }
      });
    }

    revalidatePath('/admin/catalog/sync');
    return { success: true, updated };
  });
}
