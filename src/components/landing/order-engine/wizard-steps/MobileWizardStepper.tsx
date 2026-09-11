import React from "react";
import { Check } from "lucide-react";

interface MobileWizardStepperProps {
  currentStep: number;
  setActiveStep: (step: 1 | 2 | 3 | 4) => void;
  isLinkFilled: boolean;
  hasCategory: boolean;
  hasService: boolean;
}

const STEPS = [
  { step: 1 as const, label: "Ссылка" },
  { step: 2 as const, label: "Категория" },
  { step: 3 as const, label: "Тариф" },
  { step: 4 as const, label: "Оплата" },
];

export function MobileWizardStepper({
  currentStep,
  setActiveStep,
  isLinkFilled,
  hasCategory,
  hasService,
}: MobileWizardStepperProps) {
  const isStepClickable = (s: 1 | 2 | 3 | 4) => {
    if (s === 1) return true;
    if (s === 2) return isLinkFilled || hasCategory;
    if (s === 3) return hasCategory || hasService;
    if (s === 4) return hasService;
    return false;
  };

  const isStepCompleted = (s: 1 | 2 | 3 | 4) => {
    if (s === 1) return isLinkFilled;
    if (s === 2) return hasCategory;
    if (s === 3) return hasService;
    return false;
  };

  const progressPercent = Math.min(100, Math.max(15, ((currentStep) / 4) * 100));

  return (
    <div className="w-full flex flex-col gap-2.5 pb-2">
      {/* Progress Bar Line */}
      <div className="w-full h-1.5 bg-content3 rounded-full overflow-hidden relative">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Step Indicators */}
      <div className="grid grid-cols-4 gap-1">
        {STEPS.map(({ step, label }) => {
          const isActive = currentStep === step;
          const isCompleted = isStepCompleted(step) && currentStep > step;
          const clickable = isStepClickable(step);

          return (
            <button
              key={step}
              type="button"
              disabled={!clickable}
              onClick={() => {
                if (clickable) setActiveStep(step);
              }}
              className={`
                flex flex-col items-center justify-center gap-1 min-h-[44px] py-1 px-0.5 rounded-xl transition-all text-center
                ${clickable ? 'cursor-pointer active:scale-95' : 'cursor-default opacity-50'}
                ${isActive ? 'bg-primary/10 text-primary font-black' : isCompleted ? 'text-foreground font-bold' : 'text-muted-foreground font-medium'}
              `}
            >
              <div
                className={`
                  w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black transition-all shrink-0
                  ${isActive
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30 ring-2 ring-primary/20'
                    : isCompleted
                    ? 'bg-success/20 text-success-text'
                    : 'bg-content3 text-muted-foreground'
                  }
                `}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : step}
              </div>
              <span className="text-[10px] leading-none tracking-tight truncate max-w-full">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
