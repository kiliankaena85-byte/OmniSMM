'use client';

import React from 'react';
import { RefreshCw, SlidersHorizontal, ArrowRight } from 'lucide-react';

interface Props {
  bankRub: number;
  gatewayRub: number;
  bankSource: 'ALFA_BANK_API' | 'MANUAL_ENTRY';
  isPending: boolean;
  onBankChange: (val: number) => void;
  onGatewayChange: (val: number) => void;
  onRecalculate: () => void;
}

export function ReconciliationController({
  bankRub,
  gatewayRub,
  bankSource,
  isPending,
  onBankChange,
  onGatewayChange,
  onRecalculate,
}: Props) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-primary" />
          Сверка фактических остатков
        </h3>
        <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
          Симулятор ликвидности
        </span>
      </div>

      <div className="space-y-3.5">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-muted-foreground">
              Остаток на р/с Альфа-Банка (₽)
            </label>
            <span
              className={`text-[10px] font-medium px-1.5 py-0.2 rounded-sm ${
                bankSource === 'ALFA_BANK_API'
                  ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {bankSource === 'ALFA_BANK_API' ? '● Авто-API' : 'Ручной ввод'}
            </span>
          </div>
          <input
            type="number"
            value={bankRub}
            onChange={(e) => onBankChange(Number(e.target.value))}
            className="w-full text-xs font-mono bg-muted/30 border border-border rounded-lg p-2.5 text-foreground focus:outline-hidden focus:border-primary transition-colors"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1.5">
            Средства в транзите эквайринга (ЮKassa / Robokassa) (₽)
          </label>
          <input
            type="number"
            value={gatewayRub}
            onChange={(e) => onGatewayChange(Number(e.target.value))}
            className="w-full text-xs font-mono bg-muted/30 border border-border rounded-lg p-2.5 text-foreground focus:outline-hidden focus:border-primary transition-colors"
          />
        </div>

        <button
          onClick={onRecalculate}
          disabled={isPending}
          className="w-full bg-primary text-primary-foreground font-medium text-xs py-2.5 rounded-lg shadow-xs hover:bg-primary/90 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
          {isPending ? 'Расчет модели...' : 'Пересчитать финансовое здоровье'}
        </button>
      </div>

      <div className="text-[11px] text-muted-foreground pt-2 border-t border-border/80 flex items-center gap-1.5">
        <ArrowRight className="w-3 h-3 text-primary shrink-0" />
        <span>Изменение параметров мгновенно моделирует стресс-тест баланса.</span>
      </div>
    </div>
  );
}
