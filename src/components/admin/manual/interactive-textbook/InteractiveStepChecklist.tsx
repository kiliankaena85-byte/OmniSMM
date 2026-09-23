'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle, RotateCcw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { TextbookChecklistItem } from './types';

interface InteractiveStepChecklistProps {
  chapterId: string;
  items: TextbookChecklistItem[];
}

export function InteractiveStepChecklist({ chapterId, items }: InteractiveStepChecklistProps) {
  const storageKey = `omnibook_checklist_${chapterId}`;
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setCheckedIds(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, [storageKey]);

  const handleToggle = (id: string) => {
    setCheckedIds((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
      if (!prev[id]) {
        toast.success('Пункт регламента выполнен');
      }
      return next;
    });
  };

  const handleReset = () => {
    setCheckedIds({});
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    toast.info('Чек-лист сброшен');
  };

  const completedCount = items.filter((i) => checkedIds[i.id]).length;
  const progressPercent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;
  const isAllComplete = items.length > 0 && completedCount === items.length;

  return (
    <div className="my-4 p-4 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          <h4 className="text-xs font-bold text-foreground">Интерактивный чек-лист регламента</h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-bold text-muted-foreground">
            {completedCount} / {items.length} ({progressPercent}%)
          </span>
          {completedCount > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Сбросить прогресс"
              aria-label="Сбросить чек-лист"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Checklist items */}
      <div className="space-y-2" role="group" aria-label="Пункты регламента">
        {items.map((item) => {
          const isChecked = !!checkedIds[item.id];
          return (
            <div
              key={item.id}
              role="checkbox"
              tabIndex={0}
              aria-checked={isChecked}
              aria-label={`${item.title}. ${item.detail}`}
              onClick={() => handleToggle(item.id)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  handleToggle(item.id);
                }
              }}
              className={`p-2.5 min-h-[44px] rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 select-none outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 ${
                isChecked
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-foreground'
                  : 'bg-muted/30 border-border/50 hover:bg-muted/60 text-foreground'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isChecked ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-xs font-bold block ${isChecked ? 'line-through text-muted-foreground' : ''}`}>
                  {item.title}
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  {item.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {isAllComplete && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in zoom-in-95 duration-200">
          <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>Все пункты главы успешно проверены и согласованы!</span>
        </div>
      )}
    </div>
  );
}
