import { db } from '../../../lib/db';
import { logger } from '../../../lib/logger';
import { getRedisConnection } from '@/lib/queue-manager';
import { TelegramMtprotoExecutor } from '@/services/production/telegram-mtproto-executor';
import { HeadlessStreamEngine } from '@/services/production/headless-stream-engine';
import type { OrderWithRelations } from './types';
import { decisionClient } from '@/lib/decision-engine/client';

const log = logger.child({ component: 'InHouseOrderDispatcher' });

export interface InHouseDispatchResult {
  handled: boolean;
  success: boolean;
  shouldFallbackToExternal?: boolean;
  externalOrderId?: string;
  error?: string;
}

// Singleton instances for worker process
let sharedTelegramExecutor: TelegramMtprotoExecutor | null = null;
let sharedStreamEngine: HeadlessStreamEngine | null = null;

export function getSharedTelegramExecutor(): TelegramMtprotoExecutor {
  if (!sharedTelegramExecutor) {
    sharedTelegramExecutor = new TelegramMtprotoExecutor();
  }
  return sharedTelegramExecutor;
}

export function getSharedStreamEngine(): HeadlessStreamEngine {
  if (!sharedStreamEngine) {
    sharedStreamEngine = new HeadlessStreamEngine();
  }
  return sharedStreamEngine;
}

export class InHouseOrderDispatcher {
  /**
   * Определяет, может ли заказ быть исполнен нашими собственными производственными мощностями (Tier-0 In-House)
   */
  public static canHandleInHouse(order: OrderWithRelations): boolean {
    const service = order.service;
    if (!service) return false;

    const networkName = service.category?.network?.name?.toLowerCase() || '';
    const serviceName = service.name?.toLowerCase() || '';
    const activityType = service.category?.activityType?.toLowerCase() || '';

    // 1. Telegram In-House (бусты, реакции, просмотры)
    const isTelegram = networkName.includes('telegram') || networkName.includes('тг') || order.link.includes('t.me/');
    if (isTelegram) {
      if (serviceName.includes('буст') || serviceName.includes('boost') || activityType.includes('boost')) {
        return true;
      }
      if (serviceName.includes('реакци') || serviceName.includes('reaction') || activityType.includes('like')) {
        return true;
      }
      if (serviceName.includes('просмотр') || serviceName.includes('view') || activityType.includes('view')) {
        return true;
      }
    }

    // 2. Headless HLS Stream In-House (Twitch / Kick)
    const isTwitchOrKick = networkName.includes('twitch') || networkName.includes('kick') || order.link.includes('twitch.tv') || order.link.includes('kick.com');
    if (isTwitchOrKick && (serviceName.includes('зрител') || serviceName.includes('онлайн') || serviceName.includes('stream'))) {
      return true;
    }

    return false;
  }

