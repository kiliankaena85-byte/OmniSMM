import { db } from '@/lib/db';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { inferTargetTypeFromName, isTargetTypeCompatible } from '@/utils/target-type';
import { assertSafeOutboundUrl } from '@/lib/security/ssrf-guard';
import { UPPER_SANITY_LIMIT_RUB } from '@/lib/financial-constants';

export interface AdminContext {
  id: string;
  email?: string | null;
  ip?: string | null;
}

export type LifecycleStatus = 'DRAFT' | 'TESTING' | 'PUBLISHED' | 'ARCHIVED';

export interface CreateDraftInput {
  tenantId?: string;
  providerId?: string | null;
  externalId?: string | null;
  name: string;
  cleanName?: string | null;
  description?: string | null;
  categoryId?: string | null;
  targetType?: string;
  procurementRate?: number;
  procurementCurrency?: string;
  markup?: number;
  minQty?: number;
  maxQty?: number;
  payload?: Record<string, unknown>;
}

export interface UpdateDraftInput {
  name?: string;
  cleanName?: string | null;
  description?: string | null;
  categoryId?: string | null;
  targetType?: string;
  procurementRate?: number;
  procurementCurrency?: string;
  markup?: number;
  retailPriceRub?: number;
  minQty?: number;
  maxQty?: number;
  payload?: Record<string, unknown>;
  comment?: string;
}

export interface CustomerGroupInput {
  name: string;
  slug: string;
  description?: string | null;
  tenantId?: string;
  isDefault?: boolean;
  discountPercent?: number;
}

export interface LinkCheckResult {
  isSuccess: boolean;
  statusCode?: number;
  responseTimeMs?: number;
  errorMessage?: string;
  status: 'VALID' | 'INVALID' | 'TIMEOUT';
}

export class ServicesLifecycleService {
  /**
   * Безопасный расчет розничной цены (Защита от деления на 0 и отрицательных наценок)
   */
  public calculateRetailPrice(procurementRate: number, markupMultiplier: number, usdRate: number, currency: string): number {
    const safeProcurement = Math.max(0, procurementRate);
    // Наценка: 0 = автокалькуляция (базовый множитель 3.0), иначе множитель >= 1.0
    const safeMarkup = markupMultiplier <= 0 ? 3.0 : Math.max(1.0, markupMultiplier);
    const rateInRub = currency === 'USD' ? safeProcurement * Math.max(1.0, usdRate) : safeProcurement;
    return Math.round(rateInRub * safeMarkup * 100) / 100;
  }

  /**
   * 1. Создание черновика услуги (IMPORTED → DRAFT)
   */
  async createDraft(input: CreateDraftInput, admin: AdminContext) {
    const tenantId = input.tenantId || 'smmplan';
    const settings = await db.systemSettings.findUnique({ where: { id: 'global' }, select: { exchangeRateUSD: true } });
    const usdRate = settings?.exchangeRateUSD || 90.0;
    const currency = input.procurementCurrency || 'USD';
    const procurementRate = input.procurementRate || 0.0;
    const markup = input.markup ?? 3.0;

    const retailPriceRub = this.calculateRetailPrice(procurementRate, markup, usdRate, currency);
    const targetType = input.targetType || inferTargetTypeFromName(input.name);

    const draft = await db.serviceDraft.create({
      data: {
        tenantId,
        providerId: input.providerId,
        externalId: input.externalId,
        name: input.name,
        cleanName: input.cleanName,
        description: input.description,
        categoryId: input.categoryId,
        targetType,
        status: 'DRAFT',
        procurementRate,
        procurementCurrency: currency,
        markup,
        retailPriceRub,
        minQty: Math.max(1, input.minQty ?? 10),
        maxQty: Math.max(1, input.maxQty ?? 100000),
        validationStatus: 'PENDING',
        linkCheckStatus: 'UNCHECKED',
        payload: input.payload ? (input.payload as object) : undefined,
        adminId: admin.id,
      },
    });

    // Логирование создания в историю изменений
    await db.serviceEditHistory.create({
      data: {
        draftId: draft.id,
        adminId: admin.id,
        adminEmail: admin.email,
        changeType: 'CREATE',
        field: 'ALL',
        newValue: JSON.stringify({ name: draft.name, retailPriceRub: draft.retailPriceRub, status: draft.status }),
        comment: 'Создан черновик услуги',
        ipAddress: admin.ip,
      },
    });

    return draft;
  }

