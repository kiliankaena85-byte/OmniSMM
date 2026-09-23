import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { auditAdmin } from '@/lib/admin-audit';
import { sendAdminAlert } from '@/lib/notifications';
import { providerService } from '@/services/providers/provider.service';
import { SettingsProvider } from '@/lib/settings';
import {
  SYNC_ANOMALY_THRESHOLD,
  ANOMALY_PRICE_SPIKE_THRESHOLD,
  UPPER_SANITY_LIMIT_RUB,
  SAFETY_FLOOR_MARKUP,
  applyBeautifulRounding
} from '@/lib/financial-constants';
import { inferTargetTypeFromCategory } from '@/utils/target-type';
import { ServiceAuditEngine } from '../audit-engine';
import { z } from 'zod';
import { getCostRub, reconcileCurrencyBeforeSync } from '@/lib/pricing/currency-invariant';
import { SecuritySanitizer } from '@/utils/security-sanitizer';
import { SmartAnalyzerLogic } from '@/services/providers/smart-analyzer.logic';
import { parseProviderBoolean } from './catalog-taxonomy.service';

export type ProviderExternalService = {
  service: string;
  name: string;
  rate: string;
  min: string;
  max: string;
  category: string;
  dripfeed?: boolean;
  refill?: boolean;
  cancel?: boolean;
};

export const rawServiceSchema = z.object({
  service: z.union([z.string(), z.number()]),
  name: z.string().transform(v => SecuritySanitizer.sanitizePromptInjection(v)),
  type: z.string().optional(),
  category: z.string().optional(),
  rate: z.union([z.string(), z.number()]),
  min: z.union([z.string(), z.number()]),
  max: z.union([z.string(), z.number()]),
  refill: z.boolean().optional(),
  cancel: z.boolean().optional(),
  dripfeed: z.boolean().optional(),
  desc: z.string().optional().transform(v => SecuritySanitizer.sanitizePromptInjection(v)),
  description: z.string().optional().transform(v => SecuritySanitizer.sanitizePromptInjection(v)),
}).strip();

export class CatalogSyncService {
  /**
   * Fetches the default provider services.
   */
  static async getProviderServices(): Promise<ProviderExternalService[]> {
    try {
      const provider = await providerService.getDefaultProvider();
      const services = await provider.getServices();
      return services as ProviderExternalService[];
    } catch (err) {
      console.warn('[CatalogSyncService] getProviderServices failed:', err);
      return [];
    }
  }

  /**
   * Refreshes the local ShadowService staging catalog by fetching the latest services from the provider API.
   * Clears existing records for this provider and populates new ones.
   * Safe to use in background workers.
   */
  static async refreshShadowCatalog(providerId: string): Promise<number> {
    const providerDbRecord = await db.provider.findUnique({ where: { id: providerId } });
    if (!providerDbRecord) throw new Error('Provider not found');

    // P0-2: Reconcile provider currency changes before wiping shadow catalog
    await reconcileCurrencyBeforeSync(
      providerDbRecord.id,
      providerDbRecord.balanceCurrency || 'USD'
    );

    const providerInstance = await providerService.getProviderInstance(providerDbRecord);
    const rawServices = await providerInstance.getServices();

    if (!Array.isArray(rawServices) || rawServices.length === 0) {
      throw new Error('API провайдера вернуло пустой список или ошибку. Синхронизация прервана (защита).');
    }

    // 0. Content-Hash Check: Skip heavy DB wipe & re-write if raw catalog is unchanged
    const catalogHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(rawServices))
      .digest('hex');

    const cacheKey = `provider:${providerId}:catalog:hash`;
    try {
      const cachedHash = await redis.get(cacheKey);
      const currentShadowCount = await db.shadowService.count({ where: { providerId: providerDbRecord.id } });
      if (cachedHash === catalogHash && currentShadowCount > 0) {
        logger.debug('Shadow catalog unchanged (hash match), skipping heavy DB re-creation', {
          providerId,
          hash: catalogHash.slice(0, 12),
          count: currentShadowCount
        });
        return currentShadowCount;
      }
    } catch (cacheErr) {
      console.warn('[CatalogSyncService] Redis hash cache lookup error:', cacheErr);
    }

    const usdRate = await SettingsProvider.getExchangeRateUSD();
    const currency = providerDbRecord.balanceCurrency || 'USD';

