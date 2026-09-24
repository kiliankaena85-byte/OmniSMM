import fs from 'fs';
import os from 'os';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { sendAdminAlert } from '@/lib/notifications';
import { logger } from '@/lib/logger';
import { ordersQueue, syncQueue, paymentSyncQueue } from '@/lib/queue-manager';

const log = logger.child({ component: 'SystemTelemetryService' });

export interface DiskTelemetry {
  totalGb: number;
  freeGb: number;
  usedPct: number;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

export interface MemoryTelemetry {
  osTotalMb: number;
  osFreeMb: number;
  osUsedPct: number;
  processRssMb: number;
  processHeapMb: number;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

export interface DatabaseTelemetry {
  pingLatencyMs: number;
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
}

export interface RedisTelemetry {
  usedMemoryMb: number;
  peakMemoryMb: number;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

export interface QueuesTelemetry {
  ordersWaiting: number;
  ordersActive: number;
  ordersFailed: number;
  syncWaiting: number;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

export interface SystemHealthSnapshot {
  timestamp: string;
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  disk: DiskTelemetry;
  memory: MemoryTelemetry;
  database: DatabaseTelemetry;
  redis: RedisTelemetry;
  queues: QueuesTelemetry;
  activeAlerts: Array<{
    code: string;
    category: 'INFRA' | 'DATABASE' | 'BUSINESS' | 'SECURITY';
    severity: 'WARNING' | 'CRITICAL';
    title: string;
    details: string;
    suggestedAction: string;
  }>;
}

export class SystemTelemetryService {
  private static readonly THROTTLE_PREFIX = 'telemetry:alert:throttle:';
  private static readonly THROTTLE_TTL_SEC = 300; // 5 minutes debounce per alert code

