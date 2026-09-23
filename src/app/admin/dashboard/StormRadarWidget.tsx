'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Zap, 
  ShieldCheck, 
  AlertTriangle, 
  Copy, 
  Check, 
  ExternalLink, 
  Activity, 
  MessageSquare, 
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import type { StormRadarReport, StormServiceAlert } from '@/services/admin/storm-detector.service';

interface Props {
  report: StormRadarReport;
}

export function StormRadarWidget({ report }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyTicket = (alert: StormServiceAlert) => {
    if (!alert.ticketTemplate) return;
    navigator.clipboard.writeText(alert.ticketTemplate);
    setCopiedId(alert.serviceId);
    toast.success('Готовый текст обращения скопирован в буфер обмена!', {
      description: `Услуга: ${alert.serviceName}`
    });
    setTimeout(() => setCopiedId(null), 2500);
  };

  const hasCritical = report.criticalCount > 0;
  const hasWarning = report.warningCount > 0;

  return (
    <div className={`bg-card text-card-foreground rounded-lg p-5 border shadow-sm space-y-4 ${
      hasCritical 
        ? 'border-rose-500/40 bg-gradient-to-br from-rose-500/5 via-card to-card' 
        : 'border-border/70'
    }`}>
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-md ${
            hasCritical 
              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 animate-pulse' 
              : 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
          }`}>
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">
                Радар штормов соцсетей и сбоев провайдеров
              </h4>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-muted text-muted-foreground border border-border/50">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                Shadow Mode (Без риска авто-отключения)
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Мониторинг аномальных всплесков отмен за скользящее окно {report.windowHours}ч (защита от чисток соцсетей)
            </p>
          </div>
        </div>

        {/* Status Counters */}
        <div className="flex items-center gap-2">
          {report.criticalCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              <span>{report.criticalCount} шторм</span>
            </span>
          )}
          {report.warningCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>{report.warningCount} нестабильны</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>{report.healthyCount} в норме</span>
          </span>
        </div>
      </div>

      {/* Main Alert List or Clean Slate */}
      {report.alerts.length === 0 ? (
        <div className="py-5 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Все проверенные услуги работают стабильно. Массовых отмен и штормов алгоритмов не зафиксировано.</span>
        </div>
      ) : (
        <div className="space-y-3">
          {report.alerts.map((alert) => {
            const isCritical = alert.severity === 'CRITICAL';

            return (
              <div
                key={alert.serviceId}
                className={`p-3.5 rounded-lg border transition-all ${
                  isCritical
                    ? 'bg-rose-500/10 border-rose-500/30'
                    : 'bg-amber-500/10 border-amber-500/30'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Service Details */}
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                        isCritical
                          ? 'bg-rose-600 text-white border-rose-700'
                          : 'bg-amber-600 text-white border-amber-700'
                      }`}>
                        {isCritical ? 'Шторм соцсети' : 'Внимание'}
                      </span>
                      <span className="font-bold text-foreground text-xs">{alert.serviceName}</span>
                    </div>

                    <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                      <span>Соцсеть: <strong className="text-foreground">{alert.networkName}</strong></span>
                      <span>•</span>
                      <span>Провайдер: <span className="font-semibold text-foreground">{alert.providerName}</span></span>
                      <span>•</span>
                      <span>Заказов: <strong className="text-foreground">{alert.ordersCount}</strong> ({alert.cancelCount} отмен от {alert.distinctUsersCount} кл.)</span>
                    </div>
                  </div>

                  {/* Failure Rate Gauge & Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <div className="text-right pr-2">
                      <div className="font-mono font-extrabold text-sm tabular-nums text-rose-600 dark:text-rose-400">
                        {alert.failureRate}% отмен
                      </div>
                      <span className="text-[9px] text-muted-foreground uppercase font-bold">Уровень сбоев</span>
                    </div>

                    {alert.ticketTemplate && (
                      <button
                        type="button"
                        onClick={() => handleCopyTicket(alert)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-card border border-border/70 hover:bg-muted text-foreground transition-all shadow-sm cursor-pointer"
                        title="Скопировать готовый текст претензии для тикета провайдеру"
                      >
                        {copiedId === alert.serviceId ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-600 dark:text-emerald-400">Скопировано</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>Тикет провайдеру</span>
                          </>
                        )}
                      </button>
                    )}

                    <Link
                      href={`/admin/orders?serviceName=${encodeURIComponent(alert.serviceName)}&status=PROBLEMATIC`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-muted/60 hover:bg-muted text-foreground border border-border/50 transition-colors"
                    >
                      <span>Заказы</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