    const validRawServices: z.infer<typeof rawServiceSchema>[] = [];
    let invalidCount = 0;

    for (const s of rawServices) {
      const parsed = rawServiceSchema.safeParse(s);
      if (parsed.success) {
        validRawServices.push(parsed.data);
      } else {
        invalidCount++;
      }
    }

    if (invalidCount > 0) {
      console.warn(`[Provider Sync] Ignored ${invalidCount} invalid services from provider ${providerDbRecord.name}`);
    }

    // Data Intelligence: Normalize services using SmartAnalyzerLogic
    const services = validRawServices.map((s) => {
      const rawRate = typeof s.rate === 'number' ? s.rate : parseFloat(String(s.rate)) || 0;
      const basePriceUsd = currency === 'RUB' ? rawRate / usdRate : rawRate;
      const analyzed = SmartAnalyzerLogic.detectSync(s.name, s.description || '', s.category || '', undefined, basePriceUsd);
      return {
        ...s,
        cleanName: analyzed.cleanName,
        metrics: {
          ...analyzed.metrics,
          platform: analyzed.platform,
          category: analyzed.category,
          targetType: analyzed.targetType,
          customDataType: analyzed.customDataType,
          isMediaGroupAware: analyzed.isMediaGroupAware,
          isPrivate: analyzed.isPrivate,
          warranty: analyzed.warranty
        }
      };
    });

    const servicesToCreate = services.map((s) => {
      const rawRate = typeof s.rate === 'number' ? s.rate : parseFloat(String(s.rate)) || 0;
      const rateRub = currency === 'USD' ? rawRate * usdRate : rawRate;

      return {
        providerId: providerDbRecord.id,
        externalId: String(s.service),
        name: s.name,
        type: s.type || null,
        category: s.category || null,
        rate: rawRate,
        rateRub,
        min: typeof s.min === 'number' ? s.min : parseInt(String(s.min), 10) || 0,
        max: typeof s.max === 'number' ? s.max : parseInt(String(s.max), 10) || 0,
        refill: parseProviderBoolean(s.refill),
        cancel: parseProviderBoolean(s.cancel),
        dripfeed: parseProviderBoolean(s.dripfeed),
        cleanName: s.cleanName || null,
        platform: (s.metrics?.platform || 'other').toLowerCase(),
        normalizedCategory: s.metrics?.category || null,
        targetType: s.metrics?.targetType || inferTargetTypeFromCategory(s.category || s.name),
        customDataType: s.metrics?.customDataType || 'NONE',
        isMediaGroupAware: s.metrics?.isMediaGroupAware || false,
        isPrivate: s.metrics?.isPrivate || false,
        warranty: s.metrics?.warranty || 0,
        geo: s.metrics?.geo || 'WORLDWIDE',
        velocity: s.metrics?.velocity || 0,
        anomalyScore: s.metrics?.anomalyScore || 0.0
      };
    });

    const MIN_PREVIOUS_FOR_SHRINK_CHECK = 20;
    const SHRINK_THRESHOLD = 0.5;

    const previousCount = await db.shadowService.count({ where: { providerId: providerDbRecord.id } });
    const fetchedCount = validRawServices.length;

    if (fetchedCount === 0 && previousCount > 0) {
      await db.routingAuditLog.create({
        data: {
          serviceId: 'SYSTEM',
          action: 'PROVIDER_SYNC_ABORTED_EMPTY',
          reason: `Sync aborted: Provider returned 0 valid services, previous shadow count was ${previousCount}`
        }
      });
      throw new Error('PROVIDER_RETURNED_EMPTY_CATALOG');
    }

    if (previousCount >= MIN_PREVIOUS_FOR_SHRINK_CHECK && fetchedCount < previousCount * SHRINK_THRESHOLD) {
      await db.routingAuditLog.create({
        data: {
          serviceId: 'SYSTEM',
          action: 'PROVIDER_SYNC_ABORTED_SHRINK',
          reason: `Sync aborted: Provider returned ${fetchedCount} services, abnormally shrunk from previous ${previousCount}`
        }
      });
      throw new Error('PROVIDER_CATALOG_SHRUNK_ABNORMALLY');
    }

