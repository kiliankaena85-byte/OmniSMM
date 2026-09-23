'use client';

/**
 * Step-by-step Interactive Viewer for a single Runbook (with Patent Sections & Download)
 */

import React, { useState, useEffect } from 'react';
import type { AdminRunbook } from '@/types/admin-ai-manual';
import { ArrowLeft, CheckCircle2, Circle, AlertTriangle, ExternalLink, Download } from 'lucide-react';
import Link from 'next/link';
import { downloadRunbookAsMarkdown } from '@/services/admin/ai-manual/runbook-downloader';
import { RunbookPatentSections } from './detail/RunbookPatentSections';
import { toast } from 'sonner';

interface ManualRunbookDetailProps {
  runbook: AdminRunbook;
  onBack: () => void;
}

export const ManualRunbookDetail: React.FC<ManualRunbookDetailProps> = ({ runbook, onBack }) => {
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`runbook_progress_${runbook.id}`);
      if (stored) {
        setCompletedSteps(JSON.parse(stored));
      }
    } catch {}
  }, [runbook.id]);

  const toggleStep = (stepNumber: number) => {
    setCompletedSteps((prev) => {
      const updated = prev.includes(stepNumber)
        ? prev.filter((s) => s !== stepNumber)
        : [...prev, stepNumber];
      try {
        localStorage.setItem(`runbook_progress_${runbook.id}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const progressPercent = Math.round((completedSteps.length / runbook.steps.length) * 100);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-4 text-xs">
      {/* Back button & Header with Download */}
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Назад к списку</span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              downloadRunbookAsMarkdown(runbook);
              toast.success('Регламент успешно экспортирован в Markdown!');
            }}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-medium bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors cursor-pointer"
            title="Скачать регламент в формате Markdown"
            aria-label="Скачать регламент (.md)"
          >
            <Download className="w-3 h-3 text-primary" />
            <span>Скачать регламент (.md)</span>
          </button>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            Глава {runbook.chapterNumber}: {runbook.chapterTitle}
          </span>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground tracking-tight">{runbook.title}</h3>
        <p className="text-muted-foreground mt-1 leading-relaxed text-[11px]">{runbook.summary}</p>
      </div>

      {/* Sticky Progress Bar */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md p-2.5 rounded-lg border border-border/80 shadow-xs">
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
          <span>Прогресс выполнения регламента</span>
          <span className="font-semibold text-foreground">{progressPercent}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Patent & Standard Technical Documentation Sections in strict 1..6 sequence */}
      <RunbookPatentSections
        runbook={runbook}
        stepsSlot={
          <div className="space-y-2.5">
            <div className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
              4. Пошаговый регламент штатной эксплуатации
            </div>
            {runbook.steps.map((step) => {
              const isDone = completedSteps.includes(step.stepNumber);
              return (
                <div
                  key={step.stepNumber}
                  className={`p-3 rounded-lg border transition-all ${
                    isDone
                      ? 'bg-muted/30 border-border/60 opacity-80'
                      : 'bg-card border-border/80 shadow-xs'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <button
                      type="button"
                      onClick={() => toggleStep(step.stepNumber)}
                      aria-label={`Отметить шаг ${step.stepNumber} как выполненный`}
                      className="mt-0.5 text-primary hover:scale-110 transition-transform cursor-pointer"
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>

                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className={`font-semibold ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          Шаг {step.stepNumber}: {step.title}
                        </span>
                      </div>

                      <p className="text-[11px] text-muted-foreground leading-relaxed">{step.instruction}</p>

                      {step.warningNote && (
                        <div className="flex items-start gap-1.5 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px]">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                          <span>{step.warningNote}</span>
                        </div>
                      )}

                      {step.actionUrl && (
                        <div className="pt-1">
                          <Link
                            href={step.actionUrl}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-medium transition-colors"
                          >
                            <span>{step.actionLabel || 'Перейти к разделу'}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        }
      />
    </div>
  );
};
