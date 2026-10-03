'use client';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useState } from "react";

interface DripFeedProps {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  runs: number;
  setRuns: (v: number) => void;
  interval: number;
  setInterval: (v: number) => void;
}

export function DripFeedSettings({
  enabled, setEnabled, runs, setRuns, interval, setInterval
}: DripFeedProps) {
  if (!enabled) {
    return (
      <button 
        type="button" 
        onClick={() => setEnabled(true)}
        aria-label="Добавить Drip-feed (Плавная продвижение)"
        className="w-full sm:w-auto h-11 flex items-center justify-center text-sm font-medium text-success-text hover:bg-success/20 bg-success/10 px-4 rounded-xl border border-success/20"
      >
        + Добавить Drip-feed (Плавная продвижение)
      </button>
    );
  }

  return (
    <div className="bg-content2 border border-border rounded-xl p-4 mt-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium text-sm text-foreground">Настройки Drip-feed</h3>
        <button 
          type="button"
          onClick={() => setEnabled(false)}
          aria-label="Удалить Drip-feed"
          className="text-xs text-muted-foreground hover:text-destructive h-11 flex items-center px-3 -mr-3"
        >
          Удалить
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="drip-runs-input" className="block text-xs font-medium text-foreground mb-1">Количество запусков (Runs)</label>
          <input 
            id="drip-runs-input"
            type="number" 
            min={2}
            value={runs}
            onChange={(e) => setRuns(Number(e.target.value))}
            aria-label="Количество запусков (Runs)"
            className="w-full h-11 rounded-lg border border-border px-3 text-base sm:text-sm bg-background text-foreground"
          />
        </div>
        <div>
          <label htmlFor="drip-interval-input" className="block text-xs font-medium text-foreground mb-1">Интервал (в минутах)</label>
          <input 
            id="drip-interval-input"
            type="number" 
            min={5}
            value={interval}
            onChange={(e) => setInterval(Number(e.target.value))}
            aria-label="Интервал (в минутах)"
            className="w-full h-11 rounded-lg border border-border px-3 text-base sm:text-sm bg-background text-foreground"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Заказ будет разбит на {runs} частей. Запуски каждые {interval} минут.
      </p>
    </div>
  );
}
