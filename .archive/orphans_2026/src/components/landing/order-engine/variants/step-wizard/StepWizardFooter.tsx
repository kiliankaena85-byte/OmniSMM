'use client';

import React from 'react';
import { ArrowLeft, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';

interface StepWizardFooterProps {
  step: 1 | 2 | 3;
  setStep: (step: 1 | 2 | 3 | ((s: 1 | 2 | 3) => 1 | 2 | 3)) => void;
  formattedTotal: string;
  url: string;
  isSubmitting?: boolean;
  isCalculating?: boolean;
  gateway: 'yookassa' | 'cryptobot' | 'balance';
  onNextStep: () => void;
  onSubmit: () => void;
}

export function StepWizardFooter({
  step,
  setStep,
  formattedTotal,
  isSubmitting,
  isCalculating,
  gateway,
  onNextStep,
  onSubmit,
}: StepWizardFooterProps) {
  const steps = [
    { num: 1, title: 'Количество' },
    { num: 2, title: 'Данные' },
    { num: 3, title: 'Оплата' },
  ];

  const getButtonText = () => {
    if (isSubmitting) return 'Секунду...';
    if (gateway === 'cryptobot') return 'Оплатить CryptoBot';
    if (gateway === 'balance') return 'Оплатить балансом';
    return 'Оплатить картой РФ / СБП';
  };

  return (
    <div className="border-t border-border/80 bg-muted/10 px-4 sm:px-5 pt-3 pb-6 sm:pb-3.5 shrink-0 flex items-center justify-between">
      <div>
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">
          Итого к оплате
        </span>
        <p className="text-xl sm:text-2xl font-black text-foreground tabular-nums font-mono">
          {formattedTotal} <span className="text-primary text-lg sm:text-xl">₽</span>
        </p>
      </div>

      <div className="flex items-center gap-2">
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
            className="min-h-[44px] h-11 px-3 sm:px-4 rounded-xl bg-content2 hover:bg-content3 border border-border text-foreground font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span className="hidden xs:inline">Назад</span>
          </button>
        )}

        {step < 3 ? (
          <button
            type="button"
            onClick={onNextStep}
            className="min-h-[44px] h-11 px-4 sm:px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
          >
            <span>Далее: {steps[step]?.title}</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting || isCalculating}
            className="min-h-[44px] h-11 px-4 sm:px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <ShieldCheck className="w-4.5 h-4.5" />
                <span>{getButtonText()}</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
