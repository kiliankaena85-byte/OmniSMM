'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { jwtVerify } from 'jose';
import { getEncodedKey, readSessionTokenFromCookies, clearSessionCookies } from '@/lib/session';

async function deleteSessionFromDB(token?: string) {
  if (token) {
    try {
      const { payload } = await jwtVerify(token, getEncodedKey(), { algorithms: ['HS256'] });
      if (payload.sessionId) {
        await db.session.delete({ where: { id: payload.sessionId as string } }).catch(() => {});
      }
    } catch {
      // ignore validation errors on logout
    }
  }
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const token = readSessionTokenFromCookies(cookieStore);
  await deleteSessionFromDB(token);

  clearSessionCookies(cookieStore);
  cookieStore.set('explicit_logout', 'true', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 5, // 5 minutes
  });

  redirect('/login');
}
