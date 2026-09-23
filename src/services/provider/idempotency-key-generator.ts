/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Deterministic Idempotency Key Generator for External Provider Dispatch.
 */

import crypto from 'crypto';

export interface DispatchIdempotencyParams {
  orderId?: string;
  userId: string;
  serviceId: string;
  link: string;
  quantity: number;
  runs?: number;
  customData?: string;
}

export class ProviderIdempotencyGenerator {
  /**
   * Computes a deterministic SHA-256 idempotency key from order parameters.
   */
  static generateKey(params: DispatchIdempotencyParams): string {
    const normalizedLink = params.link.trim().toLowerCase().replace(/\/+$/, '');
    const raw = `${params.orderId || ''}:${params.userId}:${params.serviceId}:${normalizedLink}:${params.quantity}:${params.runs || 1}:${params.customData || ''}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }
}
