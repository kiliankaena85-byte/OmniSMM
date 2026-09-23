import crypto from 'crypto';

const COST_N = 65536;
const LEGACY_N = 16384;
const KEY_LEN = 64;
const MAX_MEM = 128 * 1024 * 1024; // 128MB required by OpenSSL scrypt implementation for N=65536, r=8, p=1

function scryptAsync(password: string | Buffer, salt: string | Buffer, keylen: number, options: crypto.ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/**
 * Хэширует пароль с использованием алгоритма Node.js scrypt (N=65536) и уникальной соли.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, KEY_LEN, { N: COST_N, r: 8, p: 1, maxmem: MAX_MEM });
  return `$s2$${COST_N}$${salt}$${derivedKey.toString('hex')}`;
}

/**
 * Проверяет соответствие пароля хэшу (поддерживает новый формат $s2$65536$... и legacy salt:key).
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    if (!hash) return false;

    if (hash.startsWith('$s2$')) {
      const parts = hash.split('$');
      if (parts.length !== 5) return false;
      const n = parseInt(parts[2], 10) || COST_N;
      const salt = parts[3];
      const keyHex = parts[4];

      const derivedKey = await scryptAsync(password, salt, KEY_LEN, { N: n, r: 8, p: 1, maxmem: MAX_MEM });
      const keyBuffer = Buffer.from(keyHex, 'hex');
      return crypto.timingSafeEqual(keyBuffer, derivedKey);
    }

    // Legacy format: salt:key (N=16384)
    const [salt, key] = hash.split(':');
    if (!salt || !key) return false;

    const derivedKey = await scryptAsync(password, salt, KEY_LEN, { N: LEGACY_N, r: 8, p: 1, maxmem: MAX_MEM });
    const keyBuffer = Buffer.from(key, 'hex');

    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch (e) {
    console.error('[VerifyPassword] Hashing match check failed:', e);
    return false;
  }
}
