'use client';

/**
 * Patent & Technical Documentation Sections (Rospatent / GOST ESPD standard)
 */

import React from 'react';
import type { AdminRunbook } from '@/types/admin-ai-manual';
import { BookOpen, ShieldAlert, Cpu, Database, Wrench, AlertCircle, Sparkles } from 'lucide-react';

interface RunbookPatentSectionsProps {
  runbook: AdminRunbook;
  stepsSlot?: React.ReactNode;
}

export const RunbookPatentSections: React.FC<RunbookPatentSectionsProps> = ({ runbook, stepsSlot }) => {
  return (
    <div className="space-y-4 pt-2 border-t border-border/60">
      {/* 1. Scope and Objectives */}
      {runbook.scopeAndObjectives && (
        <section className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground uppercase tracking-wider">
            <BookOpen className="w-3.5 h-3.5 text-primary" />
            <span>1. Область применения и назначение</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed bg-muted/20 p-2.5 rounded-md border border-border/50">
            {runbook.scopeAndObjectives}
          </p>
        </section>
      )}

      {/* 2. Terms and Definitions */}
      {runbook.termsAndDefinitions && runbook.termsAndDefinitions.length > 0 && (
        <section className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>2. Термины и определения</span>
          </div>
          <div className="space-y-1.5">
            {runbook.termsAndDefinitions.map((item) => (
              <div key={item.term} className="p-2 rounded bg-card border border-border/70 text-[11px] leading-relaxed">
                <span className="font-semibold text-foreground block mb-0.5">{item.term}</span>
                <span className="text-muted-foreground">{item.definition}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Technical Architecture */}
      {runbook.technicalArchitecture && (
        <section className="space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground uppercase tracking-wider">
            <Cpu className="w-3.5 h-3.5 text-indigo-500" />
            <span>3. Архитектура и стек модуля</span>
          </div>

          <div className="p-2.5 rounded-md bg-muted/20 border border-border/60 space-y-2 text-[10px]">
            {runbook.technicalArchitecture.description && (
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                {runbook.technicalArchitecture.description}
              </p>
            )}

            {runbook.technicalArchitecture.prismaTables && runbook.technicalArchitecture.prismaTables.length > 0 && (
              <div className="flex items-start gap-1.5">
                <Database className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                <div className="flex flex-wrap gap-1">
                  <span className="text-muted-foreground font-medium mr-1">Таблицы БД:</span>
                  {runbook.technicalArchitecture.prismaTables.map((t) => (
                    <span key={t} className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[9px] border border-emerald-500/20">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {runbook.technicalArchitecture.level1Services && runbook.technicalArchitecture.level1Services.length > 0 && (
              <div className="flex items-start gap-1.5">
                <Wrench className="w-3 h-3 text-blue-500 shrink-0 mt-0.5" />
                <div className="flex flex-wrap gap-1">
                  <span className="text-muted-foreground font-medium mr-1">Сервисы Level 1:</span>
                  {runbook.technicalArchitecture.level1Services.map((s) => (
                    <span key={s} className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono text-[9px] border border-blue-500/20">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 4. Operational Steps Slot */}
      {stepsSlot}

      {/* 5. Protective Mechanisms */}
      {runbook.protectiveMechanisms && runbook.protectiveMechanisms.length > 0 && (
        <section className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground uppercase tracking-wider">
            <ShieldAlert className="w-3.5 h-3.5 text-emerald-500" />
            <span>5. Нестандартные и защитные функции</span>
          </div>
          <div className="space-y-1.5">
            {runbook.protectiveMechanisms.map((mech) => (
              <div key={mech.title} className="p-2 rounded bg-emerald-500/5 border border-emerald-500/20 text-[11px]">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">{mech.title}</span>
                  {mech.ruleCode && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/15 font-mono text-emerald-600 dark:text-emerald-400">
                      {mech.ruleCode}
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-[10px] leading-relaxed">{mech.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. Troubleshooting & Recovery */}
      {runbook.troubleshooting && runbook.troubleshooting.length > 0 && (
        <section className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground uppercase tracking-wider">
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
            <span>6. Диагностика сбоев и восстановление</span>
          </div>
          <div className="space-y-2">
            {runbook.troubleshooting.map((item, idx) => (
              <div key={idx} className="p-2.5 rounded bg-rose-500/5 border border-rose-500/20 text-[10px] space-y-1">
                <span className="font-semibold text-rose-700 dark:text-rose-300 block text-[11px]">
                  {item.scenario}
                </span>
                <p className="text-muted-foreground"><strong className="text-foreground">Симптомы:</strong> {item.symptoms}</p>
                <p className="text-muted-foreground"><strong className="text-emerald-600 dark:text-emerald-400">Решение:</strong> {item.remedy}</p>
                {item.files && item.files.length > 0 && (
                  <div className="pt-1 flex flex-wrap gap-1">
                    {item.files.map((f) => (
                      <span key={f} className="text-[9px] font-mono text-muted-foreground bg-muted/60 px-1 py-0.5 rounded">
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
