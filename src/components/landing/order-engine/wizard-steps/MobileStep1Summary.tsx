import React from "react";
import { Link2, ChevronDown } from "lucide-react";

interface MobileStep1SummaryProps {
  url: string;
  setActiveStep: (step: 1 | 2 | 3 | 4) => void;
  step1Ref?: React.RefObject<HTMLDivElement | null>;
}

export function MobileStep1Summary({ url, setActiveStep, step1Ref }: MobileStep1SummaryProps) {
  if (url.trim().length >= 5) {
    return (
      <div ref={step1Ref} className="scroll-mt-20">
        <button
          type="button"
          onClick={() => setActiveStep(1)}
          className="w-full text-left p-3 bg-content2 hover:bg-content3 border border-border/40 rounded-2xl flex items-center justify-between transition-all cursor-pointer active:scale-[0.99]"
        >
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[10px] text-muted-foreground uppercase font-extrabold tracking-wider">1. Ссылка на канал / пост</span>
            <span className="text-xs font-bold text-foreground truncate font-mono">
              {url}
            </span>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 rotate-90" />
        </button>
      </div>
    );
  }

  return (
    <div ref={step1Ref} className="scroll-mt-20">
      <button
        type="button"
        onClick={() => setActiveStep(1)}
        className="w-full text-left p-3 bg-primary/5 hover:bg-primary/10 border border-dashed border-primary/40 rounded-2xl flex items-center justify-between transition-all cursor-pointer active:scale-[0.99]"
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[10px] text-primary uppercase font-extrabold tracking-wider">1. Ссылка на канал / пост</span>
          <span className="text-xs font-bold text-foreground truncate flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Укажите ссылку для заказа</span>
          </span>
        </div>
        <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg shrink-0">
          Ввести →
        </span>
      </button>
    </div>
  );
}