    const CHUNK_SIZE = 1000;
    await db.$transaction(
      async (tx) => {
        await tx.shadowService.deleteMany({ where: { providerId: providerDbRecord.id } });
        for (let i = 0; i < servicesToCreate.length; i += CHUNK_SIZE) {
          const chunk = servicesToCreate.slice(i, i + CHUNK_SIZE);
          await tx.shadowService.createMany({
            data: chunk,
            skipDuplicates: true
          });
        }
      },
      { timeout: 60_000, maxWait: 10_000 }
    );

    try {
      await redis.set(cacheKey, catalogHash, 'EX', 86400);
    } catch {
      // Ignore cache write error
    }

    return servicesToCreate.length;
  }

  /**
   * Zombie Eraser & Catalog Synchronization
   * Finds services that were deleted by the provider and marks them inactive.
   * Auto-restores services that reappeared.
   */
  static async syncProviderCatalog(providerId: string, admin: { id: string; email: string }) {
    const providerDbRecord = await db.provider.findUnique({ where: { id: providerId } });
    if (!providerDbRecord) throw new Error('Провайдер не найден');
    if (providerDbRecord.syncLock) throw new Error('Синхронизация отключена (syncLock)');

    logger.debug('syncProviderCatalog started', { providerId });

    // 1. Refresh shadow catalog in database (chunked and memory-safe)
    await this.refreshShadowCatalog(providerId);

    // 2. Fetch our curated services
    const ourServices = await db.service.findMany({
      where: { providerId }
    });
    logger.debug('ourServices fetched', { count: ourServices.length, ids: ourServices.map(s => s.id) });

    // 3. Query only corresponding staging services from ShadowService table
    const activeExternalIds = ourServices.map(s => s.externalId).filter(Boolean) as string[];
    const stagingServices = await db.shadowService.findMany({
      where: {
        providerId,
        externalId: { in: activeExternalIds }
      }
    });

    const stagingMap = new Map(stagingServices.map((s) => [s.externalId, s]));
    logger.debug('stagingServices fetched', { count: stagingServices.length, keys: Array.from(stagingMap.keys()) });

    let zombiesDisabled = 0;
    let resurrected = 0;
    let priceAnomalies = 0;
    let priceUpdatedSilent = 0;
    const marginFloorBreaches = 0;

    const settings = await SettingsProvider.get();
    const usdToRub = settings.exchangeRateUSD || 95.0;
    const QUARANTINE_THRESHOLD = settings.quarantineThreshold || 0.2;
    const providerCurrency = providerDbRecord.balanceCurrency || 'USD';
    const exchangeRate = providerCurrency === 'RUB' ? 1.0 : usdToRub;

    const zombieIds: string[] = [];
    const pendingUpdates: Array<{ id: string; data: Prisma.ServiceUpdateInput; oldRate: number; newRate: number }> = [];

    const executeUpdatesChunk = async (chunk: typeof pendingUpdates) => {
      await db.$transaction(async (tx) => {
        for (const item of chunk) {
          await tx.service.update({
            where: { id: item.id },
            data: item.data,
          });

          if (item.newRate !== item.oldRate) {
            await tx.servicePriceHistory.create({
              data: {
                serviceId: item.id,
                rate: item.newRate,
              },
            });
          }
        }
      });
    };

    for (const s of ourServices) {
      if (!s.externalId) continue;

      const stagingExt = stagingMap.get(s.externalId);

      if (!stagingExt) {
        // ZOMBIE DETECTION: Service was deleted by the provider
        logger.debug('Zombie candidate detected', { externalId: s.externalId, isActive: s.isActive });
        if (s.isActive) {
          zombieIds.push(s.id);
          zombiesDisabled++;
        }
      } else {
        // LIVE SERVICE
        const rawRate = stagingExt.rate;

        if (isNaN(rawRate) || rawRate <= 0) {
          if (!s.isQuarantined && s.isActive) {
            await db.service.update({
              where: { id: s.id },
              data: {
                isQuarantined: true,
                quarantineReason: `Invalid Provider Rate: ${rawRate}. Парсинг вернул NaN или <= 0.`,
                quarantinedAt: new Date()
              }
            });
            priceAnomalies++;
          }
          continue;
        }

        // Clean name/description and fix markup/price if needed
        const auditPayloads = ServiceAuditEngine.auditAndFixService(s, { rate: rawRate }, exchangeRate);
        if (auditPayloads.length > 0) {
          await db.$transaction(auditPayloads as Prisma.PrismaPromise<unknown>[]);
        }

        if (!s.isActive && s.cooldownReason === 'ZOMBIE_AUTO_DISABLED') {
          const oldCurrency = s.providerCurrency || 'USD';
          const oldExchangeRate = oldCurrency === 'RUB' ? 1.0 : usdToRub;
          const oldCostRub = s.rate * oldExchangeRate;
          const newCostRub = rawRate * exchangeRate;
          const EPSILON_RUB = 0.01;

          if (newCostRub > UPPER_SANITY_LIMIT_RUB) {
            await db.service.update({
              where: { id: s.id },
              data: {
                isQuarantined: true,
                pendingRate: rawRate,
                quarantineReason: `Upper Sanity Limit Exceeded: себестоимость ${newCostRub.toFixed(2)} ₽/1k превышает лимит ${UPPER_SANITY_LIMIT_RUB.toLocaleString('ru-RU')} ₽ (${rawRate} ${providerCurrency})`,
                quarantinedAt: new Date()
              }
            });
            priceAnomalies++;
          } else if (oldCostRub > 0 && (newCostRub - oldCostRub) / oldCostRub >= ANOMALY_PRICE_SPIKE_THRESHOLD) {
            const spikePct = Math.round(((newCostRub - oldCostRub) / oldCostRub) * 100);
            await db.service.update({
              where: { id: s.id },
              data: {
                isQuarantined: true,
                pendingRate: rawRate,
                quarantineReason: `Price Spike on Resurrection (+${spikePct}%): себестоимость выросла с ${oldCostRub.toFixed(2)} ₽ до ${newCostRub.toFixed(2)} ₽/1k`,
                quarantinedAt: new Date()
              }
            });
            priceAnomalies++;
          } else {
            pendingUpdates.push({
              id: s.id,
              data: {
                isActive: true,
                rate: rawRate,
                providerCurrency,
                cooldownReason: null,
                isQuarantined: false,
                quarantineReason: null,
              },
              oldRate: s.rate,
              newRate: rawRate,
            });
            resurrected++;
          }
        } else if (Math.abs(s.rate - rawRate) > 0.000001) {
          const oldCostRub = s.rate * (s.providerCurrency === 'RUB' ? 1.0 : usdToRub);
          const newCostRub = rawRate * exchangeRate;
          const relChange = oldCostRub > 0 ? (newCostRub - oldCostRub) / oldCostRub : 0;

          if (newCostRub > UPPER_SANITY_LIMIT_RUB) {
            await db.service.update({
              where: { id: s.id },
              data: {
                isActive: false,
                isQuarantined: true,
                pendingRate: rawRate,
                quarantineReason: `Upper Sanity Limit Exceeded: себестоимость ${newCostRub.toFixed(2)} ₽/1k превышает лимит ${UPPER_SANITY_LIMIT_RUB.toLocaleString('ru-RU')} ₽ (${rawRate} ${providerCurrency})`,
                quarantinedAt: new Date()
              }
            });
            priceAnomalies++;
          } else if (relChange >= ANOMALY_PRICE_SPIKE_THRESHOLD) {
            const spikePct = Math.round(relChange * 100);
            await db.service.update({
              where: { id: s.id },
              data: {
                isActive: false,
                isQuarantined: true,
                pendingRate: rawRate,
                quarantineReason: `Price Spike (+${spikePct}%): себестоимость выросла с ${oldCostRub.toFixed(2)} ₽ до ${newCostRub.toFixed(2)} ₽/1k`,
                quarantinedAt: new Date()
              }
            });
            priceAnomalies++;
          } else if (Math.abs(relChange) >= QUARANTINE_THRESHOLD) {
            await db.service.update({
              where: { id: s.id },
              data: {
                isQuarantined: true,
                pendingRate: rawRate,
                quarantineReason: `Поставщик изменил цену: ${s.rate} -> ${rawRate} ${providerCurrency} (${relChange > 0 ? '+' : ''}${(relChange * 100).toFixed(1)}%)`,
                quarantinedAt: new Date(),
              }
            });
            priceAnomalies++;
          } else {
            pendingUpdates.push({
              id: s.id,
              data: {
                rate: rawRate,
                providerCurrency,
                pricePer1000Cents: Math.round(applyBeautifulRounding(newCostRub * s.markup) * 100)
              },
              oldRate: s.rate,
              newRate: rawRate,
            });
            priceUpdatedSilent++;
          }
        }
      }
    }

    const ZOMBIE_BATCH_SIZE = 50;
    for (let i = 0; i < zombieIds.length; i += ZOMBIE_BATCH_SIZE) {
      const batch = zombieIds.slice(i, i + ZOMBIE_BATCH_SIZE);
      await db.service.updateMany({
        where: { id: { in: batch } },
        data: {
          isActive: false,
          cooldownReason: 'ZOMBIE_AUTO_DISABLED',
        },
      });
    }

    const CHUNK_SIZE = 50;
    for (let i = 0; i < pendingUpdates.length; i += CHUNK_SIZE) {
      const chunk = pendingUpdates.slice(i, i + CHUNK_SIZE);
      await executeUpdatesChunk(chunk);
    }

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'PROVIDER_SYNC',
      target: providerId,
      targetType: 'PROVIDER',
      newValue: {
        zombiesDisabled,
        resurrected,
        priceAnomalies,
        priceUpdatedSilent,
        marginFloorBreaches,
      },
    });

    return {
      zombiesDisabled,
      resurrected,
      priceAnomalies,
      priceUpdatedSilent,
      marginFloorBreaches,
    };
  }

  /**
   * Anomaly Detector: checks for price changes after catalog sync.
   * Isolates services with price anomalies (>50% spike or >UPPER_SANITY_LIMIT_RUB) into quarantine.
   */
  static async detectAnomalies(
    oldRates: Map<string, number | { rate: number; currency?: string; costRub?: number }>,
    newRates: Map<string, number | { rate: number; currency?: string; costRub?: number }>
  ): Promise<string[]> {
    const anomalies: string[] = [];
    const settings = await SettingsProvider.get();
    const usdToRub = settings.exchangeRateUSD || 95.0;

    const serviceIds = Array.from(oldRates.keys());
    if (serviceIds.length === 0) return anomalies;

    const services = await db.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, name: true, rate: true, providerCurrency: true, isQuarantined: true }
    });
    const serviceMap = new Map(services.map(s => [s.id, s]));

    for (const [serviceId, oldRateVal] of oldRates) {
      const newRateVal = newRates.get(serviceId);
      if (newRateVal === undefined) continue;

      const service = serviceMap.get(serviceId);
      const sCurrency = service?.providerCurrency || 'USD';

      const oldRateNum = typeof oldRateVal === 'number' ? oldRateVal : oldRateVal.rate;
      const oldCurr = (typeof oldRateVal === 'object' && oldRateVal.currency) ? oldRateVal.currency : sCurrency;
      const oldCostRub = (typeof oldRateVal === 'object' && typeof oldRateVal.costRub === 'number')
        ? oldRateVal.costRub
        : (oldRateNum * (oldCurr === 'RUB' ? 1.0 : usdToRub));

      const newRateNum = typeof newRateVal === 'number' ? newRateVal : newRateVal.rate;
      const newCurr = (typeof newRateVal === 'object' && newRateVal.currency) ? newRateVal.currency : sCurrency;
      const newCostRub = (typeof newRateVal === 'object' && typeof newRateVal.costRub === 'number')
        ? newRateVal.costRub
        : (newRateNum * (newCurr === 'RUB' ? 1.0 : usdToRub));

      if (oldCostRub === 0 && newCostRub === 0) continue;

      if (newCostRub > UPPER_SANITY_LIMIT_RUB) {
        const msg = `🚨 [Sanity Breach] Услуга "${service?.name || serviceId}" (${serviceId}): себестоимость ${newCostRub.toFixed(2)} ₽/1k (${newRateNum} ${newCurr}) превышает лимит ${UPPER_SANITY_LIMIT_RUB.toLocaleString('ru-RU')} ₽. Изолирована в карантин.`;
        anomalies.push(msg);

        await db.service.update({
          where: { id: serviceId },
          data: {
            isActive: false,
            isQuarantined: true,
            pendingRate: newRateNum,
            quarantineReason: `Upper Sanity Limit Exceeded: себестоимость ${newCostRub.toFixed(2)} ₽/1k превышает лимит ${UPPER_SANITY_LIMIT_RUB.toLocaleString('ru-RU')} ₽ (${newRateNum} ${newCurr})`,
            quarantinedAt: new Date(),
          }
        }).catch(() => {});
        continue;
      }

      if (oldCostRub > 0) {
        const change = (newCostRub - oldCostRub) / oldCostRub;
        const absChange = Math.abs(change);

        if (absChange >= SYNC_ANOMALY_THRESHOLD) {
          const direction = newCostRub > oldCostRub ? '📈' : '📉';
          const msg = `${direction} Услуга "${service?.name || serviceId}" (${serviceId}): ${oldCostRub.toFixed(2)} ₽ (${oldRateNum} ${oldCurr}) → ${newCostRub.toFixed(2)} ₽ (${newRateNum} ${newCurr}) (${change >= 0 ? '+' : ''}${(change * 100).toFixed(0)}%)`;
          anomalies.push(msg);

          if (change >= ANOMALY_PRICE_SPIKE_THRESHOLD) {
            await db.service.update({
              where: { id: serviceId },
              data: {
                isActive: false,
                isQuarantined: true,
                pendingRate: newRateNum,
                quarantineReason: `Price Spike (+${(change * 100).toFixed(0)}%): себестоимость выросла с ${oldCostRub.toFixed(2)} ₽ до ${newCostRub.toFixed(2)} ₽/1k (${oldRateNum} ${oldCurr} → ${newRateNum} ${newCurr})`,
                quarantinedAt: new Date(),
              }
            });
          }
        }
      }
    }

    if (anomalies.length > 0) {
      await sendAdminAlert(
        `⚡ Обнаружены аномалии цен поставщиков:\n\n${anomalies.join('\n')}`,
        'WARNING'
      );
    }

    return anomalies;
  }

  /**
   * Price synchronizer for exchange rate movements.
   */
  static async syncDenormalizedPrices(usdToRub: number) {
    const { CBRRateService } = await import('@/services/system/cbr-rate.service');
    const liveCrossRates = await CBRRateService.getLiveCrossRates();

    const allServices = await db.service.findMany({
      select: { id: true, name: true, rate: true, markup: true, isActive: true, providerCurrency: true, tenantId: true }
    });

    console.info(`[CatalogSyncService] Syncing prices for ${allServices.length} services with rate ${usdToRub}...`);

    const updatesBatch: Prisma.PrismaPromise<unknown>[] = [];
    for (const s of allServices) {
      const costRub = getCostRub(s.rate, s.providerCurrency || 'RUB', usdToRub, liveCrossRates);
      const effectiveMarkup = s.markup > 0 ? s.markup : SAFETY_FLOOR_MARKUP;
      const pricePer1kRubRounded = applyBeautifulRounding(costRub * effectiveMarkup);
      const pricePerUnitRub = pricePer1kRubRounded / 1000;
      const purchaseCostPerUnitRub = costRub / 1000;

      if (pricePer1kRubRounded < costRub || pricePerUnitRub < purchaseCostPerUnitRub) {
        updatesBatch.push(
          db.service.update({
            where: { id: s.id },
            data: { isActive: false, costPer1kRub: costRub }
          })
        );

        const alertMsg = `🚨 [Loss Prevention] Услуга ${s.id} автоматически отключена из-за колебаний курса ЦБ! Розничная цена ${pricePerUnitRub.toFixed(4)} ₽/шт меньше себестоимости закупки ${purchaseCostPerUnitRub.toFixed(4)} ₽/шт.`;
        console.error(alertMsg);

        await db.routingAuditLog.create({
          data: {
            serviceId: s.id,
            action: 'LOSS_PREVENTION_BLOCK',
            reason: `Exchange rate fluctuation: Retail price ${pricePerUnitRub.toFixed(4)} < Cost ${purchaseCostPerUnitRub.toFixed(4)}`
          }
        });

        const { sendAdminAlert } = await import('@/lib/notifications');
        await sendAdminAlert(alertMsg, 'CRITICAL');
      } else {
        const newPriceCents = Math.round(pricePer1kRubRounded * 100);
        updatesBatch.push(
          db.service.update({
            where: { id: s.id },
            data: { 
              costPer1kRub: costRub,
              pricePer1000Cents: newPriceCents 
            }
          })
        );
      }
    }

    for (let i = 0; i < updatesBatch.length; i += 100) {
      await db.$transaction(updatesBatch.slice(i, i + 100));
    }

    console.info(`[CatalogSyncService] Price sync completed. Updated ${updatesBatch.length} services.`);
    return { updatedCount: updatesBatch.length, totalCount: allServices.length };
  }
}
