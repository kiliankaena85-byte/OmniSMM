'use client';
import React from 'react';
import { Sparkles, Zap } from 'lucide-react';
import { WizardTab } from './types';

interface WizardHeaderProps {
  activeTab: WizardTab;
  setActiveTab: (tab: WizardTab) => void;
}

export function WizardHeader({ activeTab, setActiveTab }: WizardHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/60 backdrop-blur-md p-5 rounded-3xl border border-border/60 shadow-sm">
      <div>
        <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
          <span>Оформление заказа</span>
          <span className="px-2.5 py-0.5 text-xs font-bold bg-primary/10 text-primary rounded-full">SMMplan</span>
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Выберите услугу пошагово или вставьте несколько ссылок сразу
        </p>
      </div>

      <div className="flex items-center gap-1.5 bg-muted/60 p-1.5 rounded-2xl border border-border/40 self-start md:self-auto">
        <button
          type="button"
          onClick={() => setActiveTab('wizard')}
          className={`px-4 py-2 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'wizard'
              ? 'bg-background text-foreground shadow-sm border border-border/50'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          Пошаговый выбор
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('multi')}
          className={`px-4 py-2 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'multi'
              ? 'bg-background text-foreground shadow-sm border border-border/50'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-500 shrink-0" />
          Быстрый ввод ссылок
        </button>
      </div>
    </div>
  );
}
