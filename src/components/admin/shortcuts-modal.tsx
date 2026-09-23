'use client';

import React, { useState } from 'react';
import { 
  Keyboard, 
  X, 
  RotateCcw, 
  Sliders,
  Check
} from 'lucide-react';
import { useShortcuts, type HotkeyConfig } from './shortcuts-context';

interface ShortcutsModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function ShortcutsModal({ isOpen = false, onClose }: ShortcutsModalProps) {
  const { hotkeysEnabled, setHotkeysEnabled, hotkeys, resetHotkeys } = useShortcuts();
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'Навигация' | 'Заказы' | 'Каталог' | 'Система'>('ALL');

  if (!isOpen) return null;

  const categories = ['ALL', 'Навигация', 'Заказы', 'Каталог', 'Система'] as const;

  const filteredHotkeys = activeCategory === 'ALL'
    ? hotkeys
    : hotkeys.filter((h) => h.category === activeCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-foreground/30 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-xl bg-card/95 backdrop-blur-xl border border-border/60 rounded-2xl shadow-2xl p-6 overflow-hidden ring-1 ring-border/10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/50 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight text-foreground">
                Горячие клавиши (Shortcuts)
              </h3>
              <p className="text-xs text-muted-foreground font-medium">
                Быстрое управление и переход по разделам с клавиатуры
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть справку"
            className="p-1.5 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Global On/Off Toggle & Reset */}
        <div className="flex items-center justify-between bg-muted/40 border border-border/50 rounded-xl p-3 mb-4">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-primary" />
            <div>
              <div className="text-xs font-bold text-foreground">Глобальные горячие клавиши</div>
              <div className="text-[11px] text-muted-foreground">
                {hotkeysEnabled ? 'Включены (активны во всех разделах админки)' : 'Отключены пользователем'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resetHotkeys}
              title="Сбросить к значениям по умолчанию"
              className="p-1.5 text-xs text-muted-foreground hover:text-foreground rounded-lg border border-border hover:bg-muted transition-all cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Сброс</span>
            </button>
            <button
              onClick={() => setHotkeysEnabled(!hotkeysEnabled)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                hotkeysEnabled
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-muted text-muted-foreground border border-border'
              }`}
            >
              <Check className={`w-3.5 h-3.5 ${hotkeysEnabled ? 'opacity-100' : 'opacity-0'}`} />
              {hotkeysEnabled ? 'Вкл' : 'Выкл'}
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1 pb-2 mb-2 border-b border-border/40 overflow-x-auto scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeCategory === cat
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {cat === 'ALL' ? 'Все' : cat}
            </button>
          ))}
        </div>

        {/* Shortcuts List */}
        <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
          {filteredHotkeys.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-background border border-border/50 text-xs hover:border-border transition-all"
            >
              <div className="flex items-center gap-2">
                <span className="text-foreground font-medium">{item.label}</span>
                {item.category && (
                  <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted border border-border/40">
                    {item.category}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-3">
                {item.keys.map((k, kIdx) => (
                  <kbd
                    key={kIdx}
                    className="px-2 py-0.5 text-[11px] font-mono font-bold bg-muted/60 border border-border/80 rounded text-foreground shadow-xs uppercase"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Нажмите <kbd className="px-1.5 py-0.5 font-mono bg-background border border-border rounded text-[10px]">Esc</kbd> для закрытия</span>
          <span className="font-semibold text-primary">SMMplan Workspace</span>
        </div>
      </div>
    </div>
  );
}
