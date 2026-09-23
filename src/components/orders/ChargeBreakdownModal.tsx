'use client';

import React, { useState } from 'react';
import { centsToRub } from '@/lib/money';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Info, Calculator, Percent, DollarSign, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChargeBreakdownModalProps {
  numericId: number;
  chargeCents: number | bigint;
  discountCents?: number | bigint;
  usdToRubRate?: number | null;
  trigger?: React.ReactElement;
  className?: string;
}

export function ChargeBreakdownModal({
  numericId,
  chargeCents,
  discountCents = 0,
  usdToRubRate,
  trigger,
  className,
}: ChargeBreakdownModalProps) {
  const [open, setOpen] = useState(false);

  const netCents = Number(chargeCents);
  const discount = Number(discountCents || 0);
  const grossCents = netCents + discount;

  const netRub = centsToRub(netCents);
  const grossRub = centsToRub(grossCents);
  const discountRub = centsToRub(discount);
  const rate = usdToRubRate || 90.0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger || (
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'text-muted-foreground/70 hover:text-primary transition-colors p-1 rounded-md hover:bg-muted/50 inline-flex items-center gap-1 cursor-pointer',
                className
              )}
              title="Детализация списания и курс ЦБ РФ"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <Receipt className="w-4 h-4 text-primary shrink-0" />
            Детализация списания #{numericId}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Полный расчёт стоимости заказа, применённые скидки и фиксированный курс ЦБ РФ.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="bg-muted/40 rounded-xl p-3.5 border border-border/50 space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                Базовая стоимость:
              </span>
              <span className="font-mono font-bold tabular-nums text-foreground">
                {grossRub.toLocaleString('ru-RU', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                ₽
              </span>
            </div>

            {discountRub > 0 && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-emerald-800 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-emerald-800 dark:text-emerald-400 shrink-0" />
                  Скидка:
                </span>
                <span className="font-mono font-bold tabular-nums text-emerald-800 dark:text-emerald-400">
                  -{' '}
                  {discountRub.toLocaleString('ru-RU', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  ₽
                </span>
              </div>
            )}

            <div className="border-t border-border/40 pt-2 flex justify-between items-center">
              <span className="text-xs font-bold text-foreground">Итого списано:</span>
              <span className="text-base font-black font-mono tabular-nums text-primary">
                {netRub.toLocaleString('ru-RU', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                ₽
              </span>
            </div>
          </div>

          <div className="bg-primary/5 rounded-xl p-3 border border-primary/20 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="w-4 h-4 text-primary shrink-0" />
              <span>Курс ЦБ РФ на момент заказа:</span>
            </div>
            <span className="font-mono font-bold text-foreground tabular-nums">
              {rate.toFixed(2)} ₽ / $
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
