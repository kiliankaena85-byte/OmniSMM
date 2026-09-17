'use server';

import { db } from "@/lib/db";
import { requireStaffPermission } from "@/lib/server/rbac";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { auditAdmin, auditAdminAwaitable } from "@/lib/admin-audit";
import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { revalidateCatalogCache } from "./revalidate";
import { SettingsProvider } from "@/lib/settings";
import { applyBeautifulRounding } from "@/lib/financial-constants";
import { inferTargetTypeFromCategory } from "@/utils/target-type";
import { validateRegexSafetyAndSmoke } from "@/validators/link-mutators";
import { normalizeIconDescriptor } from "@/lib/icons/safe-svg";
import { getUnifiedLinkSpecification } from "@/services/link-engine/link-rules-registry";

export async function ensureTaxonomyTenantAccess(categoryId: string) {
  return requireStaffPermission('CATALOG', 'edit', async (admin) => {
    const category = await db.category.findUnique({
      where: { id: categoryId },
      select: { id: true, tenantId: true, networkId: true }
    });
    if (category && category.tenantId !== 'all') {
      await db.$transaction(async (tx) => {
        await tx.category.update({
          where: { id: categoryId },
          data: { tenantId: 'all' }
        });
        if (category.networkId) {
          await tx.network.update({
            where: { id: category.networkId },
            data: { tenantId: 'all' }
          });
        }
      });
      if (category.networkId) {
        await auditAdminAwaitable({
          adminId: admin.id,
          adminEmail: admin.email,
          action: 'UPDATE_NETWORK_TENANT_ACCESS',
          target: category.networkId,
          targetType: 'NETWORK',
          newValue: { to: 'all', triggeredByCategoryId: categoryId },
        });
      }
      await auditAdminAwaitable({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'UPDATE_CATEGORY_TENANT_ACCESS',
        target: categoryId,
        targetType: 'CATEGORY',
        newValue: { from: category.tenantId, to: 'all', networkId: category.networkId },
      });
    }
  });
}

// Validation schema for manual Service CRUD operations
const serviceSchema = z.object({
  tenantId: z.enum(["smmplan", "flux"]).default("smmplan"),
  name: z.string().min(1, "Название услуги обязательно").max(255, "Название слишком длинное"),
  description: z.string().optional().nullable(),
  icon: z.string().max(35000, "Icon payload too large").optional().nullable(),
  categoryId: z.string().min(1, "Категория обязательна"),
  providerId: z.string().optional().nullable(),
  rate: z.coerce.number().min(0, "Тариф провайдера должен быть больше или равен 0"),
  markup: z.coerce.number().min(1.0, "Наценка должна быть не менее 1.0"),
  minQty: z.coerce.number().int().min(1, "Минимальное количество должно быть не менее 1"),
  maxQty: z.coerce.number().int().min(1, "Максимальное количество должно быть не менее 1"),
  externalId: z.string().optional().nullable(),
  targetType: z.string().optional().nullable(),
  qualityTier: z.enum(["ECONOMY", "STANDARD", "PREMIUM", "VIP", "AUTO"]).default("STANDARD"),
  customDataType: z.string().default("NONE"),
  customDataLabel: z.string().max(100, "Название подсказки не должно превышать 100 символов").optional().nullable(),
  isMediaGroupAware: z.coerce.boolean().default(false),
  linkValidatorRegex: z.string().optional().nullable(),
  linkPlaceholder: z.string().max(255, "Пример ссылки слишком длинный").optional().nullable(),
  linkHint: z.string().max(500, "Подсказка слишком длинная").optional().nullable(),
  requiresBotAdmin: z.coerce.boolean().default(false),
  isDripFeedEnabled: z.coerce.boolean().default(true),
  isRefillEnabled: z.coerce.boolean().default(false),
  isCancelEnabled: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
  requireWarning: z.coerce.boolean().default(false),
  warningMessage: z.string().max(1000, "Предупреждение слишком длинное").optional().nullable(),
  clientRequirement: z.string().max(2000, "Требование слишком длинное").optional().nullable(),
  clientConfirmation: z.string().max(200, "Текст подтверждения слишком длинный").optional().nullable()
});

/**
 * Manually create a new catalog Service
 */
