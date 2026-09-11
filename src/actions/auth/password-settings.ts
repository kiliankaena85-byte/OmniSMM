'use server';

import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const setPasswordSchema = z.object({
  password: z.string().min(8, "Пароль должен состоять как минимум из 8 символов"),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Пароли не совпадают",
  path: ["confirmPassword"]
});

const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "Новый пароль должен состоять как минимум из 8 символов"),
  confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Пароли не совпадают",
  path: ["confirmPassword"]
});

export async function setPasswordAction(formData: FormData) {
  if (!formData || typeof formData.entries !== 'function') {
    return { success: false, error: "Некорректные данные формы" };
  }
  const session = await verifySession();
  if (!session) {
    return { success: false, error: 'Пожалуйста, войдите в аккаунт' };
  }

  const rawData = Object.fromEntries(formData.entries());
  const parsed = setPasswordSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { password } = parsed.data;

  try {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { passwordHash: true }
    });

    if (!user) {
      return { success: false, error: 'Пользователь не найден' };
    }

    if (user.passwordHash) {
      return { success: false, error: 'У вас уже установлен пароль. Используйте форму смены пароля.' };
    }

    const hashed = await hashPassword(password);

    await db.user.update({
      where: { id: session.userId },
      data: { passwordHash: hashed }
    });

    revalidatePath('/dashboard/settings');
    return { success: true };
  } catch (error: unknown) {
    console.error('Failed to set password:', error);
    return { success: false, error: 'Ошибка сервера при установке пароля' };
  }
}

export async function changePasswordAction(formData: FormData) {
  if (!formData || typeof formData.entries !== 'function') {
    return { success: false, error: "Некорректные данные формы" };
  }
  const session = await verifySession();
  if (!session) {
    return { success: false, error: 'Пожалуйста, войдите в аккаунт' };
  }

  const rawData = Object.fromEntries(formData.entries());
  const parsed = changePasswordSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { currentPassword, newPassword } = parsed.data;

  // Проверяем, авторизовался ли пользователь через Magic Link недавно
  const canResetPassword = session.canResetPassword === true;

  if (!canResetPassword && !currentPassword) {
    return { success: false, error: 'Введите текущий пароль' };
  }

  try {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { passwordHash: true }
    });

    if (!user) {
      return { success: false, error: 'Пользователь не найден' };
    }

    if (!user.passwordHash) {
      return { success: false, error: 'У вас не установлен пароль. Пожалуйста, сначала установите пароль.' };
    }

    if (!canResetPassword) {
      const isMatch = await verifyPassword(currentPassword as string, user.passwordHash);
      if (!isMatch) {
        return { success: false, error: 'Неверный текущий пароль' };
      }
    }

    const hashed = await hashPassword(newPassword);

    await db.user.update({
      where: { id: session.userId },
      data: { passwordHash: hashed }
    });

    // W3-2 SECURITY FIX: Invalidate all existing sessions on password change
    await db.session.deleteMany({
      where: { userId: session.userId }
    });

    // Create a new session for the current device (and clear canResetPassword flag)
    const { createSession, SESSION_COOKIE_NAME } = await import('@/lib/session');
    const { sessionToken, expiresAt } = await createSession(session.userId, false);
    const cookieStore = await import('next/headers').then(m => m.cookies());
    cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      expires: expiresAt,
      sameSite: 'lax',
      path: '/',
    });

    revalidatePath('/dashboard/settings');
    return { success: true };
  } catch (error: unknown) {
    console.error('Failed to change password:', error);
    return { success: false, error: 'Ошибка сервера при смене пароля' };
  }
}
