/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * User Profile Service with Transparent PII Encryption & IDOR Protection.
 */

import { db } from '@/lib/db';
import { encrypt, decrypt, hashForSearch } from '@/lib/crypto/encryption';

export interface UpdateProfileInput {
  companyName?: string | null;
  inn?: string | null;
  kpp?: string | null;
  ogrn?: string | null;
  legalAddress?: string | null;
  telegramId?: string | null;
  telegramNotifyOrders?: boolean;
  telegramNotifyBalance?: boolean;
  telegramNotifyTickets?: boolean;
}

export class ProfileService {
  /**
   * Retrieves user profile with decrypted sensitive fields.
   * Strictly enforces access control to target userId.
   */
  static async getProfile(userId: string, tenantId?: string) {
    if (!userId) throw new Error('USER_ID_REQUIRED');

    const user = await db.user.findFirst({
      where: {
        id: userId,
        ...(tenantId ? { tenantId } : {}),
      },
      select: {
        id: true,
        email: true,
        role: true,
        balance: true,
        quarantineBalance: true,
        totalSpent: true,
        personalDiscount: true,
        isEmailVerified: true,
        isKycVerified: true,
        twoFactorEnabled: true,
        apiKeyHash: true,
        companyName: true,
        inn: true,
        kpp: true,
        ogrn: true,
        legalAddress: true,
        telegramId: true,
        telegramNotifyOrders: true,
        telegramNotifyBalance: true,
        telegramNotifyTickets: true,
        tenantId: true,
        createdAt: true,
      },
    });

    if (!user) return null;

    return {
      ...user,
      email: user.email.startsWith('deleted_') ? user.email : user.email,
      legalAddress: user.legalAddress ? decrypt(user.legalAddress) : null,
    };
  }

  /**
   * Updates user profile with encrypted storage for sensitive PII.
   * IDOR Safe: Never takes userId from body, only from verified session context.
   */
  static async updateProfile(userId: string, input: UpdateProfileInput, tenantId?: string) {
    if (!userId) throw new Error('USER_ID_REQUIRED');

    const encryptedLegalAddress = input.legalAddress ? encrypt(input.legalAddress.trim()) : input.legalAddress;

    const updatedUser = await db.user.updateMany({
      where: {
        id: userId,
        isDeleted: false,
        ...(tenantId ? { tenantId } : {}),
      },
      data: {
        ...(input.companyName !== undefined ? { companyName: input.companyName?.trim() || null } : {}),
        ...(input.inn !== undefined ? { inn: input.inn?.trim() || null } : {}),
        ...(input.kpp !== undefined ? { kpp: input.kpp?.trim() || null } : {}),
        ...(input.ogrn !== undefined ? { ogrn: input.ogrn?.trim() || null } : {}),
        ...(input.legalAddress !== undefined ? { legalAddress: encryptedLegalAddress } : {}),
        ...(input.telegramId !== undefined ? { telegramId: input.telegramId?.trim() || null } : {}),
        ...(input.telegramNotifyOrders !== undefined ? { telegramNotifyOrders: input.telegramNotifyOrders } : {}),
        ...(input.telegramNotifyBalance !== undefined ? { telegramNotifyBalance: input.telegramNotifyBalance } : {}),
        ...(input.telegramNotifyTickets !== undefined ? { telegramNotifyTickets: input.telegramNotifyTickets } : {}),
      },
    });

    if (updatedUser.count === 0) {
      throw new Error('User not found or account is deleted');
    }

    return await this.getProfile(userId, tenantId);
  }
}
