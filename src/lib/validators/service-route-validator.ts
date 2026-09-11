import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'ServiceRouteValidator' });

export interface ValidateRouteParams {
  serviceId: string;
  providerId: string;
  providerServiceId: string;
  isPrimary?: boolean;
  tenantId?: string;
}

export class ServiceRouteValidationError extends Error {
  constructor(message: string, public readonly code: string = 'ROUTE_VALIDATION_FAILED') {
    super(message);
    this.name = 'ServiceRouteValidationError';
  }
}

/**
 * Validates that a providerServiceId is genuine and not an accidental collision
 * with SMMplan's internal database numericId.
 * Enforces zero-defect data mapping for provider routing.
 */
export async function assertValidServiceRoute(params: ValidateRouteParams): Promise<{ valid: boolean; serviceName: string }> {
  const { serviceId, providerId, providerServiceId, tenantId } = params;

  if (!providerServiceId || !providerServiceId.trim()) {
    throw new ServiceRouteValidationError('ID услуги у провайдера (providerServiceId) не может быть пустым', 'EMPTY_PROVIDER_SERVICE_ID');
  }

  const cleanProviderServiceId = providerServiceId.trim();

  // 1. Fetch target service with tenant scoping
  const fetchFn = (tenantId && db.service.findFirst) ? db.service.findFirst : (db.service.findFirst || db.service.findUnique);
  const service = await fetchFn({
    where: {
      id: serviceId,
      ...(tenantId ? { tenantId } : {}),
    },
    select: {
      id: true,
      name: true,
      numericId: true,
      externalId: true,
      providerId: true,
    }
  });

  if (!service) {
    throw new ServiceRouteValidationError(`Услуга с ID ${serviceId} не найдена в базе данных`, 'SERVICE_NOT_FOUND');
  }

  // 2. CRITICAL INVARIANT: providerServiceId MUST NEVER equal the internal numericId of the service
  // This detects the exact bug where internal IDs (e.g. 1315) were mapped to Vexboost.
  if (service.numericId && String(service.numericId) === cleanProviderServiceId) {
    // If the service's legitimate externalId is completely different, this is 100% a bug!
    if (service.externalId && service.externalId !== cleanProviderServiceId) {
      log.error(`[ServiceRouteValidator] REJECTED: providerServiceId matches internal numericId (${service.numericId}) instead of externalId (${service.externalId})!`);
      throw new ServiceRouteValidationError(
        `🚨 [КРИТИЧЕСКИЙ СБОЙ МАППИНГА] providerServiceId '${cleanProviderServiceId}' совпадает с внутренним numericId услуги '${service.name}' (#${service.numericId})! ` +
        `Для связи с поставщиком необходимо указывать реальный внешний ID каталога поставщика (ожидался: '${service.externalId}').`,
        'NUMERIC_ID_COLLISION'
      );
    }
  }

  // 3. If routing to the service's primary provider, providerServiceId should align with service.externalId
  if (service.providerId === providerId && service.externalId) {
    if (cleanProviderServiceId !== service.externalId.trim()) {
      log.warn(`[ServiceRouteValidator] Primary provider route differs: route '${cleanProviderServiceId}' vs service.externalId '${service.externalId}'`);
    }
  }

  return {
    valid: true,
    serviceName: service.name
  };
}
