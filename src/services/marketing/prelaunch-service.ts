import crypto from 'node:crypto';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { sendAdminAlert } from '@/lib/notifications';

export interface SubscribeLeadInput {
  email: string;
  tenantId?: string;
  ip?: string;
  source?: string;
}

export interface SubscribeLeadResult {
  success: boolean;
  message: string;
  isNew?: boolean;
}

export class PreLaunchService {
  private static readonly RATE_LIMIT_MAX = 5;
  private static readonly RATE_LIMIT_WINDOW_SEC = 3600; // 1 hour
  private static readonly SALT = process.env.APP_SECRET || 'smmplan_prelaunch_salt_2026';

  /**
   * Hashes client IP using SHA-256 and salt for 152-FZ & GDPR compliance.
   */
  public static hashIp(ip?: string): string {
    if (!ip) return 'anonymous';
    const cleanIp = ip.split(',')[0].trim();
    return crypto.createHmac('sha256', this.SALT).update(cleanIp).digest('hex').substring(0, 32);
  }

  /**
   * Validates and sanitizes email to prevent CRLF injection & XSS.
   */
  public static validateEmail(rawEmail: string): { valid: boolean; email?: string; error?: string } {
    if (!rawEmail || typeof rawEmail !== 'string') {
      return { valid: false, error: 'Email обязателен для заполнения' };
    }

    const trimmed = rawEmail.trim().toLowerCase();

    // Check for CRLF / Header injection attempts
    if (/[\r\n\0\t]/.test(trimmed)) {
      return { valid: false, error: 'Недопустимые символы в адресе email' };
    }

    // Strict standard RFC 5322 compatible email regex
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!emailRegex.test(trimmed) || trimmed.length > 254) {
      return { valid: false, error: 'Пожалуйста, укажите корректный адрес электронной почты' };
    }

    return { valid: true, email: trimmed };
  }

  /**
   * Checks Redis rate limiter for the given IP hash.
   */
  public static async checkRateLimit(ipHash: string): Promise<boolean> {
    try {
      const key = `ratelimit:prelaunch:${ipHash}`;
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, this.RATE_LIMIT_WINDOW_SEC);
      }
      return count <= this.RATE_LIMIT_MAX;
    } catch {
      // Fallback open if Redis is unavailable during testing
      return true;
    }
  }

  /**
   * Subscribes a potential client for pre-launch notifications.
   */
  public static async subscribe(input: SubscribeLeadInput): Promise<SubscribeLeadResult> {
    const { valid, email, error } = this.validateEmail(input.email);
    if (!valid || !email) {
      return { success: false, message: error || 'Некорректный email' };
    }

    const tenantId = input.tenantId || 'smmplan';
    const ipHash = this.hashIp(input.ip);

    // Rate Limiting check
    const isAllowed = await this.checkRateLimit(ipHash);
    if (!isAllowed) {
      return {
        success: false,
        message: 'Слишком много попыток. Пожалуйста, повторите позже.'
      };
    }

    try {
      const existing = await (db as any).preLaunchLead.findUnique({
        where: {
          email_tenantId: { email, tenantId }
        }
      });

      const isNew = !existing;

      await (db as any).preLaunchLead.upsert({
        where: {
          email_tenantId: { email, tenantId }
        },
        update: {
          ipHash,
          source: input.source || 'holding_page',
          createdAt: existing ? existing.createdAt : new Date()
        },
        create: {
          email,
          tenantId,
          ipHash,
          source: input.source || 'holding_page',
          isNotified: false
        }
      });

      // Send instant Telegram alert to admin only for new leads
      if (isNew) {
        const adminMsg = 
          `🚀 <b>Новый подписчик на открытие SMMplan!</b>\n\n` +
          `📧 Email: <code>${email}</code>\n` +
          `🌐 Тенант: <b>${tenantId}</b>\n` +
          `📱 Источник: <code>${input.source || 'holding_page'}</code>\n` +
          `⏰ Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} МСК`;

        sendAdminAlert(adminMsg, 'INFO');
      }

      return {
        success: true,
        message: '✨ Спасибо! Мы пришлем персональное приглашение в момент публичного открытия.',
        isNew
      };
    } catch (err: any) {
      console.error('[PreLaunchService] Database error:', err);
      return {
        success: false,
        message: 'Не удалось сохранить подписку. Попробуйте еще раз.'
      };
    }
  }

  /**
   * Retrieves list of subscribed leads for admin view.
   */
  public static async listLeads(tenantId = 'smmplan', limit = 100, page = 1) {
    const skip = (page - 1) * limit;
    const [leads, total] = await Promise.all([
      (db as any).preLaunchLead.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      (db as any).preLaunchLead.count({ where: { tenantId } })
    ]);

    return { leads, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Exports all leads to CSV format for external CRM / Email delivery.
   */
  public static async exportLeadsCsv(tenantId = 'smmplan'): Promise<string> {
    const leads = await (db as any).preLaunchLead.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' }
    });

    const headers = 'ID,Email,Tenant,Source,IsNotified,CreatedAt\n';
    const rows = leads.map((l: any) => 
      `"${l.id}","${l.email}","${l.tenantId}","${l.source}","${l.isNotified}","${l.createdAt.toISOString()}"`
    ).join('\n');

    return headers + rows;
  }
}