  /**
   * Collects live telemetry metrics across all infrastructure and platform layers.
   */
  static async collectSnapshot(): Promise<SystemHealthSnapshot> {
    const alerts: SystemHealthSnapshot['activeAlerts'] = [];

    // 1. Disk Telemetry
    let disk: DiskTelemetry = { totalGb: 0, freeGb: 0, usedPct: 0, status: 'HEALTHY' };
    try {
      const stat = fs.statfsSync('.');
      const totalGb = Math.round((stat.blocks * stat.bsize) / (1024 ** 3) * 10) / 10;
      const freeGb = Math.round((stat.bfree * stat.bsize) / (1024 ** 3) * 10) / 10;
      const usedPct = totalGb > 0 ? Math.round(((totalGb - freeGb) / totalGb) * 1000) / 10 : 0;

      let status: DiskTelemetry['status'] = 'HEALTHY';
      if (usedPct >= 95) {
        status = 'CRITICAL';
        alerts.push({
          code: 'INFRA_DISK_CRITICAL',
          category: 'INFRA',
          severity: 'CRITICAL',
          title: 'Диск сервера переполнен (>95%)',
          details: `Занято ${usedPct}% (Свободно: ${freeGb} ГБ из ${totalGb} ГБ).`,
          suggestedAction: 'Запустите очистку логов Docker: docker system prune -af или очистите старые дампы.',
        });
      } else if (usedPct >= 85) {
        status = 'WARNING';
        alerts.push({
          code: 'INFRA_DISK_WARNING',
          category: 'INFRA',
          severity: 'WARNING',
          title: 'Диск сервера заполняется (>85%)',
          details: `Занято ${usedPct}% (Свободно: ${freeGb} ГБ).`,
          suggestedAction: 'Проверьте размер логов и временных файлов.',
        });
      }

      disk = { totalGb, freeGb, usedPct, status };
    } catch {
      disk = { totalGb: 100, freeGb: 50, usedPct: 50, status: 'HEALTHY' };
    }

    // 2. Memory Telemetry
    const osTotalMb = Math.round(os.totalmem() / 1024 / 1024);
    const osFreeMb = Math.round(os.freemem() / 1024 / 1024);
    const osUsedPct = osTotalMb > 0 ? Math.round(((osTotalMb - osFreeMb) / osTotalMb) * 1000) / 10 : 0;
    const memUsage = process.memoryUsage();
    const processRssMb = Math.round(memUsage.rss / 1024 / 1024);
    const processHeapMb = Math.round(memUsage.heapUsed / 1024 / 1024);

    let memStatus: MemoryTelemetry['status'] = 'HEALTHY';
    if (osUsedPct >= 92 || osFreeMb < 250) {
      memStatus = 'CRITICAL';
      alerts.push({
        code: 'INFRA_RAM_CRITICAL',
        category: 'INFRA',
        severity: 'CRITICAL',
        title: 'Критический дефицит RAM (<250 МБ свободно)',
        details: `Занято ${osUsedPct}% памяти OS. Свободно всего ${osFreeMb} МБ. Next.js RSS: ${processRssMb} МБ.`,
        suggestedAction: 'Проверьте процессы, возможна утечка памяти или агрессивный сборщик.',
      });
    } else if (osUsedPct >= 85) {
      memStatus = 'WARNING';
    }

    const memory: MemoryTelemetry = {
      osTotalMb,
      osFreeMb,
      osUsedPct,
      processRssMb,
      processHeapMb,
      status: memStatus,
    };

    // 3. Database Ping Telemetry
    let dbStatus: DatabaseTelemetry['status'] = 'HEALTHY';
    let pingLatencyMs = 0;
    const tDb = Date.now();
    try {
      await db.$queryRawUnsafe('SELECT 1');
      pingLatencyMs = Date.now() - tDb;

      if (pingLatencyMs > 800) {
        dbStatus = 'DEGRADED';
        alerts.push({
          code: 'DB_SLOW_QUERY_SPIKE',
          category: 'DATABASE',
          severity: 'WARNING',
          title: 'Высокая задержка базы данных PostgreSQL',
          details: `Время отклика 'SELECT 1' выросло до ${pingLatencyMs} мс (норма < 20 мс).`,
          suggestedAction: 'Проверьте заблокированные транзакции и нагрузку на диск.',
        });
      }
    } catch (e) {
      dbStatus = 'DOWN';
      pingLatencyMs = Date.now() - tDb;
      alerts.push({
        code: 'DB_CONNECTION_FAILED',
        category: 'DATABASE',
        severity: 'CRITICAL',
        title: 'Потеря связи с базой данных PostgreSQL',
        details: `Ошибка подключения: ${(e as Error).message}`,
        suggestedAction: 'Срочно проверьте контейнер PostgreSQL: docker-compose restart db',
      });
    }

    const database: DatabaseTelemetry = { pingLatencyMs, status: dbStatus };

    // 4. Redis Telemetry
    let usedMemoryMb = 0;
    let peakMemoryMb = 0;
    let redisStatus: RedisTelemetry['status'] = 'HEALTHY';
    try {
      const info = await redis.info('memory');
      const usedMatch = info.match(/used_memory:(\d+)/);
      const peakMatch = info.match(/used_memory_peak:(\d+)/);
      if (usedMatch) usedMemoryMb = Math.round(parseInt(usedMatch[1], 10) / 1024 / 1024);
      if (peakMatch) peakMemoryMb = Math.round(parseInt(peakMatch[1], 10) / 1024 / 1024);

      if (usedMemoryMb >= 900) {
        redisStatus = 'CRITICAL';
        alerts.push({
          code: 'REDIS_MEMORY_CRITICAL',
          category: 'DATABASE',
          severity: 'CRITICAL',
          title: 'Память Redis приближается к лимиту 1024 МБ',
          details: `Использовано ${usedMemoryMb} МБ из 1024 МБ.`,
          suggestedAction: 'Проверьте объем кэшей каталога и очереди BullMQ.',
        });
      }
    } catch {
      // Redis info fallback
    }

    const redisTelem: RedisTelemetry = { usedMemoryMb, peakMemoryMb, status: redisStatus };

    // 5. Queues Backlog Telemetry
    let ordersWaiting = 0;
    let ordersActive = 0;
    let ordersFailed = 0;
    let syncWaiting = 0;
    let queuesStatus: QueuesTelemetry['status'] = 'HEALTHY';

    const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> => {
      let timer: NodeJS.Timeout;
      const timeoutPromise = new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs);
      });
      return Promise.race([
        promise.then((res) => {
          clearTimeout(timer);
          return res;
        }).catch(() => {
          clearTimeout(timer);
          return fallback;
        }),
        timeoutPromise
      ]);
    };

