'use client';

import React from "react";
import { LinkIcon, ArrowLeftIcon, X } from "lucide-react";
import type { PublicNetwork } from "@/actions/order/catalog";
import type { Step } from "./types";

export interface SlideNavHeaderProps {
  step: Step;
  activeNetwork: PublicNetwork | null;
  link: string;
  enteredViaCatalog: boolean;
  onNavigateBack: () => void;
  onReset: () => void;
}

export function SlideNavHeader({
  step,
  activeNetwork,
  link,
  enteredViaCatalog,
  onNavigateBack,
  onReset,
}: SlideNavHeaderProps) {
  if (step === 'link') return null;

  return (
    <div className="w-full max-w-3xl mb-5 flex items-center bg-card/90 backdrop-blur-md border border-border/80 shadow-sm h-12 sm:h-14 rounded-2xl px-2 z-10 animate-in fade-in duration-200">
      <button
        type="button"
        onClick={onNavigateBack}
        className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors mr-1.5 flex-shrink-0 cursor-pointer"
        title="Назад"
      >
        <ArrowLeftIcon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
      </button>

      <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
        {activeNetwork?.icon && (
          <img src={activeNetwork.icon} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
        )}
        <LinkIcon className="text-muted-foreground w-3.5 h-3.5 flex-shrink-0" />
        <span className="text-xs sm:text-sm font-semibold text-foreground truncate min-w-0">
          {link || (activeNetwork?.name ? `${activeNetwork.name} (из каталога)` : "Без ссылки")}
        </span>
      </div>

      <button 
        type="button"
        onClick={onReset}
        className="h-8 px-2.5 flex items-center gap-1 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors cursor-pointer flex-shrink-0"
        title="Сбросить и ввести новую ссылку"
      >
        <X className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Сброс</span>
      </button>
    </div>
  );
}
