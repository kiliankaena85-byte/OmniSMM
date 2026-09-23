import os from 'os';
import fs from 'fs';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { P0AlertDebouncer } from '@/lib/alerts/p0-alert-debouncer';
import { sendP0EmergencyAlert } from '@/lib/notifications';
import { SettingsProvider } from '@/lib/settings';
import { providerService } from '@/services/providers/provider.service';

const log = logger.child({ component: 'P0ThreatSensorService' });

export interface SystemHealthMetrics {
  diskFreePercent: number;
  diskTotalGb: number;
  diskFreeGb: number;
  memoryUsedPercent: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  isStaleCurrency: boolean;
  currencyHoursOld: number;
  lowBalanceProviders: Array<{ id: string; name: string; balance: string; currency: string }>;
}

export class P0ThreatSensorService {
  /**
   * Checks free disk space on the primary partition.
   * Triggers P0 if free space < 10%.
   */
  public static async checkDiskSpace(): Promise<{ isCritical: boolean; freePercent: number; totalGb: number; freeGb: number }> {
    try {
      // In Node 18.15+, fs.statfsSync is natively supported
      const statfs = (fs as any).statfsSync ? (fs as any).statfsSync(process.cwd()) : null;
      if (statfs) {
        const totalBytes = Number(statfs.blocks) * Number(statfs.bsize);
        const freeBytes = Number(statfs.bfree) * Number(statfs.bsize);
        const freePercent = totalBytes > 0 ? (freeBytes / totalBytes) * 100 : 100;
        const totalGb = Math.round(totalBytes / (1024 * 1024 * 1024) * 10) / 10;
        const freeGb = Math.round(freeBytes / (1024 * 1024 * 1024) * 10) / 10;

        const isCritical = freePercent < 10;

        if (isCritical) {
          const shouldSend = await P0AlertDebouncer.shouldSendAlert('disk_critical', 12 * 3600); // 12h cooldown
          if (shouldSend) {
            await sendP0EmergencyAlert({
              code: 'P0_DISK_SPACE_CRITICAL',
              title: 'Свободное место на диске сервера критически мало!',
              details: `Свободно: ${freePercent.toFixed(1)}% (${freeGb} GB из ${totalGb} GB). Запись WAL PostgreSQL под угрозой остановки.`,
              actionPlan: 'Подключитесь по SSH и очистите docker-логи (docker system prune -f) или увеличьте размер диска в панели хостинга.',
            });
          }
        }

        return { isCritical, freePercent: Math.round(freePercent * 10) / 10, totalGb, freeGb };
      }
    } catch (err) {
      log.warn('[P0ThreatSensor] statfs check failed, using fallback', { error: err });
    }

    return { isCritical: false, freePercent: 100, totalGb: 100, freeGb: 100 };
  }

  /**
   * Checks RAM pressure.
   * Triggers P0 only if RAM sustained usage is high.
   */
  public static async checkMemoryPressure(): Promise<{ isCritical: boolean; usedPercent: number; usedMb: number; totalMb: number }> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usedPercent = totalMem > 0 ? (usedMem / totalMem) * 100 : 0;
    const usedMb = Math.round(usedMem / (1024 * 1024));
    const totalMb = Math.round(totalMem / (1024 * 1024));

    const isCritical = usedPercent > 92;

    if (isCritical) {
      const threshold = await P0AlertDebouncer.checkThresholdTrigger('ram_pressure', 180, 3); // 3 consecutive checks in 3 mins
      if (threshold.shouldTrigger) {
        const shouldSend = await P0AlertDebouncer.shouldSendAlert('ram_critical', 3600); // 1h cooldown
        if (shouldSend) {
          await sendP0EmergencyAlert({
            code: 'P0_MEMORY_LEAK_OOM',
            title: 'Критическая нагрузка на оперативную память (RAM > 92%)!',
            details: `Использование памяти: ${usedPercent.toFixed(1)}% (${usedMb} MB / ${totalMb} MB). Риск аварийного сброса Node.js (OOM).`,
            actionPlan: 'Проверьте утечки памяти в воркерах или перезапустите контейнер приложения.',
          });
        }
      }
    }

