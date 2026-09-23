'use client';

import React from 'react';
import { TreasurySimulationOutput } from '@/services/ai/harnesses/customer-liability-treasury.harness';
import { Wallet, Lock, Landmark, Sparkles } from 'lucide-react';

interface Props {
  report: TreasurySimulationOutput;
}

export function TreasuryMetricGrid({ report }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Liquid Assets */}
      <div className="bg-card border border-border p-4 rounded-xl shadow-xs transition-all hover:border-primary/40">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-primary" />
            Ликвидные активы
          </span>
          <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary">
            100%
          </span>
        </div>
        <div className="text-xl font-bold font-mono text-foreground mt-2 tracking-tight">
          {Math.round(report.totalLiquidAssetsRub).toLocaleString('ru-RU')} ₽
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Альфа-Банк + Эквайринг + Провайдеры
        </p>
      </div>

      {/* 2. Customer Escrow Liability */}
      <div className="bg-card border border-destructive/30 p-4 rounded-xl shadow-xs bg-destructive/5 transition-all hover:border-destructive/60">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-destructive uppercase tracking-wider flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-destructive" />
            Клиентский Эскроу
          </span>
          <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-sm bg-destructive/15 text-destructive">
            Обязательство
          </span>
        </div>
        <div className="text-xl font-bold font-mono text-destructive mt-2 tracking-tight">
          {Math.round(report.customerRealDepositsRub).toLocaleString('ru-RU')} ₽
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Непотраченные балансы (подлежат возврату)
        </p>
      </div>

      {/* 3. Tax Reserve */}
      <div className="bg-card border border-amber-500/30 p-4 rounded-xl shadow-xs bg-amber-500/5 transition-all hover:border-amber-500/60">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
            <Landmark className="w-3.5 h-3.5 text-amber-500" />
            Налоговый резерв
          </span>
          <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-sm bg-amber-500/15 text-amber-500">
            УСН 6%
          </span>
        </div>
        <div className="text-xl font-bold font-mono text-amber-500 mt-2 tracking-tight">
          {Math.round(report.estimatedQuarterlyTaxDueRub).toLocaleString('ru-RU')} ₽
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Резерв налога (кассовый метод ст. 346.17)
        </p>
      </div>

      {/* 4. Bonus Credits */}
      <div className="bg-card border border-border p-4 rounded-xl shadow-xs transition-all hover:border-border/80">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
            Бонусные баллы
          </span>
          <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">
            0 ₽ долга
          </span>
        </div>
        <div className="text-xl font-bold font-mono text-muted-foreground mt-2 tracking-tight">
          {Math.round(report.customerBonusCreditsRub).toLocaleString('ru-RU')} ₽
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Невыводимые промо-баллы (не долг)
        </p>
      </div>
    </div>
  );
}
