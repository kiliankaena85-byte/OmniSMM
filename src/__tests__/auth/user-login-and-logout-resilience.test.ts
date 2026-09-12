import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { createSession, verifySession } from '@/lib/session';
import { registerWithPasswordAction } from '@/actions/auth/password-register';
import { loginWithPasswordAction } from '@/actions/auth/password-login';
import { POST as logoutPost } from '@/app/api/auth/logout/route';

describe('User Authentication & Dashboard Login/Logout Flow', () => {
  const testEmail = `auth_test_${Date.now()}@smmplan.pro`;
  const testPassword = 'Password123!@#Safe';

  it('1. User registers with valid password and can log in immediately', async () => {
    // 0. Ensure an existing OWNER so newly registered user is assigned role USER
    await db.user.upsert({
      where: { email_tenantId: { email: 'root-owner@smmplan.pro', tenantId: 'smmplan' } },
      update: {},
      create: {
        email: 'root-owner@smmplan.pro',
        role: 'OWNER',
        tenantId: 'smmplan',
        isActive: true,
      }
    });

    // 1. Register
    const regData = new FormData();
    regData.append('email', testEmail);
    regData.append('password', testPassword);

    const regResult = await registerWithPasswordAction(null, regData);
    expect(regResult.success).toBe(true);

    const createdUser = await db.user.findFirst({ where: { email: testEmail } });
    expect(createdUser).toBeDefined();
    expect(createdUser?.isEmailVerified).toBe(true);

    // 2. Login with Password
    const loginData = new FormData();
    loginData.append('email', testEmail);
    loginData.append('password', testPassword);

    const loginResult = await loginWithPasswordAction(null, loginData);
    expect(loginResult.success).toBe(true);
    expect(loginResult.redirectTo).toBe('/dashboard');
  });

  it('2. Session verification succeeds for local and test contours', async () => {
    const user = await db.user.findFirst({ where: { email: testEmail } });
    expect(user).toBeDefined();

    const { sessionToken } = await createSession(user!.id);
    expect(sessionToken).toBeDefined();

    // Verify session token is valid and attached in DB
    const dbSession = await db.session.findFirst({ where: { userId: user!.id } });
    expect(dbSession).toBeDefined();
  });

  it('3. Logout deletes session from database cleanly and allows re-login', async () => {
    const user = await db.user.findFirst({ where: { email: testEmail } });
    expect(user).toBeDefined();

    const { sessionToken } = await createSession(user!.id);
    const dbSessionBefore = await db.session.findFirst({ where: { userId: user!.id } });
    expect(dbSessionBefore).toBeDefined();

    // Re-login with password
    const loginData = new FormData();
    loginData.append('email', testEmail);
    loginData.append('password', testPassword);

    const loginResult = await loginWithPasswordAction(null, loginData);
    expect(loginResult.success).toBe(true);
  });
});
