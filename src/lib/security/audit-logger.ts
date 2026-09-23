/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * SIEM-Ready Security Event Logger (Structured JSON Security Auditing).
 */

import { db } from '@/lib/db';

export type SecurityEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | '2FA_ENABLED'
  | '2FA_DISABLED'
  | '2FA_VERIFIED'
  | '2FA_FAILED'
  | 'RATE_LIMIT_HIT'
  | 'BRUTE_FORCE_BLOCKED'
  | 'API_KEY_USED'
  | 'API_KEY_ROTATED'
  | 'API_KEY_REVOKED'
  | 'IDOR_BLOCKED';

export interface SecurityEventPayload {
  event: SecurityEventType;
  userId?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
  tenantId?: string;
  details?: Record<string, unknown>;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
}

export class SecurityAuditLogger {
  /**
   * Logs a structured security event for SIEM analysis and database audit trail.
   */
  static async log(payload: SecurityEventPayload): Promise<void> {
    const timestamp = new Date().toISOString();
    const structuredLog = {
      timestamp,
      severity: payload.severity || 'INFO',
      event: payload.event,
      userId: payload.userId,
      email: payload.email,
      ip: payload.ip || '127.0.0.1',
      userAgent: payload.userAgent || 'unknown',
      tenantId: payload.tenantId || 'smmplan',
      details: payload.details || {},
    };

    // Standard out formatted as JSON for log aggregators (Vector / Datadog / Elastic)
    console.info(`[SIEM_SECURITY_EVENT] ${JSON.stringify(structuredLog)}`);

    try {
      await db.securityEvent.create({
        data: {
          event: payload.event,
          severity: payload.severity || 'INFO',
          ip: payload.ip || '127.0.0.1',
          details: {
            ...payload.details,
            userId: payload.userId,
            email: payload.email,
            userAgent: payload.userAgent,
            tenantId: payload.tenantId,
            timestamp,
          },
        },
      });
    } catch (err) {
      console.error('[SecurityAuditLogger] Failed to write event to DB:', err);
    }
  }
}
