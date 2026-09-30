/**
 * (c) 2026 OmniSMM 1.0 — Synthesized by Google Stitch & Laya Engine.
 * Screen: SMM Console [Мобильный визард пополне] | Brand: SMMPLAN | Viewport: MOBILE (375px+)
 * Standard: React 19 (Server Actions), Tailwind CSS 4 & ExactMath BigInt.
 */

'use client';

import React, { useState } from 'react';

export interface SmmConsoleMobilnyyVizardPopolneProps {
  initialBalanceKopecks?: bigint;
  tenantId?: 'smmplan';
}

export function SmmConsoleMobilnyyVizardPopolne({ initialBalanceKopecks = 145000n, tenantId = 'smmplan' }: SmmConsoleMobilnyyVizardPopolneProps) {
  const [step, setStep] = useState<number>(1);
  const [quantity, setQuantity] = useState<number>(100);
  const [targetUrl, setTargetUrl] = useState<string>('');

  const formattedBalance = (Number(initialBalanceKopecks) / 100).toFixed(2);
  const unitRateKopecks = 18n; // 0.18 ₽ per unit in kopecks (ExactMath)
  const totalKopecks = BigInt(quantity) * unitRateKopecks;
  const totalPriceRub = (Number(totalKopecks) / 100).toFixed(2);

  return (
    <div className="w-full min-h-screen bg-background text-foreground flex flex-col min-w-0">
      {/* 56px Safe Area Header */}
      <header className="h-14 border-b border-border px-3 flex items-center justify-between text-xs tabular-nums pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2 font-bold tracking-wider">
          <span className="text-primary">●</span>
          <span>{tenantId.toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Баланс:</span>
          <span className="font-semibold text-primary">{formattedBalance} ₽</span>
        </div>
      </header>

      {/* Stepper Progress */}
      <div className="px-4 py-2 border-b border-border bg-muted/40 flex items-center justify-between text-xs">
        <span className={step >= 1 ? 'font-bold text-primary' : 'text-muted-foreground'}>1. Услуга</span>
        <span>→</span>
        <span className={step >= 2 ? 'font-bold text-primary' : 'text-muted-foreground'}>2. Ссылка</span>
        <span>→</span>
        <span className={step >= 3 ? 'font-bold text-primary' : 'text-muted-foreground'}>3. Оплата</span>
      </div>

      {/* Wizard Step Content */}
      <main className="flex-1 p-4 space-y-4 max-w-lg mx-auto w-full">
        <div className="border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Оформление заказа</h2>
            <span className="text-xs text-muted-foreground font-mono">Drip-Feed Safe</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-muted-foreground mb-1">Ссылка на канал/публикацию:</label>
              <input
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://t.me/channel"
                className="w-full min-h-[44px] px-3 border border-border bg-card rounded text-xs focus:ring-1 focus:ring-primary outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 tabular-nums">
              <div>
                <label className="block text-muted-foreground mb-1">Количество (мин. 10):</label>
                <input
                  type="number"
                  min={10}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(10, parseInt(e.target.value) || 10))}
                  className="w-full min-h-[44px] px-3 border border-border bg-card rounded text-xs"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">Итого (ExactMath):</label>
                <div className="h-[44px] px-3 border border-border rounded flex items-center font-bold text-primary">
                  {totalPriceRub} ₽
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded bg-muted/30 text-[11px] text-muted-foreground space-y-1">
              <div>• Тариф: Telegram Подписчики [0.18 ₽ / шт]</div>
              <div>• Drip-Feed Floor: ⌊Q/N⌋ ≥ 10 шт гарантировано</div>
              <div>• Фискализация: 54-ФЗ электронный чек</div>
            </div>
          </div>
        </div>
      </main>

      {/* Sticky Bottom Safe Area Action Bar */}
      <footer className="p-3 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
        <button
          type="button"
          onClick={() => setStep(prev => Math.min(3, prev + 1))}
          className="w-full min-h-[48px] bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:opacity-95 transition-opacity"
        >
          Запустить продвижение ({totalPriceRub} ₽)
        </button>
      </footer>
    </div>
  );
}