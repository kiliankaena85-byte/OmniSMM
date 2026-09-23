'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Bell, Code, Building, Key } from 'lucide-react';
import PasswordCard from '@/components/dashboard/settings/PasswordCard';
import DeleteAccountCard from '@/components/dashboard/settings/DeleteAccountCard';
import LogoutCard from '@/components/dashboard/settings/LogoutCard';
import TelegramCard from '@/components/dashboard/settings/TelegramCard';
import Consent152FzCard from '@/components/dashboard/settings/Consent152FzCard';
import CompanyRequisitesCard from '@/components/dashboard/settings/CompanyRequisitesCard';
import ApiWebhookCard from '@/components/dashboard/settings/ApiWebhookCard';
import ApiKeyManager from '@/app/dashboard/settings/api/ApiKeyManager';

export interface SettingsTabsClientProps {
  user: {
    email: string;
    hasPassword: boolean;
    canResetPassword: boolean;
    telegramId: string | null;
    telegramNotifyOrders: boolean;
    telegramNotifyBalance: boolean;
    telegramNotifyTickets: boolean;
    tosAcceptedAt: Date | null;
    tosAcceptedIp: string | null;
    apiKeyHash: string | null;
    companyName: string | null;
    inn: string | null;
    kpp: string | null;
    ogrn: string | null;
    legalAddress: string | null;
    webhookUrl?: string | null;
    webhookSecret?: string | null;
    isWebhookActive?: boolean;
    tenantId?: string;
  };
}

const TABS = [
  { id: 'security', label: 'Безопасность', icon: Shield, desc: 'Пароль, сессии и аккаунт' },
  { id: 'notifications', label: 'Уведомления', icon: Bell, desc: 'Боты, оповещения, 152-ФЗ' },
  { id: 'api', label: 'API', icon: Code, desc: 'API ключи и вебхуки' },
  { id: 'company', label: 'Реквизиты', icon: Building, desc: 'Данные юрлица / ИП' },
] as const;

type TabId = typeof TABS[number]['id'];

export function SettingsTabsClient({ user }: SettingsTabsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabId) || 'security';
  const [activeTab, setActiveTab] = useState<TabId>(
    TABS.some(t => t.id === initialTab) ? initialTab : 'security'
  );

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tabId);
    router.replace(`/dashboard/settings?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      {/* Nested Tabs Bar */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-muted/40 border border-border/60 rounded-2xl">
        {TABS.map(({ id, label, icon: Icon, desc }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleTabChange(id)}
              className={`flex-1 min-w-[160px] min-h-[44px] px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
                isActive
                  ? 'bg-card text-foreground shadow-sm border border-border/80 scale-[1.01]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              aria-selected={isActive}
              role="tab"
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="text-left">
                <span className="block leading-tight">{label}</span>
                <span className="hidden sm:block text-[10px] font-normal text-muted-foreground leading-tight mt-0.5">
                  {desc}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      {activeTab === 'security' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <PasswordCard hasPassword={user.hasPassword} canResetPassword={user.canResetPassword} />
          <LogoutCard tenantId={user.tenantId} />
          <DeleteAccountCard hasPassword={user.hasPassword} />
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <TelegramCard
            telegramId={user.telegramId}
            notifyOrders={user.telegramNotifyOrders}
            notifyBalance={user.telegramNotifyBalance}
            notifyTickets={user.telegramNotifyTickets}
          />
          <Consent152FzCard
            tosAcceptedAt={user.tosAcceptedAt}
            tosAcceptedIp={user.tosAcceptedIp}
          />
        </div>
      )}

      {activeTab === 'api' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2.5 bg-muted/20">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground text-sm">Управление API-ключами</h2>
                <p className="text-[10px] text-muted-foreground">
                  Ключ для программного создания заказов через Panel API
                </p>
              </div>
            </div>
            <div className="p-5">
              <ApiKeyManager hasKey={!!user.apiKeyHash} />
            </div>
          </div>

          <ApiWebhookCard
            initialData={{
              webhookUrl: user.webhookUrl,
              webhookSecret: user.webhookSecret,
              isWebhookActive: user.isWebhookActive,
            }}
          />
        </div>
      )}

      {activeTab === 'company' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <CompanyRequisitesCard
            initialData={{
              companyName: user.companyName,
              inn: user.inn,
              kpp: user.kpp,
              ogrn: user.ogrn,
              legalAddress: user.legalAddress,
            }}
          />
        </div>
      )}
    </div>
  );
}
