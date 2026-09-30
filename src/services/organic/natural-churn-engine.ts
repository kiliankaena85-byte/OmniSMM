/**
 * NaturalChurnEngine — OmniOrganic Sprint 3
 * Генерирует расписание подписок/отписок, неотличимое от органического роста.
 * Паттерн: пик утро 09-11, вечер 19-22. Выходные 60% темпа.
 */
import type { OrganicGrowthConfig, DailyPlan, HourlySlot } from '@/actions/organic/contracts';

// Весовая функция активности по часам (российская аудитория, МСК)
const HOURLY_WEIGHTS: Record<number, number> = {
  0: 0.1, 1: 0.05, 2: 0.05, 3: 0.05, 4: 0.05, 5: 0.1,
  6: 0.3, 7: 0.5,  8: 0.8,  9: 1.2,  10: 1.3, 11: 1.1,
  12: 0.9, 13: 0.8, 14: 0.7, 15: 0.7, 16: 0.8, 17: 1.0,
  18: 1.1, 19: 1.3, 20: 1.4, 21: 1.3, 22: 1.0, 23: 0.6,
};

export class NaturalChurnEngine {
  /**
   * Генерирует durationDays дневных планов.
   * Суммарный net gain в пределах targetNetGain ±5%.
   */
  static generateCampaignSchedule(config: OrganicGrowthConfig): DailyPlan[] {
    const {
      targetNetGain, durationDays, churnRateMin, churnRateMax,
      activeHourStart, activeHourEnd, weekendMultiplier,
    } = config;

    // gross = net / (1 - avgChurn)  — нужно подписаться больше чтобы получить нужный net
    const avgChurn = (churnRateMin + churnRateMax) / 2;
    const totalGross = Math.ceil(targetNetGain / (1 - avgChurn));

    let totalDayMultiplier = 0;
    for (let day = 0; day < durationDays; day++) {
      const d = new Date(Date.now() + day * 86_400_000);
      const dayOfWeek = d.getDay();
      totalDayMultiplier += (dayOfWeek === 0 || dayOfWeek === 6) ? weekendMultiplier : 1.0;
    }

    const baseDailyGross = totalGross / totalDayMultiplier;

    const plans: DailyPlan[] = [];

    for (let day = 0; day < durationDays; day++) {
      const date = new Date(Date.now() + day * 86_400_000);
      // Обнуляем время до начала дня для чистоты
      date.setHours(0, 0, 0, 0);

      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const dayMultiplier = isWeekend ? weekendMultiplier : 1.0;

      // Случайная вариация ±25% (реалистичность)
      const variance = 0.75 + Math.random() * 0.5;

      // Случайный churn в диапазоне min-max
      const dailyChurn = churnRateMin + Math.random() * (churnRateMax - churnRateMin);

      const follows = Math.max(1, Math.round(baseDailyGross * dayMultiplier * variance));
      const unfollows = Math.round(follows * dailyChurn);
      const netGain = follows - unfollows;

      plans.push({
        date,
        follows,
        unfollows,
        netGain,
        churnRate: dailyChurn,
        hourlySchedule: NaturalChurnEngine.distributeByHour(
          follows, unfollows, activeHourStart, activeHourEnd
        ),
      });
    }

    return plans;
  }

  /**
   * Распределяет подписки/отписки по часам активности.
   * Использует HOURLY_WEIGHTS для реалистичного профиля.
   */
  static distributeByHour(
    follows: number,
    unfollows: number,
    hourStart: number,
    hourEnd: number
  ): HourlySlot[] {
    const activeHours = Object.keys(HOURLY_WEIGHTS)
      .map(Number)
      .filter(h => h >= hourStart && h <= hourEnd)
      .sort((a, b) => a - b);

    if (activeHours.length === 0) return [];

    const totalWeight = activeHours.reduce(
      (sum, h) => sum + (HOURLY_WEIGHTS[h] ?? 1), 0
    );

    // floor + accumulated remainder — гарантирует точное совпадение с дневным итогом
    let remainF = follows;
    let remainU = unfollows;
    const slots: HourlySlot[] = activeHours.map((hour, idx) => {
      const w = (HOURLY_WEIGHTS[hour] ?? 1) / totalWeight;
      const isLast = idx === activeHours.length - 1;
      const f = isLast ? remainF  : Math.floor(follows   * w);
      const u = isLast ? remainU  : Math.floor(unfollows * w);
      remainF -= f;
      remainU -= u;
      return { hour, follows: Math.max(0, f), unfollows: Math.max(0, u) };
    });

    return slots;
  }


  /**
   * Подбирает нужный план на текущую дату и час.
   * Используется BullMQ executor.
   */
  static getCurrentHourSlot(
    plans: DailyPlan[],
    now: Date = new Date()
  ): HourlySlot | null {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const todayPlan = plans.find(
      p => p.date.getTime() === today.getTime()
    );
    if (!todayPlan) return null;

    return todayPlan.hourlySchedule.find(s => s.hour === now.getHours()) ?? null;
  }
}
