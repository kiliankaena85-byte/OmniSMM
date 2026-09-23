import { z } from 'zod';

export const OrderJobSchema = z.object({
  orderId: z.string().min(1),
  isDripFeedChild: z.boolean().optional()
});

export const CatalogJobSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('SYNC_PRICES'),
    usdToRub: z.number().positive()
  }),
  z.object({
    type: z.literal('RECONCILE_PRICES'),
    batchSize: z.number().positive().optional()
  }),
  z.object({
    type: z.literal('SYNC_PROVIDER_CATALOG'),
    providerId: z.string().min(1),
     
    admin: z.any()
  }),
  z.object({
    type: z.literal('SYNC_ALL_CATALOGS'),
     
    admin: z.any()
  }),
  z.object({
    type: z.literal('BULK_MARKUP'),
    filter: z.object({
      categoryId: z.string().optional(),
      platform: z.string().optional()
    }),
    markupPercent: z.number(),
     
    admin: z.any()
  }),
  z.object({
    type: z.literal('SYNC_CBR_RATE'),
    timestamp: z.number()
  })
]);

export const RefillJobSchema = z.object({
  refillId: z.string().min(1)
});

export const SyncJobSchema = z.object({
  providerId: z.string().optional(),
  orderIds: z.array(z.string()).optional()
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
   
  metadata: z.any().optional()
});