export async function createServiceAction(rawData: unknown) {
  return requireStaffPermission('CATALOG', 'edit', async (admin) => {
    const parsed = serviceSchema.safeParse(rawData);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.errors[0]?.message || 'Неверные данные услуги' };
    }
    const data = parsed.data;

    // Verify category exists and ensure taxonomy is accessible to all tenants
    const category = await db.category.findUnique({
      where: { id: data.categoryId },
      include: { network: true }
    });
    if (!category) {
      return { success: false as const, error: 'Указанная категория не найдена' };
    }
    await ensureTaxonomyTenantAccess(data.categoryId);

    const slugCandidate = data.name.toLowerCase().trim().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-+|-+$/g, '') || `service-${Date.now()}`;
    const existingSlugService = await db.service.findFirst({
      where: { tenantId: data.tenantId, slug: slugCandidate }
    });
    if (existingSlugService) {
      return { success: false as const, error: 'Услуга уже существует для выбранного сайта' };
    }

    // Verify provider exists if provided
    let providerCurrency = 'USD';
    if (data.providerId) {
      const provider = await db.provider.findUnique({
        where: { id: data.providerId }
      });
      if (!provider) {
        return { success: false as const, error: 'Указанный провайдер SMM не найден' };
      }
      providerCurrency = provider.balanceCurrency;
    }

    // Infer targetType if not provided
    let targetType = data.targetType;
    if (!targetType) {
      targetType = inferTargetTypeFromCategory(category.name);
    }

    // Unified Link Engine auto-specification (SIL-2026)
    const linkSpec = getUnifiedLinkSpecification(
      category.network?.slug || '',
      targetType,
      category.activityType || ''
    );

    const effectiveLinkValidatorRegex = data.linkValidatorRegex || linkSpec.regex || null;
    const effectiveLinkPlaceholder = data.linkPlaceholder || linkSpec.placeholder || null;
    const effectiveLinkHint = data.linkHint || linkSpec.hint || null;
    const effectiveClientRequirement = data.clientRequirement || linkSpec.clientRequirement || null;
    const effectiveRequiresBotAdmin = data.requiresBotAdmin || linkSpec.requiresBotAdmin || false;
    const effectiveCustomDataType = data.customDataType !== "NONE" ? data.customDataType : (linkSpec.customDataType || "NONE");
    const effectiveCustomDataLabel = data.customDataLabel || linkSpec.customDataLabel || null;
    const effectiveIsMediaGroupAware = data.isMediaGroupAware || (linkSpec.isMediaGroupAware ?? false);

    // Validate link regex safety (ReDoS check)
    if (effectiveLinkValidatorRegex) {
      const regexAudit = validateRegexSafetyAndSmoke(effectiveLinkValidatorRegex);
      if (!regexAudit.isValid) {
        return { success: false as const, error: regexAudit.error || 'Некорректное или небезопасное регулярное выражение' };
      }
    }

    // Calculate pricePer1000Cents dynamically using CBR exchange rate
    const usdToRub = await SettingsProvider.getExchangeRateUSD();
    const exchangeRate = providerCurrency === 'RUB' ? 1.0 : usdToRub;
    const pricePer1000Cents = Math.round(applyBeautifulRounding(data.rate * data.markup * exchangeRate) * 100);

    // Normalize and sanitize icon
    const iconResult = normalizeIconDescriptor(data.icon);
    if (!iconResult.success) {
      return { success: false as const, error: iconResult.error || 'Некорректная иконка' };
    }

    // Atomically create the service
    const service = await db.$transaction(async (tx) => {
      return await tx.service.create({
        data: {
          tenantId: data.tenantId,
          slug: slugCandidate,
          name: data.name,
          description: data.description,
          icon: iconResult.normalized,
          categoryId: data.categoryId,
          providerId: data.providerId,
          rate: data.rate,
          markup: data.markup,
          minQty: data.minQty,
          maxQty: data.maxQty,
          externalId: data.externalId,
          targetType: targetType,
          qualityTier: data.qualityTier,
          customDataType: effectiveCustomDataType,
          customDataLabel: effectiveCustomDataLabel,
          isMediaGroupAware: effectiveIsMediaGroupAware,
          linkValidatorRegex: effectiveLinkValidatorRegex,
          linkPlaceholder: effectiveLinkPlaceholder,
          linkHint: effectiveLinkHint,
          requiresBotAdmin: effectiveRequiresBotAdmin,
          isDripFeedEnabled: data.isDripFeedEnabled,
          isRefillEnabled: data.isRefillEnabled,
          isCancelEnabled: data.isCancelEnabled,
          isActive: data.isActive,
          requireWarning: data.requireWarning,
          warningMessage: data.warningMessage,
          clientRequirement: effectiveClientRequirement,
          clientConfirmation: data.clientConfirmation,
          providerCurrency,
          pricePer1000Cents
        }
      });
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SERVICE_MANUAL_CREATE',
      target: service.id,
      targetType: 'SERVICE',
      newValue: {
        name: service.name,
        categoryId: service.categoryId,
        rate: service.rate,
        markup: service.markup,
        pricePer1000Cents: service.pricePer1000Cents,
        requireWarning: service.requireWarning,
        warningMessage: service.warningMessage,
        clientRequirement: service.clientRequirement,
        clientConfirmation: service.clientConfirmation
      }
    });

    revalidatePath("/admin/catalog");
    revalidateTag("catalog", 'default');
    revalidateTag("services", 'default');
    revalidateTag(`catalog-${data.tenantId}`, 'default');
    revalidateTag(`services-${data.tenantId}`, 'default');

    revalidateCatalogCache();
    return { success: true as const, serviceId: service.id };
  });
}

