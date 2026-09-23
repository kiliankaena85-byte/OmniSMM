import React from "react";
import { OrderEngine } from "@/hooks/useOrderEngine";

interface CustomFieldWarningProps {
  engine: OrderEngine;
  customFieldLabel: string | null;
  isCustomComments: boolean;
  isPoll: boolean;
}

export function CustomFieldWarning({ engine, customFieldLabel, isCustomComments, isPoll }: CustomFieldWarningProps) {
  if (!customFieldLabel) return null;
  const { customData, setCustomData } = engine;

  return (
    <div className="w-full space-y-2 mt-2">
      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">{customFieldLabel}</label>
      {isCustomComments ? (
        <textarea 
          value={customData} 
          onChange={e => setCustomData(e.target.value)} 
          placeholder="Каждая строка - новый комментарий..."
          className="w-full min-h-[100px] p-4 rounded-xl border border-border bg-card text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-y shadow-sm"
        />
      ) : (
        <input 
          type="text" 
          value={customData} 
          onChange={e => setCustomData(e.target.value)} 
          placeholder={isPoll ? "Например: 2" : "Слова через запятую..."}
          className="w-full h-12 px-4 rounded-xl border border-border bg-card text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm"
        />
      )}
    </div>
  );
}
