/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * GDPR & 152-FZ Encryption at Rest (AES-256-GCM & Search Hashing).
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const DEFAULT_KEY_VERSION = 'v1';

/**
 * Key Registry for Versioned Key Rotation.
 * Parses APP_ENCRYPTION_KEYS (format: "v2:hex_or_secret,v1:hex_or_secret")
 * or falls back to singular APP_ENCRYPTION_KEY / DATA_ENCRYPTION_KEY / VAULT_MASTER_KEY as v1.
 */
interface KeyRegistry {
  primaryVersion: string;
  keys: Map<string, Buffer>;
}

function deriveKeyBuffer(secret: string): Buffer {
  // If exactly 64 hex characters (32 bytes hex), parse directly as Buffer for legacy VaultService compatibility
  if (secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)) {
    return Buffer.from(secret, 'hex');
  }
  // Otherwise, use SHA-256 hash to generate deterministic 32-byte key
  return createHash('sha256').update(secret).digest();
}

function getKeyRegistry(): KeyRegistry {
  const keysMap = new Map<string, Buffer>();
  let primaryVersion = DEFAULT_KEY_VERSION;

  // 1. Check for multi-key versioning environment variable
  const multiKeysStr = process.env.APP_ENCRYPTION_KEYS;
  if (multiKeysStr && multiKeysStr.trim()) {
    const entries = multiKeysStr.split(',').map(e => e.trim()).filter(Boolean);
    let isFirst = true;
    for (const entry of entries) {
      const colonIdx = entry.indexOf(':');
      if (colonIdx === -1) {
        throw new Error(`[Encryption] Malformed APP_ENCRYPTION_KEYS entry "${entry}". Expected format "vX:secret"`);
      }
      const version = entry.substring(0, colonIdx).trim().toLowerCase();
      const secret = entry.substring(colonIdx + 1).trim();
      if (!version || !secret) {
        throw new Error(`[Encryption] Empty version or secret in APP_ENCRYPTION_KEYS entry "${entry}"`);
      }
      keysMap.set(version, deriveKeyBuffer(secret));

      // The first listed key is treated as the primary (latest) key for new encryptions
      if (isFirst) {
        primaryVersion = version;
        isFirst = false;
      }
    }
  }

  // 2. Singular fallback keys
  const singleKeyStr = process.env.APP_ENCRYPTION_KEY || process.env.DATA_ENCRYPTION_KEY || process.env.VAULT_MASTER_KEY;
  if (singleKeyStr) {
    const singleBuffer = deriveKeyBuffer(singleKeyStr);
    // If not already in map under v1, assign it
    if (!keysMap.has(DEFAULT_KEY_VERSION)) {
      keysMap.set(DEFAULT_KEY_VERSION, singleBuffer);
    }
    if (keysMap.size === 1) {
      primaryVersion = DEFAULT_KEY_VERSION;
    }
  }

  if (keysMap.size === 0) {
    throw new Error('[Encryption] APP_ENCRYPTION_KEY, APP_ENCRYPTION_KEYS or DATA_ENCRYPTION_KEY must be configured in environment');
  }

  // Security Invariant: Abort if default placeholder is left in production (P3-22)
  if (process.env.NODE_ENV === 'production') {
    const rawKey = singleKeyStr || '';
    if (rawKey.includes('CHANGE_ME') || rawKey.includes('GENERATE_WITH') || rawKey.includes('INSECURE')) {
      throw new Error('FATAL [SECURITY]: Insecure default APP_ENCRYPTION_KEY placeholder detected in production environment!');
    }
  }

  return { primaryVersion, keys: keysMap };
}

const getKeyForVersion = (version?: string): { key: Buffer; version: string } => {
  const registry = getKeyRegistry();
  if (!version) {
    const key = registry.keys.get(registry.primaryVersion);
    if (!key) {
      throw new Error(`[Encryption] Primary key version "${registry.primaryVersion}" not found in key registry`);
    }
    return { key, version: registry.primaryVersion };
  }

  const key = registry.keys.get(version.toLowerCase());
  if (!key) {
    throw new Error(`[Encryption] Encryption key version "${version}" not found in key registry. Please configure it in APP_ENCRYPTION_KEYS.`);
  }
  return { key, version };
};

