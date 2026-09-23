'use client';

/**
 * Floating Action Button (FAB) Trigger for Admin AI Manual
 */

import React from 'react';
import { Sparkles, BookOpen } from 'lucide-react';

interface ManualFloatingTriggerProps {
  isOpen: boolean;
  onToggle: () => void;
  hasUnreadOrAlert?: boolean;
}

export const ManualFloatingTrigger: React.FC<ManualFloatingTriggerProps> = ({
  isOpen,
  onToggle,
  hasUnreadOrAlert = false,
}) => {
  if (isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 group">
      {/* Keyboard Shortcut Tooltip */}
      <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-background/90 backdrop-blur-md border border-border/80 shadow-md text-[11px] font-medium text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none">
        <BookOpen className="w-3 h-3 text-primary" />
        <span>ИИ-Инструктор</span>
        <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono border border-border">Ctrl + /</kbd>
      </div>

      {/* Main Trigger Button */}
      <button
        type="button"
        onClick={onToggle}
        aria-label="Открыть интерактивную инструкцию и ИИ-консультант"
        className="relative flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-tr from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2"
      >
        <Sparkles className="w-5 h-5 animate-pulse" />

        {/* Pulse Ring */}
        <span className="absolute -inset-0.5 rounded-full bg-primary/30 animate-ping pointer-events-none opacity-60" />

        {/* Status indicator dot */}
        {hasUnreadOrAlert && (
          <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-amber-500 border-2 border-background" />
        )}
      </button>
    </div>
  );
};
