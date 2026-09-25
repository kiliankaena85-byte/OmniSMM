import nodemailer, { type Transporter } from 'nodemailer';
import dns from 'dns';
import net from 'net';
import tls from 'tls';
import { SettingsProvider } from '@/lib/settings';
import { Resend } from 'resend';
import { logger } from '@/lib/logger';
import { getBaseUrlAsync, getBaseUrlSync } from '@/utils/get-base-url';

import { normalizeTenantId, getTenantHost, getTenantSiteName } from '@/lib/seo-helpers';
import { formatRubles } from '@/utils/format-price';

// Force IPv4 DNS resolution first to avoid ENETUNREACH on dual-stack environments without IPv6 routing
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const log = logger.child({ component: 'SMTP' });

export interface SmtpProbeResult {
  success: boolean;
  host: string;
  port: number;
  durationMs: number;
  secure: boolean;
  error?: string;
}

/**
 * Directly probes SMTP host:port via socket without any intermediate proxy (SEC-003).
 * On port 465 (SMTPS), performs direct TLS handshake.
 * On port 587/25, tests raw TCP connection.
 */
export async function verifyDirectSmtpConnection(
  host: string = 'smtp.yandex.ru',
  port: number = 465,
  timeoutMs: number = 5000
): Promise<SmtpProbeResult> {
  const startTime = Date.now();
  const isTls = port === 465;

  return new Promise<SmtpProbeResult>((resolve) => {
    let settled = false;

    const onFinish = (success: boolean, error?: string) => {
      if (settled) return;
      settled = true;
      resolve({
        success,
        host,
        port,
        durationMs: Date.now() - startTime,
        secure: isTls,
        error,
      });
    };

    const timer = setTimeout(() => {
      onFinish(false, `Connection timed out after ${timeoutMs}ms`);
    }, timeoutMs);

    try {
      if (isTls) {
        const socket = tls.connect(
          {
            host,
            port,
            servername: host,
            rejectUnauthorized: true,
            timeout: timeoutMs,
          },
          () => {
            clearTimeout(timer);
            socket.end();
            onFinish(true);
          }
        );

        socket.on('error', (err) => {
          clearTimeout(timer);
          onFinish(false, err.message);
        });

        socket.on('timeout', () => {
          clearTimeout(timer);
          socket.destroy();
          onFinish(false, 'TLS Handshake timeout');
        });
      } else {
        const socket = net.createConnection({ host, port, timeout: timeoutMs }, () => {
          clearTimeout(timer);
          socket.end();
          onFinish(true);
        });

        socket.on('error', (err) => {
          clearTimeout(timer);
          onFinish(false, err.message);
        });

        socket.on('timeout', () => {
          clearTimeout(timer);
          socket.destroy();
          onFinish(false, 'TCP Connection timeout');
        });
      }
    } catch (err: any) {
      clearTimeout(timer);
      onFinish(false, err?.message || String(err));
    }
  });
}

export async function getEmailContext(tenantId?: string | null) {
  const normTenant = normalizeTenantId(tenantId);
  const companyName = getTenantSiteName(normTenant);
  const supportDomain = getTenantHost(normTenant);
  return { companyName, supportDomain, tenantId: normTenant };
}

type TransporterResult =
  | { provider: 'RESEND'; resend: Resend; fromEmail: string; smtpUser: string | null }
  | { provider: 'SMTP'; transporter: Transporter; fromEmail: string; smtpUser: string | null };

