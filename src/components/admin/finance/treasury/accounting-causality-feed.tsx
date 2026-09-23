'use client';

import React from 'react';
import { FileText, CheckCircle2, ShieldAlert, Sparkles, Lightbulb } from 'lucide-react';

interface Props {
  causalityBreakdown: string[];
  recommendations: string[];
}

export function AccountingCausalityFeed({ causalityBreakdown, recommendations }: Props) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Причинно-следственные связи и аудит казначейства
        </h3>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-medium">
          Zero-Defect Audit
        </span>
      </div>

      {/* Causality Events List */}
      <div className="space-y-2.5">
        {causalityBreakdown.map((item, idx) => {
          const isWarning = item.includes('ВНИМАНИЕ') || item.includes('Кассовый разрыв');
          return (
            <div
              key={idx}
              className={`text-xs p-3 rounded-lg flex items-start gap-2.5 transition-colors border ${
                isWarning
                  ? 'bg-destructive/10 border-destructive/30 text-destructive'
                  : 'bg-muted/20 border-border/80 text-foreground'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {isWarning ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-destructive" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                )}
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono text-muted-foreground uppercase block">
                  Фактор #{idx + 1}
                </span>
                <span className="text-xs leading-relaxed">{item}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Treasurer Recommendations */}
      <div className="pt-3 border-t border-border space-y-2">
        <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
          Рекомендации Казначея для Собственника:
        </div>
        <div className="space-y-1.5">
          {recommendations.map((rec, idx) => (
            <div
              key={idx}
              className="text-xs text-muted-foreground bg-muted/10 border border-border/50 p-2.5 rounded-lg flex items-start gap-2"
            >
              <span className="font-mono text-primary font-bold shrink-0">•</span>
              <span>{rec}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
