# Example: Synthesized React 19 Component

This example demonstrates how a Stitch-generated UI card is synthesized into an idiomatic, strictly typed React 19 component adhering to the $\le 200$-line limit.

```tsx
// src/components/dashboard/FluxDepositCard.tsx
'use client';

import React, { useState } from 'react';
import { Copy, Check, QrCode } from 'lucide-react';

interface FluxDepositCardProps {
  walletAddress: string;
  network: string;
  currency: string;
  minDeposit: string;
}

export function FluxDepositCard({
  walletAddress,
  network,
  currency,
  minDeposit
}: FluxDepositCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 p-5 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
            {currency}
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Пополнение баланса</h3>
            <p className="text-xs text-slate-500">Сеть: {network}</p>
          </div>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50">
          Мин: {minDeposit}
        </span>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row items-center gap-4">
        <div className="w-24 h-24 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center shrink-0">
          <QrCode className="w-16 h-16 text-slate-800 dark:text-slate-200" />
        </div>

        <div className="w-full min-w-0 flex flex-col gap-2">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Адрес кошелька
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={walletAddress}
              className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-zinc-800/70 border border-slate-200 dark:border-zinc-700 text-xs font-mono text-slate-800 dark:text-slate-200 select-all focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="h-10 px-3.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-800 transition-colors shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Скопировано' : 'Копировать'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```