  /**
   * 2. Редактирование черновика с фиксацией аудита изменений (Diff)
   */
  async updateDraft(draftId: string, input: UpdateDraftInput, admin: AdminContext) {
    const existing = await db.serviceDraft.findUnique({ where: { id: draftId } });
    if (!existing) throw new Error(`Черновик #${draftId} не найден`);

    const settings = await db.systemSettings.findUnique({ where: { id: 'global' }, select: { exchangeRateUSD: true } });
    const usdRate = settings?.exchangeRateUSD || 90.0;

    const nextProcurement = input.procurementRate ?? existing.procurementRate;
    const nextCurrency = input.procurementCurrency ?? existing.procurementCurrency;
    const nextMarkup = input.markup ?? existing.markup;

    const calculatedRetail = this.calculateRetailPrice(nextProcurement, nextMarkup, usdRate, nextCurrency);
    const finalRetail = input.retailPriceRub !== undefined ? Math.max(0, input.retailPriceRub) : calculatedRetail;

    const updateData: Record<string, unknown> = {
      ...(input.name && { name: input.name }),
      ...(input.cleanName !== undefined && { cleanName: input.cleanName }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(input.targetType && { targetType: input.targetType }),
      ...(input.procurementRate !== undefined && { procurementRate: input.procurementRate }),
      ...(input.procurementCurrency && { procurementCurrency: input.procurementCurrency }),
      ...(input.markup !== undefined && { markup: input.markup }),
      retailPriceRub: finalRetail,
      ...(input.minQty !== undefined && { minQty: Math.max(1, input.minQty) }),
      ...(input.maxQty !== undefined && { maxQty: Math.max(1, input.maxQty) }),
      ...(input.payload && { payload: input.payload as object }),
    };

    // Сохраняем диффы в ServiceEditHistory
    const diffEntries: Array<{ field: string; oldValue: string; newValue: string }> = [];
    if (input.name && input.name !== existing.name) {
      diffEntries.push({ field: 'name', oldValue: existing.name, newValue: input.name });
    }
    if (input.procurementRate !== undefined && input.procurementRate !== existing.procurementRate) {
      diffEntries.push({ field: 'procurementRate', oldValue: String(existing.procurementRate), newValue: String(input.procurementRate) });
    }
    if (input.markup !== undefined && input.markup !== existing.markup) {
      diffEntries.push({ field: 'markup', oldValue: String(existing.markup), newValue: String(input.markup) });
    }
    if (finalRetail !== existing.retailPriceRub) {
      diffEntries.push({ field: 'retailPriceRub', oldValue: String(existing.retailPriceRub), newValue: String(finalRetail) });
    }
    if (input.categoryId && input.categoryId !== existing.categoryId) {
      diffEntries.push({ field: 'categoryId', oldValue: String(existing.categoryId || ''), newValue: input.categoryId });
    }
    if (input.minQty !== undefined && input.minQty !== existing.minQty) {
      diffEntries.push({ field: 'minQty', oldValue: String(existing.minQty), newValue: String(input.minQty) });
    }
    if (input.maxQty !== undefined && input.maxQty !== existing.maxQty) {
      diffEntries.push({ field: 'maxQty', oldValue: String(existing.maxQty), newValue: String(input.maxQty) });
    }
    if (input.description !== undefined && input.description !== existing.description) {
      diffEntries.push({ field: 'description', oldValue: String(existing.description || ''), newValue: String(input.description || '') });
    }

    const updated = await db.serviceDraft.update({
      where: { id: draftId },
      data: updateData,
    });

    if (diffEntries.length > 0) {
      await db.$transaction(
        diffEntries.map((d) =>
          db.serviceEditHistory.create({
            data: {
              draftId: draftId,
              serviceId: existing.serviceId,
              adminId: admin.id,
              adminEmail: admin.email,
              changeType: 'UPDATE',
              field: d.field,
              oldValue: d.oldValue,
              newValue: d.newValue,
              comment: input.comment || 'Обновление параметров черновика',
              ipAddress: admin.ip,
            },
          })
        )
      );
    }

    return updated;
  }

  /**
   * 3. Проверка доступности ссылки с таймаутом (HEAD request / AbortController)
   */
  async testLink(testUrl: string, targetType: string, admin: AdminContext, serviceId?: string, draftId?: string): Promise<LinkCheckResult> {
    const startTime = Date.now();
    const cleanUrl = testUrl.trim();

    try {
      // 1. SSRF Guard
      const ssrfCheck = await assertSafeOutboundUrl(cleanUrl);
      if (!ssrfCheck.ok) {
        await db.serviceLinkCheck.create({
          data: {
            serviceId: serviceId || null,
            targetType,
            testUrl: cleanUrl,
            isSuccess: false,
            statusCode: 400,
            responseTimeMs: Date.now() - startTime,
            errorMessage: `SSRF blocked: ${ssrfCheck.reason}`,
            checkedBy: admin?.email || admin?.id || 'system',
          },
        }).catch(() => {});

        if (draftId) {
          await db.serviceDraft.update({
            where: { id: draftId },
            data: { linkCheckStatus: 'INVALID' },
          }).catch(() => {});
        }

        return {
          isSuccess: false,
          statusCode: 400,
          responseTimeMs: Date.now() - startTime,
          errorMessage: `SSRF blocked: ${ssrfCheck.reason}`,
          status: 'INVALID',
        };
      }

      // 2. Network HEAD Request с таймаутом 4000мс
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      let statusCode = 200;
      let isSuccess = false;
      let errorMessage: string | undefined;

      try {
        const res = await fetch(cleanUrl, {
          method: 'HEAD',
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SMMplan-LinkVerifier/1.0',
          },
        });
        clearTimeout(timeoutId);
        statusCode = res.status;
        isSuccess = res.ok || res.status === 403 || res.status === 405; // 403/405 часто норма для соцсетей без JS
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        const errObj = err as { name?: string; message?: string };
        if (errObj.name === 'AbortError') {
          statusCode = 408;
          errorMessage = 'Таймаут проверки ссылки (> 4000мс)';
        } else {
          statusCode = 502;
          errorMessage = errObj.message || 'Ошибка соединения с целевым сервером';
        }
      }

      const responseTimeMs = Date.now() - startTime;
      const status: 'VALID' | 'INVALID' | 'TIMEOUT' = statusCode === 408 ? 'TIMEOUT' : isSuccess ? 'VALID' : 'INVALID';

      // Логируем проверку в ServiceLinkCheck
      await db.serviceLinkCheck.create({
        data: {
          serviceId: serviceId || null,
          targetType,
          testUrl: cleanUrl,
          isSuccess,
          statusCode,
          responseTimeMs,
          errorMessage,
          checkedBy: admin.email || admin.id,
        },
      });

      if (draftId) {
        await db.serviceDraft.update({
          where: { id: draftId },
          data: { linkCheckStatus: status },
        });
      }

      return {
        isSuccess,
        statusCode,
        responseTimeMs,
        errorMessage,
        status,
      };
    } catch (e: unknown) {
      const errObj = e as { message?: string };
      const responseTimeMs = Date.now() - startTime;
      return {
        isSuccess: false,
        statusCode: 400,
        responseTimeMs,
        errorMessage: errObj.message || 'Недопустимый URL',
        status: 'INVALID',
      };
    }
  }

