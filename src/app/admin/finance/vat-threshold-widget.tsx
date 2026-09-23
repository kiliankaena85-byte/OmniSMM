'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { ShieldCheck, AlertCircle, Info, Landmark } from 'lucide-react';

interface VatThresholdWidgetProps {
  annualRevenue: number; // in cents
  effectiveTaxRate: number;
  isVatThresholdExceeded: boolean;
}

export function VatThresholdWidget({
  annualRevenue,
  effectiveTaxRate,
  isVatThresholdExceeded,
}: VatThresholdWidgetProps) {
  const thresholdRub = 20000000;
  const annualRevenueRub = annualRevenue / 100;
  const progressPercent = Math.min(100, Math.max(0, (annualRevenueRub / thresholdRub) * 100));

  const fmt = (n: number) =>
    new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0,
    }).format(n);

  // Color matching based on progress
  let progressColor = 'bg-success';
  let textColor = 'text-success';
  if (progressPercent >= 80) {
    progressColor = 'bg-destructive animate-pulse';
    textColor = 'text-destructive';
  } else if (progressPercent >= 50) {
    progressColor = 'bg-warning';
    textColor = 'text-warning';
  }

  return (
    <Card className="rounded-2xl border border-border/60 shadow-xs bg-card/60 backdrop-blur-xl p-6 space-y-5 transition-all hover:border-border">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/20 text-primary rounded-xl border border-primary/30">
          <Landmark className="w-5 h-5" />
        </div>
        <div className="space-y-0.5">
          <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Порог НДС (УСН 2026)</h3>
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
            Лимит автоматического освобождения
          </p>
        </div>
      </div>

      {/* Progress Bar & Visual Info */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-bold text-foreground">
          <span>{fmt(annualRevenueRub)}</span>
          <span className={textColor}>{progressPercent.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-3 overflow-hidden border border-border/50">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${progressColor}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground font-bold">
          <span>Старт года</span>
          <span>Лимит: {fmt(thresholdRub)}</span>
        </div>
      </div>

      {/* Status Summary */}
      <div className="p-3.5 rounded-xl border border-border/50 bg-muted/30 space-y-2">
        <div className="flex items-center gap-2">
          {isVatThresholdExceeded ? (
            <AlertCircle className="w-4 h-4 text-warning" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-success" />
          )}
          <span className="text-xs font-bold text-foreground">
            Текущий статус: {isVatThresholdExceeded ? 'Лимит превышен' : 'НДС освобожден (0%)'}
          </span>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground font-medium">
          Текущая эффективная ставка налога на маржу составляет{' '}
          <strong className="text-foreground font-extrabold">{effectiveTaxRate.toFixed(1)}%</strong>.{' '}
          {isVatThresholdExceeded
            ? 'Вы обязаны применять специальную ставку НДС 5% на УСН.'
            : 'Вы автоматически освобождены от НДС, применяется только налог УСН.'}
        </p>
      </div>

      {/* Educational block */}
      <div className="text-[11px] leading-relaxed space-y-3 pt-2 text-muted-foreground border-t border-border/50 font-medium">
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p>
              При планируемых доходах <strong className="text-foreground font-bold">более 10 млн ₽ в год</strong>, ИП на УСН «Доходы» (6%) находится в максимально выгодном положении:
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>До 20 млн ₽ оборот полностью освобождается от уплаты НДС.</li>
              <li>При превышении 20 млн ₽ вы платите налог 6% + спецставку НДС 5% (итого 11% от выручки).</li>
            </ul>
            <p className="text-warning font-bold">
              Внимание: Выбирайте спецставку НДС 5% без вычетов! Стандартный НДС 22% с вычетами уничтожит маржинальность панели, так как оплаты зарубежным провайдерам в USDT не принимаются ФНС к налоговому зачету.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
