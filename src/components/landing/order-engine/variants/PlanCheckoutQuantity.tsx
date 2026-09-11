'use client';

import React from 'react';
import { PublicService } from '@/actions/order/catalog';

export interface PlanCheckoutQuantityProps {
  quantity: number;
  setQuantity: (qty: number) => void;
  quantityInputRef: React.RefObject<HTMLInputElement | null>;
  minQty: number;
  maxQty: number;
  effectiveMinQty: number;
  handleStepQuantity: (delta: number) => void;
  selectedService: PublicService;
  dripFeedEnabled: boolean;
  setDripFeedEnabled: (val: boolean) => void;
  runs: number;
  setRuns: (r: number) => void;
  dripInterval: number;
  setDripInterval: (i: number) => void;
  setLocalError: (err: string | null) => void;
}

export function PlanCheckoutQuantity({
  quantity,
  setQuantity,
  quantityInputRef,
  minQty,
  maxQty,
  effectiveMinQty,
  handleStepQuantity,
  selectedService,
  dripFeedEnabled,
  setDripFeedEnabled,
  runs,
  setRuns,
  dripInterval,
  setDripInterval,
  setLocalError,
}: PlanCheckoutQuantityProps) {
  return (
    <div id="field-quantity" className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-black text-foreground uppercase tracking-wider">
          Количество
          <span className="text-destructive font-bold ml-1">*</span>
        </label>
        <span className="text-[11px] text-muted-foreground font-mono">
          Лимиты: {minQty} – {maxQty.toLocaleString('ru-RU')} шт.
        </span>
      </div>

      {/* Stepper Input */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => handleStepQuantity(-100)}
          className="w-12 h-12 rounded-2xl bg-muted/70 hover:bg-muted text-foreground font-bold text-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0"
          title="Уменьшить на 100"
        >
          –
        </button>

        <input
          ref={quantityInputRef}
          type="number"
          min={effectiveMinQty}
          max={maxQty}
          value={quantity}
          onChange={(e) => {
            setQuantity(parseInt(e.target.value) || 0);
            setLocalError(null);
          }}
          className="flex-1 h-12 px-3.5 rounded-2xl bg-background border border-border/80 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none font-black text-base text-foreground font-mono text-center transition-all"
        />

        <button
          type="button"
          onClick={() => handleStepQuantity(100)}
          className="w-12 h-12 rounded-2xl bg-muted/70 hover:bg-muted text-foreground font-bold text-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0"
          title="Увеличить на 100"
        >
          +
        </button>
      </div>

      {/* Drip-Feed Options */}
      {selectedService.isDripFeedEnabled && (
        <div className="mt-3 p-3.5 rounded-2xl bg-muted/30 border border-border/60">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={dripFeedEnabled}
              onChange={(e) => {
                const checked = e.target.checked;
                setDripFeedEnabled(checked);
                if (checked && Number(quantity) < minQty * runs) {
                  setQuantity(minQty * runs);
                }
                setLocalError(null);
              }}
              className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
            />
            <span className="text-xs font-bold text-foreground">
              Постепенный запуск (Drip-Feed)
            </span>
          </label>

          {dripFeedEnabled && (
            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border/40 text-xs">
              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Запусков ({runs})
                </label>
                <input
                  type="number"
                  min={2}
                  max={100}
                  value={runs}
                  onChange={(e) => {
                    const r = Math.max(2, parseInt(e.target.value) || 2);
                    setRuns(r);
                    if (Number(quantity) < minQty * r) {
                      setQuantity(minQty * r);
                    }
                  }}
                  className="w-full h-10 px-3 rounded-xl bg-background border border-border font-mono text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-muted-foreground font-medium mb-1">
                  Интервал (мин)
                </label>
                <input
                  type="number"
                  min={10}
                  max={1440}
                  value={dripInterval}
                  onChange={(e) => setDripInterval(Math.max(10, parseInt(e.target.value) || 60))}
                  className="w-full h-10 px-3 rounded-xl bg-background border border-border font-mono text-xs font-bold"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
