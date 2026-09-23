'use client';

import React from 'react';
import { TreasurySimulationOutput } from '@/services/ai/harnesses/customer-liability-treasury.harness';

interface Props {
  report: TreasurySimulationOutput;
}

export function LiquidityWaterfallBar({ report }: Props) {
  const totalAssets = Math.max(report.totalLiquidAssetsRub, 1);
  const escrowLiability = Math.min(report.customerRealDepositsRub, totalAssets);
  const taxReserve = Math.min(report.estimatedQuarterlyTaxDueRub, totalAssets - escrowLiability);
  const safeDraw = Math.max(0, report.safeOwnerDrawCapacityRub);

  const escrowPercent = Math.max(0, Math.min(100, (escrowLiability / totalAssets) * 100));
  const taxPercent = Math.max(0, Math.min(100, (taxReserve / totalAssets) * 100));
  const safeDrawPercent = Math.max(0, Math.min(100, (safeDraw / totalAssets) * 100));
  const safetyBufferPercent = Math.max(0, 100 - (escrowPercent + taxPercent + safeDrawPercent));

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Водопад распределения ликвидности (Liquidity Waterfall)
        </span>
        <span className="text-xs font-mono font-medium text-foreground">
          Всего активов: {Math.round(report.totalLiquidAssetsRub).toLocaleString('ru-RU')} ₽
        </span>
      </div>

      {/* Multi-segment Progress Bar */}
      <div className="h-3 w-full bg-muted/40 rounded-full overflow-hidden flex shadow-inner">
        {/* Customer Escrow Liability (Red) */}
        {escrowPercent > 0 && (
          <div
            style={{ width: `${escrowPercent}%` }}
            className="h-full bg-destructive/80 transition-all duration-300 hover:opacity-90"
            title={`Эскроу клиентов: ${Math.round(escrowLiability).toLocaleString('ru-RU')} ₽ (${escrowPercent.toFixed(1)}%)`}
          />
        )}
        {/* Tax Reserve (Amber) */}
        {taxPercent > 0 && (
          <div
            style={{ width: `${taxPercent}%` }}
            className="h-full bg-amber-500/80 transition-all duration-300 hover:opacity-90"
            title={`Налоговый резерв УСН: ${Math.round(taxReserve).toLocaleString('ru-RU')} ₽ (${taxPercent.toFixed(1)}%)`}
          />
        )}
        {/* Safety Buffer (Slate/Blue) */}
        {safetyBufferPercent > 0 && (
          <div
            style={{ width: `${safetyBufferPercent}%` }}
            className="h-full bg-sky-500/60 transition-all duration-300 hover:opacity-90"
            title={`Буфер кассового разрыва: ${safetyBufferPercent.toFixed(1)}%`}
          />
        )}
        {/* Safe Owner Draw (Emerald) */}
        {safeDrawPercent > 0 && (
          <div
            style={{ width: `${safeDrawPercent}%` }}
            className="h-full bg-emerald-500 transition-all duration-300 hover:opacity-90"
            title={`Свободная чистая прибыль: ${Math.round(safeDraw).toLocaleString('ru-RU')} ₽ (${safeDrawPercent.toFixed(1)}%)`}
          />
        )}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-destructive/80 shrink-0" />
          <span className="text-muted-foreground truncate">
            Эскроу: <strong className="font-mono text-foreground">{escrowPercent.toFixed(0)}%</strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80 shrink-0" />
          <span className="text-muted-foreground truncate">
            Налоги УСН: <strong className="font-mono text-foreground">{taxPercent.toFixed(0)}%</strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-sky-500/60 shrink-0" />
          <span className="text-muted-foreground truncate">
            Буфер: <strong className="font-mono text-foreground">{safetyBufferPercent.toFixed(0)}%</strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-muted-foreground truncate">
            Чистая прибыль: <strong className="font-mono text-emerald-500">{safeDrawPercent.toFixed(0)}%</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
