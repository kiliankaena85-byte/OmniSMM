import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlfaBankService } from '@/services/financial/bank-integrations/alfa-bank.service';
import { syncAlfaBankBalanceAction } from '@/actions/admin/finance/bank-sync';
import { getTreasuryFinancialHealthAction } from '@/actions/admin/finance/treasury';
import { db } from '@/lib/db';

import * as rbac from '@/lib/server/rbac';

describe('Alfa-Bank Open API Integration & Automated Treasury Sync Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(rbac, 'requireStaffPermission').mockImplementation(async (_res: any, _act: any, callback: any) => {
      return callback({ id: 'admin_test_1', email: 'admin@smmplan.pro', role: 'SUPER_ADMIN', tenantId: 'smmplan' });
    });
  });

  describe('1. Account Number Masking & Security Invariants', () => {
    it('correctly masks 20-digit Russian settlement account numbers', () => {
      const masked = AlfaBankService.maskAccountNumber('40802810900001234567');
      expect(masked).toBe('40802810****4567');
    });

    it('handles short or malformed account numbers safely', () => {
      expect(AlfaBankService.maskAccountNumber('')).toBe('40802810****0000');
      expect(AlfaBankService.maskAccountNumber('12345')).toBe('12345');
    });
  });

  describe('2. Sandbox & Live Open API Balance Retrieval', () => {
    it('returns default sandbox balance when API key is not configured', async () => {
      const res = await AlfaBankService.getLiveBalance('smmplan', true);

      expect(res.success).toBe(true);
      expect(res.bank).toBe('ALFA_BANK');
      expect(res.account?.isSandbox).toBe(true);
      expect(res.account?.authorizedBalanceRub).toBe(1450000);
      expect(res.account?.maskedAccountNumber).toBe('40802810****4567');
    });

    it('correctly parses real Alfa-Bank Open API JSON response', async () => {
      const originalApiKey = process.env.ALFA_BANK_API_KEY;
      const originalSandbox = process.env.ALFA_BANK_IS_SANDBOX;

      process.env.ALFA_BANK_API_KEY = 'alfa_prod_token_test_123';
      process.env.ALFA_BANK_IS_SANDBOX = 'false';

      const mockAlfaResponse = {
        accounts: [
          {
            accountNumber: '40802810500009998888',
            currency: 'RUB',
            status: 'ACTIVE',
            balance: {
              authorizedBalance: 2350000.75,
              availableBalance: 2350000.75,
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAlfaResponse,
      } as any);

      const res = await AlfaBankService.getLiveBalance('smmplan', true);

      expect(res.success).toBe(true);
      expect(res.account?.authorizedBalanceRub).toBe(2350000.75);
      expect(res.account?.maskedAccountNumber).toBe('40802810****8888');
      expect(res.account?.isSandbox).toBe(false);

      // Restore environment
      process.env.ALFA_BANK_API_KEY = originalApiKey;
      process.env.ALFA_BANK_IS_SANDBOX = originalSandbox;
    });

    it('gracefully handles 500 error from Alfa-Bank API without crashing', async () => {
      const originalApiKey = process.env.ALFA_BANK_API_KEY;
      const originalSandbox = process.env.ALFA_BANK_IS_SANDBOX;

      process.env.ALFA_BANK_API_KEY = 'alfa_token_failing';
      process.env.ALFA_BANK_IS_SANDBOX = 'false';

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      } as any);

      const res = await AlfaBankService.getLiveBalance('smmplan', true);

      expect(res.success).toBe(false);
      expect(res.error).toContain('Alfa-Bank API HTTP 503');

      process.env.ALFA_BANK_API_KEY = originalApiKey;
      process.env.ALFA_BANK_IS_SANDBOX = originalSandbox;
    });
  });

  describe('3. Server Actions & Treasury Integration', () => {
    it('executes syncAlfaBankBalanceAction successfully', async () => {
      const actionRes = await syncAlfaBankBalanceAction('smmplan', true);

      expect(actionRes.success).toBe(true);
      expect(actionRes.account?.authorizedBalanceRub).toBeGreaterThan(0);
    });

    it('automatically populates Alfa-Bank balance in getTreasuryFinancialHealthAction', async () => {
      vi.spyOn(db.user, 'aggregate').mockResolvedValue({
        _sum: { balance: BigInt(20000000), bonusBalance: BigInt(5000000) },
      } as any);
      vi.spyOn(db.order, 'aggregate').mockResolvedValue({
        _sum: { providerCost: BigInt(3000000) },
      } as any);
      vi.spyOn(db.payment, 'aggregate').mockResolvedValue({
        _sum: { amount: BigInt(50000000) },
      } as any);

      const treasuryRes = await getTreasuryFinancialHealthAction('smmplan');

      expect(treasuryRes.success).toBe(true);
      expect(treasuryRes.bankSource).toBe('ALFA_BANK_API');
      expect(treasuryRes.bankAccount?.maskedAccountNumber).toBeDefined();
      expect(treasuryRes.bankAccount?.authorizedBalanceRub).toBe(1450000);
      expect(treasuryRes.data?.customerRealDepositsRub).toBe(200000);
      expect(treasuryRes.data?.safeOwnerDrawCapacityRub).toBeGreaterThan(0);
    });

    it('correctly aggregates financial health across all tenants when tenantId is all', async () => {
      vi.spyOn(db.user, 'aggregate').mockResolvedValue({
        _sum: { balance: BigInt(40000000), bonusBalance: BigInt(10000000) },
      } as any);
      vi.spyOn(db.order, 'aggregate').mockResolvedValue({
        _sum: { providerCost: BigInt(6000000) },
      } as any);
      vi.spyOn(db.payment, 'aggregate').mockResolvedValue({
        _sum: { amount: BigInt(100000000) },
      } as any);

      const treasuryRes = await getTreasuryFinancialHealthAction('all');

      expect(treasuryRes.success).toBe(true);
      expect(treasuryRes.bankSource).toBe('ALFA_BANK_API');
      expect(treasuryRes.bankAccount?.authorizedBalanceRub).toBe(1450000);
      expect(treasuryRes.data?.customerRealDepositsRub).toBe(400000);
    });

    it('successfully executes testAlfaBankConnectionAction', async () => {
      const { testAlfaBankConnectionAction } = await import('@/actions/admin/settings');
      const res = await testAlfaBankConnectionAction('smmplan');

      expect(res.success).toBe(true);
      if ('pingMs' in res) {
        expect(res.pingMs).toBeGreaterThanOrEqual(0);
        expect(res.message).toContain('Связь с Альфа-Банком установлена');
        expect(res.balance).toBe(1450000);
      }
    });

    it('correctly reads encrypted credentials from db.systemSettings', async () => {
      const { VaultService } = await import('@/lib/vault');
      const rawSecret = 'alfa_token_db_encrypted_test';
      const encryptedSecret = VaultService.encrypt(rawSecret);

      vi.spyOn(db.systemSettings, 'findUnique').mockResolvedValue({
        id: 'smmplan',
        alfaBankApiKey: encryptedSecret,
        alfaBankAccountNumber: '40802810500007776666',
        alfaBankIsSandbox: true,
        alfaBankApiBaseUrl: 'https://business.alfabank.ru/ext-api/v1',
      } as any);

      const res = await AlfaBankService.getLiveBalance('smmplan', true);

      expect(res.success).toBe(true);
      expect(res.account?.accountNumber).toBe('40802810500007776666');
      expect(res.account?.maskedAccountNumber).toBe('40802810****6666');
      expect(res.account?.isSandbox).toBe(true);
    });
  });
});
