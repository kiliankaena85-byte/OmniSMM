import { db } from '@/lib/db';
import { providerService } from '@/services/providers/provider.service';
import { parseProviderBooleanOptional } from './catalog-taxonomy.service';
import type { LiveCatalogEntry, ImportSkippedItem } from './catalog-import.service';

export type PreflightResult = {
  providerDbRecord: { id: string; name: string; balanceCurrency: string | null };
  shadowServices: Array<{
    externalId: string;
    name: string;
    cleanName: string | null;
    rate: number;
    platform: string | null;
    normalizedCategory: string | null;
    targetType: string | null;
    customDataType: string | null;
    isMediaGroupAware: boolean | null;
    isPrivate: boolean | null;
    warranty: number | null;
    geo: string | null;
    velocity: number | null;
    anomalyScore: number | null;
  }>;
  liveMap: Map<string, LiveCatalogEntry>;
  skipped: ImportSkippedItem[];
  warnings: string[];
  usedLivePrices: boolean;
  shadowCatalogAgeHours: number | null;
};

export async function runCatalogImportPreflight(
  providerId: string,
  externalIds: string[]
): Promise<PreflightResult> {
  const shadowServices = await db.shadowService.findMany({
    where: {
      providerId,
      externalId: { in: externalIds.map(String) }
    }
  });

  if (shadowServices.length === 0) {
    throw new Error('Не найдены услуги для импорта в теневом каталоге (Обновите каталог)');
  }

  const shadowByExtId = new Map(shadowServices.map(s => [s.externalId, s]));
  const skipped: ImportSkippedItem[] = [];
  for (const extId of externalIds.map(String)) {
    if (!shadowByExtId.has(extId)) {
      skipped.push({ externalId: extId, name: null, reason: 'NOT_IN_SHADOW_CATALOG' });
    }
  }

  const providerDbRecord = await db.provider.findUnique({ where: { id: providerId } });
  if (!providerDbRecord) throw new Error('Провайдер не найден');

  const warnings: string[] = [];
  let usedLivePrices = true;
  let shadowCatalogAgeHours: number | null = null;
  const liveMap = new Map<string, LiveCatalogEntry>();

  const loadLiveCatalog = async (): Promise<LiveCatalogEntry[]> => {
    const providerInstance = await providerService.getProviderInstance(providerDbRecord);
    const liveServices = await providerInstance.getServices();
    return liveServices.map((s) => ({
      service: s.service.toString(),
      name: s.name,
      rate: String(s.rate),
      min: String(s.min),
      max: String(s.max),
      dripfeed: parseProviderBooleanOptional(s.dripfeed),
      refill: parseProviderBooleanOptional(s.refill),
      cancel: parseProviderBooleanOptional(s.cancel),
      desc: s.desc,
    }));
  };

  try {
    const liveEntries = await loadLiveCatalog();
    if (liveEntries.length === 0) {
      throw new Error('API провайдера вернул пустой каталог');
    }
    for (const entry of liveEntries) {
      liveMap.set(entry.service, entry);
    }
  } catch (liveErr) {
    const errMsg = liveErr instanceof Error ? liveErr.message : String(liveErr);
    const latestShadow = await db.shadowService.findFirst({
      where: { providerId },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });
    shadowCatalogAgeHours = latestShadow
      ? (Date.now() - new Date(latestShadow.updatedAt).getTime()) / 3_600_000
      : null;

    const SHADOW_FALLBACK_MAX_AGE_HOURS = 24;
    if (
      shadowServices.length > 0 &&
      shadowCatalogAgeHours !== null &&
      shadowCatalogAgeHours <= SHADOW_FALLBACK_MAX_AGE_HOURS
    ) {
      usedLivePrices = false;
      warnings.push(
        `Провайдер недоступен (${errMsg}). Импорт выполнен по ценам теневого каталога (возраст: ${shadowCatalogAgeHours.toFixed(1)} ч). После восстановления связи выполните синхронизацию цен.`
      );
      for (const s of shadowServices) {
        liveMap.set(s.externalId, {
          service: s.externalId,
          name: s.name,
          rate: String(s.rate),
          min: String(s.min),
          max: String(s.max),
          dripfeed: s.dripfeed,
          refill: s.refill,
          cancel: s.cancel,
        });
      }
    } else {
      throw new Error(
        `Провайдер недоступен (${errMsg}), а теневой каталог ${shadowCatalogAgeHours === null ? 'пуст' : `устарел (${shadowCatalogAgeHours.toFixed(1)} ч назад)`}. Нажмите «Обновить каталог» и повторите импорт.`
      );
    }
  }

  return {
    providerDbRecord,
    shadowServices,
    liveMap,
    skipped,
    warnings,
    usedLivePrices,
    shadowCatalogAgeHours
  };
}
