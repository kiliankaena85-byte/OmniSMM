import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encrypt, decrypt, reEncrypt } from '@/lib/crypto/encryption';

describe('Encryption Key Versioning & Key Rotation Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Set default single key
    process.env.APP_ENCRYPTION_KEY = 'secret-key-version-1-initial-seed';
    delete process.env.APP_ENCRYPTION_KEYS;
    delete process.env.DATA_ENCRYPTION_KEY;
    delete process.env.VAULT_MASTER_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('1. Encrypts plaintext with v1 default prefix and decrypts successfully', () => {
    const text = 'Sensitive User API Key 12345';
    const encrypted = encrypt(text);

    expect(encrypted.startsWith('v1:')).toBe(true);
    expect(encrypted.split(':').length).toBe(4); // v1:iv:tag:cipher

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(text);
  });

  it('2. Backwards Compatibility: Decrypts legacy 3-part ciphertext without version prefix (iv:tag:cipher)', () => {
    // Construct legacy ciphertext format directly
    const text = 'Legacy Stored Provider Token';
    const encryptedWithV1 = encrypt(text);
    // Strip "v1:" prefix to simulate old database records
    const legacyFormat = encryptedWithV1.replace(/^v1:/, '');
    expect(legacyFormat.split(':').length).toBe(3);

    const decrypted = decrypt(legacyFormat);
    expect(decrypted).toBe(text);
  });

  it('3. Key Rotation: Decrypts v1 data and encrypts new data with v2 when multiple keys are configured', () => {
    // Step 1: Encrypt data under v1
    const v1Data = encrypt('Old Account Credentials Under V1');
    expect(v1Data.startsWith('v1:')).toBe(true);

    // Step 2: Rotate keys (v2 is primary, v1 is maintained for decryption)
    process.env.APP_ENCRYPTION_KEYS = 'v2:brand-new-ultra-secret-key-2026,v1:secret-key-version-1-initial-seed';

    // Step 3: Encrypt new data -> should now use v2 automatically
    const v2Data = encrypt('New Account Credentials Under V2');
    expect(v2Data.startsWith('v2:')).toBe(true);

    // Step 4: Both v1 and v2 records can be decrypted seamlessly
    expect(decrypt(v1Data)).toBe('Old Account Credentials Under V1');
    expect(decrypt(v2Data)).toBe('New Account Credentials Under V2');
  });

  it('4. Re-Encryption: Upgrades legacy or older version ciphertext to the latest active key', () => {
    // Encrypt under v1
    const v1Data = encrypt('Migrating token from v1 to v2');

    // Switch primary to v2
    process.env.APP_ENCRYPTION_KEYS = 'v2:brand-new-ultra-secret-key-2026,v1:secret-key-version-1-initial-seed';

    // Re-encrypt
    const reEncrypted = reEncrypt(v1Data);
    expect(reEncrypted.startsWith('v2:')).toBe(true);
    expect(decrypt(reEncrypted)).toBe('Migrating token from v1 to v2');

    // Calling reEncrypt on already-v2 data is an idempotent no-op
    const again = reEncrypt(reEncrypted);
    expect(again).toBe(reEncrypted);
  });

  it('5. Fail-Closed: Throws on missing key version or corrupted ciphertext', () => {
    // Only configure v2
    process.env.APP_ENCRYPTION_KEYS = 'v2:brand-new-ultra-secret-key-2026';
    delete process.env.APP_ENCRYPTION_KEY;

    // Encrypt under v2
    const v2Data = encrypt('Encrypted under v2');

    // Trying to decrypt legacy v1 ciphertext when v1 is not in registry
    const fakeV1Data = `v1:${v2Data.split(':').slice(1).join(':')}`;
    expect(() => decrypt(fakeV1Data)).toThrow(/Encryption key version "v1" not found in key registry/);

    // Malformed ciphertext
    expect(() => decrypt('invalid-raw-string')).toThrow(/Plaintext or malformed ciphertext payload/);
  });
});
