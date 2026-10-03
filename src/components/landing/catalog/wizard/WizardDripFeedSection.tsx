'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';

interface WizardDripFeedSectionProps {
  dripFeedEnabled: boolean;
  setDripFeedEnabled?: (enabled: boolean) => void;
  runs: number;
  setRuns?: (runs: number) => void;
  quantity: number;
  setQuantity: (qty: number) => void;
  parsedMin: number;
  isDripFeedValid: boolean;
}

export function WizardDripFeedSection({
  dripFeedEnabled,
  setDripFeedEnabled,
  runs,
  setRuns,
  quantity,
  setQuantity,
  parsedMin,
  isDripFeedValid,
}: WizardDripFeedSectionProps) {
  return (
    <div className="space-y-3 p-4 rounded-2xl bg-muted/30 border border-border/50">
      <label className="flex items-center justify-between cursor-pointer">
        <div>
          <div className="text-sm font-bold text-foreground">Плавное налитие (Drip-Feed)</div>
          <div className="text-xs text-muted-foreground">Растянуть выполнение заказа во времени</div>
        </div>
        <input
          type="checkbox"
          checked={dripFeedEnabled}
          onChange={(e) => {
            if (setDripFeedEnabled) setDripFeedEnabled(e.target.checked);
            if (e.target.checked && setRuns) {
              setRuns(2);
              if (quantity < parsedMin * 2) {
                setQuantity(parsedMin * 2);
              }
            } else if (setRuns) {
              setRuns(1);
            }
          }}
          className="w-4 h-4 rounded text-primary focus:ring-primary/40 bg-background border-border"
        />
      </label>

      {dripFeedEnabled && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="pt-2 border-t border-border/50 space-y-4"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Количество запусков (Runs):
              </label>
              <span className="font-mono font-black text-foreground text-sm">{runs}x</span>
            </div>
            <input
              type="range"
              min={2}
              max={20}
              step={1}
              value={runs}
              onChange={(e) => {
                const newRuns = Number(e.target.value);
                if (setRuns) setRuns(newRuns);
                if (quantity < parsedMin * newRuns) {
                  setQuantity(parsedMin * newRuns);
                }
              }}
              className="w-full accent-primary h-2 bg-muted rounded-lg cursor-pointer"
            />
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border text-sm">
            <span className="text-muted-foreground font-medium">Объем 1 запуска:</span>
            <span className="font-bold font-mono">{Math.floor(quantity / runs)} шт</span>
          </div>
          {!isDripFeedValid && (
            <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                Ошибка Drip-Feed Floor: объем за 1 запуск не может быть меньше минимального лимита ({parsedMin} шт). Общее количество должно быть не меньше {parsedMin * runs} шт.
              </span>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
