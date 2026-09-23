import { db } from '@/lib/db';

export type SecurityEventPayload = {
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  staffUserId?: string | null;
  targetUserId?: string | null;
  tenantId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
    details?: Record<string, any>;
};

/**
 * Creates and persists a SecurityEvent / AnalyticsEvent in the database.
 */
export async function createSecurityEvent(event: string, payload: SecurityEventPayload): Promise<void> {
  try {
    await db.analyticsEvent.create({
      data: {
        event: `SECURITY_${event}`,
        metadata: {
          severity: payload.severity,
          staffUserId: payload.staffUserId || null,
          targetUserId: payload.targetUserId || null,
          tenantId: payload.tenantId || null,
          ipAddress: payload.ipAddress || null,
          userAgent: payload.userAgent || null,
          ...payload.details
        }
      }
    });
  } catch (err) {
    console.error(`[SecurityEvent] Failed to persist security event ${event}:`, err);
  }
}
