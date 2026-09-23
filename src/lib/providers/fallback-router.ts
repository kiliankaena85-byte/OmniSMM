import { db } from '@/lib/db';
import { ProviderCircuitBreaker } from './circuit-breaker';
import { sendAdminAlert } from '@/lib/notifications';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'ProviderFallbackRouter' });

export interface ProviderRouteCandidate {
  providerId: string;
  externalServiceId?: string;
  isBackup: boolean;
  priority: number;
}

export interface FallbackSubmitResult {
  success: boolean;
  usedProviderId?: string;
  providerOrderId?: string;
  triedProviders: string[];
  error?: string;
}

/**
 * Finds the highest-priority healthy provider candidate for a given service.
 * Automatically checks CircuitBreaker status for each candidate.
 */
export async function findAvailableProvider(
  serviceId: string,
  excludeProviderIds: string[] = []
): Promise<ProviderRouteCandidate | null> {
  const service = await db.service.findUnique({
    where: { id: serviceId },
    select: {
      providerId: true,
      externalId: true,
    },
  });

  if (!service) return null;

  const candidates: ProviderRouteCandidate[] = [];

  // 1. Primary provider
  if (service.providerId && !excludeProviderIds.includes(service.providerId)) {
    candidates.push({
      providerId: service.providerId,
      externalServiceId: service.externalId || undefined,
      isBackup: false,
      priority: 0,
    });
  }

  // 2. Backup routes from ServiceRoute table (configured via Admin Routing UI)
  const serviceRoutes = await db.serviceRoute.findMany({
    where: {
      serviceId,
      isActive: true,
      providerId: { notIn: excludeProviderIds },
    },
    orderBy: { priority: 'asc' },
  });

  for (const sr of serviceRoutes) {
    if (!candidates.some(c => c.providerId === sr.providerId)) {
      candidates.push({
        providerId: sr.providerId,
        externalServiceId: sr.providerServiceId,
        isBackup: !sr.isPrimary,
        priority: sr.priority,
      });
    }
  }

  // 3. Backup providers from ProviderServiceBackup
  const backups = await db.providerServiceBackup.findMany({
    where: {
      serviceId,
      isActive: true,
      backupProviderId: { notIn: excludeProviderIds },
    },
    orderBy: { priority: 'asc' },
  });

  for (const b of backups) {
    if (!candidates.some(c => c.providerId === b.backupProviderId)) {
      candidates.push({
        providerId: b.backupProviderId,
        externalServiceId: b.backupExternalId || undefined,
        isBackup: true,
        priority: b.priority,
      });
    }
  }

  // Evaluate circuit breakers in priority order
  for (const candidate of candidates) {
    const cb = new ProviderCircuitBreaker(candidate.providerId);
    if (await cb.canCall()) {
      return candidate;
    }
    log.warn('Candidate provider skipped due to open circuit breaker', {
      providerId: candidate.providerId,
      serviceId,
    });
  }

  return null;
}

/**
 * Executes order submission with automatic cascade to backup providers upon failure.
 */
export async function submitOrderWithFallback(params: {
  orderId: string;
  serviceId: string;
  submitFn: (
    providerId: string,
    externalId?: string
  ) => Promise<{ success: boolean; providerOrderId?: string; error?: string }>;
}): Promise<FallbackSubmitResult> {
  const { orderId, serviceId, submitFn } = params;
  const triedProviders: string[] = [];

  let candidate = await findAvailableProvider(serviceId, triedProviders);

  while (candidate) {
    triedProviders.push(candidate.providerId);
    const cb = new ProviderCircuitBreaker(candidate.providerId);

    try {
      log.info('Attempting order submission with provider', {
        orderId,
        providerId: candidate.providerId,
        isBackup: candidate.isBackup,
      });

      const res = await submitFn(candidate.providerId, candidate.externalServiceId);

      if (res.success) {
        await cb.recordSuccess();

        if (candidate.isBackup) {
          sendAdminAlert(
            `ℹ️ <b>Успешный Fallback: Заказ исполнен через резервного поставщика</b>\nЗаказ: <code>#${orderId.slice(0, 8)}</code>\nРезервный провайдер: <code>${candidate.providerId}</code>\nID у провайдера: <code>${res.providerOrderId || 'N/A'}</code>`,
            'INFO'
          );
        }

        return {
          success: true,
          usedProviderId: candidate.providerId,
          providerOrderId: res.providerOrderId,
          triedProviders,
        };
      } else {
        await cb.recordFailure();
        log.warn('Provider rejected order submission, trying fallback', {
          providerId: candidate.providerId,
          error: res.error,
        });
      }
    } catch (err) {
      await cb.recordFailure();
      log.error('Provider submission exception, trying fallback', {
        providerId: candidate.providerId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Try next available provider
    candidate = await findAvailableProvider(serviceId, triedProviders);
  }

  // All candidates exhausted
  log.error('All providers failed for order', { orderId, serviceId, triedProviders });

  sendAdminAlert(
    `🚨 <b>CRITICAL: Все провайдеры недоступны для заказа!</b>\nЗаказ: <code>#${orderId.slice(0, 8)}</code>\nОпрошенные провайдеры: <code>${triedProviders.join(', ')}</code>\nЗаказ помещён в очередь ручного разбора (PROVIDER_UNAVAILABLE).`,
    'CRITICAL'
  );

  return {
    success: false,
    triedProviders,
    error: `Все провайдеры недоступны (${triedProviders.join(', ')})`,
  };
}
