'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { verifySession, clearSessionCookies } from '@/lib/session';
import { verifyPassword } from '@/lib/auth/password';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'DeleteAccount' });

const deleteSchema = z.object({
  confirmText: z.string(),
  password: z.string().optional(),
});

export async function deleteAccountAction(prevState: unknown, formData: FormData) {
  const session = await verifySession();
  if (!session?.userId) {
    return { success: false, error: 'Вы не авторизованы' };
  }

  const rawConfirmText = formData.get('confirmText');
  const rawPassword = formData.get('password');

  const parsed = deleteSchema.safeParse({
    confirmText: rawConfirmText,
    password: rawPassword || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: 'Неверный формат входных данных' };
  }

  const { confirmText, password } = parsed.data;

  if (confirmText !== 'УДАЛИТЬ') {
    return { success: false, error: 'Для подтверждения необходимо ввести слово "УДАЛИТЬ"' };
  }

  try {
    const userId = session.userId;
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, email: true }
    });

    if (!user) {
      return { success: false, error: 'Пользователь не найден' };
    }

    // Если у пользователя задан пароль — требуем его проверку
    if (user.passwordHash) {
      if (!password) {
        return { success: false, error: 'Для удаления аккаунта требуется ввести пароль' };
      }
      const isMatch = await verifyPassword(password, user.passwordHash);
      if (!isMatch) {
        return { success: false, error: 'Неверный пароль' };
      }
    }

    // Soft delete + anonymization via AccountDeletionService
    const { AccountDeletionService } = await import('@/services/user/account-deletion.service');
    await AccountDeletionService.anonymizeAndDeleteAccount(userId, {
      reason: 'User requested self-service deletion (GDPR Art. 17 / 152-FZ)'
    });

    // Outside the transaction, clear the session cookies and set explicit_logout cookie
    const cookieStore = await cookies();
    clearSessionCookies(cookieStore);
    cookieStore.set('explicit_logout', 'true', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 год
    });

    log.info('Account successfully soft-deleted', { userId, email: user.email });
    return { success: true, error: null };
  } catch (error: unknown) {
    log.error('Account deletion failed', { error: (error instanceof Error ? error.message : String(error)) });
    return { success: false, error: 'Ошибка сервера при удалении аккаунта. Попробуйте позже.' };
  }
}
