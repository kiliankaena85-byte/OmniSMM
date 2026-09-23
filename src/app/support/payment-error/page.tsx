import { Metadata } from 'next';
import { db } from '@/lib/db';
import { SettingsProvider } from '@/lib/settings';
import { GuestSupportOptions } from '@/components/support/GuestSupportOptions';
import { CopyDetailsButton } from '@/components/support/CopyDetailsButton';
import { 
  AlertTriangle, 
  CreditCard, 
  QrCode, 
  Globe, 
  RefreshCw, 
  Send 
} from 'lucide-react';
import Link from 'next/link';

interface PageProps {
  searchParams: Promise<{
    error?: string;
    code?: string;
    serviceId?: string;
    gateway?: string;
    email?: string;
    quantity?: string;
    url?: string;
    mode?: string;
  }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await SettingsProvider.getContactAndLegalSettings();
  return {
    title: `Ошибка оплаты | ${settings.COMPANY_NAME}`,
    description: 'Инструкции по устранению проблемы с оплатой и быстрая поддержка.',
  };
}

export default async function PaymentErrorPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const settings = await SettingsProvider.getContactAndLegalSettings();

  const rawError = params.error || '';
  const code = params.code || '';
  const gatewayName = params.gateway || 'yookassa';
  const serviceId = params.serviceId;
  const email = params.email || '';
  const quantity = params.quantity || '';
  const url = params.url || '';

  // Safe mapping of predefined error codes
  const errorMap: Record<string, string> = {
    'insufficient_funds': 'Недостаточно средств на карте или счете.',
    'declined_by_bank': 'Транзакция отклонена вашим банком. Попробуйте другую карту.',
    '3ds_failed': 'Не пройдена аутентификация 3D-Secure (не введен код из СМС).',
    'gateway_timeout': 'Время ожидания ответа от платежного шлюза истекло.',
    'limit_exceeded': 'Превышен лимит по карте или операции.',
  };

  // Safe mapping of predefined error codes or sanitized descriptive error
  const isSanitizedError = rawError && rawError.length < 200 && !rawError.includes('Prisma') && !rawError.includes('at ') && !rawError.includes('SELECT ') && !rawError.includes('INSERT ');
  const displayError = errorMap[code] || (isSanitizedError ? rawError : 'Произошла непредвиденная ошибка при обработке платежа шлюзом. Транзакция отклонена.');
  const technicalErrorCode = code || (rawError ? (isSanitizedError ? rawError.slice(0, 40) : 'GATEWAY_ERROR') : 'NONE');

  // Safe database query to fetch service name
  let serviceName = '';
  if (serviceId) {
    try {
      const service = await db.service.findUnique({
        where: { id: serviceId },
        select: { name: true }
      });
      if (service) {
        serviceName = service.name;
      }
    } catch (e) {
      console.error('[PaymentErrorPage] Failed to fetch service:', e);
    }
  }

  // Construct structured diagnostic block to copy (includes generic info, not raw PII leak)
  const diagnosticText = 
    `--- ДИАГНОСТИКА ПЛАТЕЖА ---\n` +
    `• Услуга: ${serviceName || 'Массовый заказ / Смешанный'}\n` +
    `• Шлюз: ${gatewayName.toUpperCase()}\n` +
    `• Код ошибки: ${technicalErrorCode}\n` +
    `--------------------------`;

  // Mask email for PII compliance (152-ФЗ / GDPR)
  const maskedEmail = email ? email.replace(/^(.{1,2})(.*)(@.*)$/, (_, a, b, c) => a + '***' + c) : '';
  const safeDisplayUrl = url ? (url.length > 50 ? url.slice(0, 47) + '...' : url) : '';

  // Pre-fill support form message without raw PII leak
  const defaultSupportMessage = 
    `Здравствуйте!\n\n` +
    `Не удалось завершить оплату через шлюз ${gatewayName.toUpperCase()}.\n` +
    `Код ошибки: "${technicalErrorCode}"\n` +
    (serviceName ? `Выбранная услуга: ${serviceName}\n` : '') +
    (quantity ? `Количество: ${quantity} шт.\n` : '') +
    (safeDisplayUrl ? `Ссылка: ${safeDisplayUrl}\n` : '') +
    (maskedEmail ? `Email аккаунта: ${maskedEmail}\n` : '') +
    `Помогите, пожалуйста, провести платеж.`;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col py-16 px-4 telegram-light">
      {/* Premium Background Ambient Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[400px] bg-destructive/10 blur-[120px] rounded-full pointer-events-none opacity-60" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[100px] rounded-full pointer-events-none opacity-40" />

      <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col gap-12">
        
        {/* Header Indicator / Status Card */}
        <div className="flex flex-col items-center text-center gap-6 max-w-3xl mx-auto">
          <div className="w-20 h-20 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive shadow-sm animate-pulse">
            <AlertTriangle size={42} strokeWidth={2} />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-foreground">
              Упс! Платеж не прошёл
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto font-medium">
              Шлюз отклонил транзакцию. Не переживайте, ваши средства в безопасности. Ниже приведены рекомендации для решения проблемы.
            </p>
          </div>

          <div className="w-full p-6 bg-card border border-border rounded-[2rem] text-left flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-destructive uppercase tracking-widest pl-0.5">Сообщение об ошибке:</span>
              <p className="text-sm font-semibold text-foreground italic">
                "{displayError}"
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <CopyDetailsButton textToCopy={diagnosticText} />
            </div>
          </div>
        </div>

        {/* Bento Grid Diagnostic Checklist */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest text-center pl-1">
            Как исправить прямо сейчас?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            <div className="p-6 bg-card border border-border rounded-3xl flex flex-col gap-4 shadow-sm hover:border-primary/30 transition-all duration-200">
              <div className="w-12 h-12 rounded-2xl bg-warning/10 flex items-center justify-center text-warning-text">
                <CreditCard size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground">Лимиты карты</h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                  Проверьте лимиты на интернет-покупки и баланс в приложении банка.
                </p>
              </div>
            </div>

            <div className="p-6 bg-card border border-border rounded-3xl flex flex-col gap-4 shadow-sm hover:border-primary/30 transition-all duration-200">
              <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center text-success">
                <QrCode size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground">Оплатите по СБП</h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                  Используйте Систему быстрых платежей — она проходит в 99.8% случаев.
                </p>
              </div>
            </div>

            <div className="p-6 bg-card border border-border rounded-3xl flex flex-col gap-4 shadow-sm hover:border-primary/30 transition-all duration-200">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Globe size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground">Выключите VPN</h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                  Банковские шлюзы могут блокировать запросы со скрытых IP-адресов.
                </p>
              </div>
            </div>

            <div className="p-6 bg-card border border-border rounded-3xl flex flex-col gap-4 shadow-sm hover:border-primary/30 transition-all duration-200">
              <div className="w-12 h-12 rounded-2xl bg-info/10 flex items-center justify-center text-info">
                <RefreshCw size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground">Другой шлюз</h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                  Вернитесь в корзину и попробуйте оплатить через ЮKassa или Robokassa.
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Action buttons / Telegram Support direct channel */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto w-full">
          <Link
            href="/"
            className="w-full text-center flex items-center justify-center bg-card border border-border text-foreground font-bold rounded-full min-h-[48px] px-6 text-sm hover:bg-muted transition-all"
            aria-label="Вернуться к оформлению заказа"
          >
            Попробовать снова
          </Link>
          <a
            href={`https://t.me/${settings.TELEGRAM_SUPPORT_BOT}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full text-center flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-full min-h-[48px] px-6 text-sm transition-all shadow-lg shadow-primary/20"
            aria-label="Связаться с техподдержкой в Telegram"
          >
            <Send size={18} />
            <span>Поддержка в Telegram</span>
          </a>
        </div>

        {/* Custom Form Section */}
        <div className="space-y-6 pt-4 border-t border-border">
          <div className="text-center max-w-md mx-auto space-y-2">
            <h2 className="text-2xl font-black text-foreground">Связаться с нами</h2>
            <p className="text-sm text-muted-foreground font-medium leading-relaxed">
              Если у вас списались деньги или вы хотите провести платеж вручную — заполните форму ниже, мы всё решим!
            </p>
          </div>

          <GuestSupportOptions
            telegramBotUsername={settings.TELEGRAM_SUPPORT_BOT}
            supportEmail={settings.SUPPORT_EMAIL}
            defaultEmail={email}
            defaultMessage={defaultSupportMessage}
            isPaymentError={true}
            serviceId={serviceId}
            errorText={technicalErrorCode}
            gateway={gatewayName}
            quantity={quantity}
            url={url}
          />
        </div>

      </div>
    </div>
  );
}
