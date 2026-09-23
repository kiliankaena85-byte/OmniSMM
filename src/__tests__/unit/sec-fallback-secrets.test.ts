import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getShieldSecret, _resetDevShieldSecretForTest } from '@/lib/security/ddos-shield/shield-secret';
import { GET as challengeGet } from '@/app/api/security/challenge/route';
import { generateBackup } from '../../../scripts/backup/backup-postgres-s3';
import { MemoryBackupStorage } from '../../../scripts/backup/storage-provider';

describe('SEC-03 & SEC-04: Fail-Closed Elimination of Fallback Secrets', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    _resetDevShieldSecretForTest();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    _resetDevShieldSecretForTest();
  });

  describe('SEC-03: DDoS Shield Secret Resolution', () => {
    it('fails closed in production if no secret is configured', () => {
      (process.env as any).NODE_ENV = 'production';
      delete process.env.DDOS_SHIELD_SECRET;
      delete process.env.JWT_SIGNING_KEY;
      delete process.env.JWT_SECRET;

      expect(() => getShieldSecret()).toThrowError(/\[CRITICAL SEC-03\]/);
    });

    it('returns configured secret in production when provided', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.DDOS_SHIELD_SECRET = 'super-secret-production-key-32chars!';

      expect(getShieldSecret()).toBe('super-secret-production-key-32chars!');
    });

    it('generates a random ephemeral 64-char hex secret in development if unconfigured', () => {
      (process.env as any).NODE_ENV = 'development';
      delete process.env.DDOS_SHIELD_SECRET;
      delete process.env.JWT_SIGNING_KEY;
      delete process.env.JWT_SECRET;

      const secret1 = getShieldSecret();
      expect(secret1).toHaveLength(64);
      expect(secret1).not.toBe('omnismm-ddos-shield-fallback-secret-2026');

      // Subsequent calls in the same runtime reuse the generated secret
      const secret2 = getShieldSecret();
      expect(secret2).toBe(secret1);
    });

    it('returns 500 from /api/security/challenge in production when secret is unconfigured', async () => {
      (process.env as any).NODE_ENV = 'production';
      delete process.env.DDOS_SHIELD_SECRET;
      delete process.env.JWT_SIGNING_KEY;
      delete process.env.JWT_SECRET;

      const res = await challengeGet();
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toMatch(/service unavailable/i);
    });
  });

  describe('SEC-04: PostgreSQL S3 Backup Encryption Key', () => {
    it('fails closed if no encryption key is passed and BACKUP_ENCRYPTION_KEY is unset', async () => {
      delete process.env.BACKUP_ENCRYPTION_KEY;
      const storage = new MemoryBackupStorage();

      await expect(
        generateBackup({ storage })
      ).rejects.toThrowError(/\[SEC-04 Fail-Closed\] BACKUP_ENCRYPTION_KEY is required/);
    });

    it('fails closed if encryption key is shorter than 32 characters', async () => {
      const storage = new MemoryBackupStorage();

      await expect(
        generateBackup({ storage, encryptionKey: 'too-short-key' })
      ).rejects.toThrowError(/at least 32 characters long/);
    });

    it('successfully generates backup when valid 32+ character key is provided', async () => {
      const storage = new MemoryBackupStorage();
      const validKey = 'my-ultra-secure-encryption-key-for-database-backups-2026!';

      const metadata = await generateBackup({
        storage,
        encryptionKey: validKey,
      });

      expect(metadata.backupId).toBeDefined();
      expect(metadata.sha256Checksum).toHaveLength(64);
      expect(metadata.iv).toBeDefined();
      expect(metadata.authTag).toBeDefined();
    });
  });
});
