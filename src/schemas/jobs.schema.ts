import { z } from 'zod';

export const JobMetadataSchema = z.object({
  traceId: z.string().optional(),
  tenantId: z.string().optional(),
  enqueuedAt: z.string().optional(),
}).passthrough().optional();

export const OrderJobSchema = z.object({
  orderId: z.string().min(1),
  isDripFeedChild: z.boolean().optional(),
  tenantId: z.string().optional(),
  metadata: JobMetadataSchema,
});

export const CatalogJobSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('SYNC_PRICES'),
    usdToRub: z.number().positive(),
    metadata: JobMetadataSchema,
  }),
  z.object({
    type: z.literal('RECONCILE_PRICES'),
    batchSize: z.number().positive().optional(),
    metadata: JobMetadataSchema,
  }),
  z.object({
    type: z.literal('SYNC_PROVIDER_CATALOG'),
    providerId: z.string().min(1),
    admin: z.any(),
    metadata: JobMetadataSchema,
  }),
  z.object({
    type: z.literal('SYNC_ALL_CATALOGS'),
    admin: z.any(),
    metadata: JobMetadataSchema,
  }),
  z.object({
    type: z.literal('BULK_MARKUP'),
    filter: z.object({
      categoryId: z.string().optional(),
      platform: z.string().optional(),
    }),
    markupPercent: z.number(),
    admin: z.any(),
    metadata: JobMetadataSchema,
  }),
  z.object({
    type: z.literal('SYNC_CBR_RATE'),
    timestamp: z.number(),
    metadata: JobMetadataSchema,
  }),
]);

export const RefillJobSchema = z.object({
  refillId: z.string().min(1),
  tenantId: z.string().optional(),
  metadata: JobMetadataSchema,
});

export const SyncJobSchema = z.object({
  providerId: z.string().optional(),
  orderIds: z.array(z.string()).optional(),
  metadata: JobMetadataSchema,
}).optional().nullable();

export const PaymentGatewayJobSchema = z.object({
  paymentId: z.string().min(1),
  orderId: z.string().optional(),
  userId: z.string().min(1),
  amountRub: z.number().positive(),
  email: z.string().nullable().optional(),
  successUrl: z.string().min(1),
  description: z.string().min(1),
  isTestMode: z.boolean(),
  gateway: z.enum(['yookassa', 'cryptobot', 'robokassa']),
  metadata: JobMetadataSchema,
  tenantId: z.string().optional(),
});
