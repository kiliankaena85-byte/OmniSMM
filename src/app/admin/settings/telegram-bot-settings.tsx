'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { 
  Loader2, 
  Bot, 
  RotateCcw, 
  Users, 
  Headphones, 
  ShoppingBag, 
  Smartphone, 
  ExternalLink,
  MessageSquare, 
  Zap, 
  Radio,
  Send,
  Star,
  Settings2,
  BarChart3,
  Globe,
  AlertTriangle,
  Shield,
  Activity
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

import { 
  getTelegramBotDiagnosticsAction, 
  resetTelegramWebhookAction, 
  getTelegramEnterpriseConfigAction,
} from '@/actions/admin/telegram-bot';
import {
  DEFAULT_TELEGRAM_MENU_BUTTONS,
  DEFAULT_TELEGRAM_RATING_REASONS,
  DEFAULT_TELEGRAM_MESSAGE_TEMPLATES,
  type TelegramMenuButton,
  type TelegramRatingReasonsConfig,
  type TelegramMessageTemplatesConfig,
  type TelegramBotDiagnostics 
} from '@/types/telegram';

import { ConnectionPanel } from './telegram/connection-panel';
import { TelegramMenuTab } from './telegram/telegram-menu-tab';
import { TelegramTemplatesTab } from './telegram/telegram-templates-tab';
import { TelegramCsatTab } from './telegram/telegram-csat-tab';
import { TelegramFeedbackListTab } from './telegram/telegram-feedback-list-tab';
import { ProxyConfig } from './telegram/proxy-config';
import { StatisticsPanel } from './telegram/statistics-panel';
import { ErrorTracker } from './telegram/error-tracker';
import { SecurityPanel } from './telegram/security-panel';
import { TelegramLivePreview } from './telegram/telegram-live-preview';
import { BotConstructorTab } from './telegram/bot-constructor-tab';

interface TelegramBotSettingsProps {
  settings: SystemSettings;
  tenantId?: string;
}

export type TelegramSubTab = 
  | 'bots'
  | 'general' 
  | 'menu' 
  | 'templates' 
  | 'csat' 
  | 'feedback' 
  | 'proxy' 
  | 'statistics' 
  | 'errors' 
  | 'security';

