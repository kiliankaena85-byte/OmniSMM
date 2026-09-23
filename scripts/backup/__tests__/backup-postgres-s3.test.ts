import { describe, it, expect } from 'vitest';
import {
  generateBackup,
  verifyBackupChecksum,
  cleanupRetention,
} from '../backup-postgres-s3';
import { MemoryBackupStorage } from '../storage-provider';

describe('Track 3: Enterprise PostgreSQL S3 Backup', () => {
  const secretKey = 'test-encryption-key-for-backup-suite-2026';

  it('generates an encrypted backup using stream pipeline and AES-256-GCM', async () => {
    const storage = new MemoryBackupStorage();
    const sourceData = Buffer.from('CREATE TABLE accounts (id SERIAL PRIMARY KEY, name TEXT);');

    const metadata = await generateBackup({
      storage,
      encryptionKey: secretKey,
      sourceBuffer: sourceData,
    });

    expect(metadata.backupId).toBeDefined();
    expect(metadata.s3Key).toMatch(/^backups\/postgres\/smmplan-db-/);
    expect(metadata.sha256Checksum).toHaveLength(64);
    expect(metadata.iv).toBeDefined();
    expect(metadata.authTag).toBeDefined();
    expect(metadata.sizeBytes).toBeGreaterThan(0);

    const storedObj = await storage.getObject(metadata.s3Key);
    expect(storedObj).not.toBeNull();
    // Stored payload is encrypted, not raw plaintext
    expect(storedObj?.data.toString('utf-8')).not.toContain('CREATE TABLE accounts');
  });

  it('verifies backup checksum and decrypts payload successfully', async () => {
    const storage = new MemoryBackupStorage();
    const sourceData = Buffer.from('INSERT INTO services (id, name) VALUES (1, "Telegram Members");');

    const metadata = await generateBackup({
      storage,
      encryptionKey: secretKey,
      sourceBuffer: sourceData,
    });

    const verification = await verifyBackupChecksum(metadata.s3Key, metadata.sha256Checksum, {
      storage,
      encryptionKey: secretKey,
      iv: metadata.iv,
      authTag: metadata.authTag,
    });

    expect(verification.isValid).toBe(true);
    expect(verification.isAuthentic).toBe(true);
    expect(verification.sha256).toBe(metadata.sha256Checksum);
    expect(verification.error).toBeUndefined();
  });

  it('fails verification if checksum is tampered or authentication tag is invalid', async () => {
    const storage = new MemoryBackupStorage();
    const sourceData = Buffer.from('SELECT * FROM orders;');

    const metadata = await generateBackup({
      storage,
      encryptionKey: secretKey,
      sourceBuffer: sourceData,
    });

    // Checksum mismatch
    const badChecksum = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const failedChecksum = await verifyBackupChecksum(metadata.s3Key, badChecksum, {
      storage,
      encryptionKey: secretKey,
      iv: metadata.iv,
      authTag: metadata.authTag,
    });
    expect(failedChecksum.isValid).toBe(false);

    // Tampered payload
    const stored = await storage.getObject(metadata.s3Key);
    if (stored) {
      stored.data[0] ^= 0xff; // corrupt a byte
      await storage.putObject(metadata.s3Key, stored.data, stored.metadata);
    }

    const tamperedCheck = await verifyBackupChecksum(metadata.s3Key, metadata.sha256Checksum, {
      storage,
      encryptionKey: secretKey,
      iv: metadata.iv,
      authTag: metadata.authTag,
    });
    expect(tamperedCheck.isValid).toBe(false);
  });

  it('cleans up backups exceeding the retention policy', async () => {
    const storage = new MemoryBackupStorage();

    // Old backup (40 days old)
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    await storage.putObject('backups/postgres/old-backup.sql.gz.enc', Buffer.from('old'), {}, oldDate);

    // Recent backup (2 days old)
    const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await storage.putObject('backups/postgres/recent-backup.sql.gz.enc', Buffer.from('recent'), {}, recentDate);

    const result = await cleanupRetention(30, { storage });

    expect(result.deletedKeys).toContain('backups/postgres/old-backup.sql.gz.enc');
    expect(result.retainedKeys).toContain('backups/postgres/recent-backup.sql.gz.enc');
    expect(result.deletedKeys).toHaveLength(1);
    expect(result.retainedKeys).toHaveLength(1);
  });
});
