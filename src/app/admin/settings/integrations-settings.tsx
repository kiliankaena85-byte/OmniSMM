'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  updateGlobalSettings, 
  generateInboundSecretAction,
  testSmtpConnectionAction,
  testGeminiAiConnectionAction,
  testYooKassaConnectionAction,
} from '@/actions/admin/settings';
import { testInboundEmailAction } from '@/actions/admin/test-inbound-email';
import { toast } from 'sonner';
import { useActionState, useEffect, useState } from 'react';
import { 
  Loader2, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Bot, 
  ShieldCheck, 
  Radio, 
  CheckCircle, 
  AlertCircle,
  HelpCircle,
  Copy,
  Check,
  Mail,
  Send,
  ExternalLink,
  CreditCard,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import type { SystemSettings } from '@prisma/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface IntegrationsSettingsProps {
  settings: SystemSettings;
  tenantId?: string;
}

export function IntegrationsSettings({ settings, tenantId = 'smmplan' }: IntegrationsSettingsProps) {
  // YooKassa Test State
  const [testingYooKassa, setTestingYooKassa] = useState(false);
  const [yooKassaTestResult, setYooKassaTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // SMTP Test State
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Gemini AI Test State
  const [testingGemini, setTestingGemini] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Webhook Secret States
  const [inboundSecret, setInboundSecret] = useState(settings.inboundEmailWebhookSecret || '');
  const [showSecret, setShowSecret] = useState(false);
  const [generatingSecret, setGeneratingSecret] = useState(false);
  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Inbound Email Simulator States
  const [isTestEmailModalOpen, setIsTestEmailModalOpen] = useState(false);
  const [testFromEmail, setTestFromEmail] = useState('customer@example.com');
  const [testSubject, setTestSubject] = useState('Не могу войти в аккаунт');
  const [testBody, setTestBody] = useState('Здравствуйте! Пополнил баланс на 500 рублей, но заказ не запускается. Проверьте, пожалуйста.');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string; ticketId?: string } | null>(null);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);

  // Single Action State for the entire form
  const [state, formAction, isPending] = useActionState(
    async (prevState: unknown, formData: FormData) => {
      try {
        const res = await updateGlobalSettings(formData);
        if (res && typeof res === 'object' && 'success' in res && !res.success) {
          return res;
        }
        return { success: true };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return { success: false, error: errorMsg || 'Ошибка при обновлении интеграций' };
      }
    },
    null
  );

  const formState = state as { success?: boolean; error?: string; errors?: Record<string, string[]> } | null;

  useEffect(() => {
    if (formState?.success) {
      toast.success('Настройки интеграций успешно сохранены');
    } else if (formState?.error) {
      toast.error(formState.error);
    } else if (formState?.errors) {
      toast.error('Ошибка валидации данных. Проверьте правильность введенных ключей и доменов.');
      const firstErrorField = Object.keys(formState.errors)[0];
      if (firstErrorField) {
        const element = document.getElementsByName(firstErrorField)[0];
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          (element as HTMLElement).focus();
        }
      }
    }
  }, [formState]);

  const handleTestYooKassa = async () => {
    setTestingYooKassa(true);
    setYooKassaTestResult(null);
    try {
      const res = await testYooKassaConnectionAction();
      const message = 'message' in res ? res.message : res.error;
      setYooKassaTestResult({ success: res.success, message });
      if (res.success) {
        toast.success(message);
      } else {
        toast.error(message);
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setTestingYooKassa(false);
    }
  };

  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    setSmtpTestResult(null);
    try {
      const res = await testSmtpConnectionAction();
      const message = 'message' in res ? res.message : res.error;
      setSmtpTestResult({ success: res.success, message });
      if (res.success) {
        toast.success(message);
      } else {
        toast.error(message);
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleTestGemini = async () => {
    setTestingGemini(true);
    setGeminiTestResult(null);
    try {
      const res = await testGeminiAiConnectionAction();
      const message = 'message' in res ? res.message : res.error;
      setGeminiTestResult({ success: res.success, message });
      if (res.success) {
        toast.success(message);
      } else {
        toast.error(message);
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setTestingGemini(false);
    }
  };

  const copySecret = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Секретный ключ скопирован в буфер обмена');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateSecret = async () => {
    setGeneratingSecret(true);
    try {
      const res = await generateInboundSecretAction();
      if (res && res.success && res.secret) {
        setInboundSecret(res.secret);
        setShowSecret(true);
        toast.success('Секретный ключ вебхука входящей почты сгенерирован!');
      } else {
        throw new Error('Не удалось сгенерировать секрет');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(errorMsg || 'Ошибка генерации секрета');
    } finally {
      setGeneratingSecret(false);
    }
  };

  const copyWebhookUrl = () => {
    const url = typeof window !== 'undefined' 
      ? `${window.location.origin}/api/webhooks/inbound-email` 
      : 'https://smmplan.pro/api/webhooks/inbound-email';
    navigator.clipboard.writeText(url);
    setCopiedWebhookUrl(true);
    toast.success('URL вебхука входящей почты скопирован в буфер обмена');
    setTimeout(() => setCopiedWebhookUrl(false), 2000);
  };

  const handleSendTestEmail = async () => {
    setIsSendingTestEmail(true);
    setTestEmailResult(null);
    try {
      const res = await testInboundEmailAction({
        fromEmail: testFromEmail,
        subject: testSubject,
        textBody: testBody,
        tenantId
      });
      if (res && res.success) {
        setTestEmailResult({ success: true, message: res.message || 'Письмо успешно доставлено в тикеты', ticketId: res.ticketId });
        toast.success(res.message || 'Тикет успешно создан из входящего письма!');
      } else {
        setTestEmailResult({ success: false, message: res?.error || 'Ошибка создания тикета' });
        toast.error(res?.error || 'Не удалось сымитировать входящее письмо');
      }
    } catch (err) {
      setTestEmailResult({ success: false, message: err instanceof Error ? err.message : 'Внутренняя ошибка' });
      toast.error('Произошла ошибка при отправке теста');
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── НАВИГАЦИОННЫЙ БАННЕР: TELEGRAM БОТ ── */}
      <div className="p-4 sm:p-5 rounded-2xl border border-primary/20 bg-primary/5 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-foreground flex items-center gap-2">
              Настройки Telegram-бота вынесены в специализированный раздел
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                PRO Suite
              </span>
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Токен бота, сценарии витрины, интерактивные кнопки меню, CSAT-опросы и телефонный симулятор настраиваются во вкладке «Telegram Бот».
            </p>
          </div>
        </div>
        <Link href="/admin/settings?tab=telegram" className="shrink-0 self-start sm:self-auto">
          <Button type="button" variant="outline" size="sm" className="gap-2 text-xs font-bold cursor-pointer h-9 px-4">
            <span>Открыть Telegram Бот</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>

      {/* ── ЕДИНАЯ ФОРМА ВСЕХ ИНТЕГРАЦИЙ ── */}
      <form key={settings.updatedAt?.toString() || 'integrations'} action={formAction} className="space-y-6">
        <input type="hidden" name="tenantId" value={tenantId} />

        {/* 1. Платёжные шлюзы (YooKassa, Robokassa, CryptoBot) */}
        <Card className="rounded-3xl border border-border/60 shadow-lg bg-card/70 backdrop-blur-xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Платёжные шлюзы & Эквайринг</h3>
                <p className="text-xs text-muted-foreground">
                  Прием фиатных и криптовалютных платежей: ЮKassa (СБП, Карты), Robokassa и Telegram CryptoBot.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestYooKassa}
              disabled={testingYooKassa}
              className="text-xs font-bold gap-2 cursor-pointer shrink-0 h-9 px-3.5"
            >
              {testingYooKassa ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> : <Radio className="w-3.5 h-3.5 text-emerald-500" />}
              <span>Проверить YooKassa API</span>
            </Button>
          </div>

          {yooKassaTestResult && (
            <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              yooKassaTestResult.success 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 dark:text-emerald-400' 
                : 'bg-destructive/10 border-destructive/30 text-destructive'
            }`}>
              {yooKassaTestResult.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{yooKassaTestResult.message}</span>
            </div>
          )}

          {/* YooKassa Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> 1. ЮKassa (Рубли / СБП / Карты РФ)
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                Режим переключается на вкладке «Система»
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* TEST KEYS */}
              <div className={`space-y-4 p-5 rounded-2xl border transition-all ${settings.isTestMode ? 'border-warning/50 bg-warning/5 shadow-sm' : 'border-border/60 bg-muted/20 opacity-70'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-warning bg-warning/20 px-2.5 py-0.5 rounded-full">
                    Тестовый контур
                  </span>
                  {settings.isTestMode && (
                    <span className="text-[10px] font-black uppercase tracking-wider text-success bg-success/20 px-2.5 py-0.5 rounded-full animate-pulse">
                      Активен
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Test Shop ID</Label>
                  <Input
                    name="yookassaTestShopId"
                    defaultValue={settings.yookassaTestShopId || ''}
                    placeholder="Тестовый Shop ID"
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Test Secret Key</Label>
                  <Input
                    name="yookassaTestSecretKey"
                    type="password"
                    placeholder={settings.yookassaTestSecretKey ? '••••••••••••••••' : 'test_...'}
                    className="font-mono text-xs"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {/* PRODUCTION KEYS */}
              <div className={`space-y-4 p-5 rounded-2xl border transition-all ${!settings.isTestMode ? 'border-success/50 bg-success/5 shadow-sm' : 'border-border/60 bg-muted/20 opacity-70'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-success bg-success/20 px-2.5 py-0.5 rounded-full">
                    Боевой контур
                  </span>
                  {!settings.isTestMode && (
                    <span className="text-[10px] font-black uppercase tracking-wider text-success bg-success/20 px-2.5 py-0.5 rounded-full animate-pulse">
                      Активен
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Shop ID</Label>
                  <Input
                    name="yookassaShopId"
                    defaultValue={settings.yookassaShopId || ''}
                    placeholder="Боевой Shop ID"
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Secret Key</Label>
                  <Input
                    name="yookassaSecretKey"
                    type="password"
                    placeholder={settings.yookassaSecretKey ? '••••••••••••••••' : 'live_...'}
                    className="font-mono text-xs"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>

            {/* Webhook Configuration */}
            <div className="p-4 rounded-2xl bg-muted/20 border border-border/60 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Секрет HTTP-уведомлений Webhook (Опционально)
                </Label>
                <span className="text-[10px] text-muted-foreground font-mono">
                  URL: /api/webhooks/yookassa
                </span>
              </div>
              <Input
                name="yookassaWebhookSecret"
                type="password"
                placeholder={settings.yookassaWebhookSecret ? '••••••••••••••••' : 'Секрет из ЛК ЮKassa (или fallback на Secret Key)'}
                className="font-mono text-xs"
                autoComplete="new-password"
              />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Зарегистрируйте URL <span className="font-mono text-primary font-bold">https://{tenantId === 'flux' ? 'smmflux.ru' : 'smmplan.pro'}/api/webhooks/yookassa</span> в кабинете ЮKassa для мгновенного зачисления.
              </p>
            </div>
          </div>

          {/* Robokassa & CryptoBot Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/40">
            {/* Robokassa */}
            <div className="space-y-4">
              <span className="text-xs font-black uppercase tracking-wider text-foreground block">
                2. Robokassa (Резервный эквайринг)
              </span>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Merchant Login</Label>
                  <Input
                    name="robokassaLogin"
                    defaultValue={settings.robokassaLogin || ''}
                    placeholder="Идентификатор магазина"
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Пароль 1 (Оплата)</Label>
                  <Input
                    name="robokassaPassword"
                    type="password"
                    placeholder={settings.robokassaPassword ? '••••••••••••••••' : 'Не настроено'}
                    className="font-mono text-xs"
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Пароль 2 (Webhook / ResultURL)</Label>
                  <Input
                    name="robokassaWebhookPassword"
                    type="password"
                    placeholder={settings.robokassaWebhookPassword ? '••••••••••••••••' : 'Не настроено'}
                    className="font-mono text-xs"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>

            {/* CryptoBot */}
            <div className="space-y-4">
              <span className="text-xs font-black uppercase tracking-wider text-foreground block">
                3. CryptoBot (Telegram Crypto)
              </span>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">API Token (@CryptoBot)</Label>
                    <span className="text-[10px] text-emerald-500 font-bold">USDT, TON, BTC</span>
                  </div>
                  <Input
                    name="cryptoBotToken"
                    type="password"
                    placeholder={settings.cryptoBotToken ? '••••••••••••••••' : 'Вставьте токен от @CryptoBot'}
                    className="font-mono text-xs"
                    autoComplete="new-password"
                  />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Позволяет клиентам пополнять баланс криптовалютой напрямую через Telegram без комиссии платформы.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* 2. Почтовый сервис & SMTP */}
        <Card className="rounded-3xl border border-border/60 shadow-lg bg-card/70 backdrop-blur-xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl border border-blue-500/20">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Почтовый сервис (SMTP / Resend & Inbound)</h3>
                <p className="text-xs text-muted-foreground">
                  Отправка ссылок авторизации (Magic Link), чеков, уведомлений и прием входящих писем в тикеты.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsTestEmailModalOpen(true)}
                className="text-xs font-bold gap-1.5 cursor-pointer h-9 px-3"
              >
                <Send className="w-3.5 h-3.5 text-primary" />
                <span>Тест входящего письма</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestSmtp}
                disabled={testingSmtp}
                className="text-xs font-bold gap-1.5 cursor-pointer h-9 px-3"
              >
                {testingSmtp ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> : <Radio className="w-3.5 h-3.5 text-blue-500" />}
                <span>Тест SMTP</span>
              </Button>
            </div>
          </div>

          {smtpTestResult && (
            <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              smtpTestResult.success 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 dark:text-emerald-400' 
                : 'bg-destructive/10 border-destructive/30 text-destructive'
            }`}>
              {smtpTestResult.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{smtpTestResult.message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Провайдер отправки</Label>
              <select
                name="emailProvider"
                defaultValue={settings.emailProvider || 'SMTP'}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none h-10"
              >
                <option value="SMTP">SMTP (Nodemailer: Яндекс 360 / Mail.ru / Собственный сервер)</option>
                <option value="RESEND">Resend SDK (API)</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2 p-4 rounded-2xl bg-muted/20 border border-border/60">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ключ API Resend</Label>
              <Input
                name="resendApiKey"
                type="password"
                placeholder={settings.resendApiKey ? '••••••••••••••••' : 're_...'}
                className="font-mono text-xs"
                autoComplete="new-password"
              />
              <p className="text-[10px] text-muted-foreground">Используется, если выбран провайдер Resend.</p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">SMTP Host</Label>
              <Input
                name="smtpHost"
                defaultValue={settings.smtpHost || ''}
                placeholder="smtp.yandex.ru"
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">SMTP Port</Label>
              <Input
                name="smtpPort"
                type="number"
                defaultValue={settings.smtpPort || 465}
                placeholder="465"
                className={`font-mono text-xs ${formState?.errors?.smtpPort ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">SMTP Пользователь (Email)</Label>
              <Input
                name="smtpUser"
                defaultValue={settings.smtpUser || ''}
                placeholder={tenantId === 'flux' ? 'support@smmflux.ru' : 'support@smmplan.pro'}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Пароль приложения SMTP</Label>
              <Input
                name="smtpPassword"
                type="password"
                placeholder={settings.smtpPassword ? '••••••••••••••••' : 'Пароль приложения'}
                className="font-mono text-xs"
                autoComplete="new-password"
              />
            </div>

            {/* Inbound Webhook Configuration */}
            <div className="space-y-3 md:col-span-2 pt-3 border-t border-border/40">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  Прием входящей почты (Inbound Webhook)
                  <span title="Вебхук принимает письма клиентов и автоматически создает обращения в тикет-системе.">
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                  </span>
                </Label>
                <button
                  type="button"
                  onClick={copyWebhookUrl}
                  className="text-[10px] text-primary hover:underline font-mono"
                >
                  {copiedWebhookUrl ? 'Скопировано!' : 'URL вебхука: /api/webhooks/inbound-email'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-muted-foreground">Домен тикетов</Label>
                  <Input
                    name="supportEmailDomain"
                    defaultValue={settings.supportEmailDomain || ''}
                    placeholder={tenantId === 'flux' ? 'smmflux.ru' : 'smmplan.pro'}
                    className="font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Генерирует адрес <code>support+ticketId@{tenantId === 'flux' ? 'smmflux.ru' : 'smmplan.pro'}</code>
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-bold text-muted-foreground">Секрет вебхука (HMAC)</Label>
                    <button
                      type="button"
                      onClick={handleGenerateSecret}
                      disabled={generatingSecret}
                      className="text-[10px] font-bold text-primary hover:underline"
                    >
                      {generatingSecret ? 'Генерация...' : 'Сгенерировать ключ'}
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      name="inboundEmailWebhookSecret"
                      type={showSecret ? 'text' : 'password'}
                      value={inboundSecret}
                      onChange={(e) => setInboundSecret(e.target.value)}
                      placeholder="Секрет вебхука Cloudflare / SendGrid"
                      className="font-mono text-xs pr-20"
                      autoComplete="new-password"
                    />
                    <div className="absolute right-2 top-2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="text-muted-foreground hover:text-foreground p-1"
                        title={showSecret ? 'Скрыть' : 'Показать'}
                      >
                        {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      {inboundSecret && (
                        <button
                          type="button"
                          onClick={() => copySecret(inboundSecret)}
                          className="text-muted-foreground hover:text-foreground p-1"
                          title="Скопировать"
                        >
                          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* 3. Google Gemini AI & Прокси */}
        <Card className="rounded-3xl border border-border/60 shadow-lg bg-card/70 backdrop-blur-xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 text-primary rounded-xl border border-primary/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground">Google Gemini AI & Прокси для РФ</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                    Auto Fallback
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Пул API-ключей для ИИ-рерайта каталога и генерации ответов техподдержки с авто-ротацией и проксированием.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestGemini}
              disabled={testingGemini}
              className="text-xs font-bold gap-2 cursor-pointer shrink-0 h-9 px-3.5"
            >
              {testingGemini ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> : <Sparkles className="w-3.5 h-3.5 text-primary" />}
              <span>Тест Gemini AI</span>
            </Button>
          </div>

          {geminiTestResult && (
            <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              geminiTestResult.success 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 dark:text-emerald-400' 
                : 'bg-destructive/10 border-destructive/30 text-destructive'
            }`}>
              {geminiTestResult.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{geminiTestResult.message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Глобальные API-ключи Gemini (через запятую)
                </Label>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  AES-256 Vault
                </span>
              </div>
              <Textarea
                name="geminiApiKeys"
                rows={3}
                placeholder={settings.geminiApiKeys ? '•••••••••••••••• (Ключи сохранены в зашифрованном виде)' : 'AIzaSyKey1..., AIzaSyKey2...'}
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Система автоматически распределяет нагрузку между ключами (Round-Robin) и переключается при лимите 429.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Прокси для работы в РФ (Clash Verge / HTTP / SOCKS5)
              </Label>
              <Input
                name="geminiProxy"
                defaultValue={settings.geminiProxy || ''}
                placeholder="http://127.0.0.1:7890"
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Формат: <code>http://proxy-host:port</code> или <code>http://user:pass@host:port</code>. При отсутствии используется прямой доступ.
              </p>
            </div>
          </div>
        </Card>

        {/* ── STICKY BOTTOM ACTION BAR ── */}
        <div className="sticky bottom-4 z-20 flex items-center justify-between gap-4 p-4 rounded-2xl bg-card/95 backdrop-blur-md border border-border shadow-lg">
          <div className="text-xs text-muted-foreground hidden sm:block">
            Настройки платёжных шлюзов, почты и нейросети сохраняются синхронно в одной транзакции
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <Button
              disabled={isPending}
              type="submit"
              className="font-bold uppercase tracking-widest text-xs h-11 px-8 shadow-md cursor-pointer"
            >
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Сохранить все интеграции
            </Button>
          </div>
        </div>
      </form>

      {/* ── МОДАЛКА СИМУЛЯТОРА ВХОДЯЩИХ ПИСЕМ ── */}
      <Dialog open={isTestEmailModalOpen} onOpenChange={setIsTestEmailModalOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader>
            <div className="flex items-center gap-3 text-primary pb-2">
              <Mail className="w-6 h-6" />
              <DialogTitle className="text-lg font-bold">Симуляция входящего письма (Inbound Webhook)</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Отправка тестового обращения в тикет-систему для проверки маршрутизации и авто-создания пользователей.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">Email клиента (Отправитель)</Label>
              <Input
                value={testFromEmail}
                onChange={(e) => setTestFromEmail(e.target.value)}
                placeholder="client@example.com"
                className="text-xs font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">Тема письма</Label>
              <Input
                value={testSubject}
                onChange={(e) => setTestSubject(e.target.value)}
                placeholder="Тема обращения"
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">Текст сообщения</Label>
              <Textarea
                value={testBody}
                onChange={(e) => setTestBody(e.target.value)}
                rows={4}
                placeholder="Текст письма..."
                className="text-xs resize-none"
              />
            </div>
            {testEmailResult && (
              <div className={`p-3 rounded-lg text-xs font-medium ${testEmailResult.success ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>
                {testEmailResult.message}
                {testEmailResult.ticketId && (
                  <div className="mt-1 font-mono text-[11px]">
                    ID тикета: {testEmailResult.ticketId}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsTestEmailModalOpen(false)}
            >
              Закрыть
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSendingTestEmail}
              onClick={handleSendTestEmail}
              className="font-bold gap-1.5 cursor-pointer"
            >
              {isSendingTestEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Отправить письмо
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
