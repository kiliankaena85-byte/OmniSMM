import { z } from 'zod';

export const LogCategorySchema = z.enum(['security', 'logins', 'audit', 'telegram']);
export type LogCategory = z.infer<typeof LogCategorySchema>;

export const SystemLogsFilterSchema = z.object({
  category: LogCategorySchema.default('security'),
  search: z.string().max(100).optional(),
  severity: z.string().max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
  tenantId: z.string().max(50).optional(),
});

export type SystemLogsFilter = z.infer<typeof SystemLogsFilterSchema>;

export interface SecurityEventDTO {
  id: string;
  tenantId: string;
  event: string;
  severity: string;
  ip: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface LoginLogDTO {
  id: string;
  tenantId: string;
  email: string;
  userId: string | null;
  ipAddress: string;
  userAgent: string | null;
  success: boolean;
  failReason: string | null;
  createdAt: string;
}

export interface AdminAuditLogDTO {
  id: string;
  tenantId: string;
  adminId: string;
  adminEmail: string;
  action: string;
  target: string;
  targetType: string;
  oldValue: string | null;
  newValue: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface TelegramErrorLogDTO {
  id: string;
  tenantId: string;
  level: string;
  source: string;
  errorCode: string | null;
  errorMessage: string;
  stackTrace: string | null;
  updateData: string | null;
  userId: string | null;
  chatId: string | null;
  isResolved: boolean;
  occurrenceCount: number;
  firstSeenAt: string;
}

export interface LogStatsDTO {
  securityCount: number;
  failedLoginsCount: number;
  auditCount: number;
  telegramErrorsCount: number;
}

export interface SystemLogsResult<T> {
  category: LogCategory;
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: LogStatsDTO;
}