    return { isCritical, usedPercent: Math.round(usedPercent * 10) / 10, usedMb, totalMb };
  }

  /**
   * Checks all active upstream providers for low deposit balance (< $30 / 3000 RUB).
   */
  public static async checkProviderBalances(): Promise<Array<{ id: string; name: string; balance: string; currency: string }>> {
    const lowBalanceProviders: Array<{ id: string; name: string; balance: string; currency: string }> = [];

    try {
      const activeProviders = await db.provider.findMany({
        where: { isActive: true },
      });

      for (const provider of activeProviders) {
        if (!provider.apiUrl || !provider.apiKey) continue;

        try {
          const instance = await providerService.getProviderInstance(provider);
          const balanceDto = await instance.getBalance();
          const balanceNum = parseFloat(balanceDto.balance.replace(/[^\d.-]/g, ''));

          if (!isNaN(balanceNum)) {
            const isUsd = balanceDto.currency.toUpperCase() === 'USD';
            const isLow = isUsd ? balanceNum < 30.0 : balanceNum < 3000.0;

            if (isLow) {
              lowBalanceProviders.push({
                id: provider.id,
                name: provider.name,
                balance: balanceDto.balance,
                currency: balanceDto.currency,
              });

              const shouldSend = await P0AlertDebouncer.shouldSendAlert(`low_balance_${provider.id}`, 6 * 3600); // 6h cooldown
              if (shouldSend) {
                await sendP0EmergencyAlert({
                  code: 'P0_PROVIDER_LOW_BALANCE',
                  title: `Заканчивается депозит у поставщика ${provider.name}!`,
                  details: `Текущий остаток: ${balanceDto.balance} ${balanceDto.currency}. При нулевом балансе заказы перестанут выполняться.`,
                  actionPlan: `Пополните баланс в личном кабинете поставщика ${provider.name}.`,
                });
              }
            }
          }
        } catch (provErr) {
          log.warn(`[P0ThreatSensor] Could not check balance for ${provider.name}`, { error: provErr });
        }
      }
    } catch (err) {
      log.error('[P0ThreatSensor] checkProviderBalances query failed', { cause: err });
    }

    return lowBalanceProviders;
  }

  /**
   * Checks if CBR USD currency exchange rate is stale (> 48 hours).
   */
  public static async checkStaleCurrencyRate(): Promise<{ isStale: boolean; hoursOld: number }> {
    try {
      const settings = await SettingsProvider.get();
      if (settings.exchangeRateUpdatedAt) {
        const syncTime = new Date(settings.exchangeRateUpdatedAt).getTime();
        const hoursOld = !isNaN(syncTime) ? (Date.now() - syncTime) / (1000 * 60 * 60) : 0;
        const isStale = hoursOld > 48;

        if (isStale) {
          const shouldSend = await P0AlertDebouncer.shouldSendAlert('stale_cbr_currency', 24 * 3600); // 24h cooldown
          if (shouldSend) {
            await sendP0EmergencyAlert({
              code: 'P0_STALE_CURRENCY_RATE',
              title: 'Курс валют ЦБ РФ не обновлялся более 48 часов!',
              details: `Курс устарел на ${Math.round(hoursOld)} часов. Заказы могут рассчитываться по неактуальному курсу.`,
              actionPlan: 'Запустите синхронизацию курса валют в разделе «Админка → Финансы» или проверьте роут /api/cron/sync-cbr.',
            });
          }
        }

        return { isStale, hoursOld: Math.round(hoursOld * 10) / 10 };
      }
    } catch (err) {
      log.warn('[P0ThreatSensor] checkStaleCurrencyRate failed', { error: err });
    }

    return { isStale: false, hoursOld: 0 };
  }

  /**
   * Safely purges expired sessions and auth tokens with a 24-hour safety buffer.
   * Prevents database bloat while strictly avoiding race conditions with active users.
   */
  public static async purgeExpiredSessionsWithSafetyMargin(): Promise<{ deletedSessions: number; deletedTokens: number }> {
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24-hour safety buffer

      const [sessionsResult, tokensResult] = await Promise.all([
        db.session.deleteMany({
          where: { expiresAt: { lt: cutoff } }
        }),
        db.authToken.deleteMany({
          where: { expiresAt: { lt: cutoff } }
        })
      ]);

      if (sessionsResult.count > 0 || tokensResult.count > 0) {
        log.info('[P0ThreatSensor] Cleaned expired sessions and auth tokens', {
          deletedSessions: sessionsResult.count,
          deletedTokens: tokensResult.count
        });
      }

      return {
        deletedSessions: sessionsResult.count,
        deletedTokens: tokensResult.count
      };
    } catch (err) {
      log.warn('[P0ThreatSensor] purgeExpiredSessionsWithSafetyMargin failed', { error: err });
      return { deletedSessions: 0, deletedTokens: 0 };
    }
  }

  /**
   * Runs a complete comprehensive P0 health telemetry scan.
   */
  public static async runFullP0Scan(): Promise<SystemHealthMetrics> {
    const [disk, mem, lowProviders, currency] = await Promise.all([
      this.checkDiskSpace(),
      this.checkMemoryPressure(),
      this.checkProviderBalances(),
      this.checkStaleCurrencyRate(),
      this.purgeExpiredSessionsWithSafetyMargin(),
    ]);

    return {
      diskFreePercent: disk.freePercent,
      diskTotalGb: disk.totalGb,
      diskFreeGb: disk.freeGb,
      memoryUsedPercent: mem.usedPercent,
      memoryUsedMb: mem.usedMb,
      memoryTotalMb: mem.totalMb,
      isStaleCurrency: currency.isStale,
      currencyHoursOld: currency.hoursOld,
      lowBalanceProviders: lowProviders,
    };
  }
}
