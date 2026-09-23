import crypto from 'node:crypto';
import { Transform, type TransformCallback } from 'node:stream';

export interface EncryptionResult {
  iv: string;
  authTag: string;
}

export function createEncryptionCipher(key: Buffer, iv?: Buffer): {
  cipher: crypto.CipherGCM;
  iv: Buffer;
} {
  const generatedIv = iv ?? crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, generatedIv) as crypto.CipherGCM;
  return { cipher, iv: generatedIv };
}

export function createDecryptionCipher(
  key: Buffer,
  iv: Buffer,
  authTag: Buffer
): crypto.DecipherGCM {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv) as crypto.DecipherGCM;
  decipher.setAuthTag(authTag);
  return decipher;
}

export class ChecksumTransform extends Transform {
  private hash = crypto.createHash('sha256');
  private totalBytes = 0;

  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    this.hash.update(chunk);
    this.totalBytes += chunk.length;
    this.push(chunk);
    callback();
  }

  getDigest(): string {
    return this.hash.digest('hex');
  }

  getBytesProcessed(): number {
    return this.totalBytes;
  }
}

export function deriveEncryptionKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}
