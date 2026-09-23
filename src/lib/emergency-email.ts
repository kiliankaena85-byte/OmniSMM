import nodemailer from 'nodemailer';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'EmergencyEmailService' });

export interface EmergencyEmailPayload {
  severity: 'WARNING' | 'CRITICAL';
  title: string;
  details: string;
  suggestedAction?: string;
  metadata?: Record<string, unknown>;
}

export class EmergencyEmailService {
  private static transporter: nodemailer.Transporter | null = null;

  private static getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) return this.transporter;

    const host = process.env.SMTP_HOST || 'smtp.yandex.ru';
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const user = process.env.SMTP_USER || 'support@smmplan.pro';
    const pass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;

    if (!user || !pass) {
      log.warn('SMTP credentials not configured. Emergency email alerts disabled.');
      return null;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      connectionTimeout: 5000,
      socketTimeout: 5000,
    });

    return this.transporter;
  }

  /**
   * Dispatches a high-priority emergency email alert to the system owner/admin.
   * Safe, non-blocking, never throws.
   */
  static async sendAlert(payload: EmergencyEmailPayload): Promise<{ success: boolean; messageId?: string }> {
    const toEmail = process.env.ADMIN_ALERT_EMAIL || process.env.SMTP_USER || 'support@smmplan.pro';
    const transporter = this.getTransporter();

    if (!transporter) {
      return { success: false };
    }

    const { severity, title, details, suggestedAction, metadata } = payload;
    const moscowTime = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    const emoji = severity === 'CRITICAL' ? '🚨' : '⚠️';
    const headerColor = severity === 'CRITICAL' ? '#dc2626' : '#d97706';

    const metadataHtml = metadata
      ? `<pre style="background: #1e293b; color: #f8fafc; padding: 12px; border-radius: 6px; font-size: 12px; overflow-x: auto;">${JSON.stringify(
          metadata,
          null,
          2
        )}</pre>`
      : '';

    const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 24px;">
      <div style="max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden;">
        <div style="background: ${headerColor}; padding: 16px 24px; color: #ffffff;">
          <h2 style="margin: 0; font-size: 18px;">${emoji} [${severity}] OmniSMM 1.0 Emergency Alert</h2>
        </div>
        <div style="padding: 24px;">
          <h3 style="margin-top: 0; color: #ffffff; font-size: 16px;">${title}</h3>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${details}</p>
          
          ${
            suggestedAction
              ? `<div style="background: rgba(59, 130, 246, 0.1); border-left: 4px solid #3b82f6; padding: 12px; margin: 16px 0; border-radius: 4px;">
                  <strong style="color: #60a5fa; font-size: 13px;">💡 Рекомендуемое действие:</strong>
                  <p style="color: #e2e8f0; font-size: 13px; margin: 4px 0 0 0;">${suggestedAction}</p>
                </div>`
              : ''
          }
          
          ${metadataHtml}

          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #334155; color: #94a3b8; font-size: 12px; display: flex; justify-content: space-between;">
            <span>Время инцидента: ${moscowTime}</span>
            <span>OmniSMM 1.0 Autonomous Watchdog</span>
          </div>
        </div>
      </div>
    </body>
    </html>
    `;

    try {
      const info = await transporter.sendMail({
        from: `"OmniSMM 1.0 Security" <${process.env.SMTP_USER || 'support@smmplan.pro'}>`,
        to: toEmail,
        subject: `${emoji} [${severity}] ${title} — OmniSMM Monitor`,
        html,
      });

      log.info('Emergency alert email sent successfully', { messageId: info.messageId, to: toEmail });
      return { success: true, messageId: info.messageId };
    } catch (err) {
      log.error('Failed to send emergency alert email', { error: (err as Error).message });
      return { success: false };
    }
  }
}
