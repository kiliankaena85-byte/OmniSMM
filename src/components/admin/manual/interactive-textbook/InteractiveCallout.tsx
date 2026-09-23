'use client';

import React, { useState } from 'react';
import { Info, Lightbulb, AlertTriangle, ShieldAlert, Scale, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { CalloutBadge, CalloutType } from './types';

const CALLOUT_CONFIG: Record<
  CalloutType,
  {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    borderClass: string;
    bgClass: string;
    textClass: string;
    badgeBg: string;
  }
> = {
  NOTE: {
    icon: Info,
    label: 'ПРИМЕЧАНИЕ (NOTE)',
    borderClass: 'border-blue-500/30 dark:border-blue-500/40',
    bgClass: 'bg-blue-50/50 dark:bg-blue-950/20',
    textClass: 'text-blue-900 dark:text-blue-200',
    badgeBg: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
  },
  TIP: {
    icon: Lightbulb,
    label: 'СОВЕТ / ЛАЙФХАК (TIP)',
    borderClass: 'border-amber-500/30 dark:border-amber-500/40',
    bgClass: 'bg-amber-50/50 dark:bg-amber-950/20',
    textClass: 'text-amber-900 dark:text-amber-200',
    badgeBg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
  },
  WARNING: {
    icon: AlertTriangle,
    label: 'ВНИМАНИЕ (WARNING)',
    borderClass: 'border-orange-500/30 dark:border-orange-500/40',
    bgClass: 'bg-orange-50/50 dark:bg-orange-950/20',
    textClass: 'text-orange-900 dark:text-orange-200',
    badgeBg: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20',
  },
  CRITICAL: {
    icon: ShieldAlert,
    label: 'КРИТИЧЕСКИЙ ИНВАРИАНТ (CRITICAL)',
    borderClass: 'border-rose-500/40 dark:border-rose-500/50',
    bgClass: 'bg-rose-50/60 dark:bg-rose-950/30',
    textClass: 'text-rose-900 dark:text-rose-200',
    badgeBg: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  },
  LEGAL: {
    icon: Scale,
    label: 'НОРМАТИВНЫЙ БАЗИС (LEGAL)',
    borderClass: 'border-emerald-500/30 dark:border-emerald-500/40',
    bgClass: 'bg-emerald-50/50 dark:bg-emerald-950/20',
    textClass: 'text-emerald-900 dark:text-emerald-200',
    badgeBg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  },
};

interface InteractiveCalloutProps {
  callout: CalloutBadge;
}

export function InteractiveCallout({ callout }: InteractiveCalloutProps) {
  const [copied, setCopied] = useState(false);
  const config = CALLOUT_CONFIG[callout.type] || CALLOUT_CONFIG.NOTE;
  const IconComponent = config.icon;

  const handleCopySnippet = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Скопировано в буфер обмена');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Не удалось скопировать текст');
    }
  };

  return (
    <aside
      className={`my-3 p-3.5 sm:p-4 rounded-xl border ${config.borderClass} ${config.bgClass} transition-all shadow-xs`}
      role="note"
      aria-label={callout.title}
    >
      <div className="flex items-start gap-3">
        <div className="p-1.5 rounded-lg shrink-0 mt-0.5 bg-background/80 border border-border/50 shadow-2xs">
          <IconComponent className="w-4 h-4 text-foreground" />
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${config.badgeBg}`}>
                {config.label}
              </span>
              <h4 className="text-xs font-bold text-foreground">{callout.title}</h4>
            </div>

            {callout.ruleReference && (
              <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/40">
                {callout.ruleReference}
              </span>
            )}
          </div>

          <p className={`text-xs leading-relaxed font-medium ${config.textClass}`}>
            {callout.content}
          </p>

          {callout.codeSnippet && (
            <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between gap-2 bg-background/60 p-2 rounded-lg border border-border/40">
              <code className="text-[11px] font-mono text-foreground truncate select-all">
                {callout.codeSnippet}
              </code>
              <button
                type="button"
                onClick={() => handleCopySnippet(callout.codeSnippet!)}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
                title="Скопировать"
                aria-label="Скопировать код"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
