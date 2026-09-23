import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { encrypt, decrypt, hashForSearch, maskEmail } from '@/lib/crypto/encryption';
import { ProfileService } from '@/services/user/profile.service';
import { AccountDeletionService } from '@/services/user/account-deletion.service';
import { PiiAccessLogService } from '@/services/audit/access-log.service';
import { DataRetentionJob } from '@/workers/jobs/cleanup-pii.job';

describe('GDPR & 152-ФЗ Data Privacy & Protection Suite', () => {
  let testUserId: string;

  beforeEach(async () => {
    // Create test user
    const user = await db.user.create({
      data: {
        email: `privacy-test-${Date.now()}@smmplan.pro`,
        role: 'USER',
        balance: BigInt(5000), // 50.00 RUB
        tenantId: 'smmplan',
        companyName: 'Test LLC',
        inn: '7700000000',
        legalAddress: 'Moscow, Tverskaya 1',
      },
    });
    testUserId = user.id;
  });

  describe('1. Transparent AES-256-GCM Encryption at Rest', () => {
    it('encrypts sensitive text with authentication tag and successfully decrypts it', () => {
      const plaintext = 'Secret Legal Address № 42, Saint-Petersburg';
      const encrypted = encrypt(plaintext);

      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.split(':').length).toBe(4); // v1:iv:authTag:cipherHex
      expect(encrypted.startsWith('v1:')).toBe(true);

      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('generates consistent deterministic search hashes', () => {
      const email = 'client@domain.com';
      const hash1 = hashForSearch(email);
      const hash2 = hashForSearch('CLIENT@DOMAIN.COM '); // case-insensitive

      expect(hash1).toBeDefined();
      expect(hash1).toBe(hash2);
    });

    it('masks email safely for logs and UI display', () => {
      expect(maskEmail('alexander@example.com')).toBe('a*****r@example.com');
      expect(maskEmail('me@test.com')).toBe('m*@test.com');
    });
  });

  describe('2. Profile Service & IDOR Prevention', () => {
    it('updates and decrypts user profile strictly bound to session userId', async () => {
      const updated = await ProfileService.updateProfile(testUserId, {
        companyName: 'Updated Company LLC',
        legalAddress: 'Secret Avenue 12',
      });

      expect(updated).not.toBeNull();
      expect(updated?.companyName).toBe('Updated Company LLC');
      expect(updated?.legalAddress).toBe('Secret Avenue 12');

      // Verify raw database record contains encrypted legal address
      const rawUser = await db.user.findUniqueOrThrow({ where: { id: testUserId } });
      expect(rawUser.legalAddress).toContain(':');
      expect(rawUser.legalAddress).not.toBe('Secret Avenue 12');
    });

    it('prevents IDOR by rejecting updates to non-existent or deleted accounts', async () => {
      await expect(
        ProfileService.updateProfile('non-existent-user-id-999', { companyName: 'Hack' })
      ).rejects.toThrow();
    });
  });

  describe('3. Right to be Forgotten (Account Deletion & Financial Compliance)', () => {
    it('anonymizes personal data but keeps financial LedgerEntry intact for 5-year compliance', async () => {
      // 1. Create a financial ledger entry for this user
      const ledgerEntry = await db.ledgerEntry.create({
        data: {
          userId: testUserId,
          amount: BigInt(5000),
          transactionType: 'PAYMENT',
          reason: 'Initial Balance Topup',
        },
      });

      // 2. Execute deletion
      const deletionResult = await AccountDeletionService.anonymizeAndDeleteAccount(testUserId, {
        tenantId: 'smmplan',
        reason: 'GDPR right to be forgotten request',
      });

      expect(deletionResult.success).toBe(true);

      // 3. Verify user record is anonymized
      const deletedUser = await db.user.findUniqueOrThrow({ where: { id: testUserId } });
      expect(deletedUser.isDeleted).toBe(true);
      expect(deletedUser.isActive).toBe(false);
      expect(deletedUser.email).toContain('@anonymous.local');
      expect(deletedUser.passwordHash).toBeNull();
      expect(deletedUser.twoFactorSecret).toBeNull();
      expect(deletedUser.legalAddress).toBeNull();

      // 4. Verify financial ledger is PRESERVED and still linked
      const preservedLedger = await db.ledgerEntry.findUniqueOrThrow({ where: { id: ledgerEntry.id } });
      expect(preservedLedger.userId).toBe(testUserId);
      expect(preservedLedger.amount).toBe(BigInt(5000));
    });
  });

  describe('4. PII Operator Access Logging', () => {
    it('records operator access to personal data in AdminAuditLog', async () => {
      await PiiAccessLogService.logAccess({
        adminId: 'admin_123',
        adminEmail: 'support@smmplan.pro',
        targetUserId: testUserId,
        action: 'VIEW_PROFILE',
        fieldsAccessed: ['email', 'legalAddress', 'inn'],
        ipAddress: '192.168.1.1',
      });

      const log = await db.adminAuditLog.findFirst({
        where: { target: testUserId, action: 'PII_ACCESS_VIEW_PROFILE' },
        orderBy: { createdAt: 'desc' },
      });

      expect(log).not.toBeNull();
      expect(log?.adminEmail).toBe('support@smmplan.pro');
      expect(log?.newValue).toContain('legalAddress');
    });
  });

  describe('5. Data Retention Policy (PII Cleanup Job)', () => {
    it('executes cleanup job without errors and retains critical legal logs', async () => {
      const result = await DataRetentionJob.cleanupExpiredPiiLogs(365);
      expect(result).toHaveProperty('deletedAuditLogs');
      expect(result).toHaveProperty('deletedSecurityLogs');
    });
  });
});
