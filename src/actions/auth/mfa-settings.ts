'use server';

import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { generateTotpSecret, verifyTotpToken, generateBackupCodes } from '@/lib/auth/2fa';
import { verifyPassword } from '@/lib/auth/password';
import { SecurityAuditLogger } from '@/lib/security/audit-logger';
import { auditAdminAwaitable } from '@/lib/admin-audit';

/**
 * Retrieves the current 2FA status for the logged-in user.
 */
export async function getTwoFactorStatusAction() {
  const session = await verifySession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      twoFactorEnabled: true,
      role: true,
      twoFactorBackupCodes: true,
    },
  });

  if (!user) return { success: false, error: 'User not found' };

  return {
    success: true,
    data: {
      twoFactorEnabled: Boolean(user.twoFactorEnabled),
      isPrivilegedRole: user.role === 'ADMIN' || user.role === 'OWNER',
      remainingBackupCodesCount: user.twoFactorBackupCodes?.length || 0,
    },
  };
}

/**
 * Initiates 2FA setup: generates a new TOTP secret and backup recovery codes.
 * Stores the unconfirmed secret on the user until confirmed with a valid token.
 */
export async function generateTwoFactorSetupAction() {
  const session = await verifySession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { email: true, role: true, twoFactorEnabled: true },
  });

  if (!user) return { success: false, error: 'User not found' };

  const { secret, otpauthUrl } = generateTotpSecret(user.email, 'SMMplan');
  const { hashBackupCode } = await import('@/lib/auth/2fa');
  const plainCodes = generateBackupCodes(8);
  const hashedCodes = plainCodes.map(hashBackupCode);

  // Store the pending secret and hashed backup codes (twoFactorEnabled remains false until verified)
  await db.user.update({
    where: { id: session.userId },
    data: {
      twoFactorSecret: secret,
      twoFactorBackupCodes: hashedCodes,
    },
  });

  return {
    success: true,
    data: {
      secret,
      otpauthUrl,
      backupCodes: plainCodes,
    },
  };
}

/**
 * Confirms 2FA activation with a 6-digit TOTP code.
 */
export async function confirmTwoFactorAction(totpCode: string) {
  const session = await verifySession();
  if (!session) return { success: false, error: 'Unauthorized' };

  if (!totpCode || totpCode.trim().length !== 6) {
    return { success: false, error: 'Введите корректный 6-значный код' };
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, role: true, twoFactorSecret: true },
  });

  if (!user || !user.twoFactorSecret) {
    return { success: false, error: 'Секрет 2FA не найден. Начните настройку заново.' };
  }

  const isValid = verifyTotpToken(user.twoFactorSecret, totpCode.trim());
  if (!isValid) {
    return { success: false, error: 'Неверный код подтверждения. Проверьте время на устройстве.' };
  }

  await db.user.update({
    where: { id: session.userId },
    data: { twoFactorEnabled: true },
  });

  await SecurityAuditLogger.log({
    event: '2FA_ENABLED',
    userId: user.id,
    email: user.email,
    severity: 'INFO',
  });

  if (user.role === 'ADMIN' || user.role === 'OWNER') {
    await auditAdminAwaitable({
      adminId: user.id,
      adminEmail: user.email,
      action: '2FA_ENABLED_PRIVILEGED',
      target: user.id,
      targetType: 'USER',
      newValue: { twoFactorEnabled: true },
    });
  }

  return { success: true, message: 'Двухфакторная аутентификация успешно активирована' };
}

/**
 * Disables 2FA after password and current TOTP validation.
 */
export async function disableTwoFactorAction(password: string, totpCode: string) {
  const session = await verifySession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, role: true, passwordHash: true, twoFactorSecret: true, twoFactorEnabled: true },
  });

  if (!user) return { success: false, error: 'User not found' };
  if (!user.twoFactorEnabled || !user.twoFactorSecret) {
    return { success: false, error: '2FA не активна' };
  }

  if (user.passwordHash) {
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return { success: false, error: 'Неверный пароль' };
    }
  }

  const isTotpValid = verifyTotpToken(user.twoFactorSecret, totpCode.trim());
  if (!isTotpValid) {
    return { success: false, error: 'Неверный код 2FA' };
  }

  await db.user.update({
    where: { id: session.userId },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: [],
    },
  });

  await SecurityAuditLogger.log({
    event: '2FA_DISABLED',
    userId: user.id,
    email: user.email,
    severity: 'WARNING',
  });

  return { success: true, message: '2FA отключена' };
}
