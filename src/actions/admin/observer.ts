'use server';

import { requireStaffPermission } from '@/lib/server/rbac';
import { AiObserverService, type ExecutiveDigestResult } from '@/services/observer/ai-observer.service';
import { auditAdminAwaitable } from '@/lib/admin-audit';

export async function getLatestAiDigestAction(): Promise<{
  success: boolean;
  data?: {
    digest: ExecutiveDigestResult | null;
    isKillswitchActive: boolean;
  };
  error?: string;
}> {
  return requireStaffPermission('analytics', 'view', async () => {
    try {
      const [digest, isKillswitchActive] = await Promise.all([
        AiObserverService.getLatestDigest(),
        AiObserverService.isKillswitchActive(),
      ]);

      return {
        success: true,
        data: {
          digest,
          isKillswitchActive,
        },
      };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });
}

export async function triggerAiObserverManualAction(options?: {
  tenantId?: string;
  sendTelegram?: boolean;
}): Promise<{
  success: boolean;
  data?: ExecutiveDigestResult;
  error?: string;
}> {
  return requireStaffPermission('analytics', 'edit', async (staffUser) => {
    try {
      const result = await AiObserverService.runObserverPipeline({
        tenantId: options?.tenantId || 'smmplan',
        sendTelegram: options?.sendTelegram ?? false,
        forceRun: true,
      });

      await auditAdminAwaitable({
        adminId: staffUser.id,
        adminEmail: staffUser.email,
        action: 'AI_OBSERVER_MANUAL_TRIGGER',
        target: 'AI_OBSERVER',
        targetType: 'SYSTEM',
        oldValue: null,
        newValue: { source: result.source, latencyMs: result.latencyMs },
      });

      return {
        success: true,
        data: result,
      };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });
}

export async function toggleAiObserverKillswitchAction(enabled: boolean): Promise<{
  success: boolean;
  isKillswitchActive?: boolean;
  error?: string;
}> {
  return requireStaffPermission('settings', 'edit', async (staffUser) => {
    try {
      // If enabled = true, killswitch is inactive (disabled = false)
      const isKilled = !enabled;
      await AiObserverService.setKillswitch(isKilled);

      await auditAdminAwaitable({
        adminId: staffUser.id,
        adminEmail: staffUser.email,
        action: 'AI_OBSERVER_KILLSWITCH_TOGGLE',
        target: 'AI_OBSERVER',
        targetType: 'SYSTEM',
        oldValue: { isAiObserverEnabled: !enabled },
        newValue: { isAiObserverEnabled: enabled },
      });

      return {
        success: true,
        isKillswitchActive: isKilled,
      };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });
}

export async function sendExecutiveDigestToTelegramAction(options?: {
  tenantId?: string;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  return requireStaffPermission('analytics', 'edit', async (staffUser) => {
    try {
      const result = await AiObserverService.runObserverPipeline({
        tenantId: options?.tenantId || 'smmplan',
        sendTelegram: true,
        forceRun: true,
      });

      await auditAdminAwaitable({
        adminId: staffUser.id,
        adminEmail: staffUser.email,
        action: 'AI_OBSERVER_TELEGRAM_DISPATCH',
        target: 'AI_OBSERVER',
        targetType: 'SYSTEM',
        oldValue: null,
        newValue: { tenantId: options?.tenantId, generatedAt: result.generatedAt },
      });

      return {
        success: true,
        message: 'AI-Дайджест успешно сформирован и поставлен в очередь отправки Telegram',
      };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });
}

