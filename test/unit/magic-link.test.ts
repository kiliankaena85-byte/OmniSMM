import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestMagicLink } from '@/actions/auth/request-magic-link';
import { db } from '@/lib/db';
import * as smtp from '@/lib/smtp';
import { RateLimitService } from '@/services/core/rate-limit.service';

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn()
    },
    authToken: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  }
}));

vi.mock('@/lib/smtp', () => ({
  sendMagicLink: vi.fn(),
  sendWelcomeLetter: vi.fn(),
}));

vi.mock('@/services/core/rate-limit.service', () => ({
  RateLimitService: {
    check: vi.fn(),
    checkCustomKey: vi.fn(),
  }
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(() => null)
  })),
  headers: vi.fn(async () => new Headers())
}));

describe('requestMagicLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not create user if rate limit fails', async () => {
    vi.mocked(RateLimitService.check).mockResolvedValue(false);
    
    const formData = new FormData();
    formData.append('email', 'test@example.com');
    
    const result = await requestMagicLink(null, formData);
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Слишком много запросов');
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it('should soft-delete user if sendMagicLink fails', async () => {
    vi.mocked(RateLimitService.check).mockResolvedValue(true);
    vi.mocked(db.user.findUnique).mockResolvedValue(null); // New user
    
    const mockUser = { id: 'user_1', email: 'test@example.com', role: 'USER' };
    vi.mocked(db.$transaction).mockImplementation(async (callback) => {
      // Simulate transaction callback
      return { type: 'success', user: mockUser, isNewUser: true, rawToken: 'token' };
    });
    
    vi.mocked(smtp.sendMagicLink).mockRejectedValue(new Error('SMTP Down'));
    
    const formData = new FormData();
    formData.append('email', 'test@example.com');
    
    const result = await requestMagicLink(null, formData);
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Не удалось отправить письмо');
    await new Promise(r => setTimeout(r, 50));
    expect(db.$transaction).toHaveBeenCalled();
    expect(smtp.sendMagicLink).toHaveBeenCalled();
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: mockUser.id },
      data: expect.objectContaining({
        isDeleted: true,
        isActive: false,
      })
    });
    expect(smtp.sendWelcomeLetter).not.toHaveBeenCalled(); // Orphaned email prevented
  });

  it('should catch db.user.update error if it fails during SMTP fallback', async () => {
    vi.mocked(RateLimitService.check).mockResolvedValue(true);
    vi.mocked(db.user.findUnique).mockResolvedValue(null); // New user
    
    const mockUser = { id: 'user_1', email: 'test@example.com', role: 'USER' };
    vi.mocked(db.$transaction).mockImplementation(async (callback) => {
      return { type: 'success', user: mockUser, isNewUser: true, rawToken: 'token' };
    });
    
    vi.mocked(smtp.sendMagicLink).mockRejectedValue(new Error('SMTP Down'));
    vi.mocked(db.user.update).mockRejectedValue(new Error('DB Update failed'));
    
    const formData = new FormData();
    formData.append('email', 'test@example.com');
    
    const result = await requestMagicLink(null, formData);
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Не удалось отправить письмо');
    await new Promise(r => setTimeout(r, 50));
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: mockUser.id },
      data: expect.objectContaining({
        isDeleted: true,
        isActive: false,
      })
    });
  });

});
