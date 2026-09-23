/**
 * (c) 2024-2026 SMMplan / OmniSMM 1.0. All rights reserved.
 * Multi-Bot Runtime Manager daemon.
 * Dynamically registers, launches, stops, and hot-reloads multiple Telegram bots on the fly.
 */

import { Telegraf } from 'telegraf';
import type { BotContext } from '../types/bot-context';
import type { TelegramBotInstance, TelegramBotRole } from '@prisma/client';
import { attachRoleHandlers } from '../constructors/role-handlers';
import { getTelegramProxyAgent } from '@/lib/telegram-agent';
import { VaultService } from '@/lib/vault';
import { db } from '@/lib/db';
import type { TelegramMenuButton } from '@/types/telegram';
import type { BotFlowStep } from '@/types/telegram-builder';

interface ActiveBotRecord {
  bot: Telegraf<BotContext>;
  instanceId: string;
  username: string | null;
  role: TelegramBotRole;
  tenantId: string;
  startedAt: Date;
}

export class MultiBotManager {
  private static instance: MultiBotManager;
  private activeBots: Map<string, ActiveBotRecord> = new Map();

  private constructor() {}

  public static getInstance(): MultiBotManager {
    if (!MultiBotManager.instance) {
      MultiBotManager.instance = new MultiBotManager();
    }
    return MultiBotManager.instance;
  }

  /**
   * Verifies a raw Telegram bot token against the Telegram API (getMe).
   */
  public async verifyToken(token: string): Promise<{
    valid: boolean;
    bot?: { id: number; username: string; first_name: string };
    error?: string;
  }> {
    if (!token || token.trim().length < 15) {
      return { valid: false, error: 'Токен слишком короткий или пустой.' };
    }

    try {
      const agent = getTelegramProxyAgent();
      const testBot = new Telegraf(token.trim(), { telegram: { agent } });
      const me = await testBot.telegram.getMe();
      return {
        valid: true,
        bot: {
          id: me.id,
          username: me.username || '',
          first_name: me.first_name || '',
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { valid: false, error: `Telegram API вернул ошибку: ${msg}` };
    }
  }

  /**
   * Starts or restarts a single TelegramBotInstance.
   */
  public async startBot(botData: TelegramBotInstance): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. If already running, stop old instance first
      if (this.activeBots.has(botData.id)) {
        await this.stopBot(botData.id);
      }

      if (!botData.isActive) {
        return { success: true };
      }

      // 2. Decrypt token safely
      let rawToken = botData.tokenEncrypted;
      try {
        const decrypted = VaultService.decrypt(botData.tokenEncrypted);
        if (decrypted) rawToken = decrypted;
      } catch {
        // May already be unencrypted in dev mode
      }

      if (!rawToken || rawToken.length < 15) {
        return { success: false, error: 'Не удалось расшифровать токен бота.' };
      }

      // 3. Create Telegraf instance with resilient proxy routing
      const agent = getTelegramProxyAgent();
      const bot = new Telegraf<BotContext>(rawToken, { telegram: { agent } });

      // 4. Parse allowedUserIds
      let allowedUsers: string[] = [];
      if (botData.allowedUserIds) {
        try {
          allowedUsers = JSON.parse(botData.allowedUserIds);
        } catch { /* ignore */ }
      }

      // 5. Attach role-specific pipeline
      attachRoleHandlers(bot, botData.role, {
        botId: botData.id,
        tenantId: botData.tenantId,
        botName: botData.name,
        welcomeMessage: botData.welcomeMessage,
        menuConfig: botData.menuConfig as unknown as TelegramMenuButton[],
        flowConfig: botData.flowConfig as unknown as BotFlowStep[],
        allowedUserIds: allowedUsers,
        maintenanceMode: botData.maintenanceMode,
      });

      // 6. Launch polling safely with dropPendingUpdates
      try {
        await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {});
        void bot.launch({ dropPendingUpdates: true }).catch((launchErr) => {
          console.error(`[MultiBotManager] Bot @${botData.username || botData.id} launch error:`, launchErr);
        });
      } catch (launchErr) {
        console.warn(`[MultiBotManager] Non-fatal polling warning for ${botData.id}:`, launchErr);
      }

      this.activeBots.set(botData.id, {
        bot,
        instanceId: botData.id,
        username: botData.username,
        role: botData.role,
        tenantId: botData.tenantId,
        startedAt: new Date(),
      });

      console.info(`[MultiBotManager] Successfully launched bot @${botData.username || botData.id} [${botData.role}]`);
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[MultiBotManager] Failed to start bot ${botData.id}:`, err);
      return { success: false, error: msg };
    }
  }

  /**
   * Stops a running bot instance gracefully.
   */
  public async stopBot(botId: string): Promise<boolean> {
    const record = this.activeBots.get(botId);
    if (!record) return true;

    try {
      record.bot.stop('MultiBotManager:stop');
      this.activeBots.delete(botId);
      console.info(`[MultiBotManager] Stopped bot @${record.username || botId}`);
      return true;
    } catch (err) {
      console.error(`[MultiBotManager] Error stopping bot ${botId}:`, err);
      this.activeBots.delete(botId);
      return false;
    }
  }

  /**
   * Hot-reloads a bot from the database.
   */
  public async reloadBot(botId: string): Promise<{ success: boolean; error?: string }> {
    const fresh = await db.telegramBotInstance.findUnique({ where: { id: botId } });
    if (!fresh) {
      await this.stopBot(botId);
      return { success: false, error: 'Бот не найден в базе данных.' };
    }
    return this.startBot(fresh);
  }

  /**
   * Initializes the pool of all active bots from the database on application startup.
   */
  public async initPool(targetTenantId?: string): Promise<{ loaded: number; errors: number }> {
    let loaded = 0;
    let errors = 0;

    try {
      const bots = await db.telegramBotInstance.findMany({
        where: {
          isActive: true,
          ...(targetTenantId ? { tenantId: targetTenantId } : {}),
        },
      });

      for (const b of bots) {
        const res = await this.startBot(b);
        if (res.success) loaded++;
        else errors++;
      }

      console.info(`[MultiBotManager] Initialized pool: ${loaded} bots active, ${errors} errors.`);
    } catch (err) {
      console.error('[MultiBotManager] Failed to initialize bot pool:', err);
    }

    return { loaded, errors };
  }

  /**
   * Returns whether a given bot instance is currently active and running.
   */
  public isBotRunning(botId: string): boolean {
    return this.activeBots.has(botId);
  }

  /**
   * Returns total count of currently running bots.
   */
  public getActiveCount(): number {
    return this.activeBots.size;
  }
}

export const multiBotManager = MultiBotManager.getInstance();
