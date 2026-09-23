'use server';

/**
 * Level 2 Server Actions: Admin Runbooks & Status
 */

import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { KnowledgeRetrieverService } from '@/services/admin/ai-manual/knowledge-retriever.service';
import { CURATED_ADMIN_RUNBOOKS } from '@/services/admin/ai-manual/runbooks';
import type { AdminRunbook, DockerMemoryStatus } from '@/types/admin-ai-manual';

const ALLOWED_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SUPPORT'];

async function requireStaffUser() {
  const session = await verifySession();
  if (!session?.userId) throw new Error('Unauthorized');
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true },
  });
  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    throw new Error('Forbidden: Staff role required');
  }
  return user;
}

export async function getDockerMemoryStatusAction(): Promise<{ success: boolean; status?: DockerMemoryStatus; error?: string }> {
  try {
    await requireStaffUser();
    const status = await KnowledgeRetrieverService.getMemoryStatus();
    return { success: true, status };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to fetch status' };
  }
}

export async function getAdminRunbooksAction(): Promise<{ success: boolean; runbooks?: AdminRunbook[]; error?: string }> {
  try {
    await requireStaffUser();
    return { success: true, runbooks: CURATED_ADMIN_RUNBOOKS };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to fetch runbooks' };
  }
}

