'use client';

import React from 'react';
import Link from 'next/link';
import { 
  BookOpen, 
  Clock, 
  ArrowRight, 
  ArrowLeft, 
  Download, 
  ExternalLink, 
  ShieldCheck, 
  AlertOctagon, 
  Layers 
} from 'lucide-react';
import { toast } from 'sonner';
import { TextbookChapter } from './types';
import { InteractiveCallout } from './InteractiveCallout';
import { InteractiveDiagram } from './InteractiveDiagram';
import { InteractiveScreenshotViewer } from './InteractiveScreenshotViewer';
import { InteractiveStepChecklist } from './InteractiveStepChecklist';

interface TextbookChapterViewerProps {
  chapter: TextbookChapter;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
}

export function TextbookChapterViewer({
  chapter,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
}: TextbookChapterViewerProps) {
  const handleExportMarkdown = () => {
    try {
      const content = `# ТОМ ${chapter.volumeNumber}, ГЛАВА ${chapter.chapterNumber}: ${chapter.title}
*${chapter.subtitle}*

## 1. ОБЛАСТЬ ПРИМЕНЕНИЯ И НАЗНАЧЕНИЕ
${chapter.section1Scope}

## 2. ТЕРМИНЫ И ОПРЕДЕЛЕНИЯ
${chapter.section2Terms.map((t) => `- **${t.term}**: ${t.definition}`).join('\n')}

## 3. АРХИТЕКТУРА И СИСТЕМНЫЕ СВЯЗИ
${chapter.section3Architecture.description}
${chapter.section3Architecture.coreTables ? `\n- Таблицы БД: \`${chapter.section3Architecture.coreTables.join('`, `')}\`` : ''}
${chapter.section3Architecture.coreActions ? `\n- Серверные действия: \`${chapter.section3Architecture.coreActions.join('`, `')}\`` : ''}

## 4. ПОШАГОВЫЙ РЕГЛАМЕНТ ШТАТНОЙ ЭКСПЛУАТАЦИИ
${chapter.section4Walkthrough.steps.map((s) => `${s.stepNumber}. **${s.title}**: ${s.description}`).join('\n')}

${chapter.checklist.length > 0 ? `### Чек-лист проверки регламента:\n${chapter.checklist.map((c) => `- [ ] **${c.title}**: ${c.detail}`).join('\n')}\n` : ''}
## 5. НЕСТАНДАРТНЫЕ И ЗАЩИТНЫЕ ФУНКЦИИ
${chapter.section5Safeguards.rules.map((r) => `- [${r.code}] **${r.name}**: ${r.description}`).join('\n')}

${chapter.callouts.length > 0 ? `### Нормативные предупреждения и плашки безопасности:\n${chapter.callouts.map((c) => `> **[${c.type}] ${c.title}**\n> ${c.content}${c.codeSnippet ? `\n> \`\`\`\n> ${c.codeSnippet}\n> \`\`\`` : ''}`).join('\n\n')}\n` : ''}
## 6. ДИАГНОСТИКА СБОЕВ И ПЛАН ВОССТАНОВЛЕНИЯ
${chapter.section6Troubleshooting.map((tc) => `### ${tc.scenario}\n- **Симптомы**: ${tc.symptoms}\n- **Решение**: ${tc.solution}\n${tc.emergencyCommand ? `- **Аварийная команда**: \`${tc.emergencyCommand}\`` : ''}`).join('\n\n')}
`;
      const blob = new Blob(['\uFEFF' + content], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `omnibook-vol${chapter.volumeNumber}-ch${chapter.chapterNumber}-${chapter.id}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Глава учебника скачана (.md)');
    } catch {
      toast.error('Не удалось экспортировать главу');
    }
  };

  return (
    <article className="space-y-6 animate-in fade-in duration-300">
      {/* Chapter Top Navigation & Meta */}
      <div className="p-4 sm:p-6 rounded-3xl bg-card border border-border/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-primary/10 text-primary text-xs font-black uppercase tracking-wider border border-primary/20">
              Том {chapter.volumeNumber} • Глава {chapter.chapterNumber}
            </span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground font-semibold">
              <Clock className="w-3.5 h-3.5" />
              <span>{chapter.readTimeMinutes} мин чтения</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <a
              href="/manual/OMNISMM_ADMIN_DESK_HANDBOOK_2026.docx"
              download="OMNISMM_ADMIN_DESK_HANDBOOK_2026.docx"
              className="px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Скачать полную настольную книгу администратора в формате Microsoft Word (DOCX) для распечатки"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Книга (.DOCX)</span>
            </a>
            <button
              type="button"
              onClick={handleExportMarkdown}
              className="px-3 py-1.5 rounded-xl bg-muted/60 hover:bg-muted text-foreground text-xs font-bold border border-border/60 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Экспорт .md (BOM)</span>
            </button>
            {chapter.targetRoute && (
              <Link
                href={chapter.targetRoute}
                className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 hover:bg-primary/90 transition-colors"
              >
                <span>В рабочий раздел</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>

        <div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            {chapter.title}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed font-medium">
            {chapter.subtitle}
          </p>
        </div>

        {/* Callouts if any */}
        {chapter.callouts.map((c, idx) => (
          <InteractiveCallout key={idx} callout={c} />
        ))}
      </div>

      {/* Screenshot with Zoom & Hotspots */}
      {chapter.screenshot && (
        <InteractiveScreenshotViewer screenshot={chapter.screenshot} />
      )}

      {/* ГОСТ ЕСПД 19.505-79: 6 Standard Sections */}
      <div className="space-y-6">
        {/* Section 1: Scope */}
        <section className="p-5 rounded-2xl bg-card border border-border/80 shadow-xs space-y-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-primary" /> 1. Область применения и назначение
          </h3>
          <p className="text-xs sm:text-sm text-foreground leading-relaxed">
            {chapter.section1Scope}
          </p>
        </section>

        {/* Section 2: Terms */}
        <section className="p-5 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-500" /> 2. Термины и определения
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {chapter.section2Terms.map((t, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                <span className="font-bold text-foreground block">{t.term}</span>
                <p className="text-muted-foreground text-[11px] leading-relaxed">{t.definition}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Architecture & Diagram */}
        <section className="p-5 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-500" /> 3. Архитектура и системные связи
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {chapter.section3Architecture.description}
          </p>
          {chapter.section3Architecture.diagramType && (
            <InteractiveDiagram type={chapter.section3Architecture.diagramType} />
          )}
        </section>

        {/* Section 4: Operational Walkthrough */}
        <section className="p-5 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <span className="text-primary font-black">4.</span> Пошаговый регламент штатной эксплуатации
          </h3>
          <div className="space-y-3">
            {chapter.section4Walkthrough.steps.map((s) => (
              <div key={s.stepNumber} className="p-3.5 rounded-xl bg-muted/20 border border-border/60 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                  {s.stepNumber}
                </span>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-bold text-foreground">{s.title}</span>
                    {s.actionUrl && (
                      <Link
                        href={s.actionUrl}
                        className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                      >
                        <span>{s.actionLabel || 'Перейти'}</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Interactive Checklist */}
        <InteractiveStepChecklist chapterId={chapter.id} items={chapter.checklist} />

        {/* Section 5: Safeguards */}
        <section className="p-5 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" /> 5. Нестандартные и защитные функции
          </h3>
          <div className="space-y-2">
            {chapter.section5Safeguards.rules.map((r, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-start gap-2.5 text-xs">
                <span className="font-mono font-bold text-emerald-600 shrink-0">{r.code}:</span>
                <div>
                  <strong className="text-foreground">{r.name}</strong> — {r.description}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 6: Troubleshooting */}
        <section className="p-5 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
            <AlertOctagon className="w-4 h-4 text-rose-500" /> 6. Диагностика сбоев и план восстановления
          </h3>
          <div className="space-y-3">
            {chapter.section6Troubleshooting.map((tc, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/20 text-xs space-y-1.5">
                <span className="font-bold text-rose-700 dark:text-rose-300 block">{tc.scenario}</span>
                <p className="text-muted-foreground text-[11px]"><strong>Симптомы:</strong> {tc.symptoms}</p>
                <p className="text-foreground text-[11px] bg-background/80 p-2 rounded-lg border border-border/40">
                  <strong>Решение:</strong> {tc.solution}
                </p>
                {tc.emergencyCommand && (
                  <div className="pt-1">
                    <code className="text-[10px] font-mono bg-muted p-1.5 rounded block text-foreground truncate">
                      {tc.emergencyCommand}
                    </code>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Bottom Pager */}
      <nav className="flex items-center justify-between pt-4 border-t border-border/60" aria-label="Пагинация глав">
        {hasPrev && onPrev ? (
          <button
            type="button"
            onClick={onPrev}
            className="px-4 py-2 rounded-xl bg-muted/60 hover:bg-muted text-foreground text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Предыдущая глава
          </button>
        ) : <div />}

        {hasNext && onNext && (
          <button
            type="button"
            onClick={onNext}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 hover:bg-primary/90 cursor-pointer transition-colors"
          >
            Следующая глава <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </nav>
    </article>
  );
}
