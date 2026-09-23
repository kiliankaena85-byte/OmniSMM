import { describe, it, expect, vi } from 'vitest';
import { verifyBackupIntegrity } from '../../../../scripts/dr-restore-test';
import crypto from 'crypto';
import zlib from 'zlib';
import { db } from '@/lib/db';

describe('PREM-11: Disaster Recovery & Automated Restore Verification', () => {
  it('validates genuine gzipped backup and correct checksum', async () => {
    const rawSql = 'CREATE TABLE test_backup (id int); INSERT INTO test_backup VALUES (1);';
    const backupBuffer = zlib.gzipSync(Buffer.from(rawSql));
    const expectedHash = crypto.createHash('sha256').update(backupBuffer).digest('hex');

    vi.spyOn(db.user, 'count').mockResolvedValueOnce(42);
    vi.spyOn(db.service, 'count').mockResolvedValueOnce(150);

    const res = await verifyBackupIntegrity(backupBuffer, expectedHash);

    expect(res.checksumValid).toBe(true);
    expect(res.canDecompress).toBe(true);
    expect(res.schemaCheckPassed).toBe(true);
    expect(res.sampleUsersCount).toBe(42);
    expect(res.sampleServicesCount).toBe(150);
  });

  it('detects corrupted backup checksum', async () => {
    const backupBuffer = Buffer.from('corrupted_data');
    const wrongHash = '0000000000000000000000000000000000000000000000000000000000000000';

    const res = await verifyBackupIntegrity(backupBuffer, wrongHash);

    expect(res.checksumValid).toBe(false);
  });
});
