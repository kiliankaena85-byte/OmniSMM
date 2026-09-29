/**
 * wave5-support-and-omnichat-invariants.test.ts
 * Юнит-тесты на инварианты Волны 5: OmniChat, Single-Active-Thread, AI Co-Pilot и Sanitizer.
 */

import { describe, it, expect, vi } from 'vitest';
import { ticketService } from '@/services/support/ticket.service';
import { AiResponseSanitizer } from '@/services/support/ai-response-sanitizer';
import { AiSupportCoPilotService } from '@/services/support/ai-copilot.service';
import { db } from '@/lib/db';

describe('Wave 5 Invariants: Support, OmniChat & AI Co-Pilot', () => {
  it('1. Single-Active-Thread Invariant: Returns existing ticket when active ticket exists', async () => {
    const existingTicket = {
      id: 'tick-active-1',
      userId: 'user-100',
      subject: 'Existing Issue',
      status: 'OPEN',
      tenantId: 'smmplan',
      updatedAt: new Date(),
    };

    const mockTx = {
      user: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ tenantId: 'smmplan' }),
      },
      ticket: {
        findFirst: vi.fn().mockResolvedValue(existingTicket),
        create: vi.fn(),
      },
    };

    vi.spyOn(db, '$transaction').mockImplementation(async (cb: unknown) => {
      return (cb as (tx: typeof mockTx) => unknown)(mockTx) as never;
    });

    const result = await ticketService.getOrCreateTicket('user-100', 'New Message', 'WEB', 'smmplan');

    expect(result.id).toBe('tick-active-1');
    expect(mockTx.ticket.create).not.toHaveBeenCalled();
  });

  it('2. AiResponseSanitizer: Strips thinking tags, speaker prefixes, codeblocks and unwraps JSON', () => {
    const rawAiOutput = `
<think>
User is asking for an update on order #123.
I need to check the status and be polite.
</think>
[Оператор]: Здравствуйте! Ваш заказ #123 находится в обработке.
`;

    const cleaned = AiResponseSanitizer.sanitize(rawAiOutput);
    expect(cleaned).toBe('Здравствуйте! Ваш заказ #123 находится в обработке.');
    expect(cleaned).not.toContain('<think>');
    expect(cleaned).not.toContain('[Оператор]:');

    // JSON response leakage
    const jsonOutput = JSON.stringify({
      draft_reply: 'Деньги успешно возвращены на баланс.',
    });
    expect(AiResponseSanitizer.sanitize(jsonOutput)).toBe('Деньги успешно возвращены на баланс.');
  });

  it('3. Cross-Tenant Co-Pilot Isolation: Blocks operator from generating drafts for foreign tenant tickets', async () => {
    // Staff belongs to 'smmplan'
    vi.spyOn(db.user, 'findUnique').mockResolvedValue({
      id: 'staff-smmplan',
      role: 'SUPPORT',
      tenantId: 'smmplan',
    } as unknown as NonNullable<Awaited<ReturnType<typeof db.user.findUnique>>>);

    // Ticket belongs to 'flux'
    vi.spyOn(db.ticket, 'findUnique').mockResolvedValue({
      id: 'tick-flux-1',
      tenantId: 'flux',
      user: { id: 'u-flux', tenantId: 'flux' },
      messages: [],
    } as unknown as NonNullable<Awaited<ReturnType<typeof db.ticket.findUnique>>>);

    const draftResult = await AiSupportCoPilotService.generateDraft('tick-flux-1', 'staff-smmplan');

    expect(draftResult.success).toBe(false);
    expect(draftResult.error).toContain('тикет принадлежит другому сайту');
  });
});
