/**
 * Support SLA Helper based on Europe/Moscow timezone (MSK).
 * Automatically calculates realistic SLA expectation for clients and operators.
 */

export interface SupportSlaInfo {
  isNightShift: boolean;
  currentMskHour: number;
  timeStringMsk: string;
  badgeLabel: string;
  badgeShort: string;
  expectedResponseMin: number;
  description: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

export function getSupportSlaInfo(date: Date = new Date()): SupportSlaInfo {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);

  const hourStr = parts.find(p => p.type === 'hour')?.value || '12';
  const minStr = parts.find(p => p.type === 'minute')?.value || '00';
  const currentMskHour = parseInt(hourStr, 10);
  const timeStringMsk = `${hourStr}:${minStr} МСК`;

  // Night shift: 23:00 to 07:59 MSK
  const isNightShift = currentMskHour >= 23 || currentMskHour < 8;

  if (isNightShift) {
    return {
      isNightShift: true,
      currentMskHour,
      timeStringMsk,
      badgeLabel: '🌙 Ночное дежурство: ответ ~30-45 мин',
      badgeShort: '🌙 Ночной SLA ~45м',
      expectedResponseMin: 45,
      description: 'Дежурная ночная смена на связи. Время ответа может быть чуть увеличено из-за ночной нагрузки.',
      colorClass: 'text-indigo-400 dark:text-indigo-300',
      bgClass: 'bg-indigo-500/10 dark:bg-indigo-950/40',
      borderClass: 'border-indigo-500/30'
    };
  }

  return {
    isNightShift: false,
    currentMskHour,
    timeStringMsk,
    badgeLabel: '⚡ Дневная смена: ответ ~10-15 мин',
    badgeShort: '⚡ Дневной SLA ~15м',
    expectedResponseMin: 15,
    description: 'Полная дневная смена операторов на линии. Моментальная обработка тикетов.',
    colorClass: 'text-emerald-500 dark:text-emerald-400',
    bgClass: 'bg-emerald-500/10 dark:bg-emerald-950/40',
    borderClass: 'border-emerald-500/30'
  };
}
