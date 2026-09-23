'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, Power, Send } from 'lucide-react';
import { toast } from 'sonner';
import { getLatestAiDigestAction, triggerAiObserverManualAction, toggleAiObserverKillswitchAction } from '@/actions/admin/observer';
import { type ExecutiveDigestResult } from '@/services/observer/ai-observer.service';

export function ExecutiveAiDigestCard({
  canAccessExecutive = true,
  canUseKillSwitch = true,
  canEditSettings = true,
  canEditAnalytics = true,
}: {
  canAccessExecutive?: boolean;
  canUseKillSwitch?: boolean;
  canEditSettings?: boolean;
  canEditAnalytics?: boolean;
}) {
  const [digestData, setDigestData] = useState<ExecutiveDigestResult | null>(null);
  const [isKilled, setIsKilled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchLatest = async () => {
    try {
      setIsLoading(true);
      const res = await getLatestAiDigestAction();
      if (res.success && res.data) {
        setDigestData(res.data.digest);
        setIsKilled(res.data.isKillswitchActive);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canAccessExecutive) {
      fetchLatest();
    }
  }, [canAccessExecutive]);

  // Strict RBAC: If role has no right to view executive digest, render nothing in DOM
  if (!canAccessExecutive) {
    return null;
  }

  const handleManualRun = async (sendTelegram: boolean) => {
    try {
      setIsGenerating(true);
      toast.info(sendTelegram ? 'Формирование отчета и отправка в Telegram...' : 'Генерация свежего AI-дайджеста...');
      const res = await triggerAiObserverManualAction({ sendTelegram });
      if (res.success && res.data) {
        setDigestData(res.data);
        toast.success(`Дайджест успешно сгенерирован за ${res.data.latencyMs}ms (${res.data.source})`);
      } else {
        toast.error(res.error || 'Не удалось сгенерировать дайджест');
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleKillswitch = async () => {
    const nextState = isKilled; // If currently killed, enable it (true)
    try {
      const res = await toggleAiObserverKillswitchAction(nextState);
      if (res.success) {
        setIsKilled(res.isKillswitchActive ?? false);
        toast.success(res.isKillswitchActive ? 'Модуль AI-Observer отключен (Kill-Switch)' : 'Модуль AI-Observer включен');
      } else {
        toast.error(res.error || 'Ошибка изменения статуса');
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const showKillSwitch = canUseKillSwitch && canEditSettings;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              Executive AI Observer & Daily Digest
              <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${isKilled ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                {isKilled ? 'ОТКЛЮЧЕН (KILL-SWITCH)' : 'АКТИВЕН (08:00 МСК)'}
              </span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Автономная сводка финансов, маржинальности, надежности провайдеров и безопасности.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {showKillSwitch && (
            <button
              onClick={handleToggleKillswitch}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all duration-200 ${isKilled ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20' : 'bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20'}`}
              title="Master Kill-Switch (Мгновенное отключение модуля)"
            >
              <Power className="w-3.5 h-3.5" />
              {isKilled ? 'Включить модуль' : 'Kill-Switch'}
            </button>
          )}

          {canEditAnalytics && (
            <>
              <button
                disabled={isGenerating}
                onClick={() => handleManualRun(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-muted border border-border text-foreground hover:bg-card transition-all duration-200 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                Обновить
              </button>

              <button
                disabled={isGenerating}
                onClick={() => handleManualRun(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                Отправить в Telegram
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content Body */}
      {isLoading ? (
        <div className="py-8 flex items-center justify-center text-xs text-muted-foreground gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-primary" />
          Загрузка последнего дайджеста...
        </div>
      ) : digestData ? (
        <div className="space-y-3">
          {/* Metadata badges */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-mono">Период: 24h</span>
            <span>•</span>
            <span className="font-mono">Выручка: {(digestData.metrics?.financials?.grossRevenueRub ?? 0).toLocaleString('ru-RU')} ₽</span>
            <span>•</span>
            <span className="font-mono">Маржа: {digestData.metrics?.financials?.marginPercent ?? 0}%</span>
            <span>•</span>
            <span>Источник: {digestData.source}</span>
          </div>

          {/* Markdown Content Output */}
          <div className="rounded-lg bg-muted/40 p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed border border-border/50 max-h-96 overflow-y-auto select-text">
            {digestData.digestMarkdown}
          </div>
        </div>
      ) : (
        <div className="py-6 text-center text-xs text-muted-foreground">
          Дайджест еще не сформирован. Нажмите «Обновить» для немедленной генерации отчета.
        </div>
      )}
    </div>
  );
}
