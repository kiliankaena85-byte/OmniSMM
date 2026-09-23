/**
 * GeoAvailabilityProcessor — Autonomous Background Watchdog for Russia & Global ISP Outages.
 * Runs every 5 minutes, verifies availability across Russian probes (Moscow/St. Petersburg),
 * and dispatches instant Telegram alerts to the Owner upon detection of TSPU / ISP blocks.
 */

import { Job } from 'bullmq';
import { GeoAvailabilityService } from '@/services/telemetry/geo-availability.service';
import { sendAdminAlert } from '@/lib/notifications';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'GeoAvailabilityWatchdog' });

export interface GeoAvailabilityJobData {
  targetUrl?: string;
  timestamp: number;
}

export interface GeoMonitorState {
  isBlocked: boolean;
  consecutiveFails: number;
  lastAlertTime: number;
}

export async function processGeoAvailabilityCheck(job?: Job<GeoAvailabilityJobData>): Promise<{
  status: string;
  ruRate: number;
  alertSent: boolean;
}> {
  const targetUrl = job?.data?.targetUrl || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://test.smmplan.pro';
  log.info(`🔍 Running automated Geo-Availability probe for: ${targetUrl}`);

  const report = await GeoAvailabilityService.checkAvailability(targetUrl, 12, 5000);
  const stateKey = `geo_monitor:state:${Buffer.from(targetUrl).toString('base64')}`;

  let previousState: GeoMonitorState = {
    isBlocked: false,
    consecutiveFails: 0,
    lastAlertTime: 0,
  };

  try {
    const rawState = await redis.get(stateKey);
    if (rawState) {
      previousState = JSON.parse(rawState);
    }
  } catch (err: any) {
    log.warn(`Failed to read previous geo monitor state: ${err.message}`);
  }

  const now = Date.now();
  let alertSent = false;
  const isCurrentlyBlocked = report.verdict === 'RU_BLOCKED' || (report.ruTotal > 0 && report.ruPassed === 0);

  if (isCurrentlyBlocked) {
    const consecutiveFails = previousState.consecutiveFails + 1;
    const cooldownMs = 15 * 60 * 1000; // 15-minute alert cooldown
    const shouldAlert = !previousState.isBlocked || now - previousState.lastAlertTime > cooldownMs;

    if (shouldAlert) {
      const alertMsg =
        `🚨 <b>ВНИМАНИЕ: СБОЙ ДОСТУПНОСТИ САЙТА ИЗ РОССИИ!</b>\n\n` +
        `🎯 <b>Целевой домен:</b> <code>${targetUrl}</code>\n` +
        `🇷🇺 <b>Статус в РФ:</b> <b>0% Доступности</b> (0/${report.ruTotal || 2} узлов)\n` +
        `📊 <b>Симптом:</b> ${report.verdictText}\n` +
        `🌍 <b>Мировая доступность:</b> ${Math.round(report.globalRate * 100)}% (${report.globalPassed}/${report.globalTotal || 1})\n\n` +
        `⚡ <b>Рекомендованные действия:</b>\n` +
        `1. Проверить статус <b>ECH (Encrypted Client Hello)</b> в Cloudflare (отключить при блокировке).\n` +
        `2. Переключить Cloudflare на режим <b>DNS Only (Серое облако)</b>.\n` +
        `3. Перенаправить трафик на резервный RU-домен (<code>smmflux.ru</code>).\n\n` +
        (report.permanentLink ? `🔗 <a href="${report.permanentLink}">Подробный диагностический отчет</a>` : '');

      sendAdminAlert(alertMsg, 'CRITICAL');
      alertSent = true;
      log.error(`🚨 Dispatched CRITICAL Geo-Availability alert for ${targetUrl}`);
    }

    const newState: GeoMonitorState = {
      isBlocked: true,
      consecutiveFails,
      lastAlertTime: shouldAlert ? now : previousState.lastAlertTime,
    };
    await redis.set(stateKey, JSON.stringify(newState), 'EX', 86400); // 24h TTL
  } else if (previousState.isBlocked && report.verdict === 'ALL_GREEN') {
    // RECOVERY EVENT
    const recoveryMsg =
      `🟢 <b>САЙТ СНОВА ДОСТУПЕН ИЗ РОССИИ!</b>\n\n` +
      `🎯 <b>Целевой домен:</b> <code>${targetUrl}</code>\n` +
      `🇷🇺 <b>Доступность в РФ:</b> <b>100%</b> (${report.ruPassed}/${report.ruTotal || 1} узлов OK)\n` +
      `🌍 <b>Мировая доступность:</b> <b>100%</b>\n` +
      `⚡ <b>Средняя задержка:</b> ${report.avgResponseTimeMs || 100} ms\n\n` +
      `<i>Все системы работают в штатном режиме.</i>`;

    sendAdminAlert(recoveryMsg, 'INFO');
    alertSent = true;
    log.info(`🟢 Site availability recovered for ${targetUrl}`);

    const newState: GeoMonitorState = {
      isBlocked: false,
      consecutiveFails: 0,
      lastAlertTime: now,
    };
    await redis.set(stateKey, JSON.stringify(newState), 'EX', 86400);
  } else {
    // Normal healthy ping
    log.info(`🟢 Geo probe healthy: RU=${Math.round(report.ruRate * 100)}%, Global=${Math.round(report.globalRate * 100)}%`);
    if (previousState.consecutiveFails > 0) {
      await redis.set(
        stateKey,
        JSON.stringify({ isBlocked: false, consecutiveFails: 0, lastAlertTime: previousState.lastAlertTime }),
        'EX',
        86400
      );
    }
  }

  return {
    status: report.verdict,
    ruRate: report.ruRate,
    alertSent,
  };
}

export default processGeoAvailabilityCheck;
