'use client';

import * as React from 'react';
import { useEffect, useState, useCallback } from 'react';
import type { SystemSettings } from '@prisma/client';
import {
  getTelegramBotDiagnosticsAction,
  getTelegramEnterpriseConfigAction,
} from '@/actions/admin/telegram-bot';
import {
  DEFAULT_TELEGRAM_MENU_BUTTONS,
  DEFAULT_TELEGRAM_RATING_REASONS,
  DEFAULT_TELEGRAM_MESSAGE_TEMPLATES,
  type TelegramMenuButton,
  type TelegramRatingReasonsConfig,
  type TelegramMessageTemplatesConfig,
  type TelegramBotDiagnostics,
} from '@/types/telegram';
import { getTenantFallbackBranding } from '@/lib/tenant-branding';

import { TelegramBotHeaderCard } from './telegram/telegram-bot-header-card';
import { TelegramBotSidebar, type TelegramSubTab } from './telegram/telegram-bot-sidebar';
import { TelegramBotTabsContent } from './telegram/telegram-bot-tabs-content';

interface TelegramBotSettingsProps {
  settings: SystemSettings;
  tenantId?: string;
}

export function TelegramBotSettings({ settings, tenantId = 'smmplan' }: TelegramBotSettingsProps) {
  const [activeTab, setActiveTab] = useState<TelegramSubTab>('general');
  const [diagnostics, setDiagnostics] = useState<TelegramBotDiagnostics | null>(null);
  const [loadingDiag, setLoadingDiag] = useState(false);

  const fallbackBranding = getTenantFallbackBranding(tenantId);
  const botUsername = (settings as unknown as { telegramBotUsername?: string }).telegramBotUsername || fallbackBranding.bot;

  const [menuButtons, setMenuButtons] = useState<TelegramMenuButton[]>(DEFAULT_TELEGRAM_MENU_BUTTONS);
  const [templates, setTemplates] = useState<TelegramMessageTemplatesConfig>(DEFAULT_TELEGRAM_MESSAGE_TEMPLATES);
  const [ratingReasons, setRatingReasons] = useState<TelegramRatingReasonsConfig>(DEFAULT_TELEGRAM_RATING_REASONS);

  const fetchDiagnostics = useCallback(async () => {
    setLoadingDiag(true);
    try {
      const res = await getTelegramBotDiagnosticsAction(tenantId);
      if (res) {
        setDiagnostics(res);
      }
    } catch {
      // ignore
    } finally {
      setLoadingDiag(false);
    }
  }, [tenantId]);

  const loadEnterpriseConfig = useCallback(async () => {
    try {
      const res = await getTelegramEnterpriseConfigAction(tenantId);
      if (res.success && res.config) {
        if (res.config.menuButtons) setMenuButtons(res.config.menuButtons);
        if (res.config.ratingReasons) setRatingReasons(res.config.ratingReasons);
        if (res.config.templates) setTemplates(res.config.templates);
      }
    } catch {
      // ignore
    }
  }, [tenantId]);

  useEffect(() => {
    fetchDiagnostics();
    loadEnterpriseConfig();
  }, [fetchDiagnostics, loadEnterpriseConfig]);

  useEffect(() => {
    if (settings.telegramMenuConfig) {
      setMenuButtons(settings.telegramMenuConfig as unknown as TelegramMenuButton[]);
    }
    if (settings.telegramRatingReasons) {
      setRatingReasons(settings.telegramRatingReasons as unknown as TelegramRatingReasonsConfig);
    }
    if (settings.telegramTemplates) {
      setTemplates(settings.telegramTemplates as unknown as TelegramMessageTemplatesConfig);
    }
  }, [settings, tenantId]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* ── 1. HERO STATUS & DIAGNOSTICS BANNER ── */}
      <TelegramBotHeaderCard
        diagnostics={diagnostics}
        loadingDiag={loadingDiag}
        fetchDiagnostics={fetchDiagnostics}
        botUsername={botUsername}
        tenantId={tenantId}
      />

      {/* ── 2. VERTICAL SIDEBAR & WORKSPACE (12 COLUMNS) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Sidebar Menu (3 cols) */}
        <TelegramBotSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Right Content Area (9 cols) */}
        <div className="lg:col-span-9 space-y-6">
          <TelegramBotTabsContent
            activeTab={activeTab}
            settings={settings}
            tenantId={tenantId}
            diagnostics={diagnostics}
            fetchDiagnostics={fetchDiagnostics}
            menuButtons={menuButtons}
            setMenuButtons={setMenuButtons}
            templates={templates}
            setTemplates={setTemplates}
            ratingReasons={ratingReasons}
            setRatingReasons={setRatingReasons}
          />
        </div>
      </div>
    </div>
  );
}
