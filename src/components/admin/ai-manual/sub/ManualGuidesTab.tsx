'use client';

/**
 * Tab 2: Interactive Guides & Runbooks Catalog (with Direct Markdown Download)
 */

import React, { useState, useEffect } from 'react';
import type { AdminRunbook } from '@/types/admin-ai-manual';
import { getAdminRunbooksAction } from '@/actions/admin/ai-manual/guides.action';
import { ManualRunbookDetail } from './ManualRunbookDetail';
import { Search, Clock, ChevronRight, BookOpen, Sparkles, Download } from 'lucide-react';
import { usePathname } from 'next/navigation';
import {
  downloadFullManualAsMarkdown,
  downloadRunbookAsMarkdown,
} from '@/services/admin/ai-manual/runbook-downloader';
import { toast } from 'sonner';

export const ManualGuidesTab: React.FC = () => {
  const pathname = usePathname() || '/admin/dashboard';
  const [runbooks, setRunbooks] = useState<AdminRunbook[]>([]);
  const [selectedRunbook, setSelectedRunbook] = useState<AdminRunbook | null>(null);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getAdminRunbooksAction().then((res) => {
      if (mounted && res.success && res.runbooks) {
        setRunbooks(res.runbooks);
      }
      if (mounted) setIsLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (selectedRunbook) {
    return (
      <ManualRunbookDetail
        runbook={selectedRunbook}
        onBack={() => setSelectedRunbook(null)}
      />
    );
  }

  const filtered = runbooks.filter((r) => {
    const query = search.toLowerCase();
    return (
      r.title.toLowerCase().includes(query) ||
      r.summary.toLowerCase().includes(query) ||
      r.chapterTitle.toLowerCase().includes(query) ||
      r.tags.some((t) => t.toLowerCase().includes(query))
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    const aMatch = pathname.startsWith(a.targetRoute) ? 1 : 0;
    const bMatch = pathname.startsWith(b.targetRoute) ? 1 : 0;
    return bMatch - aMatch;
  });

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-3 text-xs">
      {/* Search & Download Full Manual Bar */}
      <div className="space-y-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по регламентам и сценариям..."
              className="w-full bg-muted/40 border border-border/80 rounded-md pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              downloadFullManualAsMarkdown(runbooks);
              toast.success('Сводный регламент успешно экспортирован в Markdown!');
            }}
            disabled={runbooks.length === 0}
            aria-label="Скачать все регламенты (.md)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-[11px] font-medium transition-colors shrink-0 disabled:opacity-50 cursor-pointer min-h-[32px]"
            title="Скачать все регламенты единым файлом (.md)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Скачать все (.md)</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          <Sparkles className="w-4 h-4 animate-spin mr-2 text-primary" />
          <span>Загрузка регламентов...</span>
        </div>
      ) : sorted.length === 0 ? (
        <div className="p-6 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border/80">
          <span>Регламенты не найдены</span>
        </div>
      ) : (
        <div className="space-y-2 flex-1">
          {sorted.map((item) => {
            const isPageMatch = pathname.startsWith(item.targetRoute);
            return (
              <div
                key={item.id}
                onClick={() => setSelectedRunbook(item)}
                className={`p-3 rounded-lg border transition-all cursor-pointer hover:scale-[1.01] ${
                  isPageMatch
                    ? 'bg-primary/5 border-primary/40 shadow-xs'
                    : 'bg-card border-border/80 hover:border-primary/30'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    Глава {item.chapterNumber}: {item.chapterTitle}
                  </span>
                  {isPageMatch && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Для этой страницы
                    </span>
                  )}
                </div>

                <h4 className="font-semibold text-foreground text-xs">{item.title}</h4>
                <p className="text-muted-foreground text-[11px] mt-1 line-clamp-2 leading-relaxed">
                  {item.summary}
                </p>

                <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> ~{item.estimatedMinutes} мин
                  </span>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadRunbookAsMarkdown(item);
                        toast.success(`Регламент «${item.title.slice(0, 30)}...» экспортирован!`);
                      }}
                      className="inline-flex items-center gap-1 p-1 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                      title="Скачать этот регламент (.md)"
                      aria-label={`Скачать регламент ${item.title} (.md)`}
                    >
                      <Download className="w-3 h-3" />
                      <span className="text-[10px]">.md</span>
                    </button>

                    <span className="flex items-center gap-0.5 text-primary font-medium hover:underline">
                      <BookOpen className="w-3 h-3" /> Шагов: {item.steps.length}
                      <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
