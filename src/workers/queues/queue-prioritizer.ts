/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Queue Tier Prioritizer (Critical, Default, Bulk Queue Segregation).
 */

export type QueueTier = 'critical' | 'default' | 'bulk';

export interface QueueConfig {
  name: string;
  priority: number;
  concurrency: number;
  rateLimit?: {
    max: number;
    duration: number; // in ms
  };
}

export const QUEUE_CONFIGS: Record<QueueTier, QueueConfig> = {
  critical: {
    name: 'critical-queue',
    priority: 10,
    concurrency: 10,
  },
  default: {
    name: 'default-queue',
    priority: 5,
    concurrency: 5,
    rateLimit: {
      max: 50,
      duration: 1000,
    },
  },
  bulk: {
    name: 'bulk-queue',
    priority: 1,
    concurrency: 2,
    rateLimit: {
      max: 10,
      duration: 1000,
    },
  },
};

export class QueuePrioritizer {
  /**
   * Resolves target queue tier based on job type.
   */
  static getQueueTierForJob(jobType: string): QueueTier {
    switch (jobType) {
      case 'OTP_DISPATCH':
      case 'WEBHOOK_PROCESS':
      case 'BALANCE_OPERATION':
      case 'CRITICAL_ORDER_DISPATCH':
        return 'critical';

      case 'ORDER_STATUS_SYNC':
      case 'SEND_EMAIL':
      case 'REFILL_REQUEST':
        return 'default';

      case 'GENERATE_REPORT':
      case 'SHADOW_CATALOG_SYNC':
      case 'MASS_BROADCAST':
      case 'AUDIT_LOG_CLEANUP':
      default:
        return 'bulk';
    }
  }
}
