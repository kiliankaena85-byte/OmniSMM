'use client';

import React from 'react';
import { ChevronRight, CheckCircle2 } from 'lucide-react';

interface WizardStepIndicatorProps {
  currentStep: 1 | 2 | 3 | 4;
  onStepClick: (step: 1 | 2 | 3 | 4) => void;
  selectedNetworkName?: string;
  selectedCategoryName?: string;
  selectedServiceName?: string;
}

export function WizardStepIndicator({
  currentStep,
  onStepClick,
  selectedNetworkName,
  selectedCategoryName,
  selectedServiceName,
}: WizardStepIndicatorProps) {
  const steps = [
    { number: 1, label: selectedNetworkName || 'Соцсеть' },
    { number: 2, label: selectedCategoryName || 'Категория' },
    { number: 3, label: selectedServiceName ? 'Тариф' : 'Услуга' },
    { number: 4, label: 'Оформление' },
  ] as const;

  return (
    <nav aria-label="Шаги оформления заказа" className="w-full bg-card/60 backdrop-blur-xl border border-border/30 rounded-2xl p-2.5 sm:p-3 shadow-sm mb-6 flex items-center justify-between overflow-x-auto scrollbar-none">
      <div className="flex items-center gap-1 sm:gap-2 min-w-max mx-auto">
        {steps.map((step, idx) => {
          const isDone = currentStep > step.number;
          const isActive = currentStep === step.number;
          const isClickable = isDone;

          return (
            <React.Fragment key={step.number}>
              <button
                type="button"
                disabled={!isClickable}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`Шаг ${step.number}: ${step.label}${isActive ? ' (текущий шаг)' : isDone ? ' (завершено)' : ''}`}
                onClick={() => isClickable && onStepClick(step.number)}
                className={`flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]'
                    : isDone
                    ? 'bg-muted/80 text-foreground hover:bg-muted cursor-pointer'
                    : 'text-muted-foreground/60 cursor-not-allowed opacity-60'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                    isActive
                      ? 'bg-primary-foreground text-primary'
                      : isDone
                      ? 'bg-emerald-500 text-white'
                      : 'bg-muted-foreground/20 text-muted-foreground'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : step.number}
                </div>
                <span className="truncate max-w-[110px] sm:max-w-[140px]">{step.label}</span>
              </button>

              {idx < steps.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 mx-0.5" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
}
