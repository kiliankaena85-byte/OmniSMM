/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Panel API Key Management Service: Secure SHA-256 Hashing, Generation & Revocation.
 */

import crypto from 'crypto';
import { db } from '@/lib/db';
import { User } from '@prisma/client';

export class ApiKeyService {
  private static readonly KEY_PREFIX = 'smm_live_';

  /**
   * Generates a new secure API Key and returns both the plaintext key (to show once) and its SHA-256 hash.
   */
  static generateKey(): { plainKey: string; keyHash: string; maskedKey: string } {
    const secretBytes = crypto.randomBytes(24).toString('hex');
    const plainKey = `${this.KEY_PREFIX}${secretBytes}`;
    const keyHash = this.hashKey(plainKey);
    const maskedKey = `${this.KEY_PREFIX}${secretBytes.slice(0, 4)}••••••••${secretBytes.slice(-4)}`;

    return { plainKey, keyHash, maskedKey };
  }

  /**
   * Computes constant-time SHA-256 hash of the API key.
   */
  static hashKey(plainKey: string): string {
    const normalized = plainKey.trim();
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Validates an incoming API key against the database hash.
   */
  static async authenticate(plainKey?: string | null): Promise<User | null> {
    if (!plainKey || plainKey.length < 16) return null;

    try {
      const hashedKey = this.hashKey(plainKey);
      const user = await db.user.findUnique({
        where: { apiKeyHash: hashedKey },
      });

      if (!user || !user.isActive || user.isDeleted) {
        return null;
      }

      return user;
    } catch (err) {
      console.error('[ApiKeyService] Auth lookup failed:', err);
      return null;
    }
  }

  /**
   * Assigns a newly generated API key to a user, replacing any previous key.
   */
  static async assignNewKeyToUser(userId: string): Promise<{ plainKey: string; maskedKey: string }> {
    const { plainKey, keyHash, maskedKey } = this.generateKey();

    await db.user.update({
      where: { id: userId },
      data: { apiKeyHash: keyHash },
    });

    return { plainKey, maskedKey };
  }

  /**
   * Revokes (deletes) the API key of a user.
   */
  static async revokeKey(userId: string): Promise<void> {
    await db.user.update({
      where: { id: userId },
      data: { apiKeyHash: null },
    });
  }
}
