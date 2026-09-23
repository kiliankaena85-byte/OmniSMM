'use client';

import React from 'react';
import { X } from 'lucide-react';
import { PublicService } from '@/actions/order/catalog';

interface StepWizardHeaderProps {
  service: PublicService;
  onClose: () => void;
}

export function StepWizardHeader({ service, onClose }: StepWizardHeaderProps) {
  return (
    <>
      {/* Mobile Drag Handle Pill */}
      <div className="pt-2.5 pb-1 flex justify-center sm:hidden shrink-0 cursor-grab active:cursor-grabbing">
        <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
      </div>

      {/* Top Wizard Header */}
      <div className="px-4 sm:px-5 py-2.5 sm:py-3 border-b border-border/80 bg-muted/20 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
            ID {service.numericId}
          </span>
          <span className="text-xs sm:text-sm font-black text-foreground truncate max-w-[240px] sm:max-w-[420px] min-w-0">
            {service.name}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-content2 hover:bg-content3 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer shrink-0"
          title="Закрыть"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </>
  );
}
