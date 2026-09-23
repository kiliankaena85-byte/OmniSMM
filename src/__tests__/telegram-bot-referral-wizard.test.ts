import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { referralWizard, REFERRAL_WIZARD } from '@/bot/scenes/referral.wizard';

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    }
  }
}));

vi.mock('@/utils/get-base-url', () => ({
  getBaseUrlSync: () => 'https://test.smmplan.pro'
}));

describe('Telegram Bot Referral Wizard (referral.wizard.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Initializes referral wizard scene correctly', () => {
    expect(referralWizard.id).toBe(REFERRAL_WIZARD);
    expect(referralWizard.steps.length).toBe(2);
  });

  it('2. Successfully generates and sends referral link and stats for existing user', async () => {
    (db.user.findFirst as any).mockResolvedValueOnce({
      id: 'usr-ref-1',
      referralCode: 'TESTREF1',
      referralBalance: 15000, // 150.00 RUB
      _count: { referrals: 5 }
    });

    const mockCtx: any = {
      from: { id: 123456789 },
      scene: { leave: vi.fn() },
      wizard: { next: vi.fn() },
      reply: vi.fn().mockResolvedValue(true)
    };

    const step0: any = referralWizard.steps[0];
    await step0(mockCtx);

    expect(mockCtx.reply).toHaveBeenCalled();
    const replyCall = mockCtx.reply.mock.calls[0];
    expect(replyCall[0]).toContain('https://test.smmplan.pro/?ref=TESTREF1');
    expect(replyCall[0]).toContain('5 чел.');
    expect(replyCall[0]).toContain('150.00 ₽');
    expect(mockCtx.wizard.next).toHaveBeenCalled();
    expect(mockCtx.scene.leave).not.toHaveBeenCalled();
  });

  it('3. Automatically provisions referral code if user does not have one yet', async () => {
    (db.user.findFirst as any).mockResolvedValueOnce({
      id: 'usr-ref-2',
      referralCode: null,
      referralBalance: 0,
      _count: { referrals: 0 }
    });
    (db.user.findUnique as any).mockResolvedValueOnce(null);
    (db.user.update as any).mockResolvedValueOnce({ id: 'usr-ref-2', referralCode: 'NEWCODE8' });

    const mockCtx: any = {
      from: { id: 987654321 },
      scene: { leave: vi.fn() },
      wizard: { next: vi.fn() },
      reply: vi.fn().mockResolvedValue(true)
    };

    const step0: any = referralWizard.steps[0];
    await step0(mockCtx);

    expect(db.user.update).toHaveBeenCalled();
    expect(mockCtx.reply).toHaveBeenCalled();
    expect(mockCtx.wizard.next).toHaveBeenCalled();
  });

  it('4. Handles database errors gracefully without throwing unhandled exceptions', async () => {
    (db.user.findFirst as any).mockRejectedValueOnce(new Error('DB Connection Timeout'));

    const mockCtx: any = {
      from: { id: 111222333 },
      scene: { leave: vi.fn() },
      wizard: { next: vi.fn() },
      reply: vi.fn().mockResolvedValue(true)
    };

    const step0: any = referralWizard.steps[0];
    await step0(mockCtx);

    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Произошла ошибка'),
    );
    expect(mockCtx.scene.leave).toHaveBeenCalled();
  });
});
