'use client';

import { Printer } from 'lucide-react';

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="w-full h-12 bg-sky-500 hover:bg-sky-400 text-primary-foreground font-bold uppercase tracking-wider text-xs rounded-xl shadow-lg shadow-sky-500/15 flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
    >
      <Printer className="w-4 h-4" />
      <span>Печать / Сохранить в PDF</span>
    </button>
  );
}
