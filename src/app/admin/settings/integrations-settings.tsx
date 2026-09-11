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
  testTelegramBotConnectionAction,
  testYooKassaConnectionAction,
  disconnectTelegramBotAction,
} from '@/actions/admin/settings';
import { testInboundEmailAction } from '@/actions/admin/test-inbound-email';
import { toast } from 'sonner';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { 
  Loader2, 
  Eye, 
  EyeOff, 
  Key, 
  Sparkles, 
  Bot, 
  ShieldCheck, 
  Radio, 
  CheckCircle, 
  AlertCircle,
  HelpCircle,
  Copy,
  Check,
  AlertTriangle,
  Unlink,
  Trash2,
  Mail,
  Send,
  ExternalLink
} from 'lucide-react';
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
  const [isDisconnectBotModalOpen, setIsDisconnectBotModalOpen] = useState(false);
  const [isDisconnectingBot, startDisconnectBotTransition] = useTransition();

  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [testingGemini, setTestingGemini] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramTestResult, setTelegramTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [testingYooKassa, setTestingYooKassa] = useState(false);
  const [yooKassaTestResult, setYooKassaTestResult] = useState<{ success: boolean; message: string } | null>(null);

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

  const handleTestTelegram = async () => {
    setTestingTelegram(true);
    setTelegramTestResult(null);
    try {
      const res = await testTelegramBotConnectionAction();
      const message = 'message' in res ? res.message : res.error;
      setTelegramTestResult({ success: res.success, message });
      if (res.success) {
        toast.success(message);
      } else {
        toast.error(message);
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setTestingTelegram(false);
    }
  };
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
      toast.success('Настройки интеграций обновлены');
    } else if (formState?.error) {
      toast.error(formState.error);
    } else if (formState?.errors) {
      toast.error('Ошибка валидации данных. Проверьте правильность введенных ключей и доменов.');
      // Auto scroll to first error field
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

  // Telegram Form States
  const [telegramBot, setTelegramBot] = React.useState(settings.contactTelegramBot || '');
  const [telegramChannel, setTelegramChannel] = React.useState(settings.contactTelegramChannel || '');
  const [welcomeMessage, setWelcomeMessage] = React.useState(settings.welcomeMessage || '');

  React.useEffect(() => {
    setTelegramBot(settings.contactTelegramBot || '');
    setTelegramChannel(settings.contactTelegramChannel || '');
    setWelcomeMessage(settings.welcomeMessage || '');
  }, [settings.contactTelegramBot, settings.contactTelegramChannel, settings.welcomeMessage]);

  // Webhook Secret States
  const [inboundSecret, setInboundSecret] = React.useState(settings.inboundEmailWebhookSecret || '');
  const [showSecret, setShowSecret] = React.useState(false);
  const [generatingSecret, setGeneratingSecret] = React.useState(false);
  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

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

  const [isTestEmailModalOpen, setIsTestEmailModalOpen] = React.useState(false);
  const [testFromEmail, setTestFromEmail] = React.useState('customer@example.com');
  const [testSubject, setTestSubject] = React.useState('Не могу войти в аккаунт');
  const [testBody, setTestBody] = React.useState('Здравствуйте! Пополнил баланс на 500 рублей, но заказ не запускается. Проверьте, пожалуйста.');
  const [isSendingTestEmail, setIsSendingTestEmail] = React.useState(false);
  const [testEmailResult, setTestEmailResult] = React.useState<{ success: boolean; message: string; ticketId?: string } | null>(null);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = React.useState(false);

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
    } catch (err: any) {
      setTestEmailResult({ success: false, message: err?.message || 'Внутренняя ошибка' });
      toast.error('Произошла ошибка при отправке теста');
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Telegram */}
      <Card className="rounded-2xl border-border shadow-sm bg-card backdrop-blur-xl">
        <div className="p-5 sm:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 text-primary rounded-xl border border-primary/20">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground">Telegram Бот Поддержки & Продаж</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-success/20 text-success border border-success/30">
                    Smart Bind Ready
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Единый бот для оформления заказов, пополнения баланса и сквозной техподдержки клиентов.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {settings.contactTelegramBot && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDisconnectBotModalOpen(true)}
                  disabled={isDisconnectingBot}
                  className="font-bold text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 border-rose-500/30 gap-1.5 h-9 cursor-pointer"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>Отвязать бота</span>
                </Button>
              )}
              <Button
                type="button"
                intent="secondary"
                size="sm"
                onClick={handleTestTelegram}
                disabled={testingTelegram}
                className="font-bold uppercase tracking-widest text-[11px] h-9 cursor-pointer"
              >
                {testingTelegram ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />}
                Тест связи с Bot API
              </Button>
            </div>
          </div>

          {/* Bot Disconnect Confirmation Dialog */}
          <Dialog open={isDisconnectBotModalOpen} onOpenChange={setIsDisconnectBotModalOpen}>
            <DialogContent className="sm:max-w-md bg-card border-border">
              <DialogHeader>
                <div className="flex items-center gap-3 text-rose-500 pb-2">
                  <AlertTriangle className="w-6 h-6" />
                  <DialogTitle className="text-lg font-bold">Отвязать Telegram-бота?</DialogTitle>
                </div>
                <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                  Вы уверены, что хотите отвязать бота <strong className="text-foreground">@{settings.contactTelegramBot}</strong> от бренда <strong className="text-foreground">{tenantId === 'flux' ? 'SMMflux' : 'SMMplan'}</strong>?
                  <br /><br />
                  ⚠️ Клиенты сайта <strong className="text-foreground">{tenantId === 'flux' ? 'smmflux.ru' : 'smmplan.pro'}</strong> потеряют возможность обращаться в поддержку через Telegram, пока не будет подключен новый бот. Настройки других брендов затронуты не будут.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDisconnectBotModalOpen(false)}
                >
                  Отмена
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setIsDisconnectBotModalOpen(false);
                    startDisconnectBotTransition(async () => {
                      try {
                        const res = await disconnectTelegramBotAction(tenantId);
                        if (res.success) {
                          setTelegramBot('');
                          toast.success(res.message);
                        } else if ('error' in res) {
                          toast.error(res.error || 'Ошибка при отвязке бота');
                        }
                      } catch (err) { toast.error(String(err)); }
                    });
                  }}
                  disabled={isDisconnectingBot}
                  className="font-bold gap-1.5"
                >
                  {isDisconnectingBot ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Отвязать бота
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {telegramTestResult && (
            <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              telegramTestResult.success 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                : 'bg-destructive/10 border-destructive/30 text-destructive'
            }`}>
              {telegramTestResult.success ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{telegramTestResult.message}</span>
            </div>
          )}
          
          <form action={formAction} className="space-y-6">
            <input type="hidden" name="tenantId" value={tenantId} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Юзернейм бота (без @)
                </Label>
                <Input
                  name="contactTelegramBot"
                  value={telegramBot}
                  onChange={(e) => setTelegramBot(e.target.value)}
                  placeholder={tenantId === 'flux' ? 'smmflux_support_bot' : 'smmplan_support_bot'}
                />
                <p className="text-[11px] text-muted-foreground">
                  {telegramBot ? (
                    <>Клиенты в интерфейсе и письмах видят ссылку: <span className="font-mono text-primary font-bold">t.me/{telegramBot}</span></>
                  ) : (
                    <span className="text-amber-500/90 font-medium">⚠️ Бот не указан: ссылка на Telegram будет скрыта</span>
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Telegram Канал новостей / акций (@канал)
                </Label>
                <Input
                  name="contactTelegramChannel"
                  value={telegramChannel}
                  onChange={(e) => setTelegramChannel(e.target.value)}
                  placeholder={tenantId === 'flux' ? '@smmflux_news' : '@smmplan_news'}
                />
                <p className="text-[11px] text-muted-foreground">
                  Официальный информационный канал платформы для клиентов.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Приветственное сообщение (/start)</Label>
              <Textarea
                name="welcomeMessage"
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                rows={3}
                placeholder={`Добро пожаловать в ${tenantId === 'flux' ? 'SMMflux' : 'SMMplan'}! Ваш персональный кабинет готов к работе.`}
              />
              <p className="text-[11px] text-muted-foreground">
                Текст, отправляемый пользователю при первом запуске бота или команде /start.
              </p>
            </div>

            {/* Smart Bind Features Box */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="space-y-1">
                <p className="font-bold text-foreground flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  Smart Bind Protocol
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Безопасная привязка Telegram-аккаунта к сайту без передачи номеров телефонов.
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-bold text-foreground flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  Сквозная поддержка
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Сообщения клиентов из бота мгновенно попадают в тикет-систему админки.
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-bold text-foreground flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  CSAT Оценки
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Клиент оценивает работу оператора прямо в боте (1-5 звезд) при закрытии тикета.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-border flex justify-end">
              <Button disabled={isPending} type="submit" className="font-bold uppercase tracking-widest text-xs h-10 shadow-md cursor-pointer">
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Сохранить настройки бота
              </Button>
            </div>
          </form>
        </div>
      </Card>

      {/* Payments */}
      <Card className="rounded-2xl border-border shadow-sm bg-card backdrop-blur-xl">
        <div className="p-5 sm:p-8 space-y-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1 px-2.5 bg-success/20 text-success rounded-md text-[10px] font-bold">PAY</span>
            <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Платёжные шлюзы</h3>
          </div>

          <form action={formAction} className="space-y-8">
            <input type="hidden" name="tenantId" value={tenantId} />
            {/* YooKassa section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">YooKassa (Fiat)</div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    intent="secondary"
                    size="sm"
                    onClick={handleTestYooKassa}
                    disabled={testingYooKassa}
                    className="font-bold uppercase tracking-widest text-[10px] h-8 cursor-pointer gap-1.5"
                  >
                    {testingYooKassa ? <Loader2 className="w-3 h-3 animate-spin" /> : <Radio className="w-3 h-3 text-primary" />}
                    <span>Проверить YooKassa API</span>
                  </Button>
                </div>
              </div>

              {yooKassaTestResult && (
                <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  yooKassaTestResult.success 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                    : 'bg-destructive/10 border-destructive/30 text-destructive'
                }`}>
                  {yooKassaTestResult.success ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{yooKassaTestResult.message}</span>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* TEST KEYS */}
                <div className={`space-y-4 p-5 rounded-xl border-2 transition-all ${settings.isTestMode ? 'border-warning/50 bg-warning/5 shadow-sm' : 'border-border bg-muted/30 opacity-60'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-warning bg-warning/20 px-2 py-0.5 rounded">Тестовые</span>
                    </div>
                    {settings.isTestMode && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-success bg-success/20 px-2 py-0.5 rounded animate-pulse">Активно</span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Test Shop ID</Label>
                    <Input
                      name="yookassaTestShopId"
                      defaultValue={settings.yookassaTestShopId || ''}
                      placeholder="Тестовый Shop ID"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Test Secret Key</Label>
                    <Input
                      name="yookassaTestSecretKey"
                      type="password"
                      placeholder={settings.yookassaTestSecretKey ? '••••••••••••••••' : 'Не настроено'}
                    />
                  </div>
                </div>

                {/* PRODUCTION KEYS */}
                <div className={`space-y-4 p-5 rounded-xl border-2 transition-all ${!settings.isTestMode ? 'border-success/50 bg-success/5 shadow-sm' : 'border-border bg-muted/30 opacity-60'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-success bg-success/20 px-2 py-0.5 rounded">Боевые</span>
                    </div>
                    {!settings.isTestMode && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-success bg-success/20 px-2 py-0.5 rounded animate-pulse">Активно</span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Shop ID</Label>
                    <Input
                      name="yookassaShopId"
                      defaultValue={settings.yookassaShopId || ''}
                      placeholder="Боевой Shop ID"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Secret Key</Label>
                    <Input
                      name="yookassaSecretKey"
                      type="password"
                      placeholder={settings.yookassaSecretKey ? '••••••••••••••••' : 'Не настроено'}
                    />
                  </div>
                </div>
              </div>

              {/* Webhook Configuration */}
              <div className="p-4 rounded-xl bg-muted/20 border border-border/80 space-y-3">
                <div className="flex items-center justify-between">
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
                />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Зарегистрируйте URL <span className="font-mono text-primary font-bold">https://&lt;домен&gt;/api/webhooks/yookassa</span> в личном кабинете ЮKassa (Настройки → HTTP-уведомления).
                </p>
              </div>

              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Переключение между тестовыми и боевыми ключами — через «Тестовый режим» на вкладке «Система».
                При включённом тестовом режиме используются тестовые ключи (с fallback на боевые).
              </p>
            </div>

            {/* CryptoBot */}
            <div className="space-y-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border pb-1">CryptoBot (Crypto)</div>
              <div className="max-w-md space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">API Token</Label>
                <Input
                  name="cryptoBotToken"
                  type="password"
                  placeholder={settings.cryptoBotToken ? '••••••••••••••••' : 'Не настроено'}
                />
              </div>
            </div>

            {/* Robokassa */}
            <div className="space-y-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Robokassa (Fiat)</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Идентификатор магазина (Merchant Login)</Label>
                  <Input
                    name="robokassaLogin"
                    defaultValue={settings.robokassaLogin || ''}
                    placeholder="Идентификатор магазина"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Пароль 1 (для инициализации оплаты)</Label>
                  <Input
                    name="robokassaPassword"
                    type="password"
                    placeholder={settings.robokassaPassword ? '••••••••••••••••' : 'Не настроено'}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Пароль 2 (для Webhook / ResultURL)</Label>
                  <Input
                    name="robokassaWebhookPassword"
                    type="password"
                    placeholder={settings.robokassaWebhookPassword ? '••••••••••••••••' : 'Не настроено'}
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border flex justify-end">
              <Button disabled={isPending} type="submit" className="font-bold uppercase tracking-widest text-xs h-10 shadow-md">
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Сохранить ключи шлюзов
              </Button>
            </div>
          </form>
        </div>
      </Card>

      {/* Email & SMTP */}
      <Card className="rounded-2xl border-border shadow-sm bg-card backdrop-blur-xl">
        <div className="p-5 sm:p-8 space-y-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1 px-2.5 bg-info/20 text-info rounded-md text-[10px] font-bold">MAIL</span>
            <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Почта (SMTP & Inbound)</h3>
          </div>

          <form action={formAction} className="space-y-8">
            <input type="hidden" name="tenantId" value={tenantId} />
            <div className="space-y-6">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Отправка писем</div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Провайдер писем</Label>
                  <select
                    name="emailProvider"
                    defaultValue={settings.emailProvider || 'SMTP'}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="SMTP">SMTP (Nodemailer)</option>
                    <option value="RESEND">Resend SDK</option>
                  </select>
                </div>
                
                <div className="space-y-2 md:col-span-2 pt-4 border-t border-border">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ключ API Resend</Label>
                  <Input
                    name="resendApiKey"
                    type="password"
                    placeholder={settings.resendApiKey ? '••••••••••••••••' : 'Не настроено'}
                  />
                  <p className="text-[10px] text-muted-foreground">Используется, если выбран провайдер Resend.</p>
                </div>

                <div className="space-y-2 mt-4 md:col-span-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Настройки SMTP (Nodemailer)</Label>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">SMTP Host</Label>
                  <Input
                    name="smtpHost"
                    defaultValue={settings.smtpHost || ''}
                    placeholder="smtp.example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">SMTP Port</Label>
                  <Input
                    name="smtpPort"
                    type="number"
                    defaultValue={settings.smtpPort || 465}
                    placeholder="465"
                    className={formState?.errors?.smtpPort ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                  {formState?.errors?.smtpPort && (
                    <p className="text-xs font-bold text-destructive mt-1">{formState.errors.smtpPort[0]}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Пользователь (Email)</Label>
                  <Input
                    name="smtpUser"
                    defaultValue={settings.smtpUser || ''}
                    placeholder="support@smmplan.pro"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Пароль приложения</Label>
                  <Input
                    name="smtpPassword"
                    type="password"
                    placeholder={settings.smtpPassword ? '••••••••••••••••' : 'Не настроено'}
                  />
                </div>
              </div>
            </div>

            {/* Inbound Mail webhooks */}
            <div className="space-y-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Прием писем (Inbound)</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Домен (для тикетов)</Label>
                  <Input
                    name="supportEmailDomain"
                    defaultValue={settings.supportEmailDomain || ''}
                    placeholder="smmplan.pro"
                    className={formState?.errors?.supportEmailDomain ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                  {formState?.errors?.supportEmailDomain && (
                    <p className="text-xs font-bold text-destructive mt-1">{formState.errors.supportEmailDomain[0]}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Используется для генерации адреса <code>support+ticketId@домен</code>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    Секретный ключ вебхука
                    <span title="Секретный ключ для подписи и проверки подлинности входящих писем от Cloudflare Email Routing / SendGrid.">
                      <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                    </span>
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                      <Input
                        name="inboundEmailWebhookSecret"
                        type={showSecret ? 'text' : 'password'}
                        value={inboundSecret}
                        onChange={(e) => setInboundSecret(e.target.value)}
                        placeholder="Не настроено"
                        className="pr-10 font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                        title={showSecret ? 'Скрыть секрет' : 'Показать секрет'}
                      >
                        {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {inboundSecret && (
                      <Button
                        type="button"
                        intent="outline"
                        size="sm"
                        onClick={() => copySecret(inboundSecret)}
                        className="font-bold text-xs gap-1 h-10 px-3"
                        title="Скопировать секрет в буфер обмена"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline">{copied ? 'Скопировано' : 'Копировать'}</span>
                      </Button>
                    )}

                    <Button
                      type="button"
                      disabled={generatingSecret}
                      onClick={() => setIsRegenerateModalOpen(true)}
                      intent="outline"
                      className="font-bold text-xs gap-1 h-10 px-3"
                    >
                      {generatingSecret ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Key className="w-3.5 h-3.5" />
                      )}
                      Сгенерировать
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Используется для валидации входящих вебхуков писем от почтового шлюза.
                  </p>
                </div>

                {/* Webhook Endpoint URL */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    URL вебхука входящей почты
                    <span title="URL эндпоинта, на который Cloudflare Email Worker или почтовый шлюз отправляет POST-запросы.">
                      <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                    </span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/inbound-email` : 'https://smmplan.pro/api/webhooks/inbound-email'}
                      className="font-mono text-xs bg-muted/30"
                    />
                    <Button
                      type="button"
                      intent="outline"
                      size="sm"
                      onClick={copyWebhookUrl}
                      className="font-bold text-xs gap-1 h-10 px-3 shrink-0"
                      title="Скопировать URL вебхука"
                    >
                      {copiedWebhookUrl ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">{copiedWebhookUrl ? 'Скопировано' : 'Копировать'}</span>
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Укажите этот URL в переменной <code>WEBHOOK_URL</code> в Cloudflare Email Worker.
                  </p>
                </div>

                {/* Test Webhook Simulator Button */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Проверка интеграции</Label>
                  <div>
                    <Button
                      type="button"
                      intent="outline"
                      onClick={() => setIsTestEmailModalOpen(true)}
                      className="font-bold text-xs gap-1.5 h-10 px-4 w-full sm:w-auto"
                    >
                      <Mail className="w-3.5 h-3.5 text-primary" />
                      Симуляция входящего письма
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Позволяет протестировать создание тикета в системе без отправки реального email.
                  </p>
                </div>

                {/* Regenerate Webhook Secret Modal */}
                <Dialog open={isRegenerateModalOpen} onOpenChange={setIsRegenerateModalOpen}>
                  <DialogContent className="sm:max-w-md bg-card border-border">
                    <DialogHeader>
                      <div className="flex items-center gap-3 text-amber-500 pb-2">
                        <AlertTriangle className="w-6 h-6" />
                        <DialogTitle className="text-lg font-bold">Перегенерация секрета вебхука</DialogTitle>
                      </div>
                      <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                        Вы собираетесь сгенерировать новый секретный ключ для входящей почты.
                        <br /><br />
                        ⚠️ <strong>Внимание:</strong> Предыдущий ключ будет немедленно инвалидирован! Вам потребуется обновить URL и подпись в настройках Cloudflare / почтового шлюза.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-2 pt-4">
                      <Button
                        type="button"
                        intent="secondary"
                        size="sm"
                        onClick={() => setIsRegenerateModalOpen(false)}
                      >
                        Отмена
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setIsRegenerateModalOpen(false);
                          handleGenerateSecret();
                        }}
                        className="font-bold bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                      >
                        Сгенерировать новый ключ
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Test Email Simulator Modal */}
                <Dialog open={isTestEmailModalOpen} onOpenChange={setIsTestEmailModalOpen}>
                  <DialogContent className="sm:max-w-lg bg-card border-border">
                    <DialogHeader>
                      <div className="flex items-center gap-3 text-primary pb-2">
                        <Mail className="w-6 h-6" />
                        <DialogTitle className="text-lg font-bold">Симуляция входящего письма (Inbound)</DialogTitle>
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
                        <div className={`p-3 rounded-lg text-xs font-medium ${testEmailResult.success ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>
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
                        intent="secondary"
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
                        Отправить тестовое письмо
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>


            <div className="pt-4 border-t border-border flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  intent="secondary"
                  size="sm"
                  onClick={handleTestSmtp}
                  disabled={testingSmtp}
                  className="font-bold uppercase tracking-widest text-[11px] h-9 cursor-pointer"
                >
                  {testingSmtp ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Radio className="w-3.5 h-3.5 mr-1.5" />}
                  Тест SMTP соединения
                </Button>
                {smtpTestResult && (
                  <span className={`text-xs font-semibold ${smtpTestResult.success ? 'text-success' : 'text-destructive'}`}>
                    {smtpTestResult.message}
                  </span>
                )}
              </div>
              <Button disabled={isPending} type="submit" className="font-bold uppercase tracking-widest text-xs h-10 shadow-md cursor-pointer">
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Сохранить настройки почты
              </Button>
            </div>
          </form>
        </div>
      </Card>

      {/* ── SECTION 4: GOOGLE GEMINI AI & PROXY ── */}
      <Card className="p-6 border-border/60 shadow-sm bg-card/40 backdrop-blur-xs relative overflow-hidden">
        <div className="space-y-6">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">Google Gemini AI & Прокси для РФ</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                  gemini-latest (Auto)
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Глобальный пул ключей для ИИ-рерайта каталога и генерации ответов техподдержки с авто-ротацией и проксированием Clash Verge.
              </p>
            </div>
          </div>

          <form action={formAction} className="space-y-6">
            <input type="hidden" name="tenantId" value={tenantId} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* API Keys Pool */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Глобальные API-ключи Gemini (через запятую)
                  </Label>
                  <span className="text-[10px] text-muted-foreground font-mono">AES-256 Encrypted</span>
                </div>
                <Textarea
                  name="geminiApiKeys"
                  rows={3}
                  placeholder={settings.geminiApiKeys ? '•••••••••••••••• (Ключи сохранены в зашифрованном виде)' : 'AIzaSyKey1..., AIzaSyKey2...'}
                  className="font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Система автоматически распределяет нагрузку между ключами (Round-Robin) и переключается при исчерпании лимитов (429).
                </p>
              </div>

              {/* Proxy Settings */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Прокси для работы в РФ (Clash Verge / HTTP / SOCKS5)
                </Label>
                <Input
                  name="geminiProxy"
                  defaultValue={settings.geminiProxy || ''}
                  placeholder="http://proxy.smmplan.pro:7890"
                  className="font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Для внешнего защищенного прокси укажите: <code>http://proxy-host:port</code> или <code>http://user:pass@host:port</code>.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-card border border-border/80 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground leading-relaxed space-y-1">
                <p className="font-semibold text-foreground">Персональные ключи сотрудников:</p>
                <p>
                  Каждый сотрудник (оператор, менеджер) может подключить свой личный API-ключ во вкладке <strong>«Команда»</strong>.
                  При генерации ответов система сначала расходует личный ключ сотрудника, а при его отсутствии использует этот общий пул.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-border flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  intent="secondary"
                  size="sm"
                  onClick={handleTestGemini}
                  disabled={testingGemini}
                  className="font-bold uppercase tracking-widest text-[11px] h-9 cursor-pointer"
                >
                  {testingGemini ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                  Тест Gemini AI
                </Button>
                {geminiTestResult && (
                  <span className={`text-xs font-semibold ${geminiTestResult.success ? 'text-success' : 'text-destructive'}`}>
                    {geminiTestResult.message}
                  </span>
                )}
              </div>
              <Button disabled={isPending} type="submit" className="font-bold uppercase tracking-widest text-xs h-10 shadow-md cursor-pointer">
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Сохранить настройки Gemini
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