async function getTransporter(tenantId?: string): Promise<TransporterResult | null> {
  const normTenant = normalizeTenantId(tenantId);
  const s = await SettingsProvider.getEmailSettings(normTenant);

  // DEPLOYMENT NOTE (РФ-инфраструктура):
  // Resend и Twilio могут блокировать отправку на домены .ru или с российских IP.
  // Для production в РФ рекомендуется использовать SMTP-провайдер:
  //   - Yandex 360 для бизнеса: smtp.yandex.ru:465
  //   - Mail.ru для бизнеса: smtp.mail.ru:465
  //   - Локальный Postfix / MailCow
  // Настройка SMTP производится в панели администратора → Настройки → Email.

  if (s.emailProvider === 'RESEND') {
    if (!s.resendApiKey) {
      log.error('RESEND selected but API key is not configured');
      throw new Error('Email provider is set to Resend but API key is missing. Check admin settings.');
    }
    const defaultFrom = normTenant === 'flux' ? 'no-reply@smmflux.ru' : 'no-reply@smmplan.pro';
    return { provider: 'RESEND', resend: new Resend(s.resendApiKey), smtpUser: s.smtpUser, fromEmail: s.smtpUser || defaultFrom };
  }

  if (!s.smtpHost || !s.smtpUser || !s.smtpPassword) {
    return null; // SMTP не сконфигурирован
  }

  const transporter = nodemailer.createTransport({
    host: s.smtpHost,
    port: s.smtpPort || 465,
    secure: s.smtpPort === 465,
    auth: {
      user: s.smtpUser,
      pass: s.smtpPassword,
    },
    family: 4, // Force IPv4 to prevent ENETUNREACH on systems without IPv6 routing
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  } as any);

  return { provider: 'SMTP', transporter, smtpUser: s.smtpUser, fromEmail: s.smtpUser };
}

type DispatchOptions = {
  companyName: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
};

async function dispatch(result: TransporterResult, options: DispatchOptions) {
  const fromAddress = `"${options.companyName} Support" <${result.fromEmail}>`;

  if (result.provider === 'RESEND') {
    log.info('Sending via RESEND', { to: options.to, subject: options.subject });
    const { error } = await result.resend.emails.send({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      html: options.html,
      ...(options.replyTo ? { reply_to: options.replyTo } : {}),
    });
    if (error) {
      log.error('Resend delivery failed', { to: options.to, subject: options.subject, code: (error instanceof Error ? error.name : 'Error') });
      throw new Error(`Resend error: ${(error instanceof Error ? error.message : String(error))}`);
    }
  } else {
    log.info('Sending via SMTP', { to: options.to, subject: options.subject });
    await result.transporter.sendMail({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      html: options.html,
      ...(options.replyTo ? { replyTo: options.replyTo } : {}),
    });
  }
}

