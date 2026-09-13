'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LayoutGrid, ListOrdered, Link2, Sparkles } from 'lucide-react';
import { FullscreenMasterCatalog } from './FullscreenMasterCatalog';
import { StepByStepWizard } from './StepByStepWizard';

export function DualModeOrderEngine() {
  const [activeMode, setActiveMode] = useState<'catalog' | 'wizard'>('catalog');
  const [smartUrl, setSmartUrl] = useState('');

  return (
    <section className="w-full py-8 sm:py-12 space-y-8">
      {/* ── Smart Link Input Top Bar ── */}
      <div className="w-full max-w-4xl mx-auto p-2 sm:p-2.5 rounded-3xl bg-card border border-border/80 shadow-md shadow-primary/5 flex flex-col sm:flex-row items-center gap-2">
        <div className="flex-1 flex items-center gap-3 px-4 py-2 w-full">
          <Link2 className="w-5 h-5 text-primary shrink-0" />
          <input
            type="text"
            value={smartUrl}
            onChange={(e) => setSmartUrl(e.target.value)}
            placeholder="Вставьте ссылку: t.me/..., vk.com/..., instagram.com/..."
            className="w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>

        <button
          type="button"
          className="w-full sm:w-auto px-6 py-3 min-h-[44px] rounded-2xl bg-primary text-primary-foreground font-bold text-xs sm:text-sm shadow-sm shadow-primary/20 hover:opacity-95 active:scale-98 transition-all shrink-0 flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>Подобрать тариф</span>
        </button>
      </div>

      {/* ── A/B Mode Toggle Segmented Control ── */}
      <div className="flex items-center justify-center">
        <div className="p-1 rounded-2xl bg-muted/60 border border-border/80 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveMode('catalog')}
            className={`flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ${
              activeMode === 'catalog'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Вариант А: Весь каталог сразу</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('wizard')}
            className={`flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ${
              activeMode === 'wizard'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ListOrdered className="w-4 h-4" />
            <span>Вариант Б: Пошаговый визард</span>
          </button>
        </div>
      </div>

      {/* ── Active Flow Render ── */}
      <div className="w-full">
        {activeMode === 'catalog' ? (
          <FullscreenMasterCatalog />
        ) : (
          <StepByStepWizard />
        )}
      </div>
    </section>
  );
}
