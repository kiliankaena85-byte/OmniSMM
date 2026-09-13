'use client';
import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { WizardStep } from './types';
import { PublicNetwork, PublicCategory, PublicService } from '@/actions/order/catalog';

interface WizardStepIndicatorProps {
  step: WizardStep;
  selectedNetwork: PublicNetwork | null;
  selectedCategory: PublicCategory | null;
  selectedService: PublicService | null;
  changeStep: (step: WizardStep) => void;
}

export function WizardStepIndicator({
  step,
  selectedNetwork,
  selectedCategory,
  selectedService,
  changeStep,
}: WizardStepIndicatorProps) {
  const steps: Array<{ num: WizardStep; label: string }> = [
    { num: 1, label: 'Соцсеть' },
    { num: 2, label: 'Категория' },
    { num: 3, label: 'Услуга' },
    { num: 4, label: 'Оплата' },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 bg-card/40 p-2 rounded-2xl border border-border/40">
      {steps.map(s => {
        const isActive = step === s.num;
        const isDone = step > s.num;
        const isDisabled = s.num > step && (!selectedNetwork || (s.num === 3 && !selectedCategory) || (s.num === 4 && !selectedService));
        return (
          <button
            key={s.num}
            type="button"
            disabled={isDisabled}
            onClick={() => changeStep(s.num)}
            className={`flex items-center justify-center md:justify-start gap-2.5 p-2.5 rounded-xl text-xs md:text-sm font-bold transition-all ${
              isActive
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]'
                : isDone
                ? 'bg-primary/10 text-primary hover:bg-primary/20'
                : 'text-muted-foreground hover:bg-muted/40 opacity-60'
            }`}
          >
            <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${
              isActive ? 'bg-white/20 text-foreground' : isDone ? 'bg-primary text-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.num}
            </span>
            <span className="hidden md:inline truncate min-w-0">{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}