    try {
      const [ow, oa, of, sw] = await Promise.all([
        withTimeout(ordersQueue.getWaitingCount(), 1000, 0),
        withTimeout(ordersQueue.getActiveCount(), 1000, 0),
        withTimeout(ordersQueue.getFailedCount(), 1000, 0),
        withTimeout(syncQueue.getWaitingCount(), 1000, 0),
      ]);
      ordersWaiting = ow;
      ordersActive = oa;
      ordersFailed = of;
      syncWaiting = sw;

      if (ordersWaiting > 200) {
        queuesStatus = 'WARNING';
        alerts.push({
          code: 'BULLMQ_ORDER_BACKLOG',
          category: 'BUSINESS',
          severity: 'WARNING',
          title: 'Скопление очереди заказов (>200 задач)',
          details: `В очереди ordersQueue ожидает ${ordersWaiting} заказов.`,
          suggestedAction: 'Проверьте доступность API провайдеров и работу воркера.',
        });
      }
    } catch {
      // Best-effort queue telemetry
    }

    const queues: QueuesTelemetry = {
      ordersWaiting,
      ordersActive,
      ordersFailed,
      syncWaiting,
      status: queuesStatus,
    };

    // Overall status
    const hasCritical = alerts.some((a) => a.severity === 'CRITICAL');
    const hasWarning = alerts.some((a) => a.severity === 'WARNING');
    const overallStatus: SystemHealthSnapshot['overallStatus'] = hasCritical
      ? 'CRITICAL'
      : hasWarning
      ? 'DEGRADED'
      : 'HEALTHY';

    return {
      timestamp: new Date().toISOString(),
      overallStatus,
      disk,
      memory,
      database,
      redis: redisTelem,
      queues,
      activeAlerts: alerts,
    };
  }

  /**
   * Evaluates system health and dispatches debounced alerts to Telegram if thresholds are breached.
   */
  static async evaluateAndAlertAdmins(): Promise<{ alertsSent: number; snapshot: SystemHealthSnapshot }> {
    const snapshot = await this.collectSnapshot();
    let alertsSent = 0;

    for (const alert of snapshot.activeAlerts) {
      const throttleKey = `${this.THROTTLE_PREFIX}${alert.code}`;
      try {
        const isThrottled = await redis.get(throttleKey);
        if (isThrottled) {
          continue; // Suppress repeated spam within 5 minutes
        }
        await redis.set(throttleKey, '1', 'EX', this.THROTTLE_TTL_SEC);
      } catch {
        // Fallback to send
      }

      const emoji = alert.severity === 'CRITICAL' ? '🚨' : '⚠️';
      const msg = [
        `${emoji} <b>[${alert.severity}] ${alert.title}</b>`,
        '',
        `📂 <b>Категория:</b> <code>${alert.category}</code> (Код: <code>${alert.code}</code>)`,
        `📊 <b>Метрики:</b> ${alert.details}`,
        `💡 <b>Действие:</b> <i>${alert.suggestedAction}</i>`,
        '',
        `<i>Система мониторинга OmniSMM 1.0 • ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}</i>`,
      ].join('\n');

      sendAdminAlert(msg, alert.severity);
      alertsSent++;
      log.warn(`Dispatched infrastructure alert [${alert.code}]`, { alert });
    }

    return { alertsSent, snapshot };
  }
}

export const getSystemTelemetry = () => SystemTelemetryService.collectSnapshot();
