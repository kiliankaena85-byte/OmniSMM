/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Anti-Fraud Referral Graph Validator (Cycle Detection & IP Clustering Heuristics).
 */

import { db } from '@/lib/db';

export interface ReferralValidationResult {
  valid: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reason?: string;
}

export class ReferralValidatorService {
  /**
   * Recursively traverses up the referral tree to retrieve all ancestor IDs of a user.
   */
  static async getReferralAncestors(userId: string, maxDepth: number = 10): Promise<string[]> {
    const ancestors: string[] = [];
    let currentId: string | null = userId;
    let depth = 0;

    while (currentId && depth < maxDepth) {
      const targetUser: { referredById: string | null } | null = await db.user.findUnique({
        where: { id: currentId },
        select: { referredById: true },
      });

      if (!targetUser || !targetUser.referredById) break;
      if (ancestors.includes(targetUser.referredById)) {
        // Detected existing cycle in database
        break;
      }

      ancestors.push(targetUser.referredById);
      currentId = targetUser.referredById;
      depth++;
    }

    return ancestors;
  }

  /**
   * Validates a prospective referral binding:
   * 1. Self-referral prevention.
   * 2. Cycle graph detection (A -> B -> C -> A).
   * 3. IP clustering heuristic (> 5 referrals from same IP in 24h).
   */
  static async validateReferralLink(
    inviterId: string,
    prospectiveUserId: string | null,
    context?: { ip?: string; userAgent?: string; inviteeEmail?: string; tenantId?: string }
  ): Promise<ReferralValidationResult> {
    if (!inviterId) {
      return { valid: false, riskLevel: 'CRITICAL', reason: 'INVITER_ID_REQUIRED' };
    }

    // 1. Self-referral ban
    if (prospectiveUserId && inviterId === prospectiveUserId) {
      return { valid: false, riskLevel: 'CRITICAL', reason: 'SELF_REFERRAL_FORBIDDEN' };
    }

    const inviter = await db.user.findUnique({
      where: { id: inviterId },
      select: { id: true, email: true, referralCode: true, tenantId: true, isDeleted: true },
    });

    if (!inviter || inviter.isDeleted) {
      return { valid: false, riskLevel: 'CRITICAL', reason: 'INVITER_NOT_FOUND' };
    }

    if (context?.inviteeEmail && inviter.email.toLowerCase() === context.inviteeEmail.toLowerCase()) {
      return { valid: false, riskLevel: 'CRITICAL', reason: 'SELF_REFERRAL_BY_EMAIL' };
    }

    // 1.5. Cross-tenant referral isolation
    if (context?.tenantId && inviter.tenantId !== context.tenantId) {
      return { valid: false, riskLevel: 'HIGH', reason: 'CROSS_TENANT_REFERRAL_FORBIDDEN' };
    }

    // 2. Cycle graph detection: ensure prospective user is not already an ancestor of inviter
    if (prospectiveUserId) {
      const ancestors = await this.getReferralAncestors(inviterId);
      if (ancestors.includes(prospectiveUserId)) {
        return { valid: false, riskLevel: 'CRITICAL', reason: 'CIRCULAR_REFERRAL_DETECTED' };
      }
    }

    // 3. IP Clustering Heuristic
    if (context?.ip && context.ip !== '127.0.0.1') {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const tenantId = context?.tenantId || inviter.tenantId;
      const recentIpReferrals = await db.user.count({
        where: {
          referredById: inviterId,
          createdAt: { gte: oneDayAgo },
          tosAcceptedIp: context.ip,
          ...(tenantId ? { tenantId } : {})
        },
      });

      if (recentIpReferrals >= 5) {
        return { valid: true, riskLevel: 'HIGH', reason: 'IP_CLUSTERING_SUSPICIOUS' };
      }
    }

    return { valid: true, riskLevel: 'LOW' };
  }
}
