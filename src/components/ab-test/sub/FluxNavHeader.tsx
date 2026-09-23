'use client';

import React from "react";
import { ArrowLeftIcon } from "lucide-react";
import type { FluxNetwork } from "@/types/flux";

export type FluxStep = 'link' | 'network' | 'category' | 'service' | 'checkout';

interface FluxNavHeaderProps {
  step: FluxStep;
  link: string;
  activeNetwork: FluxNetwork | null;
  onNavigate: (step: FluxStep) => void;
}

export function FluxNavHeader({
  step,
  link,
  activeNetwork,
  onNavigate,
}: FluxNavHeaderProps) {
  if (step === 'link') return null;

  const handleBack = () => {
    if (step === 'checkout') onNavigate('service');
    else if (step === 'service') onNavigate('category');
    else if (step === 'category') onNavigate('network');
    else if (step === 'network') onNavigate('link');
  };

  return (
    <div className="w-full max-w-3xl mb-5 flex items-center bg-card/90 backdrop-blur-md border border-border/80 shadow-sm h-12 sm:h-14 rounded-2xl px-2 z-10 animate-in fade-in duration-200">
      <button
        type="button"
        onClick={handleBack}
        className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors mr-1.5 flex-shrink-0 cursor-pointer"
        title="Назад"
      >
        <ArrowLeftIcon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
      </button>
      <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
        {activeNetwork?.icon && (
          <img src={activeNetwork.icon} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
        )}
        <span className="text-xs sm:text-sm font-semibold text-foreground truncate min-w-0">
          {link || (activeNetwork?.name ? `${activeNetwork.name} (из каталога)` : "Без ссылки")}
        </span>
      </div>
    </div>
  );
}
