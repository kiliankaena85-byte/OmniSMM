'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export interface WizardStepMeta {
  num: number;
  title: string;
  desc: string;
}

interface WizardProgressProps {
  steps: WizardStepMeta[];
  currentStep: number;
  onStepClick: (step: 1 | 2 | 3 | 4) => void;
}

export function WizardProgress({ steps, currentStep, onStepClick }: WizardProgressProps) {
  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-card border border-border/80 shadow-sm">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {steps.map((s) => {
          const isCompleted = currentStep > s.num;
          const isCurrent = currentStep === s.num;

          return (
            <button
              key={s.num}
              type="button"
              disabled={s.num > currentStep}
              onClick={() => onStepClick(s.num as 1 | 2 | 3 | 4)}
              className={`flex items-center gap-3 p-3 min-h-[44px] rounded-2xl border text-left transition-all duration-200 ${
                isCurrent
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : isCompleted
                  ? 'bg-muted/40 text-foreground border-border hover:bg-muted cursor-pointer'
                  : 'bg-transparent text-muted-foreground border-transparent opacity-50 cursor-not-allowed'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                  isCurrent
                    ? 'bg-primary-foreground text-primary'
                    : isCompleted
                    ? 'bg-emerald-500/20 text-emerald-500'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : s.num}
              </div>
              <div className="truncate">
                <div className="text-xs font-black leading-tight tracking-tight">{s.title}</div>
                <div className="text-[11px] opacity-80 truncate">{s.desc}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
