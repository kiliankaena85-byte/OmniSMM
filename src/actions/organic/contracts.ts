/**
 * OmniOrganic — Zod контракты (Contract-Driven Development)
 * Все входные и выходные данные строго типизированы.
 * Реализация ОБЯЗАНА соответствовать этим контрактам.
 */
import { z } from 'zod';

// ─── Создание кампании ─────────────────────────────────────────────────────
export const CreateCampaignSchema = z.object({
  channelUsername: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^@?[a-zA-Z0-9_]+$/, 'Некорректное имя канала (только буквы, цифры, _)')
    .transform(v => v.replace(/^@/, '')),
  targetNetGain: z
    .number()
    .int()
    .min(100, 'Минимум 100 подписчиков')
    .max(100_000, 'Максимум 100 000 подписчиков за одну кампанию'),
  durationDays: z
    .number()
    .int()
    .min(7, 'Минимум 7 дней')
    .max(90, 'Максимум 90 дней')
    .default(30),
  churnRateMin: z.number().min(0.03).max(0.5).default(0.08),
  churnRateMax: z.number().min(0.03).max(0.5).default(0.12),
  activeHourStart: z.number().int().min(0).max(23).default(7),
  activeHourEnd: z.number().int().min(0).max(23).default(23),
  weekendMultiplier: z.number().min(0.1).max(1.0).default(0.6),
  orderId: z.string().min(1),
  tenantId: z.string().default('smmplan'),
}).refine(
  d => d.churnRateMin <= d.churnRateMax,
  { message: 'churnRateMin должен быть <= churnRateMax', path: ['churnRateMin'] }
).refine(
  d => d.activeHourStart < d.activeHourEnd,
  { message: 'activeHourStart должен быть < activeHourEnd', path: ['activeHourStart'] }
);

export type CreateCampaignDto = z.infer<typeof CreateCampaignSchema>;

// ─── Статус кампании ────────────────────────────────────────────────────────
export const CampaignStatusSchema = z.object({
  id: z.string(),
  channelUsername: z.string(),
  status: z.enum(['SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']),
  targetNetGain: z.number(),
  netGainActual: z.number(),
  followsDelivered: z.number(),
  unfollowsDelivered: z.number(),
  progressPercent: z.number().min(0).max(100),
  daysRemaining: z.number().int(),
  retentionRate: z.number().min(0).max(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export type CampaignStatusDto = z.infer<typeof CampaignStatusSchema>;

// ─── Обновление предпочтений ноды ───────────────────────────────────────────
export const UpdateNodePrefsSchema = z.object({
  nodeId: z.string().trim().min(3),
  acceptsViewTasks: z.boolean().optional(),
  acceptsReactTasks: z.boolean().optional(),
  acceptsFollowTasks: z.boolean().optional(),
});

export type UpdateNodePrefsDto = z.infer<typeof UpdateNodePrefsSchema>;

// ─── Дневной план (для NaturalChurnEngine) ──────────────────────────────────
export interface HourlySlot {
  hour: number;
  follows: number;
  unfollows: number;
}

export interface DailyPlan {
  date: Date;
  follows: number;
  unfollows: number;
  netGain: number;
  churnRate: number;
  hourlySchedule: HourlySlot[];
}

export interface OrganicGrowthConfig {
  targetNetGain: number;
  durationDays: number;
  churnRateMin: number;
  churnRateMax: number;
  activeHourStart: number;
  activeHourEnd: number;
  weekendMultiplier: number;
}