/**
 * Manually update an existing catalog Service
 */
export async function updateServiceAction(id: string, rawData: unknown) {
  return requireStaffPermission('CATALOG', 'edit', async (admin) => {
    if (!id || typeof id !== 'string') {
      return { success: false as const, error: 'ID услуги обязателен' };
    }

    const parsed = serviceSchema.safeParse(rawData);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.errors[0]?.message || 'Неверные данные услуги' };
    }
    const data = parsed.data;

    // Verify service exists
    const service = await db.service.findUnique({
      where: { id }
    });
    if (!service) {
      return { success: false as const, error: 'Услуга не найдена' };
    }

    // Verify category exists
    const category = await db.category.findUnique({
      where: { id: data.categoryId }
    });
    if (!category) {
      return { success: false as const, error: 'Указанная категория не найдена' };
    }
    await ensureTaxonomyTenantAccess(data.categoryId);

    // Verify provider exists if provided
    let providerCurrency = service.providerCurrency;
    if (data.providerId) {
      const provider = await db.provider.findUnique({
        where: { id: data.providerId }
      });
      if (!provider) {
        return { success: false as const, error: 'Указанный провайдер SMM не найден' };
      }
      providerCurrency = provider.balanceCurrency;
    }

    // Infer targetType if not provided
    let targetType = data.targetType;
    if (!targetType) {
      targetType = inferTargetTypeFromCategory(category.name);
    }

    // Validate link regex safety (ReDoS check)
    if (data.linkValidatorRegex) {
      const regexAudit = validateRegexSafetyAndSmoke(data.linkValidatorRegex);
      if (!regexAudit.isValid) {
        return { success: false as const, error: regexAudit.error || 'Некорректное или небезопасное регулярное выражение' };
      }
    }

    // For API-bound services (VexBoost/SMM panels), rate, minQty, and maxQty are authoritative from the upstream provider API sync
    const isApiBound = Boolean((service.providerId && service.externalId) || (data.providerId && data.externalId));
    const effectiveRate = isApiBound && service.rate > 0 ? service.rate : data.rate;
    const effectiveMinQty = isApiBound && service.minQty > 0 ? service.minQty : data.minQty;
    const effectiveMaxQty = isApiBound && service.maxQty > 0 ? service.maxQty : data.maxQty;

    // Recalculate pricePer1000Cents dynamically using CBR exchange rate
    const usdToRub = await SettingsProvider.getExchangeRateUSD();
    const exchangeRate = providerCurrency === 'RUB' ? 1.0 : usdToRub;
    const pricePer1000Cents = Math.round(applyBeautifulRounding(effectiveRate * data.markup * exchangeRate) * 100);

    // Normalize and sanitize icon
    const iconResult = normalizeIconDescriptor(data.icon);
    if (!iconResult.success) {
      return { success: false as const, error: iconResult.error || 'Некорректная иконка' };
    }

    // Check if name or description were customized
    const isCustomName = data.name !== service.name ? true : service.isCustomName;
    const isCustomDescription = data.description !== service.description ? true : service.isCustomDescription;

    // Atomically update the service
    const updatedService = await db.$transaction(async (tx) => {
      return await tx.service.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          icon: iconResult.normalized,
          isCustomName,
          isCustomDescription,
          categoryId: data.categoryId,
          providerId: data.providerId,
          rate: effectiveRate,
          markup: data.markup,
          minQty: effectiveMinQty,
          maxQty: effectiveMaxQty,
          externalId: data.externalId,
          targetType: targetType,
          qualityTier: data.qualityTier,
          customDataType: data.customDataType,
          customDataLabel: data.customDataLabel,
          isMediaGroupAware: data.isMediaGroupAware,
          linkValidatorRegex: data.linkValidatorRegex,
          linkPlaceholder: data.linkPlaceholder,
          linkHint: data.linkHint,
          requiresBotAdmin: data.requiresBotAdmin,
          isDripFeedEnabled: data.isDripFeedEnabled,
          isRefillEnabled: data.isRefillEnabled,
          isCancelEnabled: data.isCancelEnabled,
          isActive: data.isActive,
          requireWarning: data.requireWarning,
          warningMessage: data.warningMessage,
          clientRequirement: data.clientRequirement,
          clientConfirmation: data.clientConfirmation,
          providerCurrency,
          pricePer1000Cents
        }
      });
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SERVICE_MANUAL_UPDATE',
      target: id,
      targetType: 'SERVICE',
      oldValue: {
        name: service.name,
        categoryId: service.categoryId,
        rate: service.rate,
        markup: service.markup,
        pricePer1000Cents: service.pricePer1000Cents,
        requireWarning: service.requireWarning,
        warningMessage: service.warningMessage
      },
      newValue: {
        name: updatedService.name,
        categoryId: updatedService.categoryId,
        rate: updatedService.rate,
        markup: updatedService.markup,
        pricePer1000Cents: updatedService.pricePer1000Cents,
        requireWarning: updatedService.requireWarning,
        warningMessage: updatedService.warningMessage,
        clientRequirement: updatedService.clientRequirement,
        clientConfirmation: updatedService.clientConfirmation
      }
    });

    revalidatePath("/admin/catalog");
    revalidatePath("/", "layout");
    revalidatePath("/services", "layout");
    revalidateTag("catalog", 'default');
    revalidateTag("services", 'default');
    revalidateTag("catalog-smmplan", 'default');
    revalidateTag("catalog-flux", 'default');
    revalidateTag("networks-smmplan", 'default');
    revalidateTag("networks-flux", 'default');
    if (updatedService.categoryId) {
      revalidateTag(`category-${updatedService.categoryId}-smmplan`, 'default');
      revalidateTag(`category-${updatedService.categoryId}-flux`, 'default');
    }

    revalidateCatalogCache();
    return { success: true as const, serviceId: updatedService.id };
  });
}