export async function sendMagicLink(email: string, token: string, tenantId?: string, redirectTo?: string) {
  const { companyName } = await getEmailContext(tenantId);
  let baseUrl = await getBaseUrlAsync().catch(() => '');
  if (!baseUrl) {
    const { supportDomain } = await getEmailContext(tenantId);
    baseUrl = `https://${supportDomain}`;
  }
  const normTenant = normalizeTenantId(tenantId);
  const tenantParam = normTenant && normTenant !== 'smmplan' ? `&tenant=${normTenant}` : '';
  const redirectParam = redirectTo ? `&redirectTo=${encodeURIComponent(redirectTo)}` : '';
  const link = `${baseUrl}/api/auth/verify?token=${token}${tenantParam}${redirectParam}`;

  const isDebugMagicLink = (process.env.DEBUG_MAGIC_LINK === 'true' || process.env.NODE_ENV === 'test') && process.env.NODE_ENV !== 'production';
  const maskedLink = link.replace(/token=[^&]+/, 'token=***');

  if (isDebugMagicLink) {
    console.info(`\n========================================\n[DEV MAGIC LINK FOR ${email} (${companyName})]:\n${link}\n========================================\n`);
  }

  const result = await getTransporter(tenantId);

  if (!result) {
    log.warn('SMTP Not configured. Magic link dispatch skipped.', { email, link: isDebugMagicLink ? link : maskedLink });
    return;
  }

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #e4e4e7;">
      <h2 style="color: #18181b;">Вход в ${companyName}</h2>
      <p style="color: #71717a; line-height: 1.5;">Вы запросили ссылку для входа. Нажмите на кнопку ниже, чтобы войти в аккаунт. Ссылка действительна 15 минут.</p>
      <div style="margin-top: 32px; text-align: center;">
        <a href="${link}" style="background-color: #18181b; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500; display: inline-block;">
          Войти в ${companyName}
        </a>
      </div>
      <p style="margin-top: 32px; font-size: 12px; color: #a1a1aa;">Если вы не запрашивали письмо, проигнорируйте его.</p>
    </div>
  `;

  try {
    await dispatch(result, { companyName, to: email, subject: `Ваша ссылка для входа в ${companyName}`, html: htmlContent });
  } catch (err: unknown) {
    log.error('SMTP send failed (printed link above in console)', { 
      error: (err instanceof Error ? err.message : String(err)),
      email,
      link
    });
    // In staging / dev / when ISP blocks port 465, do not fail the request if link was generated
    if (process.env.APP_URL?.includes('test.smmplan.pro') || process.env.NODE_ENV !== 'production' || process.env.DEV_MOCK_SMTP === 'true') {
      return;
    }
    throw err;
  }
}

export async function sendMail(email: string, subject: string, htmlContent: string, replyTo?: string, tenantId?: string) {
  const { companyName } = await getEmailContext(tenantId);
  const result = await getTransporter(tenantId);

  if (!result) {
    if (process.env.NODE_ENV === 'production') {
      log.error('Not configured in AdminPanel');
    } else {
      log.warn('Not configured. Email skipped.', { to: email, subject });
    }
    return;
  }

  try {
    await dispatch(result, { companyName, to: email, subject, html: htmlContent, replyTo });
  } catch (err: unknown) {
    if (process.env.NODE_ENV === 'production' && process.env.DEV_MOCK_SMTP !== 'true') {
      throw err;
    } else {
      log.error('SMTP email delivery failed', { to: email, subject, error: (err instanceof Error ? err.message : String(err)) });
    }
  }
}

export async function sendAuthMail(email: string, otp: string, tenantId?: string) {
  const { companyName } = await getEmailContext(tenantId);

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #e4e4e7;">
      <h2 style="color: #18181b;">Вход в ${companyName}</h2>
      <p style="color: #71717a; line-height: 1.5;">Ваш код для входа: <strong>${otp}</strong>. Ссылка действительна 15 минут.</p>
    </div>
  `;
  return sendMail(email, `Код входа в ${companyName}`, htmlContent, undefined, tenantId);
}

export async function sendWelcomeLetter(email: string, tenantId?: string) {
  const { companyName } = await getEmailContext(tenantId);

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #e4e4e7;">
      <h2 style="color: #18181b;">Добро пожаловать в ${companyName}! 🎉</h2>
      <p style="color: #71717a; line-height: 1.5;">Спасибо за регистрацию в нашем сервисе! Мы предоставляем качественное продвижение в социальных сетях.</p>
      <div style="margin-top: 32px; padding: 16px; background-color: #f4f4f5; border-radius: 8px;">
        <h4 style="margin-top: 0; color: #18181b;">Ваши преимущества:</h4>
        <ul style="color: #71717a; padding-left: 20px;">
          <li>Сотни услуг для всех популярных соцсетей</li>
          <li>Быстрый старт заказов — от 5 минут</li>
          <li>Реферальная программа — платим 15% с заказов друзей</li>
        </ul>
      </div>
      <p style="margin-top: 32px; font-size: 14px; color: #71717a;">Пополняйте баланс и запускайте накрутку прямо сейчас!</p>
    </div>
  `;
  return sendMail(email, `Добро пожаловать в ${companyName}!`, htmlContent, undefined, tenantId);
}

export async function sendOrderCompletedMail(email: string, orderId: string, serviceName: string, tenantId?: string) {
  const { companyName, supportDomain } = await getEmailContext(tenantId);

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #e4e4e7;">
      <h2 style="color: #10b981;">Заказ #<span>${orderId}</span> выполнен! ✅</h2>
      <p style="color: #71717a; line-height: 1.5;">Ваш заказ на услугу <strong>${serviceName}</strong> в сервисе ${companyName} был успешно выполнен.</p>
      <div style="margin-top: 32px; text-align: center;">
        <a href="https://${supportDomain}/dashboard/orders" style="background-color: #18181b; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500; display: inline-block;">
          Посмотреть мои заказы
        </a>
      </div>
    </div>
  `;
  return sendMail(email, `Ваш заказ #${orderId} выполнен — ${companyName}!`, htmlContent, undefined, tenantId);
}

