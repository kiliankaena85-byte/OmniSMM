'use server';

import { requireStaffPermission } from '@/lib/server/rbac';
import { AiSupportCoPilotService, type CoPilotDraftResult } from '@/services/support/ai-copilot.service';
import { rateLimit } from '@/lib/security/rate-limit';
import { auditAdminAwaitable } from '@/lib/admin-audit';

export async function generateTicketCoPilotDraftAction(input: {
  ticketId: string;
}): Promise<CoPilotDraftResult | { success: false; error: string }> {
  return requireStaffPermission('support', 'edit', async (staffUser) => {
    if (!input?.ticketId || typeof input.ticketId !== 'string') {
      return {
        success: false,
        draftText: '',
        confidence: 'FALLBACK',
        source: 'DETERMINISTIC_FALLBACK',
        error: 'Не указан ID тикета',
      };
    }

    // Rate limit: max 20 generations per minute per staff user
    const limit = await rateLimit(`ai:copilot:staff:${staffUser.id}`, 20, 60);
    if (!limit.ok) {
      return {
        success: false,
        draftText: '',
        confidence: 'FALLBACK',
        source: 'DETERMINISTIC_FALLBACK',
        error: 'Слишком много запросов к AI Co-Pilot. Пожалуйста, подождите 1 минуту.',
      };
    }

    const result = await AiSupportCoPilotService.generateDraft(input.ticketId, staffUser.id);

    await auditAdminAwaitable({
      adminId: staffUser.id,
      adminEmail: staffUser.email,
      action: 'AI_COPILOT_DRAFT_GENERATED',
      target: 'TICKET_CO_PILOT',
      targetType: 'TICKET',
      oldValue: null,
      newValue: {
        ticketId: input.ticketId,
        source: result.source,
        confidence: result.confidence,
        success: result.success,
      },
    });

    return result;
  });
}
