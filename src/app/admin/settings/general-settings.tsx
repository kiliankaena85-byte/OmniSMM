'use client';

import * as React from 'react';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { updateGlobalSettings, disconnectTelegramBotAction } from '@/actions/admin/settings';
import { toggleTenantMaintenanceAction } from '@/actions/admin/tenants';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { SystemSettings } from '@prisma/client';
import { getTenantFallbackBranding } from '@/lib/tenant-branding';
import {
  GeneralMaintenanceSection,
  GeneralBrandingSection,
  GeneralTelegramBotSection,
  GeneralLegalFiscalSection,
  type GeneralFormState,
  type BotTestResult,
} from './components/general';

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

  // Live Preview States (Tenant-Aware Defaults for arbitrary N-tenants)
  const branding = getTenantFallbackBranding(tenantId);
  const defaultSiteName = branding.name;
  const defaultEmail = branding.supportEmail;
  const defaultPrivacyEmail = branding.privacyEmail;

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

  // Tax and USN Scheme reactivity (54-ФЗ / 152-ФЗ)
  const [usnScheme, setUsnScheme] = useState<string>(settings.usnScheme || 'INCOME_EXPENSES');
  const [taxRate, setTaxRate] = useState<number>(settings.taxRate ?? (settings.usnScheme === 'INCOME' ? 6 : 15));
  const [opexMonthly, setOpexMonthly] = useState<number>(settings.opexMonthly ? Math.round(settings.opexMonthly / 100) : 0);

  // Branding Upload states
  const [logoUrl, setLogoUrl] = useState<string | null>(settings.siteLogoUrl);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(settings.siteFaviconUrl);
  const [logoUploading, setLogoUploading] = useState(false);
  const [faviconUploading, setFaviconUploading] = useState(false);

  // Bot test states
  const [isTestingBot, setIsTestingBot] = useState(false);
  const [botTestResult, setBotTestResult] = useState<BotTestResult | null>(null);

  useEffect(() => {
    const curBranding = getTenantFallbackBranding(tenantId);
    setMaintenance(Boolean(settings.maintenanceMode));
    setSiteName(settings.siteName || curBranding.name);
    setSiteDescription(settings.siteDescription || '');
    setSupportEmail(settings.contactSupportEmail || curBranding.supportEmail);
    setPrivacyEmail(settings.contactPrivacyEmail || curBranding.privacyEmail);
    setTelegramBot(settings.contactTelegramBot || '');
    setTelegramBotToken('');
    setTelegramChannel(settings.contactTelegramChannel || '');
    setCompanyName(settings.legalCompanyName || curBranding.name);
    setCompanyInn(settings.legalCompanyInn || '');
    setCompanyOgrnip(settings.legalCompanyOgrnip || '');
    setCompanyAddress(settings.legalCompanyAddress || '');
    setUsnScheme(settings.usnScheme || 'INCOME_EXPENSES');
    setTaxRate(settings.taxRate ?? (settings.usnScheme === 'INCOME' ? 6 : 15));
    setOpexMonthly(settings.opexMonthly ? Math.round(settings.opexMonthly / 100) : 0);
  }, [settings, tenantId]);

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

  const handleTestBot = async () => {
    setIsTestingBot(true);
    setBotTestResult(null);
    try {
      const url = new URL('/api/admin/test-telegram-bot', window.location.origin);
      url.searchParams.set('tenant', tenantId);
      if (telegramBotToken && telegramBotToken.trim().length > 10 && !telegramBotToken.includes('•••')) {
        url.searchParams.set('token', telegramBotToken.trim());
      }
      const res = await fetch(url.toString(), { cache: 'no-store', signal: AbortSignal.timeout(10000) });
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

  const handleUsnChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const scheme = e.target.value;
    setUsnScheme(scheme);
    if (scheme === 'INCOME') {
      setTaxRate(6);
    } else if (scheme === 'INCOME_EXPENSES') {
      setTaxRate(15);
    }
  };

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
        signal: AbortSignal.timeout(15000),
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

  const formState = state as GeneralFormState | null;

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
      <GeneralMaintenanceSection
        maintenance={maintenance}
        isTogglingMaintenance={isTogglingMaintenance}
        isMaintenanceModalOpen={isMaintenanceModalOpen}
        setIsMaintenanceModalOpen={setIsMaintenanceModalOpen}
        onToggleMaintenance={handleToggleMaintenance}
      />

      {/* 2. Branding & Site Identity */}
      <GeneralBrandingSection
        siteName={siteName}
        setSiteName={setSiteName}
        siteDescription={siteDescription}
        setSiteDescription={setSiteDescription}
        logoUrl={logoUrl}
        setLogoUrl={setLogoUrl}
        faviconUrl={faviconUrl}
        setFaviconUrl={setFaviconUrl}
        logoUploading={logoUploading}
        faviconUploading={faviconUploading}
        handleBrandingUpload={handleBrandingUpload}
        copyToClipboard={copyToClipboard}
        copiedField={copiedField}
        formState={formState}
        onRemoveBranding={(type) => {
          if (type === 'logo') {
            setLogoUrl(null);
            toast.info('Логотип удален (нажмите Сохранить для подтверждения)');
          } else {
            setFaviconUrl(null);
            toast.info('Фавикон удален (нажмите Сохранить для подтверждения)');
          }
        }}
      />

      {/* 3. Telegram Support Bot Configuration & Live Diagnostics */}
      <GeneralTelegramBotSection
        tenantId={tenantId}
        telegramBot={telegramBot}
        setTelegramBot={setTelegramBot}
        telegramBotToken={telegramBotToken}
        setTelegramBotToken={setTelegramBotToken}
        telegramChannel={telegramChannel}
        setTelegramChannel={setTelegramChannel}
        hasExistingToken={Boolean(settings.telegramBotToken)}
        isDisconnectBotModalOpen={isDisconnectBotModalOpen}
        setIsDisconnectBotModalOpen={setIsDisconnectBotModalOpen}
        isDisconnectingBot={isDisconnectingBot}
        handleDisconnectBot={handleDisconnectBot}
        isTestingBot={isTestingBot}
        botTestResult={botTestResult}
        handleTestBot={handleTestBot}
      />

      {/* 4. Contacts & Legal Requisites */}
      <GeneralLegalFiscalSection
        defaultEmail={defaultEmail}
        defaultPrivacyEmail={defaultPrivacyEmail}
        defaultSiteName={defaultSiteName}
        supportEmail={supportEmail}
        setSupportEmail={setSupportEmail}
        privacyEmail={privacyEmail}
        setPrivacyEmail={setPrivacyEmail}
        telegramChannelDefault={settings.contactTelegramChannel || (tenantId === 'flux' ? 'smmflux_news' : 'smmplan_news')}
        companyName={companyName}
        setCompanyName={setCompanyName}
        companyInn={companyInn}
        setCompanyInn={setCompanyInn}
        companyOgrnip={companyOgrnip}
        setCompanyOgrnip={setCompanyOgrnip}
        companyAddress={companyAddress}
        setCompanyAddress={setCompanyAddress}
        usnScheme={usnScheme}
        handleUsnChange={handleUsnChange}
        taxRate={taxRate}
        setTaxRate={setTaxRate}
        opexMonthly={opexMonthly}
        setOpexMonthly={setOpexMonthly}
        siteName={siteName}
        formState={formState}
      />

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
