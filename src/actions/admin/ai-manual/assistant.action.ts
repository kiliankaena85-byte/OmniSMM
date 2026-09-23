'use server';

/**
 * Level 2 Server Action: Admin AI Assistant Query
 * Provides zero-defect fallback & resilient consultation dispatch.
 */

import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { AdminAiAssistantService } from '@/services/admin/ai-manual/admin-ai-assistant.service';
import { z } from 'zod';
import { AdminAssistantQuerySchema } from '@/types/admin-ai-manual';

const ALLOWED_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SUPPORT'];

export async function queryAdminAiAssistantAction(
  payload: z.input<typeof AdminAssistantQuerySchema>
): Promise<{
  success: boolean;
  result?: {
    fullText: string;
    chunksUsed: Array<{ title: string; filePath?: string }>;
    isFromCache?: boolean;
  };
  error?: string;
}> {
  try {
    const session = await verifySession();
    if (!session?.userId) return { success: false, error: 'Unauthorized' };

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { id: true, role: true },
    });
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      return { success: false, error: 'Forbidden: Staff role required' };
    }

    const parsed = AdminAssistantQuerySchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, error: 'Validation failed' };
    }

    const result = await AdminAiAssistantService.streamConsultation(
      parsed.data,
      user.id,
      user.role,
      () => {}
    );

    return {
      success: true,
      result: {
        fullText: result.fullText,
        chunksUsed: result.chunksUsed.map((c) => ({ title: c.title, filePath: c.filePath })),
        isFromCache: Boolean(result.isFromCache),
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Assistant query failed',
    };
  }
}
