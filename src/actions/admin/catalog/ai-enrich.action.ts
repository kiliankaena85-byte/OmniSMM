'use server';

import { requireStaffPermission } from "@/lib/server/rbac";
import { aiCatalogEnricherService, RawServiceToEnrich } from "@/services/admin/ai-catalog-enricher.service";
import { db } from "@/lib/db";
import { handleServerError } from "@/utils/error-handler";
import { revalidatePath } from "next/cache";

/**
 * Server Action: Предварительный просмотр обогащения услуги через Gemini 3 Flash.
 */
export async function previewServiceAiEnrichAction(raw: RawServiceToEnrich) {
  return requireStaffPermission('catalog', 'edit', async () => {
    try {
      const enriched = await aiCatalogEnricherService.enrichService(raw);
      return { success: true, data: enriched };
    } catch (e) {
      const localized = handleServerError(e);
      return { success: false, error: localized.message };
    }
  });
}

/**
 * Server Action: Пакетное обновление и стандартизация услуг в базе через Gemini 3 Flash.
 */
export async function batchEnrichExistingServicesAction(serviceIds: string[]) {
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    try {
      if (!serviceIds || serviceIds.length === 0) {
        return { success: false, error: "Не выбраны услуги для обработки" };
      }

      const tenantFilter = admin.tenantId ? { tenantId: admin.tenantId } : {};

      const services = await db.service.findMany({
        where: { id: { in: serviceIds }, ...tenantFilter },
        include: { category: { include: { network: true } } }
      });

      let updatedCount = 0;

      for (const srv of services) {
        const enriched = await aiCatalogEnricherService.enrichService({
          name: srv.name,
          description: srv.description,
          categoryName: srv.category?.name,
          networkName: srv.category?.network?.name,
          rateUsd: srv.providerCurrency === 'RUB' ? Number((srv.rate / 90).toFixed(4)) : srv.rate,
          minQty: srv.minQty,
          maxQty: srv.maxQty,
          isRefillEnabled: srv.isRefillEnabled,
        });

        await db.service.update({
          where: { id: srv.id },
          data: {
            name: enriched.cleanTitle,
            description: enriched.fullDescriptionMarkdown,
            targetType: enriched.targetType,
            clientRequirement: enriched.clientRequirement,
            isRefillEnabled: enriched.isRefillConfirmed,
          }
        });

        updatedCount++;
      }

      revalidatePath('/admin/catalog');
      revalidatePath('/');
      revalidatePath('/dashboard/new-order');

      return { success: true, updatedCount };
    } catch (e) {
      const localized = handleServerError(e);
      return { success: false, error: localized.message };
    }
  });
}
