'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface StepWizardStepperProps {
  step: 1 | 2 | 3;
  setStep: (step: 1 | 2 | 3) => void;
  quantity: number;
  url: string;
}

export function StepWizardStepper({ step, setStep, quantity, url }: StepWizardStepperProps) {
  const steps = [
    { num: 1, title: 'Количество', desc: 'Объем заказа' },
    { num: 2, title: 'Данные', desc: 'Ссылка и Email' },
    { num: 3, title: 'Оплата', desc: 'Шлюз и оплата' },
  ];

  return (
    <div className="grid grid-cols-3 border-b border-border/60 bg-muted/10 shrink-0">
      {steps.map((s) => {
        const isActive = step === s.num;
        const isPassed = step > s.num;
        return (
          <button
            key={s.num}
            type="button"
            onClick={() => {
              if (isPassed || (s.num === 2 && quantity > 0) || (s.num === 3 && quantity > 0 && url)) {
                setStep(s.num as 1 | 2 | 3);
              }
            }}
            className={`py-2.5 px-2 sm:px-4 text-left transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              isActive
                ? 'border-primary bg-primary/5 text-primary'
                : isPassed
                ? 'border-emerald-500/60 text-foreground hover:bg-muted/40'
                : 'border-transparent text-muted-foreground/60 hover:text-muted-foreground'
            }`}
          >
            <div
              className={`w-5.5 h-5.5 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 transition-all ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : isPassed
                  ? 'bg-emerald-500 text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {isPassed ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.num}
            </div>
            <div className="hidden sm:block min-w-0">
              <p
                className={`text-xs font-black leading-tight truncate ${
                  isActive ? 'text-primary' : 'text-foreground'
                }`}
              >
                {s.title}
              </p>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5 truncate">
                {s.desc}
              </p>
            </div>
            <span className="sm:hidden text-[11px] font-bold text-foreground truncate">
              {s.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}
