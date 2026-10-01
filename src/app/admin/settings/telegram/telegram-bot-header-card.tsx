'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Bot,
  RotateCcw,
  Users,
  Headphones,
  ShoppingBag,
  Zap,
  Radio,
  ExternalLink,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { TelegramResetWebhookDialog } from './telegram-reset-webhook-dialog';
import { resetTelegramWebhookAction } from '@/actions/admin/telegram-bot';
import type { TelegramBotDiagnostics } from '@/types/telegram';

interface TelegramBotHeaderCardProps {
  diagnostics: TelegramBotDiagnostics | null;
  loadingDiag: boolean;
  fetchDiagnostics: () => void;
  botUsername: string;
  tenantId?: string;
}

export function TelegramBotHeaderCard({
  diagnostics,
  loadingDiag,
  fetchDiagnostics,
  botUsername,
  tenantId,
}: TelegramBotHeaderCardProps) {
  const [isResetWebhookModalOpen, setIsResetWebhookModalOpen] = React.useState(false);
  const [isPendingReset, startTransitionReset] = React.useTransition();

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
          <TelegramResetWebhookDialog
            isOpen={isResetWebhookModalOpen}
            onOpenChange={setIsResetWebhookModalOpen}
            onConfirm={executeResetWebhook}
          />

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
  );
}
