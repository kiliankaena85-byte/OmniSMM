'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { updateGlobalSettings, disconnectTelegramBotAction } from '@/actions/admin/settings';
import { toggleTenantMaintenanceAction } from '@/actions/admin/tenants';
import { toast } from 'sonner';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { 
  Loader2, 
  UploadCloud, 
  Globe, 
  Sparkles, 
  ShieldCheck, 
  Building2, 
  PhoneCall, 
  SlidersHorizontal,
  Eye,
  Copy,
  Trash2,
  HelpCircle,
  AlertTriangle,
  Check,
  Unlink
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

interface GeneralSettingsProps {
  settings: SystemSettings;
  tenantId?: string;
}

export function GeneralSettings({ settings, tenantId = 'smmplan' }: GeneralSettingsProps) {
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [isTogglingMaintenance, setIsTogglingMaintenance] = useState(false);
  const [isDisconnectBotModalOpen, setIsDisconnectBotModalOpen] = useState(false);
  const [isDisconnectingBot, startDisconnectBotTransition] = useTransition();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleToggleMaintenance = async (enable: boolean) => {
    setIsTogglingMaintenance(true);
    try {
      const res = await toggleTenantMaintenanceAction(tenantId, enable);
      if (res && res.success) {
        setMaintenance(enable);
        setIsMaintenanceModalOpen(false);
        if (enable) {
          toast.success('🔴 Режим техработ активирован! Витрина закрыта для посетителей.');
        } else {
          toast.success('🟢 Режим техработ отключен! Витрина переведена в штатный режим.');
        }
      } else {
        toast.error((res && 'error' in res && res.error) ? res.error : 'Ошибка переключения режима техработ');
      }
    } catch {
      toast.error('Сетевой сбой при переключении режима техработ');
    } finally {
      setIsTogglingMaintenance(false);
    }
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`Скопировано: ${text}`);
    setTimeout(() => setCopiedField(null), 2000);
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
        return { success: false, error: errorMsg || 'Ошибка при обновлении настроек' };
      }
    },
    null
  );

  const formState = state as { success?: boolean; error?: string; errors?: Record<string, string[]> } | null;

  // Live Preview States (Tenant-Aware Defaults)
  const defaultSiteName = tenantId === 'flux' ? 'SMMflux' : 'SMMplan';
  const defaultEmail = tenantId === 'flux' ? 'support@smmflux.ru' : 'support@smmplan.pro';
  const defaultPrivacyEmail = tenantId === 'flux' ? 'privacy@smmflux.ru' : 'privacy@smmplan.pro';

  const [maintenance, setMaintenance] = useState<boolean>(Boolean(settings.maintenanceMode));
  const [siteName, setSiteName] = useState<string>(settings.siteName || defaultSiteName);
  const [siteDescription, setSiteDescription] = useState<string>(settings.siteDescription || '');
  const [supportEmail, setSupportEmail] = useState<string>(settings.contactSupportEmail || defaultEmail);
  const [privacyEmail, setPrivacyEmail] = useState<string>(settings.contactPrivacyEmail || defaultPrivacyEmail);
  const [telegramBot, setTelegramBot] = useState<string>(settings.contactTelegramBot || '');
  const [telegramBotToken, setTelegramBotToken] = useState<string>('');
  const [telegramChannel, setTelegramChannel] = useState<string>(settings.contactTelegramChannel || '');
  const [companyName, setCompanyName] = useState<string>(settings.legalCompanyName || defaultSiteName);
  const [companyInn, setCompanyInn] = useState<string>(settings.legalCompanyInn || '');
  const [companyOgrnip, setCompanyOgrnip] = useState<string>(settings.legalCompanyOgrnip || '');
  const [companyAddress, setCompanyAddress] = useState<string>(settings.legalCompanyAddress || '');

  useEffect(() => {
    setMaintenance(Boolean(settings.maintenanceMode));
    setSiteName(settings.siteName || (tenantId === 'flux' ? 'SMMflux' : 'SMMplan'));
    setSiteDescription(settings.siteDescription || '');
    setSupportEmail(settings.contactSupportEmail || (tenantId === 'flux' ? 'support@smmflux.ru' : 'support@smmplan.pro'));
    setPrivacyEmail(settings.contactPrivacyEmail || (tenantId === 'flux' ? 'privacy@smmflux.ru' : 'privacy@smmplan.pro'));
    setTelegramBot(settings.contactTelegramBot || '');
    setTelegramBotToken('');
    setTelegramChannel(settings.contactTelegramChannel || '');
    setCompanyName(settings.legalCompanyName || (tenantId === 'flux' ? 'SMMflux' : 'SMMplan'));
    setCompanyInn(settings.legalCompanyInn || '');
    setCompanyOgrnip(settings.legalCompanyOgrnip || '');
    setCompanyAddress(settings.legalCompanyAddress || '');
    setUsnScheme(settings.usnScheme || 'INCOME_EXPENSES');
    setTaxRate(settings.taxRate ?? (settings.usnScheme === 'INCOME' ? 6 : 15));
    setOpexMonthly(settings.opexMonthly ? Math.round(settings.opexMonthly / 100) : 0);
  }, [settings, tenantId]);

  // Handle explicit bot disconnect
  const handleDisconnectBot = () => {
    setIsDisconnectBotModalOpen(false);
    startDisconnectBotTransition(async () => {
      try {
        const res = await disconnectTelegramBotAction(tenantId);
        if (res.success) {
          toast.success(res.message);
          setTelegramBot('');
          setTelegramBotToken('');
        } else {
          toast.error('error' in res ? res.error : 'Ошибка отвязки бота');
        }
      } catch (err) {
        toast.error(String(err));
      }
    });
  };

  // Bot test states
  const [isTestingBot, setIsTestingBot] = useState(false);
  interface BotTestResult {
    success: boolean;
    username?: string;
    name?: string;
    botId?: string | number;
    bot?: unknown;
    pingMs?: number;
    error?: string;
  }
  const [botTestResult, setBotTestResult] = useState<BotTestResult | null>(null);

  const handleTestBot = async () => {
    setIsTestingBot(true);
    setBotTestResult(null);
    try {
      const url = new URL('/api/admin/test-telegram-bot', window.location.origin);
      url.searchParams.set('tenant', tenantId);
      if (telegramBotToken && telegramBotToken.trim().length > 10 && !telegramBotToken.includes('•••')) {
        url.searchParams.set('token', telegramBotToken.trim());
      }
      const res = await fetch(url.toString(), { cache: 'no-store' });
      const data = await res.json();
      setBotTestResult(data);
      if (data.success) {
        toast.success(`Бот @${data.username} успешно отвечает (Ping: ${data.pingMs}ms)`);
      } else {
        toast.error(`Ошибка связи: ${data.error}`);
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setIsTestingBot(false);
    }
  };

  // Tax and USN Scheme reactivity (54-ФЗ / 152-ФЗ)
  const [usnScheme, setUsnScheme] = useState<string>(settings.usnScheme || 'INCOME_EXPENSES');
  const [taxRate, setTaxRate] = useState<number>(settings.taxRate ?? (settings.usnScheme === 'INCOME' ? 6 : 15));
  const [opexMonthly, setOpexMonthly] = useState<number>(settings.opexMonthly ? Math.round(settings.opexMonthly / 100) : 0);

  const handleUsnChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const scheme = e.target.value;
    setUsnScheme(scheme);
    if (scheme === 'INCOME') {
      setTaxRate(6);
    } else if (scheme === 'INCOME_EXPENSES') {
      setTaxRate(15);
    }
  };

  // Branding Upload states
  const [logoUrl, setLogoUrl] = useState<string | null>(settings.siteLogoUrl);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(settings.siteFaviconUrl);
  const [logoUploading, setLogoUploading] = useState(false);
  const [faviconUploading, setFaviconUploading] = useState(false);

  const handleBrandingUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'favicon') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = type === 'logo' ? 2 * 1024 * 1024 : 500 * 1024;
    if (file.size > maxSize) {
      toast.error(`Файл слишком большой. Максимальный размер: ${type === 'logo' ? '2 МБ' : '500 КБ'}`);
      return;
    }

    const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'];
    if (!allowedMime.includes(file.type)) {
      toast.error('Неподдерживаемый формат. Разрешены PNG, JPG, WEBP, SVG, ICO.');
      return;
    }

    const setUploading = type === 'logo' ? setLogoUploading : setFaviconUploading;
    const setUrl = type === 'logo' ? setLogoUrl : setFaviconUrl;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    try {
      const res = await fetch('/api/admin/upload-branding', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.url) {
        setUrl(data.url);
        toast.success(`${type === 'logo' ? 'Логотип' : 'Фавикон'} успешно загружен`);
      } else {
        throw new Error(data.error || 'Ошибка загрузки');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(errorMsg);
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (formState?.success) {
      toast.success('Настройки системы успешно сохранены');
    } else if (formState?.error) {
      toast.error(formState.error);
    } else if (formState?.errors) {
      toast.error('Ошибка валидации данных. Проверьте заполненные поля.');
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

  return (
    <form key={settings.updatedAt?.toString() || 'general'} action={formAction} className="space-y-6">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="_isGeneralSettings" value="1" />
      <input type="hidden" name="siteLogoUrl" value={logoUrl || ''} />
      <input type="hidden" name="siteFaviconUrl" value={faviconUrl || ''} />

      {/* 1. Platform Core Status (Maintenance Kill-Switch) */}
      <Card className="rounded-3xl border border-border/60 shadow-lg bg-card/70 backdrop-blur-xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3 border-b border-border/50 pb-5">
          <div className="p-2.5 bg-primary/10 text-primary rounded-xl border border-primary/20">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Статус платформы & Режим техработ</h3>
            <p className="text-xs text-muted-foreground">
              Аварийный выключатель доступа для клиентов при проведении технических обновлений.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 sm:p-5 rounded-2xl border border-border/60 bg-muted/20">
            <div className="space-y-1 pr-4">
              <Label htmlFor="maintenanceMode" className="text-sm font-bold text-foreground cursor-pointer flex items-center gap-2">
                Режим технического обслуживания (Maintenance)
                <span title="Аварийный выключатель: при включении все клиенты мгновенно увидят экран техработ. Действие требует подтверждения.">
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground cursor-help" />
                </span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Закрывает витрину для клиентов и показывает специализированный экран техработ (статус узлов, сохранность балансов, экстренная связь с дежурным инженером в Telegram).
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className={`text-xs font-bold ${maintenance ? 'text-rose-500 font-extrabold' : 'text-muted-foreground'}`}>
                {maintenance ? '🔴 Включен' : '⚪ Выключен'}
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="maintenanceMode"
                  name="maintenanceMode"
                  checked={maintenance}
                  disabled={isTogglingMaintenance}
                  onChange={() => {
                    if (!maintenance) {
                      setIsMaintenanceModalOpen(true);
                    } else {
                      handleToggleMaintenance(false);
                    }
                  }}
                  className="sr-only peer"
                />
                <div className={`w-12 h-6.5 bg-muted-foreground/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-background after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600 ${isTogglingMaintenance ? 'opacity-50 cursor-wait' : ''}`}></div>
              </label>
            </div>
          </div>

          {/* Maintenance Mode Confirmation Modal */}
          <Dialog open={isMaintenanceModalOpen} onOpenChange={setIsMaintenanceModalOpen}>
            <DialogContent className="sm:max-w-md bg-card border-border">
              <DialogHeader>
                <div className="flex items-center gap-3 text-rose-500 pb-2">
                  <AlertTriangle className="w-6 h-6" />
                  <DialogTitle className="text-lg font-bold">Включение режима техработ</DialogTitle>
                </div>
                <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                  Вы собираетесь перевести платформу в режим технического обслуживания.
                  <br /><br />
                  • Витрина и мастер заказа станут временно недоступны для посетителей.<br />
                  • Клиенты увидят экран информирования о плановых работах.<br />
                  • Авторизованные администраторы сохранят доступ к панели управления.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isTogglingMaintenance}
                  onClick={() => setIsMaintenanceModalOpen(false)}
                >
                  Отмена
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isTogglingMaintenance}
                  onClick={() => handleToggleMaintenance(true)}
                  className="font-bold gap-1.5 cursor-pointer"
                >
                  {isTogglingMaintenance && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                  Включить техработы
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="p-3.5 rounded-xl border border-border/40 bg-card/60 text-xs text-muted-foreground space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <span className="text-primary font-bold">ℹ️ Архитектурные экраны ожидания:</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              • <strong className="text-foreground">Экран техработ (Maintenance Screen):</strong> отображается при активном тумблере выше (для неавторизованных пользователей на основном домене).<br />
              • <strong className="text-foreground">Предстартовый экран (Pre-Launch Holding):</strong> презентационная страница сбора email-заявок (доступна по пути <code className="text-primary font-mono text-[10px]">/prelaunch</code> или при holding-маршрутизации).
            </p>
          </div>
        </div>
      </Card>

      {/* 2. Branding & Site Identity */}
      <Card className="rounded-3xl border border-border/60 shadow-lg bg-card/70 backdrop-blur-xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3 border-b border-border/50 pb-5">
          <div className="p-2.5 bg-primary/10 text-primary rounded-xl border border-primary/20">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Брендинг & Идентичность сайта</h3>
            <p className="text-xs text-muted-foreground">
              Название, SEO-описание и графические логотипы платформы.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              Название сайта (Brand)
              <span title="Публичное название платформы. Используется в шапке, OpenGraph, title и email-уведомлениях.">
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
              </span>
            </Label>
            <Input
              name="siteName"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="SMMplan"
              className={formState?.errors?.siteName ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            {formState?.errors?.siteName && (
              <p className="text-xs font-bold text-destructive mt-1">{formState.errors.siteName[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              SEO Описание (Meta Description)
              <span title="Meta description для поисковых систем (120–160 символов). Отображается в выдаче Яндекса/Google и превью мессенджеров.">
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
              </span>
            </Label>
            <Input
              name="siteDescription"
              value={siteDescription}
              onChange={(e) => setSiteDescription(e.target.value)}
              placeholder="Сервис продвижения в социальных сетях №1"
              className={formState?.errors?.siteDescription ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            {formState?.errors?.siteDescription && (
              <p className="text-xs font-bold text-destructive mt-1">{formState.errors.siteDescription[0]}</p>
            )}
          </div>
        </div>

        {/* Upload Logo & Favicon */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Логотип платформы</Label>
            <div className="flex items-center gap-5 p-4 rounded-2xl border border-border bg-muted/10">
              <div className="w-16 h-16 rounded-xl border border-border flex items-center justify-center bg-card overflow-hidden relative shadow-inner shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1.5" />
                ) : (
                  <UploadCloud className="w-6 h-6 text-muted-foreground" />
                )}
                {logoUploading && (
                  <div className="absolute inset-0 bg-background/85 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-1.5 min-w-0">
                <input
                  type="file"
                  id="logo-file"
                  accept=".png,.jpg,.jpeg,.webp,.svg"
                  className="hidden"
                  onChange={(e) => handleBrandingUpload(e, 'logo')}
                  disabled={logoUploading}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    htmlFor="logo-file"
                    className="inline-flex items-center justify-center rounded-xl px-3.5 py-2 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-sm"
                  >
                    Загрузить лого
                  </label>
                  {logoUrl && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(logoUrl, 'logo')}
                        className="h-8 px-2.5 text-xs gap-1"
                        title="Скопировать URL логотипа"
                      >
                        {copiedField === 'logo' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline">Копировать URL</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setLogoUrl(null);
                          toast.info('Логотип удален (нажмите Сохранить для подтверждения)');
                        }}
                        className="h-8 px-2.5 text-xs text-rose-500 hover:text-rose-600 gap-1"
                        title="Удалить логотип"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">PNG, SVG, WEBP до 2 МБ</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Фавикон браузера</Label>
            <div className="flex items-center gap-5 p-4 rounded-2xl border border-border bg-muted/10">
              <div className="w-16 h-16 rounded-xl border border-border flex items-center justify-center bg-card overflow-hidden relative shadow-inner shrink-0">
                {faviconUrl ? (
                  <img src={faviconUrl} alt="Favicon" className="w-8 h-8 object-contain" />
                ) : (
                  <UploadCloud className="w-6 h-6 text-muted-foreground" />
                )}
                {faviconUploading && (
                  <div className="absolute inset-0 bg-background/85 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-1.5 min-w-0">
                <input
                  type="file"
                  id="favicon-file"
                  accept=".png,.jpg,.jpeg,.webp,.svg,.ico"
                  className="hidden"
                  onChange={(e) => handleBrandingUpload(e, 'favicon')}
                  disabled={faviconUploading}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    htmlFor="favicon-file"
                    className="inline-flex items-center justify-center rounded-xl px-3.5 py-2 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-sm"
                  >
                    Загрузить иконку
                  </label>
                  {faviconUrl && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(faviconUrl, 'favicon')}
                        className="h-8 px-2.5 text-xs gap-1"
                        title="Скопировать URL фавикона"
                      >
                        {copiedField === 'favicon' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline">Копировать URL</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFaviconUrl(null);
                          toast.info('Фавикон удален (нажмите Сохранить для подтверждения)');
                        }}
                        className="h-8 px-2.5 text-xs text-rose-500 hover:text-rose-600 gap-1"
                        title="Удалить фавикон"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">ICO, SVG, PNG до 500 КБ</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Telegram Support Bot Configuration & Live Diagnostics */}
      <Card className="rounded-3xl border border-border/60 shadow-lg bg-card/70 backdrop-blur-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl border border-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">Telegram Бот Поддержки</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {tenantId === 'flux' ? 'SMMflux' : 'SMMplan'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Прием сообщений от клиентов из Telegram и отправка ответов операторов из единой админки.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {telegramBot && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDisconnectBotModalOpen(true)}
                disabled={isDisconnectingBot}
                className="text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 border-rose-500/30 gap-1.5 h-9"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Отвязать бота</span>
              </Button>
            )}
            <Button
              type="button"
              onClick={handleTestBot}
              disabled={isTestingBot}
              className="text-xs font-bold gap-2 cursor-pointer shrink-0 h-9 px-3.5 border border-border bg-muted/40 hover:bg-muted text-foreground"
            >
              {isTestingBot ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />}
              <span>Проверить статус API</span>
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
                Вы уверены, что хотите отвязать бота <strong className="text-foreground">@{telegramBot}</strong> от бренда <strong className="text-foreground">{tenantId === 'flux' ? 'SMMflux' : 'SMMplan'}</strong>?
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
                onClick={handleDisconnectBot}
                disabled={isDisconnectingBot}
                className="font-bold gap-1.5"
              >
                {isDisconnectingBot ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                Отвязать бота
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              {telegramBot ? (
                <>Клиенты на сайте видят ссылку <span className="font-mono text-primary font-bold">t.me/{telegramBot}</span></>
              ) : (
                <span className="text-amber-500/90 font-medium">⚠️ Бот не указан: ссылка на Telegram в шапке сайта будет скрыта</span>
              )}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Официальный Telegram-канал
            </Label>
            <Input
              name="contactTelegramChannel"
              value={telegramChannel}
              onChange={(e) => setTelegramChannel(e.target.value)}
              placeholder={tenantId === 'flux' ? '@smmflux_news' : '@smmplan_news'}
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Канал для новостей и акций бренда, отображаемый в футере и виджетах.
            </p>
          </div>
        </div>

        {/* Telegram Bot Token Input Field (AES-256 Vault) */}
        <div className="space-y-2 pt-2 border-t border-border/40">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Токен Telegram Бота (API Token)
            </Label>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              AES-256-GCM Vault
            </span>
          </div>
          <Input
            name="telegramBotToken"
            type="password"
            value={telegramBotToken}
            onChange={(e) => setTelegramBotToken(e.target.value)}
            placeholder={settings.telegramBotToken ? '••••••••••••••••' : 'Вставьте токен от @BotFather (например: 123456:ABC-DEF...)'}
            className="font-mono text-xs"
            autoComplete="new-password"
          />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <p>
              Токен шифруется в защищенном хранилище БД (Vault) и имеет приоритет над переменными окружения.
            </p>
            <a
              href="/admin/settings?tab=telegram"
              className="text-primary hover:underline font-bold inline-flex items-center gap-1 shrink-0"
            >
              <span>Центр управления ботом (меню, CSAT, конструктор) →</span>
            </a>
          </div>
        </div>

        {/* Bot Status & Link Preview */}
        <div className="p-3 rounded-2xl bg-muted/20 border border-border/60 flex items-center justify-between text-xs min-h-[46px]">
          {telegramBot ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-foreground font-mono">@{telegramBot}</span>
                {settings.telegramBotToken && (
                  <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Токен сохранен
                  </span>
                )}
              </div>
              <a
                href={`https://t.me/${telegramBot}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-bold text-[11px] flex items-center gap-1"
              >
                Открыть в Telegram ↗
              </a>
            </>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground font-medium">
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-500" />
              <span>Бот не привязан к {tenantId === 'flux' ? 'SMMflux' : 'SMMplan'}</span>
            </div>
          )}
        </div>

        {/* Live Diagnostics Card */}
        {botTestResult && (
          <div className={`p-4 rounded-2xl border text-xs space-y-2 ${
            botTestResult.success 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
              : 'bg-destructive/10 border-destructive/30 text-destructive'
          }`}>
            <div className="flex items-center justify-between font-bold">
              <span>{botTestResult.success ? '✅ Telegram Bot API: Связь установлена успешно!' : '❌ Ошибка проверки Telegram Bot:'}</span>
              {botTestResult.pingMs && <span className="font-mono text-[11px]">Ping: {botTestResult.pingMs}ms</span>}
            </div>
            {botTestResult.success && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 font-mono text-[11px] text-foreground">
                <div>Имя: <span className="font-bold">{botTestResult.name || '—'}</span></div>
                <div>Username: <span className="font-bold">{botTestResult.username ? `@${botTestResult.username}` : '—'}</span></div>
                <div>Bot ID: <span className="font-bold">{String(botTestResult.botId || '—')}</span></div>
              </div>
            )}
            {!botTestResult.success && (
              <p className="text-[11px] font-mono">{botTestResult.error}</p>
            )}
          </div>
        )}
      </Card>

      {/* 4. Contacts & Legal Requisites */}
      <Card className="rounded-3xl border border-border/60 shadow-lg bg-card/70 backdrop-blur-xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3 border-b border-border/50 pb-5">
          <div className="p-2.5 bg-primary/10 text-primary rounded-xl border border-primary/20">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Контакты & Юридические реквизиты (152-ФЗ)</h3>
            <p className="text-xs text-muted-foreground">
              Отображаются в подвале сайта, пользовательском соглашении и платежных документах.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Поддержки</Label>
            <Input
              name="contactSupportEmail"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              placeholder={defaultEmail}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Email по защите персональных данных (152-ФЗ)
            </Label>
            <Input
              name="contactPrivacyEmail"
              value={privacyEmail}
              onChange={(e) => setPrivacyEmail(e.target.value)}
              placeholder={defaultPrivacyEmail}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Telegram Канал новостей (@канал)</Label>
            <Input
              name="contactTelegramChannel"
              defaultValue={settings.contactTelegramChannel || (tenantId === 'flux' ? 'smmflux_news' : 'smmplan_news')}
              placeholder={tenantId === 'flux' ? 'smmflux_news' : 'smmplan_news'}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Название Юр. Лица / ИП</Label>
            <Input
              name="legalCompanyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={defaultSiteName}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">ИНН (10 или 12 цифр)</Label>
            <Input
              name="legalCompanyInn"
              value={companyInn}
              onChange={(e) => setCompanyInn(e.target.value)}
              placeholder="Укажите ИНН"
              className={formState?.errors?.legalCompanyInn ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            {formState?.errors?.legalCompanyInn && (
              <p className="text-xs font-bold text-destructive mt-1">{formState.errors.legalCompanyInn[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">ОГРН / ОГРНИП</Label>
            <Input
              name="legalCompanyOgrnip"
              value={companyOgrnip}
              onChange={(e) => setCompanyOgrnip(e.target.value)}
              placeholder="Укажите ОГРНИП"
              className={formState?.errors?.legalCompanyOgrnip ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Юридический адрес / Город</span>
              <span className="text-[10px] text-muted-foreground font-normal lowercase">(необязательно для ИП по 152-ФЗ)</span>
            </Label>
            <Input
              name="legalCompanyAddress"
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              placeholder="г. Москва (оставьте пустым для скрытия домашнего адреса ИП)"
            />
            <p className="text-[10px] text-muted-foreground">
              🛡️ Защита PII: если поле пустое, строка «Адрес» полностью исключается из договора-оферты.
            </p>
          </div>

          {/* Fiscal 54-FZ & USN Settings */}
          <div className="md:col-span-2 pt-4 border-t border-border/50">
            <div className="flex items-center gap-2 mb-3">
              <span className="p-1 px-2 bg-primary/10 text-primary rounded text-[10px] font-bold">54-ФЗ</span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Налогообложение & Фискализация (54-ФЗ / 176-ФЗ)
              </h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Схема налогообложения
                </Label>
                <select
                  name="usnScheme"
                  value={usnScheme}
                  onChange={handleUsnChange}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none h-10"
                >
                  <option value="INCOME">УСН Доходы (6%)</option>
                  <option value="INCOME_EXPENSES">УСН Доходы минус расходы (15%)</option>
                </select>
                <p className="text-[10px] text-muted-foreground">
                  Базовая ставка по ст. 346.20 НК РФ
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Ставка налога (%)
                </Label>
                <Input
                  name="taxRate"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Региональная льготная или стандартная ставка
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  OPEX в месяц (₽)
                </Label>
                <Input
                  name="opexMonthly"
                  type="number"
                  step="1000"
                  min="0"
                  value={opexMonthly}
                  onChange={(e) => setOpexMonthly(parseFloat(e.target.value) || 0)}
                  placeholder="50000"
                  className="font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Постоянные операционные расходы (сервера, софт)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── LIVE FOOTER & REQUISITES PREVIEW ── */}
        <div className="p-5 rounded-2xl border border-border/60 bg-muted/20 space-y-3">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" />
            <span className="text-xs font-black uppercase tracking-wider text-foreground">
              Brand-First предпросмотр (Безопасность реквизитов оператора)
            </span>
          </div>

          <div className="space-y-2.5">
            <div className="p-3.5 rounded-xl bg-card border border-border/80 text-xs text-muted-foreground space-y-1 font-medium">
              <div className="text-[11px] font-bold text-primary uppercase tracking-wider">1. Публичный подвал (Футер на главной):</div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-border/40">
                <span className="font-bold text-foreground">© 2026 {siteName || defaultSiteName}. Все права защищены.</span>
                <span className="text-foreground/70">Информационно-техническая платформа</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-card border border-border/80 text-xs text-muted-foreground space-y-1.5 font-medium">
              <div className="text-[11px] font-bold text-primary uppercase tracking-wider">2. Реквизиты в договоре-оферте (/legal/terms):</div>
              <div className="text-[11px] text-foreground/80 font-mono grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1.5 border-t border-border/40">
                <div>Исполнитель: <strong>{companyName || defaultSiteName}</strong></div>
                <div>ИНН: <strong>{companyInn || '—'}</strong></div>
                <div>ОГРНИП: <strong>{companyOgrnip || '—'}</strong></div>
                <div>Адрес: <strong>{companyAddress || '<скрыт по 152-ФЗ>'}</strong></div>
                <div>Режим налогообложения: <strong>{usnScheme === 'INCOME' ? `УСН Доходы (${taxRate}%)` : `УСН Доходы-Расходы (${taxRate}%)`}</strong></div>
                <div>OPEX: <strong>{opexMonthly ? `${opexMonthly.toLocaleString('ru-RU')} ₽ / мес` : 'Не задан'}</strong></div>
                <div>Поддержка: <strong>{supportEmail || defaultEmail}</strong></div>
                <div>ПДн (152-ФЗ): <strong>{privacyEmail || defaultPrivacyEmail}</strong></div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Sticky Bottom Action Bar */}
      <div className="sticky bottom-4 z-20 flex items-center justify-between gap-4 p-4 rounded-2xl bg-card/95 backdrop-blur-md border border-border shadow-lg">
        <div className="text-xs text-muted-foreground hidden sm:block">
          Не забудьте сохранить изменения перед переходом в другие разделы
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <Button
            disabled={isPending}
            type="submit"
            className="font-bold uppercase tracking-widest text-xs h-11 px-8 shadow-md cursor-pointer"
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Сохранить все настройки
          </Button>
        </div>
      </div>
    </form>
  );
}
