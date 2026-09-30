'use client';

import React, { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';

export interface AffiliateReferralHubProps {
  initialTitle?: string;
  className?: string;
  onActionComplete?: (data: { success: boolean }) => void;
}

export function AffiliateReferralHub({
  initialTitle = 'SMMflux Service',
  className = '',
  onActionComplete
}: AffiliateReferralHubProps) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<string>('all');

  const handlePrimaryAction = () => {
    startTransition(async () => {
      // Action callback conforming to OmniSMM standard { success, error }
      onActionComplete?.({ success: true });
    });
  };

  return (
    <div className={`w-full max-w-4xl mx-auto p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 shadow-sm flex flex-col gap-4 ${className}`}>
      <header className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">{initialTitle}</h3>
        <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/50">
          React 19 Synthesized
        </span>
      </header>

      <div className="flex flex-col gap-3">
        {/* Real-time Metrics HUD (hud) */}
        <section className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/80">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Real-time Metrics HUD</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">Section type: hud</p>
        </section>

        {/* Transactional Action Panel (wizard) */}
        <section className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/80">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Transactional Action Panel</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">Section type: wizard</p>
        </section>
      </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={handlePrimaryAction}
            className="w-full h-12 bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Подтвердить действие →</span>}
          </button>
        </div>
    </div>
  );
}
