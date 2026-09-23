'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface BalanceEquationCardProps {
  currentBalanceRub: number;
  parsedAmountRub: number;
  direction: 'CREDIT' | 'DEBIT';
  projectedBalanceRub: number;
  isOverdraft: boolean;
}

export function BalanceEquationCard({
  currentBalanceRub,
  parsedAmountRub,
  direction,
  projectedBalanceRub,
  isOverdraft,
}: BalanceEquationCardProps) {
  if (parsedAmountRub <= 0) return null;

  return (
    <div
      className={`p-4 rounded-2xl border transition-all ${
        isOverdraft
          ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400'
          : 'bg-muted/40 border-border/60 text-foreground'
      }`}
    >
      <div className="grid grid-cols-3 gap-2 items-center text-center font-mono">
        <div className="p-2.5 rounded-xl bg-background/40 border border-border/40">
          <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-0.5">
            Было
          </span>
          <span className="font-bold text-base">
            {currentBalanceRub.toFixed(2)} ₽
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-background/40 border border-border/40">
          <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-0.5">
            Операция
          </span>
          <span
            className={`font-black text-lg ${
              direction === 'CREDIT'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {direction === 'CREDIT' ? '+' : '−'}
            {parsedAmountRub.toFixed(2)} ₽
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-background/70 border border-border/60 shadow-xs">
          <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-0.5">
            Станет
          </span>
          <span
            className={`font-black text-xl ${
              isOverdraft ? 'text-rose-600' : 'text-primary'
            }`}
          >
            {projectedBalanceRub.toFixed(2)} ₽
          </span>
        </div>
      </div>
      {isOverdraft && (
        <p className="text-xs font-bold text-rose-600 mt-2.5 flex items-center justify-center gap-1.5">
          <AlertTriangle className="w-4 h-4" /> Внимание: списание превышает
          текущий баланс клиента!
        </p>
      )}
    </div>
  );
}
