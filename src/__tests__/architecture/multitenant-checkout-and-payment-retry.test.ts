/**
 * multitenant-checkout-and-payment-retry.test.ts
 * Тесты целостности мульти-тенантности: повторная оплата, рефералы, почтовый транспорт и кэш.
 * Стандарт SDD-TDD RAC-2026 (OmniSMM 1.0)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { ReferralValidatorService } from '@/services/referral/referral-validator.service';
import { SettingsProvider } from '@/lib/settings';

describe('Multi-Tenant Isolation Hardening (Wave 1-3)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Referral Validator Cross-Tenant Isolation', () => {
    it('should reject referral if inviter and invitee belong to different tenants', async () => {
      // Mock inviter belonging to 'smmplan'
      vi.spyOn(db.user, 'findUnique').mockResolvedValueOnce({
        id: 'user-smmplan-1',
        email: 'inviter@smmplan.pro',
        referralCode: 'PLANREF1',
        tenantId: 'smmplan',
        isDeleted: false,
      } as any);

      // Invitee registers on 'flux'
      const result = await ReferralValidatorService.validateReferralLink(
        'user-smmplan-1',
        null,
        {
          inviteeEmail: 'invitee@smmflux.ru',
          ip: '1.2.3.4',
          tenantId: 'flux',
        }
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('CROSS_TENANT_REFERRAL_FORBIDDEN');
    });

    it('should accept referral if inviter and invitee belong to same tenant', async () => {
      vi.spyOn(db.user, 'findUnique').mockResolvedValueOnce({
        id: 'user-flux-1',
        email: 'inviter@smmflux.ru',
        referralCode: 'FLUXREF1',
        tenantId: 'flux',
        isDeleted: false,
      } as any);

      vi.spyOn(db.user, 'count').mockResolvedValueOnce(0);

      const result = await ReferralValidatorService.validateReferralLink(
        'user-flux-1',
        null,
        {
          inviteeEmail: 'invitee2@smmflux.ru',
          ip: '1.2.3.5',
          tenantId: 'flux',
        }
      );

      expect(result.valid).toBe(true);
      expect(result.riskLevel).toBe('LOW');
    });
  });

  describe('2. Email Settings Per-Tenant Isolation', () => {
    it('should query tenant-specific settings when tenantId is provided', async () => {
      const getEmailSettingsSpy = vi.spyOn(SettingsProvider, 'getEmailSettings').mockResolvedValueOnce({
        emailProvider: 'SMTP',
        resendApiKey: null,
        smtpHost: 'smtp.flux.local',
        smtpPort: 465,
        smtpUser: 'support@smmflux.ru',
        smtpPassword: 'encrypted',
        supportEmailDomain: 'smmflux.ru',
      });

      const { getEmailContext, sendMail } = await import('@/lib/smtp');
      const context = await getEmailContext('flux');

      expect(context.companyName).toBe('SMMflux');
      expect(context.supportDomain).toContain('flux');

      await sendMail('user@test.com', 'Subject', '<p>Text</p>', undefined, 'flux');
      expect(getEmailSettingsSpy).toHaveBeenCalledWith('flux');
    });
  });
});
