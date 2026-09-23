import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'PiiAccessLog' });

export interface LogPiiAccessInput {
  staffId: string;
  staffEmail: string;
  action: string;
  targetId: string;
  targetType: 'client' | 'order' | 'payment';
  fields: string[];
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Logs staff read access to Personally Identifiable Information (PII)
 * for 152-FZ, GDPR, and security audit trail compliance.
 */
export async function logPiiAccess(input: LogPiiAccessInput): Promise<void> {
  const { staffId, staffEmail, action, targetId, targetType, fields, ip, userAgent } = input;

  try {
    await db.piiAccessLog.create({
      data: {
        staffId,
        staffEmail,
        action,
        targetId,
        targetType,
        fields,
        ip: ip || null,
        userAgent: userAgent || null,
      },
    });

    log.info('PII access logged', {
      staffEmail,
      action,
      targetType,
      targetId,
      fieldsCount: fields.length,
    });
  } catch (err) {
    log.error('Failed to record PII access log', {
      error: err instanceof Error ? err.message : String(err),
      input,
    });
  }
}

/**
 * Masks an email for safe display (e.g. "alexander@domain.com" -> "a***r@domain.com")
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return '';
  const parts = email.split('@');
  if (parts.length !== 2) return '***';

  const [name, domain] = parts;
  if (name.length <= 2) {
    return `${name[0]}***@${domain}`;
  }

  return `${name[0]}***${name[name.length - 1]}@${domain}`;
}

/**
 * Masks a phone number (e.g. "+79991234567" -> "+7 (999) ***-**-67")
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone || typeof phone !== 'string') return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return '***-***';

  const lastTwo = digits.slice(-2);
  const code = digits.slice(0, 4);
  return `+${code} ***-**-${lastTwo}`;
}

/**
 * Masks Russian INN (e.g. "7701123456" -> "7701****56")
 */
export function maskInn(inn: string | null | undefined): string {
  if (!inn || typeof inn !== 'string') return '';
  if (inn.length < 6) return '***';

  const prefix = inn.slice(0, 4);
  const suffix = inn.slice(-2);
  return `${prefix}****${suffix}`;
}

/**
 * Masks physical address (e.g. "г. Москва, ул. Тверская 12, кв 45" -> "г. Москва, ул. ***")
 */
export function maskAddress(address: string | null | undefined): string {
  if (!address || typeof address !== 'string') return '';
  const commaIndex = address.indexOf(',');
  if (commaIndex > 0) {
    return `${address.slice(0, commaIndex)}, ул. ***`;
  }
  return `${address.slice(0, 10)}... ***`;
}
