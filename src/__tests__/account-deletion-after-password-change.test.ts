import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { deleteAccountAction } from '@/actions/auth/delete-account';
import { verifySession } from '@/lib/session';

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
  cookies: vi.fn(async () => mockCookieStore),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/session')>();
  return {
    ...actual,
    verifySession: vi.fn(),
    createSession: vi.fn(async () => ({ sessionToken: 'new_token', expiresAt: new Date(Date.now() + 86400000) })),
  };
});

vi.mock('@/lib/auth/password', () => ({
  hashPassword: vi.fn(async (pwd: string) => `hashed_${pwd}`),
  verifyPassword: vi.fn(async (plain: string, hashed: string) => hashed === `hashed_${plain}`),
}));

describe('Account Deletion After Password Change', () => {
  const testUserId = 'user_del_test_123';
  const oldPassword = 'OldPassword123!';
  const newPassword = 'NewPassword456!';

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(verifySession).mockResolvedValue({ userId: testUserId } as any);

    (vi.spyOn(db.user, 'findUnique') as any).mockImplementation(async ({ where }: any) => {
      if (where.id === testUserId) {
        return {
          id: testUserId,
          email: 'test@example.com',
          passwordHash: `hashed_${oldPassword}`,
        };
      }
      return null;
    });

    (vi.spyOn(db.user, 'update') as any).mockImplementation(async () => ({}));
    (vi.spyOn(db.session, 'deleteMany') as any).mockImplementation(async () => ({ count: 1 }));
  });

  it('rejects deletion if password is required but not provided', async () => {
    const formData = new FormData();
    formData.append('confirmText', 'УДАЛИТЬ');

    const result = await deleteAccountAction(null, formData);
    expect(result.success).toBe(false);
    expect(result.error).toContain('требуется ввести пароль');
  });

  it('rejects deletion if old password is used after password was changed', async () => {
    // 1. Password changed to newPassword
    (vi.spyOn(db.user, 'findUnique') as any).mockImplementation(async ({ where }: any) => {
      if (where.id === testUserId) {
        return {
          id: testUserId,
          email: 'test@example.com',
          passwordHash: `hashed_${newPassword}`,
        };
      }
      return null;
    });

    // 2. Attempt deletion with old password
    const formData = new FormData();
    formData.append('confirmText', 'УДАЛИТЬ');
    formData.append('password', oldPassword);

    const result = await deleteAccountAction(null, formData);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Неверный пароль');
  });

  it('successfully deletes account when new password is used', async () => {
    // 1. Password changed to newPassword
    (vi.spyOn(db.user, 'findUnique') as any).mockImplementation(async ({ where }: any) => {
      if (where.id === testUserId) {
        return {
          id: testUserId,
          email: 'test@example.com',
          passwordHash: `hashed_${newPassword}`,
        };
      }
      return null;
    });

    // Mock AccountDeletionService
    const { AccountDeletionService } = await import('@/services/user/account-deletion.service');
    vi.spyOn(AccountDeletionService, 'anonymizeAndDeleteAccount').mockResolvedValue({
      success: true,
      anonymizedId: testUserId,
    });

    // 2. Attempt deletion with new password
    const formData = new FormData();
    formData.append('confirmText', 'УДАЛИТЬ');
    formData.append('password', newPassword);

    const result = await deleteAccountAction(null, formData);
    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
    expect(AccountDeletionService.anonymizeAndDeleteAccount).toHaveBeenCalledWith(
      testUserId,
      expect.objectContaining({ reason: expect.stringContaining('self-service deletion') })
    );
  });
});
