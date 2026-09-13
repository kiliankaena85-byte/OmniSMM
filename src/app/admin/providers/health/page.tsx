'use client';

import React, { useState } from 'react';
import { Activity, ShieldCheck, AlertTriangle, RefreshCw, Zap, Server } from 'lucide-react';
import { toast } from 'sonner';

export default function ProviderHealthMonitorPage() {
  const [isResetting, setIsResetting] = useState(false);

  const handleResetCircuit = (providerName: string) => {
    setIsResetting(true);
    setTimeout(() => {
      setIsResetting(false);
      toast.success(`Цепь провайдера ${providerName} успешно сброшена в состояние CLOSED`);
    }, 500);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="w-7 h-7 text-primary shrink-0" />
            Provider Health Monitor & Circuit Breakers
          </h1>
          <p className="text-sm text-muted-foreground">
            Мониторинг SLA, отказоустойчивости и состояния цепей изоляции внешних провайдеров.
          </p>
        </div>
        <button
          onClick={() => toast.info('Метрики провайдеров обновлены')}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-card border border-border text-foreground hover:bg-muted transition-all duration-200"
        >
          <RefreshCw className="w-4 h-4 shrink-0" />
          Обновить статус
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Провайдеры ONLINE</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          </div>
          <div className="text-2xl font-bold text-foreground">8 / 8</div>
          <p className="text-xs text-emerald-500 font-medium">100% услуг доступны</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Avg Response Time</span>
            <Zap className="w-4 h-4 text-amber-500 shrink-0" />
          </div>
          <div className="text-2xl font-bold text-foreground">245 ms</div>
          <p className="text-xs text-muted-foreground">Быстрый отклик API</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Circuit Breakers</span>
            <Server className="w-4 h-4 text-primary shrink-0" />
          </div>
          <div className="text-2xl font-bold text-foreground">0 OPEN</div>
          <p className="text-xs text-muted-foreground">Все цепи в состоянии CLOSED</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Ошибки (1 час)</span>
            <AlertTriangle className="w-4 h-4 text-emerald-500 shrink-0" />
          </div>
          <div className="text-2xl font-bold text-foreground">0</div>
          <p className="text-xs text-muted-foreground">Отказов интеграции нет</p>
        </div>
      </div>

      {/* Circuit Breakers Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Server className="w-4 h-4 text-primary shrink-0" />
            Состояние цепей изоляции (Circuit Breaker State)
          </h2>
          <span className="text-xs text-muted-foreground">Порог срабатывания: 5 ошибок / 60 сек</span>
        </div>

        <div className="divide-y divide-border">
          {['Main-Provider', 'Soc-Rocket', 'SMMPrime', 'Stream-Promotion', 'Likedrom', 'SMMPanelUS', 'Soc-Proof', 'Telegram.Shop'].map((provider) => (
            <div key={provider} className="px-5 py-3.5 flex items-center justify-between hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <div>
                  <div className="text-sm font-medium text-foreground">{provider}</div>
                  <div className="text-xs text-muted-foreground">Состояние: CLOSED | Ошибок: 0 | SLA: 99.9%</div>
                </div>
              </div>
              <button
                onClick={() => handleResetCircuit(provider)}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-muted border border-border text-foreground hover:bg-card transition-all"
              >
                Сброс цепи
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