/**
 * Safe Delete or Archive Service
 * If 0 orders exist -> Hard delete from PostgreSQL
 * If orders exist -> Soft archive (isActive=false, [АРХИВ] prefix) to preserve historical transactions
 */
export async function deleteOrArchiveServiceAction(id: string) {
  return requireStaffPermission('CATALOG', 'edit', async (admin) => {
    if (!id || typeof id !== 'string') {
      return { success: false as const, error: 'ID услуги обязателен' };
    }

    const service = await db.service.findUnique({
      where: { id },
      select: { id: true, name: true, tenantId: true, isActive: true, _count: { select: { orders: true } } }
    });

    if (!service) {
      return { success: false as const, error: 'Услуга не найдена' };
    }

    const orderCount = service._count.orders;

    if (orderCount === 0) {
      // Safe Hard Delete: No FK constraints broken
      try {
        await db.service.delete({ where: { id } });

        await auditAdminAwaitable({
          adminId: admin.id,
          adminEmail: admin.email,
          action: 'SERVICE_DELETE',
          target: id,
          targetType: 'SERVICE',
          oldValue: { name: service.name, isActive: service.isActive },
          newValue: { deleted: true }
        });

        revalidatePath("/admin/catalog");
        revalidatePath("/admin/catalog/tree");
        revalidateTag("catalog", 'default');
        revalidateTag("services", 'default');
        if (service.tenantId) {
          revalidateTag(`catalog-${service.tenantId}`, 'default');
          revalidateTag(`services-${service.tenantId}`, 'default');
        }

        revalidateCatalogCache();
        return { 
          success: true as const, 
          action: 'DELETED' as const, 
          message: `Услуга «${service.name}» полностью удалена (0 заказов).` 
        };
      } catch (delErr) {
        console.warn(`[Catalog] Hard delete failed for service ${id}, falling back to soft archive:`, delErr);
        // Fallback to Soft Archive if secondary FK prevents delete
        const archivedName = service.name.startsWith('[АРХИВ] ')
          ? service.name
          : `[АРХИВ] ${service.name}`;

        await db.service.update({
          where: { id },
          data: {
            isActive: false,
            name: archivedName,
            cooldownReason: null,
            cooldownUntil: null,
          }
        });

        await auditAdminAwaitable({
          adminId: admin.id,
          adminEmail: admin.email,
          action: 'SERVICE_ARCHIVE',
          target: id,
          targetType: 'SERVICE',
          oldValue: { name: service.name, isActive: service.isActive },
          newValue: { name: archivedName, isActive: false, archived: true }
        });

        revalidatePath("/admin/catalog");
        revalidatePath("/admin/catalog/tree");
        revalidateTag("catalog", 'default');
        revalidateTag("services", 'default');

        revalidateCatalogCache();
        return { 
          success: true as const, 
          action: 'ARCHIVED' as const, 
          message: `Услуга «${service.name}» деактивирована и перенесена в архив.` 
        };
      }
    } else {
      // Safe Soft Archive: Keeps foreign key integrity
      const archivedName = service.name.startsWith('[АРХИВ] ')
        ? service.name
        : `[АРХИВ] ${service.name}`;

      await db.service.update({
        where: { id },
        data: {
          isActive: false,
          name: archivedName,
          cooldownReason: null,
          cooldownUntil: null,
        }
      });

      await auditAdminAwaitable({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'SERVICE_ARCHIVE',
        target: id,
        targetType: 'SERVICE',
        oldValue: { name: service.name, isActive: service.isActive },
        newValue: { name: archivedName, isActive: false, archived: true }
      });

      revalidatePath("/admin/catalog");
      revalidatePath("/admin/catalog/tree");
      revalidateTag("catalog", 'default');
      revalidateTag("services", 'default');

      revalidateCatalogCache();
      return { 
        success: true as const, 
        action: 'ARCHIVED' as const, 
        message: `Услуга «${service.name}» перенесена в архив (содержит ${orderCount} заказов).` 
      };
    }
  });
}