  /**
   * Исполняет заказ через внутренние производственные роботы с распределенным замком и каскадным фоллбеком
   */
  public static async tryDispatchInHouse(
    order: OrderWithRelations,
    redisKey?: string
  ): Promise<InHouseDispatchResult> {
    if (!this.canHandleInHouse(order)) {
      return { handled: false, success: false };
    }

    const service = order.service!;
    const networkName = service.category?.network?.name?.toLowerCase() || '';
    const serviceName = service.name?.toLowerCase() || '';
    const connection = getRedisConnection();

    // Захватываем распределенный замок для защиты от TOCTOU race conditions
    const lockKey = `lock:in_house_dispatch:${order.id}`;
    const acquiredLock = await connection.set(lockKey, 'locked', 'PX', 5000, 'NX');
    if (!acquiredLock) {
      log.warn(`[InHouseDispatcher] Concurrent dispatch attempt for order ${order.id}. Deferring to worker retry.`);
      return { handled: true, success: false, shouldFallbackToExternal: false, error: 'DISPATCH_LOCK_HELD' };
    }

    try {
      // 0. System 1 Pre-Flight Link Safety Check via Laya Decision Gate (RAC-2026)
      const safetyCheck = await decisionClient.score({
        context: order.link,
        metricName: 'LINK_SAFETY',
      });
      if (safetyCheck.score <= 0.25) {
        log.warn(`[InHouseDispatcher] Order ${order.id} rejected due to malicious/unsafe link score (${safetyCheck.score}) on ${order.link}`);
        await db.order.update({
          where: { id: order.id },
          data: {
            status: 'CANCELED',
            error: 'MALICIOUS_LINK_REJECTED',
          },
        });
        return { handled: true, success: false, shouldFallbackToExternal: false, error: 'MALICIOUS_LINK_REJECTED' };
      }

      const isTelegram = networkName.includes('telegram') || networkName.includes('тг') || order.link.includes('t.me/');

      // ── А. TELEGRAM БУСТЫ КАНАЛОВ ─────────────────────────────────────────────
      if (isTelegram && (serviceName.includes('буст') || serviceName.includes('boost'))) {
        const executor = getSharedTelegramExecutor();
        const durationDays = order.runs && order.runs > 0 ? order.runs : 30;

        const boostResult = await executor.executeBoostChannel(order.link, durationDays);

        if (!boostResult.success) {
          // Если слоты временно заняты — активируем каскадный переход на внешнего поставщика
          if (boostResult.error && (boostResult.error.includes('NO_SLOTS') || boostResult.error.includes('NO_AVAILABLE_BOOST_SLOTS'))) {
            log.info(`[InHouseDispatcher] All in-house boost slots busy. Triggering cascade fallback for order ${order.id}.`);
            return { handled: true, success: false, shouldFallbackToExternal: true, error: boostResult.error };
          }
          return { handled: true, success: false, shouldFallbackToExternal: false, error: boostResult.error };
        }

        const extId = `in_house_tg_${boostResult.sessionId}_slot_${boostResult.slotIndex}`;
        await db.order.update({
          where: { id: order.id },
          data: {
            externalId: extId,
            status: 'IN_PROGRESS',
            error: null,
          },
        });

        log.info(`[InHouseDispatcher] Order ${order.id} boosted successfully via session ${boostResult.sessionId} slot ${boostResult.slotIndex}`);
        return { handled: true, success: true, externalOrderId: extId };
      }

      // ── Б. TELEGRAM РЕАКЦИИ ──────────────────────────────────────────────────
      if (isTelegram && (serviceName.includes('реакци') || serviceName.includes('reaction'))) {
        const executor = getSharedTelegramExecutor();
        let emoji = '🔥';
        if (order.customData) {
          try {
            const parsed = typeof order.customData === 'string' ? JSON.parse(order.customData) : order.customData;
            if (parsed && typeof parsed === 'object' && 'emoji' in parsed && typeof parsed.emoji === 'string') {
              emoji = parsed.emoji;
            }
          } catch {
            // default emoji
          }
        }

        const reactionResult = await executor.executePostReaction(order.link, emoji);
        if (!reactionResult.success) {
          log.warn(`[InHouseDispatcher] In-house reaction failed for order ${order.id}: ${reactionResult.error}`);
          return { handled: true, success: false, shouldFallbackToExternal: true, error: reactionResult.error };
        }

        const extId = `in_house_tg_reaction_${reactionResult.sessionId}`;
        await db.order.update({
          where: { id: order.id },
          data: {
            externalId: extId,
            status: 'COMPLETED',
            remains: 0,
            error: null,
          },
        });

        return { handled: true, success: true, externalOrderId: extId };
      }

      // ── В. TELEGRAM ПРОСМОТРЫ ПОСТОВ (БЫСТРЫЙ ВЕБ-ШЛЮЗ) ─────────────────────
      if (isTelegram && (serviceName.includes('просмотр') || serviceName.includes('view'))) {
        const executor = getSharedTelegramExecutor();
        const viewResult = await executor.executePublicPostView(order.link);
        if (!viewResult.success) {
          return { handled: true, success: false, shouldFallbackToExternal: true, error: viewResult.error };
        }

        const extId = `in_house_tg_view_${Date.now()}`;
        await db.order.update({
          where: { id: order.id },
          data: {
            externalId: extId,
            status: 'COMPLETED',
            remains: 0,
            error: null,
          },
        });

        return { handled: true, success: true, externalOrderId: extId };
      }

      // ── Г. TWITCH / KICK СТРИМ-ЗРИТЕЛИ (HEADLESS HLS ENGINE) ────────────────
      const isTwitchOrKick = networkName.includes('twitch') || networkName.includes('kick') || order.link.includes('twitch.tv') || order.link.includes('kick.com');
      if (isTwitchOrKick) {
        const streamEngine = getSharedStreamEngine();
        const durationMinutes = 60; // дефолт: 1 час удержания стрима

        const streamTask = streamEngine.createStreamTask({
          targetUrl: order.link,
          platform: order.link.includes('kick.com') ? 'KICK' : 'TWITCH',
          viewersTarget: order.quantity,
          durationMinutes,
        });
        const extId = `in_house_stream_${streamTask.id}`;

        await db.order.update({
          where: { id: order.id },
          data: {
            externalId: extId,
            status: 'IN_PROGRESS',
            error: null,
          },
        });

        return { handled: true, success: true, externalOrderId: extId };
      }

      return { handled: false, success: false };
    } finally {
      await connection.del(lockKey).catch(() => {});
      if (redisKey) {
        await connection.del(redisKey).catch(() => {});
      }
    }
  }
}
