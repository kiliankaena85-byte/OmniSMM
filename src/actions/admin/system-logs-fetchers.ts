import { db } from '@/lib/db';
import { redactSensitiveTokens } from '@/lib/logger/sensitive-data-filter';
import {
  type SystemLogsFilter,
  type SystemLogsResult,
  type SecurityEventDTO,
  type LoginLogDTO,
  type AdminAuditLogDTO,
  type TelegramErrorLogDTO,
  type LogStatsDTO,
} from '@/types/system-logs.dto';

export function sanitizePayload(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const serialized = typeof raw === 'string' ? raw : JSON.stringify(raw);
    const scrubbed = redactSensitiveTokens(serialized);
    return JSON.parse(scrubbed);
  } catch {
    return { raw: String(raw) };
  }
}

function toResult<T>(category: SystemLogsFilter['category'], items: T[], total: number, filter: SystemLogsFilter, stats: LogStatsDTO): SystemLogsResult<T> {
  return {
    category,
    items,
    total,
    page: filter.page,
    pageSize: filter.pageSize,
    totalPages: Math.ceil(total / filter.pageSize) || 1,
    stats,
  };
}

export async function fetchSecurityLogs(
  filter: SystemLogsFilter,
  tenantCondition: Record<string, unknown>,
  skip: number,
  take: number,
  stats: LogStatsDTO,
): Promise<SystemLogsResult<SecurityEventDTO>> {
  const where: Record<string, unknown> = { ...tenantCondition };
  if (filter.severity && filter.severity !== 'ALL') where.severity = filter.severity;
  if (filter.search) {
    where.OR = [
      { event: { contains: filter.search, mode: 'insensitive' } },
      { ip: { contains: filter.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    db.securityEvent.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    db.securityEvent.count({ where }),
  ]);

  const formatted: SecurityEventDTO[] = items.map((i) => ({
    id: i.id,
    tenantId: i.tenantId ?? 'smmplan',
    event: i.event,
    severity: i.severity,
    ip: i.ip,
    details: sanitizePayload(i.details),
    createdAt: i.createdAt.toISOString(),
  }));

  return toResult('security', formatted, total, filter, stats);
}

export async function fetchLoginLogs(
  filter: SystemLogsFilter,
  tenantCondition: Record<string, unknown>,
  skip: number,
  take: number,
  stats: LogStatsDTO,
): Promise<SystemLogsResult<LoginLogDTO>> {
  const where: Record<string, unknown> = { ...tenantCondition };
  if (filter.severity === 'FAILED') where.success = false;
  else if (filter.severity === 'SUCCESS') where.success = true;
  if (filter.search) {
    where.OR = [
      { email: { contains: filter.search, mode: 'insensitive' } },
      { ipAddress: { contains: filter.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    db.loginLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    db.loginLog.count({ where }),
  ]);

  const formatted: LoginLogDTO[] = items.map((i) => ({
    id: i.id,
    tenantId: i.tenantId ?? 'smmplan',
    email: i.email,
    userId: i.userId,
    ipAddress: i.ipAddress,
    userAgent: i.userAgent,
    success: i.success,
    failReason: i.failReason,
    createdAt: i.createdAt.toISOString(),
  }));

  return toResult('logins', formatted, total, filter, stats);
}

export async function fetchAuditLogs(
  filter: SystemLogsFilter,
  tenantCondition: Record<string, unknown>,
  skip: number,
  take: number,
  stats: LogStatsDTO,
): Promise<SystemLogsResult<AdminAuditLogDTO>> {
  const where: Record<string, unknown> = { ...tenantCondition };
  if (filter.severity && filter.severity !== 'ALL') where.targetType = filter.severity;
  if (filter.search) {
    where.OR = [
      { action: { contains: filter.search, mode: 'insensitive' } },
      { adminEmail: { contains: filter.search, mode: 'insensitive' } },
      { target: { contains: filter.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    db.adminAuditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    db.adminAuditLog.count({ where }),
  ]);

  const formatted: AdminAuditLogDTO[] = items.map((i) => ({
    id: i.id,
    tenantId: i.tenantId ?? 'smmplan',
    adminId: i.adminId,
    adminEmail: i.adminEmail,
    action: i.action,
    target: i.target,
    targetType: i.targetType,
    oldValue: i.oldValue ? redactSensitiveTokens(i.oldValue) : null,
    newValue: i.newValue ? redactSensitiveTokens(i.newValue) : null,
    ipAddress: i.ipAddress,
    createdAt: i.createdAt.toISOString(),
  }));

  return toResult('audit', formatted, total, filter, stats);
}

export async function fetchTelegramLogs(
  filter: SystemLogsFilter,
  tenantCondition: Record<string, unknown>,
  skip: number,
  take: number,
  stats: LogStatsDTO,
): Promise<SystemLogsResult<TelegramErrorLogDTO>> {
  const where: Record<string, unknown> = { ...tenantCondition };
  if (filter.severity && filter.severity !== 'ALL') where.level = filter.severity;
  if (filter.search) {
    where.OR = [
      { errorMessage: { contains: filter.search, mode: 'insensitive' } },
      { source: { contains: filter.search, mode: 'insensitive' } },
      { errorCode: { contains: filter.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    db.telegramErrorLog.findMany({ where, orderBy: { firstSeenAt: 'desc' }, skip, take }),
    db.telegramErrorLog.count({ where }),
  ]);

  const formatted: TelegramErrorLogDTO[] = items.map((i) => ({
    id: i.id,
    tenantId: i.tenantId,
    level: i.level,
    source: i.source,
    errorCode: i.errorCode,
    errorMessage: i.errorMessage,
    stackTrace: i.stackTrace ? redactSensitiveTokens(i.stackTrace) : null,
    updateData: i.updateData ? redactSensitiveTokens(i.updateData) : null,
    userId: i.userId,
    chatId: i.chatId,
    isResolved: i.isResolved,
    occurrenceCount: i.occurrenceCount,
    firstSeenAt: i.firstSeenAt.toISOString(),
  }));

  return toResult('telegram', formatted, total, filter, stats);
}
