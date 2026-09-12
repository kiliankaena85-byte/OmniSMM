import { settingsService } from '@/services/admin/settings.service';
import { db } from '@/lib/db';
import { Settings, Globe, Link as LinkIcon, Users, History, MessageSquare, Database, Bot, Server } from 'lucide-react';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { SYSTEM_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';
import { TestModePanel } from '@/components/admin/test-mode-panel';
import { GeneralSettings } from './general-settings';
import { CatalogSettings } from './catalog-settings';
import { IntegrationsSettings } from './integrations-settings';
import { TelegramBotSettings } from './telegram-bot-settings';
import dynamicImport from 'next/dynamic';

const TeamManagement = dynamicImport(() => import('./team-management').then(m => m.TeamManagement), {
  loading: () => <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">Загрузка панели команды...</div>
});
const ProviderProxyManager = dynamicImport(() => import('./provider-proxy-manager').then(m => m.ProviderProxyManager), {
  loading: () => <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">Загрузка прокси провайдеров...</div>
});
const SupportTemplatesSettings = dynamicImport(() => import('./support-templates').then(m => m.SupportTemplatesSettings), {
  loading: () => <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">Загрузка шаблонов ответов...</div>
});
const StorefrontKeysSettings = dynamicImport(() => import('./storefront-keys/storefront-keys-settings').then(m => m.StorefrontKeysSettings), {
  loading: () => <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">Загрузка ключей витрин...</div>
});
import { AuditLogsTab } from '@/components/admin/settings/audit-logs-tab';
import Link from 'next/link';
import { enforceSectionAccess } from '@/lib/server/rbac';
import { SettingsProvider } from '@/lib/settings';
import { SystemHealthOverview } from '@/components/admin/settings/system-health-overview';
import { OnboardingReadinessBar } from '@/components/admin/settings/onboarding-readiness-bar';
import { SettingsSearchCommand } from '@/components/admin/settings/settings-search-command';
import { SettingsClusterTabs } from '@/components/admin/settings/settings-cluster-tabs';
import { resolveSettingsNavigation } from '@/components/admin/settings/settings-navigation-config';
import { AdminAuditLog, StaffRole, StaffPermission, SupportTemplate, SystemSettings, Provider, StorefrontKey } from '@prisma/client';

import { cookies } from 'next/headers';
import { normalizeTenantId } from '@/lib/tenant-resolver-edge';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; tenant?: string }>;
}) {
  // 1. RBAC Guard: Evaluate access ceiling first
  const admin = await enforceSectionAccess('settings');
  
  const params = await searchParams;
  const cookieStore = await cookies();
  const urlTenant = normalizeTenantId(params.tenant);
  const cookieTenant = normalizeTenantId(cookieStore.get('x_admin_tenant')?.value);
  const headerTenant = await SettingsProvider.getTenantId();
  const activeTenantId = urlTenant || cookieTenant || normalizeTenantId(headerTenant) || 'smmplan';

  const rawTab = params.tab || 'system';
  const { activeSubTab } = resolveSettingsNavigation(rawTab);
  const activeTab = activeSubTab;
  const searchQuery = params.q || '';

  // 2. Tab-Scoped Optimized Queries: Fetch settings + conditionally only the active tab data
  let settings: SystemSettings;
  let staffUsers: Awaited<ReturnType<typeof settingsService.listStaffUsers>> = [];
  let users: Awaited<ReturnType<typeof settingsService.listUsers>> = [];
  let recentLogs: AdminAuditLog[] = [];
  let staffRoles: (StaffRole & { permissions: StaffPermission[] })[] = [];
  let templates: SupportTemplate[] = [];
  let providers: Provider[] = [];
  let storefrontKeys: Array<{
    id: string;
    tenantId: string;
    type: 'PUBLISHABLE' | 'SECRET';
    keyPrefix: string;
    name: string | null;
    isActive: boolean;
    lastUsedAt: string | null;
    createdAt: string;
  }> = [];

  try {
    const settingsPromise = settingsService.getSystemSettings(activeTenantId);

    if (activeTab === 'team') {
      const [s, stUsers, uList, roles] = await Promise.all([
        settingsPromise,
        settingsService.listStaffUsers(),
        searchQuery ? settingsService.listUsers(searchQuery) : Promise.resolve([]),
        db.staffRole.findMany({ include: { permissions: true }, orderBy: { name: 'asc' } }),
      ]);
      settings = s;
      staffUsers = stUsers;
      users = uList;
      staffRoles = roles;
    } else if (activeTab === 'proxy') {
      const [s, pList] = await Promise.all([
        settingsPromise,
        db.provider.findMany({ orderBy: { name: 'asc' } }),
      ]);
      settings = s;
      providers = pList;
    } else if (activeTab === 'storefront') {
      const [s, kList] = await Promise.all([
        settingsPromise,
        db.storefrontKey.findMany({
          where: { tenantId: activeTenantId },
          orderBy: { createdAt: 'desc' },
        }),
      ]);
      settings = s;
      storefrontKeys = kList.map((k: StorefrontKey) => ({
        id: k.id,
        tenantId: k.tenantId,
        type: k.type as 'PUBLISHABLE' | 'SECRET',
        keyPrefix: k.keyPrefix,
        name: k.name,
        isActive: k.isActive,
        lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
        createdAt: k.createdAt.toISOString(),
      }));
    } else if (activeTab === 'templates') {
      const [s, tList] = await Promise.all([
        settingsPromise,
        db.supportTemplate.findMany({ orderBy: { sort: 'asc' } }),
      ]);
      settings = s;
      templates = tList;
    } else if (activeTab === 'audit') {
      const [s, logs] = await Promise.all([
        settingsPromise,
        db.adminAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
      ]);
      settings = s;
      recentLogs = logs;
    } else {
      // Default tabs: 'system', 'catalog', 'integrations', 'telegram' only need settings
      settings = await settingsPromise;
    }
  } catch (error) {
    console.error('[AdminSettingsPage] Failed to load settings data:', error);
    throw new Error('Не удалось загрузить данные настроек. Попробуйте обновить страницу.');
  }

  // 3. Security Sanitize: Mask all 11 critical secrets before passing to client components
  const sanitizedSettings = {
    ...settings,
    telegramBotToken: settings.telegramBotToken ? '••••••••••••••••' : null,
    yookassaSecretKey: settings.yookassaSecretKey ? '••••••••••••••••' : null,
    yookassaWebhookSecret: settings.yookassaWebhookSecret ? '••••••••••••••••' : null,
    yookassaTestSecretKey: settings.yookassaTestSecretKey ? '••••••••••••••••' : null,
    cryptoBotToken: settings.cryptoBotToken ? '••••••••••••••••' : null,
    resendApiKey: settings.resendApiKey ? '••••••••••••••••' : null,
    smtpPassword: settings.smtpPassword ? '••••••••••••••••' : null,
    inboundEmailWebhookSecret: settings.inboundEmailWebhookSecret ? '••••••••••••••••' : null,
    robokassaPassword: settings.robokassaPassword ? '••••••••••••••••' : null,
    robokassaWebhookPassword: settings.robokassaWebhookPassword ? '••••••••••••••••' : null,
    geminiApiKeys: settings.geminiApiKeys ? '••••••••••••••••' : null,
  };

  const regularUsers = users.filter((u) => u.id !== admin.id);

  return (
    <div className="space-y-6 max-w-4xl mx-auto w-full min-w-0 animate-in fade-in duration-300 ease-out px-1 sm:px-4 min-h-full pb-16">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1">
        <AdminTabbedHeader
          icon={Settings}
          title="Настройки системы"
          description="Глобальная конфигурация платформы, безопасность и персонал."
          onboardingKey="settings"
          onboarding={ONBOARDING_CONFIGS.settings}
        />
        <div className="shrink-0 self-start lg:self-center w-full sm:w-auto">
          <SettingsSearchCommand />
        </div>
      </div>

      {/* ── Onboarding Readiness & Goal-Gradient Bar ── */}
      <OnboardingReadinessBar settings={sanitizedSettings} />

      {/* ── Dynamic System Health Pulse & Quick Actions ── */}
      <SystemHealthOverview settings={sanitizedSettings} />

      {/* ── Level 1 & Level 2 Master Cluster Navigation ── */}
      <SettingsClusterTabs activeTab={activeTab} />

      <div className="space-y-8 mt-4">
        {/* ── TAB 1: SYSTEM ── */}
        {activeTab === 'system' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-300">
            <TestModePanel initialIsTestMode={sanitizedSettings.isTestMode} isTestEnvironment={SettingsProvider.isTestEnvironment()} />
            <GeneralSettings settings={sanitizedSettings} tenantId={activeTenantId} />
          </div>
        )}

        {/* ── TAB 1.5: CATALOG ── */}
        {activeTab === 'catalog' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-300">
            <CatalogSettings settings={sanitizedSettings} tenantId={activeTenantId} />
          </div>
        )}

        {/* ── TAB 2: INTEGRATIONS ── */}
        {activeTab === 'integrations' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-300">
            <IntegrationsSettings settings={sanitizedSettings} tenantId={activeTenantId} />
          </div>
        )}

        {/* ── TAB 2.5: TELEGRAM BOT ── */}
        {activeTab === 'telegram' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-300">
            <TelegramBotSettings settings={sanitizedSettings} tenantId={activeTenantId} />
          </div>
        )}

        {/* ── TAB 2.8: PROVIDER PROXIES ── */}
        {activeTab === 'proxy' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-300">
            <ProviderProxyManager providers={providers} />
          </div>
        )}

        {/* ── TAB 2.9: STOREFRONT KEYS ── */}
        {activeTab === 'storefront' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-300">
            <StorefrontKeysSettings initialKeys={storefrontKeys} tenantId={activeTenantId} />
          </div>
        )}

        {/* ── TAB 3: TEAM ── */}
        {activeTab === 'team' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-300">
            <TeamManagement 
              staffUsers={staffUsers} 
              regularUsers={regularUsers} 
              searchQuery={searchQuery} 
              currentAdminRole={admin.role}
              staffRoles={staffRoles}
            />
          </div>
        )}

        {/* ── TAB 3.7: SUPPORT TEMPLATES ── */}
        {activeTab === 'templates' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-300">
            <SupportTemplatesSettings initialTemplates={templates} />
          </div>
        )}

        {/* ── TAB 4: AUDIT ── */}
        {activeTab === 'audit' && (
          <AuditLogsTab logs={recentLogs} />
        )}
      </div>
    </div>
  );
}
