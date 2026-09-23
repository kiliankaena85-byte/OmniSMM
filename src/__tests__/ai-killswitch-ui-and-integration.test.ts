import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSmartReplyAction } from '../actions/support/ticket';
import { OperatorVerificationGuard } from '../services/admin/operator-verification-guard.service';

vi.mock('@/lib/server/rbac', () => ({
  requireStaffPermission: vi.fn((_module, _action, callback) =>
    callback({ userId: 'staff-admin-1', email: 'admin@smmplan.pro', tenantId: 'smmplan' })
  ),
}));

vi.mock('@/services/admin/ai-support.service', () => ({
  aiSupportService: {
    generateReply: vi.fn().mockResolvedValue({
      client_sentiment: 'NEUTRAL',
      escalate_to_senior: false,
      internal_reasoning: 'Standard resolution',
      draft_reply: 'Здравствуйте! Ваш вопрос решен.',
      policy_violations: [],
      blocked: false,
    }),
  },
}));

describe('BLOCK 31: AI Kill-Switch UI & End-to-End State Integration (2026)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DISABLE_AI_SUPPORT;
  });

  // -----------------------------------------------------------------------
  // 1. AI Enabled State (Default)
  // -----------------------------------------------------------------------
  it('KillSwitch-E2E 1 [AI Active]: When AI is enabled, generateSmartReplyAction returns valid draft', async () => {
    process.env.DISABLE_AI_SUPPORT = 'false';

    const res = await generateSmartReplyAction('ticket-live-1');
    expect(res.success).toBe(true);
    if ('reply' in res) {
      expect(res.reply).toBe('Здравствуйте! Ваш вопрос решен.');
    }
  });

  // -----------------------------------------------------------------------
  // 2. AI Disabled State (Kill-Switch Active)
  // -----------------------------------------------------------------------
  it('KillSwitch-E2E 2 [AI Disabled]: When DISABLE_AI_SUPPORT=true, AI immediately stops with clear diagnostic message', async () => {
    process.env.DISABLE_AI_SUPPORT = 'true';

    const res = await generateSmartReplyAction('ticket-live-2');
    expect(res.success).toBe(false);
    expect(res.error).toContain('AI-ассистент временно отключен администратором');
  });

  // -----------------------------------------------------------------------
  // 3. 100% Unrestricted Manual Support in Disabled State
  // -----------------------------------------------------------------------
  it('KillSwitch-E2E 3 [Manual Chat]: Staff operator can submit custom replies freely when AI is disabled', () => {
    process.env.DISABLE_AI_SUPPORT = 'true';

    const manualStaffReply = 'Здравствуйте! Мы проверили ваш заказ вручную, всё в порядке.';
    const result = OperatorVerificationGuard.validateOperatorVerification({
      text: manualStaffReply,
      isStaff: true,
      hasAiDraftUsed: false,
    });

    expect(result.canSend).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // 4. Zero DB Corruption on Toggle Cycle
  // -----------------------------------------------------------------------
  it('KillSwitch-E2E 4 [State Cycle]: Toggling AI state multiple times does not corrupt runtime state', async () => {
    // 1. Turn OFF
    process.env.DISABLE_AI_SUPPORT = 'true';
    let res = await generateSmartReplyAction('ticket-1');
    expect(res.success).toBe(false);

    // 2. Turn ON
    process.env.DISABLE_AI_SUPPORT = 'false';
    res = await generateSmartReplyAction('ticket-1');
    expect(res.success).toBe(true);

    // 3. Turn OFF again
    process.env.DISABLE_AI_SUPPORT = 'true';
    res = await generateSmartReplyAction('ticket-1');
    expect(res.success).toBe(false);
  });
});