  /**
   * 4. Перевод в статус TESTING
   */
  async promoteToTesting(draftId: string, admin: AdminContext) {
    const draft = await db.serviceDraft.findUnique({ where: { id: draftId } });
    if (!draft) throw new Error(`Черновик #${draftId} не найден`);

    if (!draft.categoryId) {
      throw new Error('Невозможно перевести в TESTING: не назначена категория услуги');
    }

    if (draft.retailPriceRub <= 0) {
      throw new Error('Невозможно перевести в TESTING: цена услуги должна быть больше 0 ₽');
    }

    const settings = await db.systemSettings.findUnique({ where: { id: 'global' }, select: { exchangeRateUSD: true } });
    const usdRate = settings?.exchangeRateUSD || 90.0;
    const rateInRub = (draft.procurementCurrency || 'USD') === 'USD' ? draft.procurementRate * Math.max(1.0, usdRate) : draft.procurementRate;
    if (rateInRub > UPPER_SANITY_LIMIT_RUB) {
      throw new Error(`Невозможно перевести в TESTING: себестоимость ${rateInRub.toFixed(2)} ₽ превышает верхний лимит безопасности (${UPPER_SANITY_LIMIT_RUB.toLocaleString('ru-RU')} ₽)`);
    }

    const updated = await db.serviceDraft.update({
      where: { id: draftId },
      data: { status: 'TESTING', validationStatus: 'PASSED' },
    });

    await db.serviceEditHistory.create({
      data: {
        draftId,
        serviceId: draft.serviceId,
        adminId: admin.id,
        adminEmail: admin.email,
        changeType: 'STATUS_CHANGE',
        field: 'status',
        oldValue: 'DRAFT',
        newValue: 'TESTING',
        comment: 'Услуга переведена на этап тестирования (TESTING)',
        ipAddress: admin.ip,
      },
    });

    return updated;
  }

