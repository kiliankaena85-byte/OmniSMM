import { describe, it, expect, vi } from 'vitest';
import { requestMagicLink } from '../../../src/actions/auth/request-magic-link';
import { db } from '../../../src/lib/db';
import * as smtp from '../../../src/lib/smtp';
import { RateLimitService } from '../../../src/services/core/rate-limit.service';
import { cookies } from 'next/headers';

vi.mock('../../../src/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    authToken: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  }
}));

vi.mock('../../../src/lib/smtp', () => ({
  sendMagicLink: vi.fn(),
  sendWelcomeLetter: vi.fn(),
}));

vi.mock('../../../src/services/core/rate-limit.service', () => ({
  RateLimitService: {
    check: vi.fn(),
  }
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

describe('Magic Link Edge Cases', () => {
  it('should crash process if db.user.delete throws during SMTP failure', async () => {
    // Setup mocks
    vi.mocked(RateLimitService.check).mockResolvedValue(true);
    vi.mocked(cookies).mockResolvedValue({ get: () => undefined } as any);

    // Mock transaction to return isNewUser: true
    const userMock = { id: 'user-1', email: 'test@example.com' };
    vi.mocked(db.$transaction).mockResolvedValue({
      type: 'success',
      user: userMock,
      isNewUser: true,
      rawToken: 'token123'
    });

    // Make SMTP fail
    vi.mocked(smtp.sendMagicLink).mockRejectedValue(new Error('SMTP disconnected'));

    // Make db.user.delete fail
    vi.mocked(db.user.delete).mockRejectedValue(new Error('DB Connection lost'));

    const formData = new FormData();
    formData.append('email', 'test@example.com');

    // To catch unhandled rejection, we can attach a listener
    const unhandledRejectionPromise = new Promise((resolve) => {
      process.once('unhandledRejection', (reason) => {
        resolve(reason);
      });
    });

    const result = await requestMagicLink(null, formData);
    
    // requestMagicLink returns successfully
    expect(result.success).toBe(true);

    // Wait for the background task to fail and trigger unhandled rejection
    const reason = await unhandledRejectionPromise;
    expect(reason).toBeInstanceOf(Error);
    expect((reason as Error).message).toBe('DB Connection lost');
  });
});