export async function sendOrderPaidMail(email: string, orderId: string, serviceName: string, tenantId?: string) {
  const { companyName, supportDomain } = await getEmailContext(tenantId);

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 28px; border-radius: 16px; border: 1px solid #e4e4e7; color: #18181b;">
      <h2 style="color: #10b981; margin-top: 0; font-size: 22px;">Заказ #<span>${orderId}</span> успешно оплачен! 🚀</h2>
      <p style="color: #52525b; line-height: 1.6; font-size: 15px;">
        Ваш заказ на услугу <strong>${serviceName}</strong> в сервисе ${companyName} принят и запущен в обработку.
      </p>
      
      <div style="background: #f4f4f5; padding: 16px; border-radius: 12px; margin: 20px 0; font-size: 13px; line-height: 1.5; color: #3f3f46;">
        <div>📄 <strong>Электронный чек 54-ФЗ:</strong> направлен на вашу почту платежным оператором.</div>
        <div style="margin-top: 6px;">⚡ <strong>Старт выполнения:</strong> в течение 1–5 минут.</div>
      </div>

      <div style="margin: 28px 0; text-align: center;">
        <a href="https://${supportDomain}/dashboard/orders" style="background-color: #0284c7; color: #ffffff; padding: 13px 28px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; display: inline-block;">
          Перейти в личный кабинет →
        </a>
      </div>

      <div style="border-top: 1px solid #e4e4e7; padding-top: 16px; font-size: 12px; color: #a1a1aa; line-height: 1.5;">
        💡 <em>Если вы допустили опечатку в email или не можете войти в аккаунт, обратитесь в нашу службу поддержки с номером заказа #${orderId}.</em>
      </div>
    </div>
  `;
  return sendMail(email, `Оплата получена и запуск заказа #${orderId} — ${companyName}`, htmlContent, undefined, tenantId);
}

export interface BalanceDebitMailParams {
  email: string;
  orderId: string;
  serviceName: string;
  chargedCents: number | bigint;
  remainingBalanceCents?: number | bigint | null;
  tenantId?: string;
}

export async function sendOrderBalanceDebitMail({
  email,
  orderId,
  serviceName,
  chargedCents,
  remainingBalanceCents,
  tenantId
}: BalanceDebitMailParams) {
  const { companyName, supportDomain } = await getEmailContext(tenantId);
  const chargedRub = Number(chargedCents) / 100;
  const remainingRub = remainingBalanceCents !== undefined && remainingBalanceCents !== null 
    ? Number(remainingBalanceCents) / 100 
    : null;

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 28px; border-radius: 16px; border: 1px solid #e4e4e7; color: #18181b;">
      <h2 style="color: #10b981; margin-top: 0; font-size: 22px;">Заказ #<span>${orderId}</span> успешно запущен! 🚀</h2>
      <p style="color: #52525b; line-height: 1.6; font-size: 15px;">
        Ваш заказ на услугу <strong>${serviceName}</strong> в сервисе ${companyName} принят и запущен в обработку.
      </p>
      
      <div style="background: #f4f4f5; padding: 18px; border-radius: 12px; margin: 20px 0; font-size: 14px; line-height: 1.6; color: #27272a;">
        <div>💰 <strong>Списано с баланса:</strong> ${formatRubles(chargedRub)}</div>
        ${remainingRub !== null ? `<div style="margin-top: 6px;">💼 <strong>Остаток на балансе:</strong> ${formatRubles(remainingRub)}</div>` : ''}
        <div style="margin-top: 6px;">⚡ <strong>Старт выполнения:</strong> в течение 1–5 минут.</div>
        <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed #d4d4d8; font-size: 12px; color: #71717a; line-height: 1.5;">
          💡 <em>Оплата произведена с вашего внутреннего лицевого счёта (ранее внесенный аванс). Повторное списание с вашей банковской карты не производилось. Кассовый чек по 54-ФЗ был предоставлен вам ранее в момент пополнения баланса.</em>
        </div>
      </div>

      <div style="margin: 28px 0; text-align: center;">
        <a href="https://${supportDomain}/dashboard/orders" style="background-color: #0284c7; color: #ffffff; padding: 13px 28px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; display: inline-block;">
          Перейти в мои заказы →
        </a>
      </div>

      <div style="border-top: 1px solid #e4e4e7; padding-top: 16px; font-size: 12px; color: #a1a1aa; line-height: 1.5;">
        💡 <em>Если у вас возникли вопросы по заказу, обратитесь в нашу службу поддержки с номером заказа #${orderId}.</em>
      </div>
    </div>
  `;
  return sendMail(email, `Заказ #${orderId} запущен — списание с баланса ${companyName}`, htmlContent, undefined, tenantId);
}

