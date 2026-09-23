'use client';

import React from 'react';
import { ChevronRight, Wallet } from 'lucide-react';
import type { Step } from '../wizard-steps/types';
import type { FluxNetwork, FluxCategory, FluxService } from '@/types/flux';

interface FluxWizardStepBarProps {
  step: Step;
  activeNetwork: FluxNetwork | null;
  activeCategory: FluxCategory | null;
  selectedService: FluxService | null;
  userBalanceCents?: number;
  userBalanceRub: string;
  onNavigateTo: (step: Step) => void;
}

export function FluxWizardStepBar({
  step,
  activeNetwork,
  activeCategory,
  selectedService,
  userBalanceCents = 0,
  userBalanceRub,
  onNavigateTo,
}: FluxWizardStepBarProps) {
  return (
    <div className="flex items-center justify-between gap-4 pb-2 border-b border-border/30">
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => onNavigateTo('network')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${
            step === 'network'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : activeNetwork
              ? 'bg-muted/70 text-foreground hover:bg-muted'
              : 'text-muted-foreground opacity-50'
          }`}
        >
          1. {activeNetwork ? activeNetwork.name : 'Соцсеть'}
        </button>

        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />

        <button
          type="button"
          disabled={!activeNetwork}
          onClick={() => activeNetwork && onNavigateTo('category')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${
            step === 'category'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : activeCategory
              ? 'bg-muted/70 text-foreground hover:bg-muted'
              : 'text-muted-foreground opacity-50'
          }`}
        >
          2. {activeCategory ? activeCategory.name : 'Категория'}
        </button>

        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />

        <button
          type="button"
          disabled={!activeCategory}
          onClick={() => activeCategory && onNavigateTo('service')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${
            step === 'service'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : selectedService
              ? 'bg-muted/70 text-foreground hover:bg-muted'
              : 'text-muted-foreground opacity-50'
          }`}
        >
          3. {selectedService ? 'Тариф выбран' : 'Тариф'}
        </button>

        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />

        <button
          type="button"
          disabled={!selectedService}
          onClick={() => selectedService && onNavigateTo('checkout')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${
            step === 'checkout'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground opacity-50'
          }`}
        >
          4. Оформление
        </button>
      </div>

      {userBalanceCents > 0 && (
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-600 dark:text-emerald-400 text-xs font-extrabold tabular-nums font-mono">
          <Wallet className="w-3.5 h-3.5" />
          <span>Баланс: {userBalanceRub} ₽</span>
        </div>
      )}
    </div>
  );
}
