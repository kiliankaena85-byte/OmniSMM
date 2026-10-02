'use client';

import * as React from 'react';
import type { SystemSettings } from '@prisma/client';
import type { TelegramBotDiagnostics, TelegramMenuButton, TelegramRatingReasonsConfig, TelegramMessageTemplatesConfig } from '@/types/telegram';
import type { TelegramSubTab } from './telegram-bot-sidebar';

import { ConnectionPanel } from './connection-panel';
import { TelegramMenuTab } from './telegram-menu-tab';
import { TelegramTemplatesTab } from './telegram-templates-tab';
import { TelegramCsatTab } from './telegram-csat-tab';
import { TelegramFeedbackListTab } from './telegram-feedback-list-tab';
import { ProxyConfig } from './proxy-config';
import { StatisticsPanel } from './statistics-panel';
import { ErrorTracker } from './error-tracker';
import { SecurityPanel } from './security-panel';
import { BotConstructorTab } from './bot-constructor-tab';
import { DePinNodesTab } from './depin-nodes-tab';
import { TelegramMtprotoTab } from './telegram-mtproto-tab';

interface TelegramBotTabsContentProps {
  activeTab: TelegramSubTab;
  settings: SystemSettings;
  tenantId?: string;
  diagnostics: TelegramBotDiagnostics | null;
  fetchDiagnostics: () => void;
  menuButtons: TelegramMenuButton[];
  setMenuButtons: (buttons: TelegramMenuButton[]) => void;
  templates: TelegramMessageTemplatesConfig;
  setTemplates: (templates: TelegramMessageTemplatesConfig) => void;
  ratingReasons: TelegramRatingReasonsConfig;
  setRatingReasons: (reasons: TelegramRatingReasonsConfig) => void;
}

export function TelegramBotTabsContent({
  activeTab,
  settings,
  tenantId,
  diagnostics,
  fetchDiagnostics,
  menuButtons,
  setMenuButtons,
  templates,
  setTemplates,
  ratingReasons,
  setRatingReasons,
}: TelegramBotTabsContentProps) {
  if (activeTab === 'bots') {
    return <BotConstructorTab tenantId={tenantId || 'smmplan'} />;
  }

  return (
    <div className="space-y-6">
      {/* TAB 1: CONNECTION & DIAGNOSTICS */}
      {activeTab === 'general' && (
        <ConnectionPanel
          settings={settings}
          tenantId={tenantId}
          diagnostics={diagnostics}
          onRefresh={fetchDiagnostics}
        />
      )}

      {/* TAB 2: MENU BUILDER */}
      {activeTab === 'menu' && (
        <TelegramMenuTab
          initialButtons={menuButtons}
          onButtonsChange={setMenuButtons}
          tenantId={tenantId}
        />
      )}

      {/* TAB DEPIN: NODES & EARNINGS */}
      {activeTab === 'depin' && (
        <DePinNodesTab tenantId={tenantId} />
      )}

      {/* TAB MTPROTO: PRODUCTION CLUSTER */}
      {activeTab === 'mtproto' && (
        <TelegramMtprotoTab tenantId={tenantId} />
      )}

      {/* TAB 3: MESSAGE TEMPLATES */}
      {activeTab === 'templates' && (
        <TelegramTemplatesTab
          initialTemplates={templates}
          onTemplatesChange={setTemplates}
          tenantId={tenantId}
        />
      )}

      {/* TAB 4: CSAT RATING REASONS */}
      {activeTab === 'csat' && (
        <TelegramCsatTab
          initialReasons={ratingReasons}
          onReasonsChange={setRatingReasons}
          tenantId={tenantId}
        />
      )}

      {/* TAB 5: FEEDBACK CRM */}
      {activeTab === 'feedback' && (
        <TelegramFeedbackListTab />
      )}

      {/* TAB 6: PROXY CONFIGURATION */}
      {activeTab === 'proxy' && (
        <ProxyConfig diagnostics={diagnostics} onRefresh={fetchDiagnostics} />
      )}

      {/* TAB 7: DAILY STATISTICS */}
      {activeTab === 'statistics' && (
        <StatisticsPanel />
      )}

      {/* TAB 8: ERROR TRACKER */}
      {activeTab === 'errors' && (
        <ErrorTracker />
      )}

      {/* TAB 9: SECURITY CONFIGURATION (OWASP TOP 10) */}
      {activeTab === 'security' && (
        <SecurityPanel
          settings={settings}
          diagnostics={diagnostics}
          onRefresh={fetchDiagnostics}
        />
      )}
    </div>
  );
}