/**
 * Quick toggle active/inactive status
 */
export async function toggleServiceStatusAction(id: string, isActive: boolean) {
  return requireStaffPermission('CATALOG', 'edit', async (admin) => {
    if (!id || typeof id !== 'string') {
      return { success: false as const, error: 'ID услуги обязателен' };
    }

    const service = await db.service.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true }
    });

    if (!service) {
      return { success: false as const, error: 'Услуга не найдена' };
    }

    await db.service.update({
      where: { id },
      data: { isActive }
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: isActive ? 'SERVICE_ENABLE' : 'SERVICE_DISABLE',
      target: id,
      targetType: 'SERVICE',
      oldValue: { isActive: service.isActive },
      newValue: { isActive }
    });

    revalidatePath("/admin/catalog");
    revalidatePath("/admin/catalog/tree");
    revalidateTag("catalog", 'default');
    revalidateTag("services", 'default');

    revalidateCatalogCache();
    return { success: true as const, isActive };
  });
}

/**
 * Bulk Delete or Archive Services
 */
export async function bulkDeleteOrArchiveServicesAction(serviceIds: string[]) {
  return requireStaffPermission('CATALOG', 'edit', async (admin) => {
    if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
      return { success: false as const, error: 'Выберите хотя бы одну услугу' };
    }

    let deletedCount = 0;
    let archivedCount = 0;

    for (const id of serviceIds) {
      const service = await db.service.findUnique({
        where: { id },
        select: { id: true, name: true, isActive: true, _count: { select: { orders: true } } }
      });

      if (!service) continue;

      if (service._count.orders === 0) {
        await db.service.delete({ where: { id } });
        deletedCount++;
      } else {
        const archivedName = service.name.startsWith('[АРХИВ] ')
          ? service.name
          : `[АРХИВ] ${service.name}`;

        await db.service.update({
          where: { id },
          data: {
            isActive: false,
            name: archivedName,
            cooldownReason: null,
            cooldownUntil: null,
          }
        });
        archivedCount++;
      }
    }

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SERVICE_BULK_DELETE_OR_ARCHIVE',
      target: 'BULK',
      targetType: 'SERVICE',
      newValue: { deletedCount, archivedCount, total: serviceIds.length }
    });

    revalidatePath("/admin/catalog");
    revalidatePath("/admin/catalog/tree");
    revalidateTag("catalog", 'default');
    revalidateTag("services", 'default');

    revalidateCatalogCache();
    return { 
      success: true as const, 
      deletedCount, 
      archivedCount, 
      message: `Обработано: ${deletedCount} удалено, ${archivedCount} перенесено в архив.` 
    };
  });
}

/**
 * Reset custom metadata flags to allow automatic provider synchronization
 */
export async function resetCustomFlagsAction(id: string) {
  return requireStaffPermission('CATALOG', 'edit', async (admin) => {
    if (!id || typeof id !== 'string') {
      return { success: false as const, error: 'ID услуги обязателен' };
    }

    const service = await db.service.update({
      where: { id },
      data: {
        isCustomName: false,
        isCustomDescription: false,
      }
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SERVICE_RESET_CUSTOM_FLAGS',
      target: id,
      targetType: 'SERVICE',
    });

    revalidatePath("/admin/catalog");
    revalidateCatalogCache();
    return { success: true as const, serviceId: service.id };
  });
}