const getSalt = (): string => {
  const salt = process.env.DATA_SALT;
  if (!salt) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[Encryption] DATA_SALT must be configured in production');
    }
    // In dev/test, derive deterministic salt from encryption key only
    const singleKeyStr = process.env.APP_ENCRYPTION_KEY || process.env.DATA_ENCRYPTION_KEY || process.env.VAULT_MASTER_KEY || 'dev_secret_key';
    return createHash('sha256').update(`${singleKeyStr}:salt_derive`).digest('hex');
  }
  return salt;
};

/**
 * Encrypts plaintext string using AES-256-GCM with random IV and key versioning.
 * Output format: v{version}:{iv}:{authTag}:{cipherHex} (e.g. v1:iv:tag:cipher)
 */
export function encrypt(text: string, forcedVersion?: string): string {
  if (!text || typeof text !== 'string') return text;

  const iv = randomBytes(IV_LENGTH);
  const { key, version } = getKeyForVersion(forcedVersion);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${version}:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts AES-256-GCM ciphertext.
 * Supports:
 *  - Versioned payloads: "v{version}:{iv}:{authTag}:{cipherHex}" (4 parts)
 *  - Legacy unversioned payloads: "{iv}:{authTag}:{cipherHex}" (3 parts, treated as v1)
 * Fail-fast: throws on malformed payload or authentication tag mismatch.
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData || typeof encryptedData !== 'string') return encryptedData;

  const parts = encryptedData.split(':');
  let version = DEFAULT_KEY_VERSION;
  let ivHex = '';
  let authTagHex = '';
  let encrypted = '';

  if (parts.length === 4 && parts[0].startsWith('v')) {
    // Versioned payload: v2:iv:authTag:cipher
    version = parts[0];
    ivHex = parts[1];
    authTagHex = parts[2];
    encrypted = parts[3];
  } else if (parts.length === 3) {
    // Legacy unversioned payload: iv:authTag:cipher (assumed v1)
    version = DEFAULT_KEY_VERSION;
    ivHex = parts[0];
    authTagHex = parts[1];
    encrypted = parts[2];
  } else {
    throw new Error('[Encryption] Plaintext or malformed ciphertext payload detected. Access denied.');
  }

  try {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const { key } = getKeyForVersion(version);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    console.error(`[Encryption] Decryption failed for version ${version}:`, err instanceof Error ? err.message : String(err));
    throw new Error(`[Encryption] Decryption failed or ciphertext is corrupted (key version: ${version}): ${err instanceof Error ? err.message : String(err)}`, { cause: err });
  }
}

/**
 * Re-encrypts ciphertext with the latest (primary) encryption key.
 * If data is already encrypted with the primary key, returns it unchanged.
 */
export function reEncrypt(encryptedData: string): string {
  if (!encryptedData || typeof encryptedData !== 'string') return encryptedData;
  const registry = getKeyRegistry();
  const parts = encryptedData.split(':');
  
  if (parts.length === 4 && parts[0] === registry.primaryVersion) {
    return encryptedData; // Already on primary version
  }

  const decrypted = decrypt(encryptedData);
  return encrypt(decrypted);
}

/**
 * Computes deterministic HMAC/SHA-256 search hash for indexing and unique constraints.
 */
export function hashForSearch(value: string): string {
  if (!value || typeof value !== 'string') return '';
  const normalized = value.trim().toLowerCase();
  return createHash('sha256').update(`${normalized}:${getSalt()}`).digest('hex');
}

/**
 * Masks an email for safe logs/UI (e.g. j***n@example.com).
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '••••••••';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}*@${domain}`;
  }
  return `${local[0]}${'*'.repeat(Math.min(local.length - 2, 5))}${local.slice(-1)}@${domain}`;
}