  /**
   * 5. Атомарная публикация (TESTING/DRAFT → PUBLISHED)
   */
  async publishDraft(draftId: string, admin: AdminContext) {
    const draft = await db.serviceDraft.findUnique({
      where: { id: draftId },
    });
    if (!draft) throw new Error(`Черновик #${draftId} не найден`);

    if (!draft.categoryId) {
      throw new Error('Невозможно опубликовать: отсутствует категория');
    }

    const category = await db.category.findUnique({ where: { id: draft.categoryId } });
    if (!category) {
      throw new Error(`Категория #${draft.categoryId} не найдена в базе`);
    }

    // Проверка совместимости типов
    const catTargetType = inferTargetTypeFromName(category.name);
    if (!isTargetTypeCompatible(draft.targetType, catTargetType)) {
      console.warn(`[Lifecycle] Предупреждение: тип услуги ${draft.targetType} может не совпадать с категорией ${category.name}`);
    }

    const settings = await db.systemSettings.findUnique({ where: { id: 'global' }, select: { exchangeRateUSD: true } });
    const usdRate = settings?.exchangeRateUSD || 90.0;
    const rateInRub = (draft.procurementCurrency || 'USD') === 'USD' ? draft.procurementRate * Math.max(1.0, usdRate) : draft.procurementRate;
    if (rateInRub > UPPER_SANITY_LIMIT_RUB) {
      throw new Error(`Невозможно опубликовать: себестоимость ${rateInRub.toFixed(2)} ₽ превышает верхний лимит безопасности (${UPPER_SANITY_LIMIT_RUB.toLocaleString('ru-RU')} ₽)`);
    }

    // Атомарная транзакция создания/обновления реальной услуги
    const publishedService = await db.$transaction(async (tx) => {
      let targetServiceId = draft.serviceId;

      if (targetServiceId) {
        // Обновление существующей
        await tx.service.update({
          where: { id: targetServiceId },
          data: {
            name: draft.name,
            description: draft.description,
            categoryId: draft.categoryId!,
            providerId: draft.providerId,
            rate: draft.procurementRate,
            providerCurrency: draft.procurementCurrency,
            markup: draft.markup,
            minQty: draft.minQty,
            maxQty: draft.maxQty,
            externalId: draft.externalId,
            targetType: draft.targetType,
            isActive: true,
          },
        });
      } else {
        // Создание новой услуги
        const created = await tx.service.create({
          data: {
            tenantId: draft.tenantId,
            name: draft.name,
            description: draft.description,
            categoryId: draft.categoryId!,
            providerId: draft.providerId,
            rate: draft.procurementRate,
            providerCurrency: draft.procurementCurrency,
            markup: draft.markup,
            minQty: draft.minQty,
            maxQty: draft.maxQty,
            externalId: draft.externalId,
            targetType: draft.targetType,
            isActive: true,
          },
        });
        targetServiceId = created.id;
      }

      // Обновляем черновик
      await tx.serviceDraft.update({
        where: { id: draftId },
        data: {
          serviceId: targetServiceId,
          status: 'PUBLISHED',
          validationStatus: 'PASSED',
        },
      });

      // Логируем публикацию в историю
      await tx.serviceEditHistory.create({
        data: {
          draftId,
          serviceId: targetServiceId,
          adminId: admin.id,
          adminEmail: admin.email,
          changeType: 'PUBLISH',
          field: 'status',
          oldValue: draft.status,
          newValue: 'PUBLISHED',
          comment: `Услуга успешно опубликована на витрину #${targetServiceId}`,
          ipAddress: admin.ip,
        },
      });

      return targetServiceId;
    });

    // Финансовый аудит
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email || 'system@smmplan.pro',
      action: 'SERVICE_LIFECYCLE_PUBLISH',
      target: publishedService,
      targetType: 'Service',
      newValue: {
        draftId,
        serviceId: publishedService,
        name: draft.name,
        procurementRate: draft.procurementRate,
        markup: draft.markup,
        retailPriceRub: draft.retailPriceRub,
      },
      ipAddress: admin.ip || undefined,
    });

    return { success: true, serviceId: publishedService };
  }

  /**
   * 6. Архивация услуги (PUBLISHED → ARCHIVED)
   */
  async archiveService(serviceId: string, reason: string, admin: AdminContext) {
    const service = await db.service.findUnique({ where: { id: serviceId } });
    if (!service) throw new Error(`Услуга #${serviceId} не найдена`);

    await db.$transaction(async (tx) => {
      await tx.service.update({
        where: { id: serviceId },
        data: { isActive: false },
      });

      await tx.serviceDraft.updateMany({
        where: { serviceId },
        data: { status: 'ARCHIVED' },
      });

      await tx.serviceEditHistory.create({
        data: {
          serviceId,
          adminId: admin.id,
          adminEmail: admin.email,
          changeType: 'ARCHIVE',
          field: 'isActive',
          oldValue: 'true',
          newValue: 'false',
          comment: `Услуга отправлена в архив: ${reason}`,
          ipAddress: admin.ip,
        },
      });
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email || 'system@smmplan.pro',
      action: 'SERVICE_LIFECYCLE_ARCHIVE',
      target: serviceId,
      targetType: 'Service',
      newValue: { reason },
      ipAddress: admin.ip || undefined,
    });

    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════
  // CUSTOMER GROUP & ACCESS CONTROL
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Создание группы заказчиков
   */
  async createCustomerGroup(data: CustomerGroupInput, admin: AdminContext) {
    const tenantId = data.tenantId || 'smmplan';
    const group = await db.customerGroup.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        tenantId,
        isDefault: data.isDefault || false,
        discountPercent: Math.max(0, Math.min(100, data.discountPercent || 0)),
      },
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email || 'system@smmplan.pro',
      action: 'CUSTOMER_GROUP_CREATE',
      target: group.id,
      targetType: 'CustomerGroup',
      newValue: { name: group.name, slug: group.slug, discountPercent: group.discountPercent },
      ipAddress: admin.ip || undefined,
    });

    return group;
  }

  /**
   * Назначение доступности услуги для групп заказчиков
   */
  async assignCustomerGroupAccess(
    serviceId: string,
    customerGroupIds: string[],
    customPricesRub?: Record<string, number>,
    admin?: AdminContext
  ) {
    const service = await db.service.findUnique({ where: { id: serviceId } });
    if (!service) throw new Error(`Услуга #${serviceId} не найдена`);

    await db.$transaction(async (tx) => {
      // Удаляем старые привязки
      await tx.serviceCustomerAccess.deleteMany({ where: { serviceId } });

      // Создаем новые
      if (customerGroupIds.length > 0) {
        await tx.serviceCustomerAccess.createMany({
          data: customerGroupIds.map((groupId) => ({
            serviceId,
            customerGroupId: groupId,
            isCustomPrice: customPricesRub && customPricesRub[groupId] !== undefined,
            customPriceRub: customPricesRub ? customPricesRub[groupId] : null,
          })),
        });
      }
    });

    if (admin) {
      await auditAdminAwaitable({
        adminId: admin.id,
        adminEmail: admin.email || 'system@smmplan.pro',
        action: 'SERVICE_ACCESS_UPDATE',
        target: serviceId,
        targetType: 'Service',
        newValue: { groupCount: customerGroupIds.length, groupIds: customerGroupIds },
        ipAddress: admin.ip || undefined,
      });
    }

    return { success: true, assignedCount: customerGroupIds.length };
  }

  /**
   * Проверка доступа пользователя к услуге
   */
  async isServiceAccessibleForUser(serviceId: string, userId?: string): Promise<boolean> {
    const accessRulesCount = await db.serviceCustomerAccess.count({ where: { serviceId } });
    // Если для услуги не заданы ограничения по группам — она доступна всем публично
    if (accessRulesCount === 0) return true;

    if (!userId) return false;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { customerGroupId: true },
    });

    if (!user || !user.customerGroupId) return false;

    const hasAccess = await db.serviceCustomerAccess.findUnique({
      where: {
        serviceId_customerGroupId: {
          serviceId,
          customerGroupId: user.customerGroupId,
        },
      },
    });

    return !!hasAccess;
  }

  /**
   * Получение истории изменений услуги
   */
  async getServiceEditHistory(query: { serviceId?: string; draftId?: string }) {
    return db.serviceEditHistory.findMany({
      where: {
        ...(query.serviceId && { serviceId: query.serviceId }),
        ...(query.draftId && { draftId: query.draftId }),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}

export const servicesLifecycleService = new ServicesLifecycleService();