export function TelegramBotSettings({ settings, tenantId = 'smmplan' }: TelegramBotSettingsProps) {
  const [activeTab, setActiveTab] = useState<TelegramSubTab>('general');
  const [diagnostics, setDiagnostics] = useState<TelegramBotDiagnostics | null>(null);
  const [loadingDiag, setLoadingDiag] = useState(false);
  const [isPendingReset, startTransitionReset] = useTransition();

  // General Settings State
  const botUsername = settings.contactTelegramBot || (tenantId === 'flux' ? 'smmflux_support_bot' : 'smmplan_support_bot');

  // Enterprise Config States for Live Preview Synchronization
  const [menuButtons, setMenuButtons] = useState<TelegramMenuButton[]>(
    (settings.telegramMenuConfig as unknown as TelegramMenuButton[]) || DEFAULT_TELEGRAM_MENU_BUTTONS
  );
  const [ratingReasons, setRatingReasons] = useState<TelegramRatingReasonsConfig>(
    (settings.telegramRatingReasons as unknown as TelegramRatingReasonsConfig) || DEFAULT_TELEGRAM_RATING_REASONS
  );
  const [templates, setTemplates] = useState<TelegramMessageTemplatesConfig>(
    (settings.telegramTemplates as unknown as TelegramMessageTemplatesConfig) || DEFAULT_TELEGRAM_MESSAGE_TEMPLATES
  );

  const fetchDiagnostics = useCallback(async () => {
    setLoadingDiag(true);
    try {
      const res = await getTelegramBotDiagnosticsAction(tenantId);
      setDiagnostics(res);
      if (res.success && res.bot) {
        toast.success(`Бот @${res.bot.username} онлайн (Ping: ${res.pingMs}ms)`);
      } else if (!res.success && res.error) {
        toast.error(res.error);
      }
    } catch (err) {
      toast.error(String(err));
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
    } catch { /* ignore */ }
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

  const [isResetWebhookModalOpen, setIsResetWebhookModalOpen] = useState(false);

  const executeResetWebhook = () => {
    setIsResetWebhookModalOpen(false);
    startTransitionReset(async () => {
      try {
        const res = await resetTelegramWebhookAction(tenantId);
        if (res.success) {
          toast.success(res.message);
          fetchDiagnostics();
        } else {
          toast.error(res.error || 'Ошибка сброса вебхука');
        }
      } catch (err) {
        toast.error(String(err));
      }
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* ── 1. HERO STATUS & DIAGNOSTICS BANNER ── */}
      <Card className="rounded-3xl border border-border/80 shadow-lg bg-card/80 backdrop-blur-xl p-6 sm:p-8 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-border/60">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 shrink-0">
              <Bot className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl font-extrabold text-foreground tracking-tight">Telegram Enterprise Control Center</h2>
                {diagnostics?.success ? (
                  diagnostics.daemonRunning ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Online • Long Polling (Демон активен)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Токен валиден • Polling перезапускается
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/15 text-rose-400 border border-rose-500/30">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    {diagnostics ? 'Токен не настроен / Ошибка' : 'Проверка статуса...'}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                Комплексное управление экосистемой Telegram: конструктор кнопок меню, шаблоны автоответов, причины оценок (1–5 ⭐), CSAT CRM, прокси-серверы, мониторинг сбоев и безопасность OWASP.
              </p>
            </div>
          </div>

          {/* Quick Action Controls */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              type="button"
              intent="secondary"
              size="sm"
              onClick={fetchDiagnostics}
              disabled={loadingDiag}
              className="font-bold text-xs h-9 px-3.5 cursor-pointer gap-1.5"
            >
              {loadingDiag ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5 text-blue-400" />}
              <span>Тест API</span>
            </Button>

            <Button
              type="button"
              intent="outline"
              size="sm"
              onClick={() => setIsResetWebhookModalOpen(true)}
              disabled={isPendingReset}
              className="font-bold text-xs h-9 px-3.5 cursor-pointer gap-1.5 border-border hover:bg-muted/40"
              title="Удаляет вебхуки и сбрасывает подвисшие апдейты в Telegram"
            >
              {isPendingReset ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5 text-amber-400" />}
              <span>Сбросить очередь</span>
            </Button>

            {/* Reset Webhook Confirmation Modal */}
            <Dialog open={isResetWebhookModalOpen} onOpenChange={setIsResetWebhookModalOpen}>
              <DialogContent className="sm:max-w-md bg-card border-border">
                <DialogHeader>
                  <div className="flex items-center gap-3 text-amber-500 pb-2">
                    <AlertTriangle className="w-6 h-6" />
                    <DialogTitle className="text-lg font-bold">Сброс очереди Telegram</DialogTitle>
                  </div>
                  <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                    Действие вызовет метод <code>deleteWebhook(&#123; drop_pending_updates: true &#125;)</code> на серверах Telegram.
                    <br /><br />
                    • Все зависшие очереди входящих сообщений будут очищены.<br />
                    • Активные вебхуки будут удалены в пользу Long Polling демона.<br />
                    • Рекомендуется применять при ошибках <code>409 Conflict</code>.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    intent="secondary"
                    size="sm"
                    onClick={() => setIsResetWebhookModalOpen(false)}
                  >
                    Отмена
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={executeResetWebhook}
                    className="font-bold bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                  >
                    Сбросить очередь
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <a
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
            >
              <span>Открыть @{botUsername}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Diagnostic Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
          <div className="p-4 rounded-2xl bg-muted/20 border border-border/60 space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Bot Latency (Ping)
            </span>
            <p className="text-base font-extrabold text-foreground font-mono">
              {diagnostics?.pingMs !== undefined ? `${diagnostics.pingMs} ms` : '—'}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-muted/20 border border-border/60 space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              Привязано аккаунтов
            </span>
            <p className="text-base font-extrabold text-foreground font-mono">
              {diagnostics?.stats?.linkedUsersCount ?? 0}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-muted/20 border border-border/60 space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Headphones className="w-3.5 h-3.5 text-emerald-400" />
              Тикетов из Telegram
            </span>
            <p className="text-base font-extrabold text-foreground font-mono">
              {diagnostics?.stats?.telegramTicketsCount ?? 0}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-muted/20 border border-border/60 space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <ShoppingBag className="w-3.5 h-3.5 text-purple-400" />
              Всего заказов в БД
            </span>
            <p className="text-base font-extrabold text-foreground font-mono">
              {diagnostics?.stats?.totalOrdersCount ?? 0}
            </p>
          </div>
        </div>
      </Card>

      {/* ── 2. INNER NAVIGATION TABS (ENTERPRISE SUBTABS) ── */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-muted/30 border border-border/60 overflow-x-auto w-full min-w-0 no-scrollbar snap-x snap-mandatory">
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 snap-start whitespace-nowrap ${
            activeTab === 'general'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>1. Подключение</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('menu')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 snap-start whitespace-nowrap ${
            activeTab === 'menu'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>2. Кнопки Меню</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('bots')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 snap-start whitespace-nowrap ${
            activeTab === 'bots'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>Конструктор ботов</span>
          <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono font-extrabold">NEW</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('templates')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 snap-start whitespace-nowrap ${
            activeTab === 'templates'
              ? 'bg-card text-foreground shadow-sm border border-border/80'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
          <span>3. Шаблоны Ответов</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('csat')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 snap-start whitespace-nowrap ${
            activeTab === 'csat'
              ? 'bg-card text-foreground shadow-sm border border-border/80'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          <span>4. Причины Оценок</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('feedback')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 snap-start whitespace-nowrap ${
            activeTab === 'feedback'
              ? 'bg-card text-foreground shadow-sm border border-border/80'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
          <span>5. Журнал Отзывов</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('proxy')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 snap-start whitespace-nowrap ${
            activeTab === 'proxy'
              ? 'bg-card text-foreground shadow-sm border border-border/80'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-cyan-400" />
          <span>6. Прокси</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('statistics')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 snap-start whitespace-nowrap ${
            activeTab === 'statistics'
              ? 'bg-card text-foreground shadow-sm border border-border/80'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-purple-400" />
          <span>7. Статистика</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('errors')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 snap-start whitespace-nowrap ${
            activeTab === 'errors'
              ? 'bg-card text-foreground shadow-sm border border-border/80'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          <span>8. Сбои</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 snap-start whitespace-nowrap ${
            activeTab === 'security'
              ? 'bg-card text-foreground shadow-sm border border-border/80'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>9. Безопасность</span>
        </button>
      </div>

      {/* ── 3. BOT CONSTRUCTOR (FULL WIDTH) OR TWO-COLUMN WORKSPACE ── */}
      {activeTab === 'bots' ? (
        <BotConstructorTab tenantId={tenantId} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
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

        {/* Right Column: Live Interactive iPhone Dark Simulator (5 cols) */}
        <div className="lg:col-span-5 sticky top-6">
          <TelegramLivePreview
            botUsername={botUsername}
            siteName={settings.siteName || 'SMMplan'}
            menuButtons={menuButtons}
            ratingReasons={ratingReasons}
            templates={templates}
          />
        </div>
      </div>
      )}
    </div>
  );
}
