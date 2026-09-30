import { describe, it, expect } from 'vitest';
import type { OrganicGrowthConfig, DailyPlan } from '@/actions/organic/contracts';

// RED PHASE: импорт ещё не существует → тест упадёт с MODULE_NOT_FOUND
import { NaturalChurnEngine } from '@/services/organic/natural-churn-engine';

const BASE_CONFIG: OrganicGrowthConfig = {
  targetNetGain: 500,
  durationDays: 30,
  churnRateMin: 0.08,
  churnRateMax: 0.12,
  activeHourStart: 7,
  activeHourEnd: 23,
  weekendMultiplier: 0.6,
};

describe('NaturalChurnEngine', () => {
  describe('generateCampaignSchedule', () => {
    it('returns exactly durationDays plans', () => {
      const plans = NaturalChurnEngine.generateCampaignSchedule(BASE_CONFIG);
      expect(plans).toHaveLength(30);
    });

    it('total net gain is within 5% of target', () => {
      const plans = NaturalChurnEngine.generateCampaignSchedule(BASE_CONFIG);
      const totalNet = plans.reduce((s, p) => s + p.netGain, 0);
      expect(totalNet).toBeGreaterThan(500 * 0.95);
      expect(totalNet).toBeLessThan(500 * 1.15); // slight overshoot ok
    });

    it('each day churn rate is within configured bounds', () => {
      const plans = NaturalChurnEngine.generateCampaignSchedule(BASE_CONFIG);
      for (const plan of plans) {
        if (plan.follows === 0) continue;
        expect(plan.churnRate).toBeGreaterThanOrEqual(BASE_CONFIG.churnRateMin - 0.01);
        expect(plan.churnRate).toBeLessThanOrEqual(BASE_CONFIG.churnRateMax + 0.01);
      }
    });

    it('weekend days have lower activity than weekdays', () => {
      const plans = NaturalChurnEngine.generateCampaignSchedule(BASE_CONFIG);
      const weekdays = plans.filter(p => ![0, 6].includes(p.date.getDay()));
      const weekends = plans.filter(p => [0, 6].includes(p.date.getDay()));
      if (weekends.length === 0) return;
      const avgWeekday = weekdays.reduce((s, p) => s + p.follows, 0) / weekdays.length;
      const avgWeekend = weekends.reduce((s, p) => s + p.follows, 0) / weekends.length;
      expect(avgWeekend).toBeLessThan(avgWeekday);
    });

    it('hourly schedule sums match daily totals', () => {
      const plans = NaturalChurnEngine.generateCampaignSchedule(BASE_CONFIG);
      for (const plan of plans) {
        const hourlyFollows = plan.hourlySchedule.reduce((s, h) => s + h.follows, 0);
        // allow rounding diff of ±2
        expect(Math.abs(hourlyFollows - plan.follows)).toBeLessThanOrEqual(2);
      }
    });

    it('no hours outside activeHour window', () => {
      const plans = NaturalChurnEngine.generateCampaignSchedule(BASE_CONFIG);
      for (const plan of plans) {
        for (const slot of plan.hourlySchedule) {
          expect(slot.hour).toBeGreaterThanOrEqual(BASE_CONFIG.activeHourStart);
          expect(slot.hour).toBeLessThanOrEqual(BASE_CONFIG.activeHourEnd);
        }
      }
    });

    it('all follows and unfollows are non-negative integers', () => {
      const plans = NaturalChurnEngine.generateCampaignSchedule(BASE_CONFIG);
      for (const plan of plans) {
        expect(plan.follows).toBeGreaterThanOrEqual(0);
        expect(plan.unfollows).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(plan.follows)).toBe(true);
        expect(Number.isInteger(plan.unfollows)).toBe(true);
      }
    });
  });
});
