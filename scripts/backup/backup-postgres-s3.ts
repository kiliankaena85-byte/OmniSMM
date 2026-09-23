import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import {
  createEncryptionCipher,
  createDecryptionCipher,
  ChecksumTransform,
  deriveEncryptionKey,
} from './crypto-stream';
import {
  type BackupStorageProvider,
  MemoryBackupStorage,
} from './storage-provider';

export interface BackupMetadata {
  backupId: string;
  s3Key: string;
  sha256Checksum: string;
  iv: string;
  authTag: string;
  sizeBytes: number;
  createdAt: string;
}

export interface VerificationResult {
  isValid: boolean;
  isAuthentic: boolean;
  sha256: string;
  sizeBytes: number;
  error?: string;
}

export interface CleanupResult {
  deletedKeys: string[];
  retainedKeys: string[];
  totalProcessed: number;
}

export interface GenerateBackupOptions {
  storage?: BackupStorageProvider;
  encryptionKey?: string;
  sourceStream?: Readable;
  sourceBuffer?: Buffer;
  prefix?: string;
}

export interface VerifyBackupOptions {
  storage?: BackupStorageProvider;
  encryptionKey?: string;
  iv?: string;
  authTag?: string;
}

export interface CleanupRetentionOptions {
  storage?: BackupStorageProvider;
  prefix?: string;
}

const defaultStorage = new MemoryBackupStorage();

function getEncryptionKey(keyString?: string): Buffer {
  const secret = keyString || process.env.BACKUP_ENCRYPTION_KEY || 'default-postgres-backup-secret-key-32b!';
  return deriveEncryptionKey(secret);
}

export async function generateBackup(
  options: GenerateBackupOptions = {}
): Promise<BackupMetadata> {
  const storage = options.storage || defaultStorage;
  const key = getEncryptionKey(options.encryptionKey);
  const backupId = `smmplan-db-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const prefix = options.prefix || 'backups/postgres';
  const s3Key = `${prefix}/${backupId}.sql.gz.enc`;

  const rawData = options.sourceBuffer || Buffer.from(
    `-- SMMPlan PostgreSQL Snapshot\n-- Timestamp: ${new Date().toISOString()}\nSELECT 1;`
  );
  const inputStream = options.sourceStream || Readable.from(rawData);

  const gzip = zlib.createGzip();
  const { cipher, iv } = createEncryptionCipher(key);
  const checksumStream = new ChecksumTransform();

  const chunks: Buffer[] = [];
  checksumStream.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });

  await pipeline(inputStream, gzip, cipher, checksumStream);

  const authTag = cipher.getAuthTag().toString('hex');
  const ivHex = iv.toString('hex');
  const sha256Checksum = checksumStream.getDigest();
  const encryptedPayload = Buffer.concat(chunks);

  const metadata: Record<string, string> = {
    backupId,
    sha256Checksum,
    iv: ivHex,
    authTag,
    createdAt: new Date().toISOString(),
  };

  await storage.putObject(s3Key, encryptedPayload, metadata);

  return {
    backupId,
    s3Key,
    sha256Checksum,
    iv: ivHex,
    authTag,
    sizeBytes: encryptedPayload.length,
    createdAt: metadata.createdAt,
  };
}

export async function verifyBackupChecksum(
  backupKey: string,
  expectedChecksum?: string,
  options: VerifyBackupOptions = {}
): Promise<VerificationResult> {
  const storage = options.storage || defaultStorage;
  const obj = await storage.getObject(backupKey);
  if (!obj) {
    return {
      isValid: false,
      isAuthentic: false,
      sha256: '',
      sizeBytes: 0,
      error: `Backup not found: ${backupKey}`,
    };
  }

  const computedHash = crypto.createHash('sha256').update(obj.data).digest('hex');
  let isValid = true;
  if (expectedChecksum) {
    const computedBuf = Buffer.from(computedHash);
    const expectedBuf = Buffer.from(expectedChecksum);
    isValid = computedBuf.length === expectedBuf.length && crypto.timingSafeEqual(computedBuf, expectedBuf);
  }

  const ivHex = options.iv || obj.metadata?.iv;
  const authTagHex = options.authTag || obj.metadata?.authTag;
  let isAuthentic = false;

  if (ivHex && authTagHex) {
    try {
      const key = getEncryptionKey(options.encryptionKey);
      const decipher = createDecryptionCipher(
        key,
        Buffer.from(ivHex, 'hex'),
        Buffer.from(authTagHex, 'hex')
      );
      const gunzip = zlib.createGunzip();
      await pipeline(Readable.from(obj.data), decipher, gunzip);
      isAuthentic = true;
    } catch {
      isAuthentic = false;
    }
  }

  return {
    isValid: isValid && isAuthentic,
    isAuthentic,
    sha256: computedHash,
    sizeBytes: obj.data.length,
    error: !isValid ? 'Checksum mismatch' : !isAuthentic ? 'Authentication failed' : undefined,
  };
}

export async function cleanupRetention(
  retentionDays: number = 30,
  options: CleanupRetentionOptions = {}
): Promise<CleanupResult> {
  const storage = options.storage || defaultStorage;
  const prefix = options.prefix || 'backups/postgres';
  const objects = await storage.listObjects(prefix);
  const now = Date.now();
  const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;

  const deletedKeys: string[] = [];
  const retainedKeys: string[] = [];

  for (const obj of objects) {
    const age = now - obj.lastModified.getTime();
    if (age > maxAgeMs) {
      await storage.deleteObject(obj.key);
      deletedKeys.push(obj.key);
    } else {
      retainedKeys.push(obj.key);
    }
  }

  return {
    deletedKeys,
    retainedKeys,
    totalProcessed: objects.length,
  };
}
