import React from 'react';
import Link from 'next/link';
import { Receipt, Printer, Wallet } from 'lucide-react';

interface FluxTransactionsHeaderProps {
  onPrint: () => void;
}

export function FluxTransactionsHeader({ onPrint }: FluxTransactionsHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-wider mb-2 print:hidden">
          <Receipt className="w-3.5 h-3.5" />
          Прозрачная бухгалтерия
        </div>
        <h1 className="text-3xl font-black tracking-tight">Финансовый журнал</h1>
        <p className="text-sm text-muted-foreground mt-1 font-medium">
          Детализированный аудит баланса: сколько внесено, потрачено и возвращено.
        </p>
      </div>

      <div className="flex items-center gap-2 self-start sm:self-auto print:hidden">
        <button
          onClick={onPrint}
          className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-2xl bg-card border border-border/80 text-foreground font-bold text-sm hover:bg-muted/50 transition-all cursor-pointer shadow-sm"
          title="Распечатать или сохранить выписку в PDF"
        >
          <Printer className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">Печать выписки</span>
        </button>

        <Link
          href="/dashboard/add-funds"
          className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-2xl bg-primary text-primary-foreground font-black text-sm shadow-md hover:opacity-90 active:scale-95 transition-all"
        >
          <Wallet className="w-4 h-4 shrink-0" />
          <span>Пополнить</span>
        </Link>
      </div>
    </div>
  );
}
