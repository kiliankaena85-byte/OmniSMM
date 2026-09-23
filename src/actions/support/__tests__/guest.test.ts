import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { createGuestTicketAction } from '../guest';
import { RateLimitService } from '@/services/core/rate-limit.service';

vi.mock('@/services/core/rate-limit.service', () => ({
  RateLimitService: {
    check: vi.fn(async () => true),
    checkCustomKey: vi.fn(async () => true),
  }
}));

vi.mock('@/utils/ip', () => ({
  getClientIp: vi.fn(async () => '127.0.0.1'),
}));

describe.sequential('createGuestTicketAction', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await db.ticketMessage.deleteMany().catch(() => {});
    await db.ticket.deleteMany().catch(() => {});
    await db.user.deleteMany().catch(() => {});
  });

  it('should reject invalid guest input data (Zod errors)', async () => {
    const formData = new FormData();
    formData.append('name', 'A'); // Too short
    formData.append('email', 'invalid-email');
    formData.append('message', 'Short'); // Too short

    const result = await createGuestTicketAction(formData);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should reject guest ticket if email belongs to a registered user', async () => {
    // Create a registered user with passwordHash
    await db.user.create({
      data: {
        email: 'registered@smmplan.local',
        passwordHash: 'hashed_password_456',
      }
    });

    const formData = new FormData();
    formData.append('name', 'Jane Doe');
    formData.append('email', 'Registered@smmplan.local'); // mixed case to verify case normalization
    formData.append('message', 'My order has been delayed for a long time');

    const result = await createGuestTicketAction(formData);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Аккаунт с этим email уже существует');
  });

  it('should block ticket creation if IP rate limit is exceeded', async () => {
    vi.mocked(RateLimitService.checkCustomKey).mockImplementation(async (key) => {
      if (key.startsWith('guest_ip:')) return false; // Block IP
      return true;
    });

    const formData = new FormData();
    formData.append('name', 'John Doe');
    formData.append('email', 'spammer@smmplan.local');
    formData.append('message', 'My order has been delayed for a long time');

    const result = await createGuestTicketAction(formData);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Слишком много обращений с вашего IP');
  });

  it('should block ticket creation if Email rate limit is exceeded', async () => {
    vi.mocked(RateLimitService.checkCustomKey).mockImplementation(async (key) => {
      if (key.startsWith('guest_ticket:')) return false; // Block Email
      return true;
    });

    const formData = new FormData();
    formData.append('name', 'John Doe');
    formData.append('email', 'spammer@smmplan.local');
    formData.append('message', 'My order has been delayed for a long time');

    const result = await createGuestTicketAction(formData);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Слишком много обращений. Попробуйте позже.');
  });

  it('should successfully create shadow user, ticket, and message for a valid guest request', async () => {
    vi.mocked(RateLimitService.checkCustomKey).mockResolvedValue(true);

    const formData = new FormData();
    formData.append('name', 'Alice Smith');
    formData.append('email', 'Guest_User@SMMplan.local'); // checks email lowercase normalization
    formData.append('message', 'Greetings! Please help me with this offline order check.');

    const result = await createGuestTicketAction(formData);

    if (!result.success) {
      console.error('Test failed with error:', result.error);
    }
    expect(result.success).toBe(true);

    const shadowUser = await db.user.findUnique({
      where: { email_tenantId: { email: 'guest_user@smmplan.local', tenantId: 'smmplan' } },
      include: {
        tickets: {
          include: {
            messages: true
          }
        }
      }
    });

    expect(shadowUser).toBeDefined();
    expect(shadowUser?.email).toBe('guest_user@smmplan.local');
    expect(shadowUser?.tickets).toHaveLength(1);
    expect(shadowUser?.tickets[0].subject).toBe('Вопрос от гостя: Alice Smith');
    expect(shadowUser?.tickets[0].messages).toHaveLength(1);
    expect(shadowUser?.tickets[0].messages[0].text).toBe('Greetings! Please help me with this offline order check.');
  });
});