export async function sendOrderCanceledMail(email: string, orderId: string, serviceName: string, tenantId?: string) {
  const { companyName, supportDomain } = await getEmailContext(tenantId);

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #e4e4e7;">
      <h2 style="color: #ef4444;">Заказ #<span>${orderId}</span> отменен ❌</h2>
      <p style="color: #71717a; line-height: 1.5;">Ваш заказ на услугу <strong>${serviceName}</strong> в сервисе ${companyName} был отменен. Средства возвращены на ваш баланс.</p>
      <div style="margin-top: 32px; text-align: center;">
        <a href="https://${supportDomain}/dashboard/orders" style="background-color: #18181b; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500; display: inline-block;">
          Посмотреть мои заказы
        </a>
      </div>
    </div>
  `;
  return sendMail(email, `Ваш заказ #${orderId} отменен — ${companyName}`, htmlContent, undefined, tenantId);
}

export async function sendTicketCreatedMail(
  email: string,
  ticketId: string,
  ticketSubject: string,
  tenantId?: string
) {
  const { companyName, supportDomain } = await getEmailContext(tenantId);
  const shortId = ticketId.slice(-6).toUpperCase();
  const replyTo = `support+${ticketId}@${supportDomain}`;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0;">
      <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-bottom: 20px;">
        <h2 style="color: #0f172a; margin: 0; font-size: 20px;">Служба поддержки ${companyName}</h2>
      </div>
      <p style="color: #334155; font-size: 15px; line-height: 1.6;">
        Здравствуйте! Ваше обращение успешно зарегистрировано в тикет-системе.
      </p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;">Номер тикета:</p>
        <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: bold; color: #1e293b;">#${ticketId}</p>
        <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;">Тема:</p>
        <p style="margin: 0; font-size: 14px; font-weight: 500; color: #1e293b;">${ticketSubject}</p>
      </div>
      <p style="color: #334155; font-size: 14px; line-height: 1.6;">
        Специалист поддержки ответит вам в ближайшее время.
      </p>
      <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px; border-radius: 4px; margin-top: 20px;">
        <p style="margin: 0; font-size: 13px; color: #1d4ed8; font-weight: 500;">
          💡 <strong>Как продолжить диалог:</strong> Вы можете отвечать прямо на это письмо со своей почты — все ответы автоматически добавятся в ваш тикет.
        </p>
      </div>
      <div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center;">
        <a href="https://${supportDomain}/dashboard/tickets?ticketId=${ticketId}" style="background-color: #0f172a; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600; display: inline-block;">
          Открыть тикет в личном кабинете
        </a>
      </div>
    </div>
  `;

  return sendMail(email, `[Тикет #${shortId}] ${ticketSubject}`, htmlContent, replyTo, tenantId);
}
