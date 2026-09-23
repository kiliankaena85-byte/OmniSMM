import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { DomainVerificationService } from '@/services/tenant/domain-verification.service';
import { DomainRegistryService } from '@/services/tenant/domain-registry.service';
import dns from 'node:dns/promises';

vi.mock('@/lib/server/rbac', () => ({
  requireStaffPermission: vi.fn((_p, _a, handler) => handler({ id: 'staff_1', email: 'admin@smmplan.pro' })),
}));

describe('Dynamic Domain Verification & DNS Probe (Phase 5)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Metadata & Token Generation', () => {
    it('generates secure domain verification metadata and challenge records', () => {
      const meta = DomainVerificationService.generateDomainMeta('alpha-agency', 'alpha-boost.com');

      expect(meta.customDomain).toBe('alpha-boost.com');
      expect(meta.status).toBe('PENDING');
      expect(meta.verificationToken).toMatch(/^omni_verify_[a-f0-9]{32}$/);
      expect(meta.txtHost).toBe('_omnismm-challenge.alpha-boost.com');
      expect(meta.txtValue).toBe(`omnismm-verify=${meta.verificationToken}`);
      expect(meta.cnameTarget).toBeDefined();
    });

    it('rejects attempts to claim core platform domains as custom domains', () => {
      expect(() => {
        DomainVerificationService.generateDomainMeta('rogue-tenant', 'smmplan.pro');
      }).toThrow(/системный домен/i);

      expect(() => {
        DomainVerificationService.generateDomainMeta('rogue-tenant', 'smmflux.ru');
      }).toThrow(/системный домен/i);
    });
  });

  describe('DNS Probe Logic', () => {
    it('successfully verifies domain via CNAME record matching platform target', async () => {
      vi.spyOn(dns, 'resolveCname').mockResolvedValue(['smmplan.pro']);

      const check = await DomainVerificationService.checkDns(
        'client-portal.com',
        'omni_verify_1234567890abcdef1234567890abcdef',
        'smmplan.pro'
      );

      expect(check.verified).toBe(true);
      expect(check.method).toBe('CNAME');
    });

    it('successfully verifies domain via TXT ownership challenge record', async () => {
      vi.spyOn(dns, 'resolveCname').mockRejectedValue(new Error('ENODATA'));
      vi.spyOn(dns, 'resolveTxt').mockResolvedValue([
        ['some-other-tag=abc'],
        ['omnismm-verify=omni_verify_secret_token_12345678'],
      ]);

      const check = await DomainVerificationService.checkDns(
        'client-portal.com',
        'omni_verify_secret_token_12345678',
        'smmplan.pro'
      );

      expect(check.verified).toBe(true);
      expect(check.method).toBe('TXT');
    });

    it('fails gracefully when neither CNAME nor TXT matches', async () => {
      vi.spyOn(dns, 'resolveCname').mockResolvedValue(['unrelated-host.net']);
      vi.spyOn(dns, 'resolveTxt').mockResolvedValue([['random-txt-record']]);

      const check = await DomainVerificationService.checkDns(
        'client-portal.com',
        'omni_verify_secret_token_12345678',
        'smmplan.pro'
      );

      expect(check.verified).toBe(false);
      expect(check.error).toBeDefined();
    });

    it('handles DNS resolution errors (ENOTFOUND, ETIMEOUT) without crashing', async () => {
      const err = new Error('getaddrinfo ENOTFOUND _omnismm-challenge.nonexistent.com');
      (err as any).code = 'ENOTFOUND';
      vi.spyOn(dns, 'resolveCname').mockRejectedValue(err);
      vi.spyOn(dns, 'resolveTxt').mockRejectedValue(err);

      const check = await DomainVerificationService.checkDns(
        'nonexistent.com',
        'omni_verify_12345',
        'smmplan.pro'
      );

      expect(check.verified).toBe(false);
      expect(check.error).toContain('не найдены');
    });
  });

  describe('End-to-End Tenant Domain Verification', () => {
    it('verifies custom domain, updates SystemSetting, and registers in DomainRegistryService', async () => {
      const dummyMeta = {
        customDomain: 'verified-shop.com',
        verificationToken: 'omni_verify_test_token',
        status: 'PENDING' as const,
        cnameTarget: 'smmplan.pro',
        txtHost: '_omnismm-challenge.verified-shop.com',
        txtValue: 'omnismm-verify=omni_verify_test_token',
      };

      vi.spyOn(db.systemSetting, 'findUnique').mockResolvedValue({
        key: 'tenant_domain_meta_beta-shop',
        value: JSON.stringify(dummyMeta),
        group: 'DOMAIN',
        description: null,
        updatedAt: new Date(),
        updatedBy: null,
      });

      const upsertSpy = vi.spyOn(db.systemSetting, 'upsert').mockResolvedValue({} as any);
      vi.spyOn(DomainRegistryService, 'registerDomain').mockResolvedValue();
      vi.spyOn(dns, 'resolveCname').mockResolvedValue(['smmplan.pro']);

      const result = await DomainVerificationService.verifyDomain('beta-shop');
      expect(result.success).toBe(true);
      expect(result.status).toBe('VERIFIED');
      expect(DomainRegistryService.registerDomain).toHaveBeenCalled();
      expect(upsertSpy).toHaveBeenCalled();
    });
  });

  describe('Server Actions Integration', () => {
    it('getDomainVerificationAction retrieves stored meta for tenant', async () => {
      const { getDomainVerificationAction } = await import('@/actions/admin/tenants');

      const dummyMeta = {
        customDomain: 'agency-direct.com',
        verificationToken: 'omni_verify_111',
        status: 'PENDING' as const,
        cnameTarget: 'smmplan.pro',
        txtHost: '_omnismm-challenge.agency-direct.com',
        txtValue: 'omnismm-verify=omni_verify_111',
      };

      vi.spyOn(DomainVerificationService, 'getDomainMeta').mockResolvedValue(dummyMeta as any);

      const res = await getDomainVerificationAction('gamma-agency');
      expect(res.success).toBe(true);
      if ('data' in res) {
        expect(res.data?.customDomain).toBe('agency-direct.com');
      }
    });

    it('verifyCustomDomainAction executes verification probe and returns updated meta', async () => {
      const { verifyCustomDomainAction } = await import('@/actions/admin/tenants');

      const dummyMeta = {
        customDomain: 'agency-direct.com',
        verificationToken: 'omni_verify_111',
        status: 'VERIFIED' as const,
        cnameTarget: 'smmplan.pro',
        txtHost: '_omnismm-challenge.agency-direct.com',
        txtValue: 'omnismm-verify=omni_verify_111',
      };

      vi.spyOn(DomainVerificationService, 'verifyDomain').mockResolvedValue({
        success: true,
        status: 'VERIFIED',
        meta: dummyMeta as any,
      });

      const res = await verifyCustomDomainAction('gamma-agency');
      expect(res.success).toBe(true);
      if ('status' in res) {
        expect(res.status).toBe('VERIFIED');
      }
      if ('data' in res) {
        expect(res.data?.status).toBe('VERIFIED');
      }
    });

    it('regenerateDomainVerificationTokenAction rotates verification token', async () => {
      const { regenerateDomainVerificationTokenAction } = await import('@/actions/admin/tenants');

      const updatedMeta = {
        customDomain: 'agency-direct.com',
        verificationToken: 'omni_verify_new_token_rotated',
        status: 'PENDING' as const,
        cnameTarget: 'smmplan.pro',
        txtHost: '_omnismm-challenge.agency-direct.com',
        txtValue: 'omnismm-verify=omni_verify_new_token_rotated',
      };

      vi.spyOn(DomainVerificationService, 'regenerateToken').mockResolvedValue(updatedMeta as any);

      const res = await regenerateDomainVerificationTokenAction('gamma-agency');
      expect(res.success).toBe(true);
      if ('data' in res) {
        expect(res.data?.verificationToken).toBe('omni_verify_new_token_rotated');
      }
    });
  });
});
