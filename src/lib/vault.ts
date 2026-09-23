import 'server-only';
import crypto from 'crypto';
import { encrypt, decrypt } from '@/lib/crypto/encryption';

/**
 * VaultService: Unified encryption handler for sensitive application data.
 * Delegated to centralized AES-256-GCM encryption with Key Versioning support.
 */
export class VaultService {
  /**
   * Encrypts a plain text string into a versioned format: v{version}:iv:authTag:encryptedText
   */
  static encrypt(text: string): string {
    if (!text) return text;
    return encrypt(text);
  }

  /**
   * Decrypts a combined format string back into plain text.
   * Supports both versioned (v1/v2) and legacy 3-part payloads.
   */
  static decrypt(encryptedPayload: string | null | undefined): string {
    if (!encryptedPayload) return '';
    return decrypt(encryptedPayload);
  }

  /**
   * Simple hashing for non-reversible sensitive data (e.g. for search indexing if needed)
   */
  static hash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }
}
