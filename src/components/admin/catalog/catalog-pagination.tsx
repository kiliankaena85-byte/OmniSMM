'use client';

import React, { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Layers, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowRight } from 'lucide-react';

interface CatalogPaginationProps {
  totalCount: number;
  globalTotalCount?: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  selectedTenant?: string;
}

export function CatalogPagination({
  totalCount,
  globalTotalCount,
  currentPage,
  totalPages,
  pageSize,
  selectedTenant = 'smmplan',
}: CatalogPaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [jumpPage, setJumpPage] = useState('');

  // Helper to build URL with page & pageSize while preserving all other active filters
  const buildPageUrl = (page: number, newPageSize?: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('cursor'); // clear old cursor if present

    params.set('tenant', selectedTenant);
    params.set('page', String(page));
    params.set('pageSize', String(newPageSize || pageSize));

    return `${pathname}?${params.toString()}`;
  };

  const navigateToPage = (targetPage: number, newPageSize?: number) => {
    const clamped = Math.max(1, Math.min(targetPage, totalPages || 1));
    router.push(buildPageUrl(clamped, newPageSize), { scroll: false });
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(jumpPage, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      navigateToPage(parsed);
      setJumpPage('');
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    navigateToPage(1, newSize);
  };

  // Generate numbered pages list with smart ellipsis
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | 'ellipsis')[] = [];

    if (currentPage <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push('ellipsis');
      pages.push(totalPages);
    } else if (currentPage >= totalPages - 3) {
      pages.push(1);
      pages.push('ellipsis');
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push('ellipsis');
      pages.push(currentPage - 1);
      pages.push(currentPage);
      pages.push(currentPage + 1);
      pages.push('ellipsis');
      pages.push(totalPages);
    }

    return pages;
  };

  const startRecord = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalCount);
  const isFiltered = globalTotalCount !== undefined && globalTotalCount > totalCount;

  return (
    <div className="flex flex-col lg:flex-row items-center justify-between gap-4 pt-4 border-t border-border/60 text-xs text-muted-foreground">
      {/* ─── 1. Information & Range Display ─── */}
      <div className="flex flex-wrap items-center gap-2 font-medium">
        <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
        <span>
          Показано{' '}
          <strong className="text-foreground font-bold font-mono">
            {startRecord}–{endRecord}
          </strong>{' '}
          из{' '}
          <strong className="text-foreground font-bold font-mono">{totalCount.toLocaleString('ru-RU')}</strong> услуг
        </span>
        {isFiltered && (
          <span className="text-muted-foreground/80 font-normal">
            (всего в базе: {globalTotalCount.toLocaleString('ru-RU')})
          </span>
        )}
      </div>

      {/* ─── 2. Numbered Navigation & Page Switcher ─── */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 lg:pb-0">
          {/* First Page */}
          <button
            type="button"
            onClick={() => navigateToPage(1)}
            disabled={currentPage <= 1}
            title="Первая страница"
            aria-label="Первая страница"
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-border/70 bg-card text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs active:scale-95"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>

          {/* Previous Page */}
          <button
            type="button"
            onClick={() => navigateToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            title="Предыдущая страница"
            aria-label="Предыдущая страница"
            className="h-8 px-2.5 flex items-center gap-1 rounded-lg border border-border/70 bg-card text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer font-medium shadow-2xs active:scale-95"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Назад</span>
          </button>

          {/* Page Numbers */}
          <div className="flex items-center gap-1">
            {getPageNumbers().map((item, idx) => {
              if (item === 'ellipsis') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="h-8 w-7 flex items-center justify-center text-muted-foreground select-none font-bold"
                  >
                    …
                  </span>
                );
              }

              const isCurrent = item === currentPage;
              return (
                <button
                  key={`page-${item}`}
                  type="button"
                  onClick={() => navigateToPage(item)}
                  aria-label={`Страница ${item}`}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={`h-8 min-w-[32px] px-2 flex items-center justify-center rounded-lg font-bold font-mono transition-all cursor-pointer text-xs ${
                    isCurrent
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'border border-border/70 bg-card text-muted-foreground hover:text-foreground hover:bg-muted/80 shadow-2xs active:scale-95'
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>

          {/* Next Page */}
          <button
            type="button"
            onClick={() => navigateToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            title="Следующая страница"
            aria-label="Следующая страница"
            className="h-8 px-2.5 flex items-center gap-1 rounded-lg border border-border/70 bg-card text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer font-medium shadow-2xs active:scale-95"
          >
            <span className="hidden sm:inline">Вперёд</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Last Page */}
          <button
            type="button"
            onClick={() => navigateToPage(totalPages)}
            disabled={currentPage >= totalPages}
            title="Последняя страница"
            aria-label="Последняя страница"
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-border/70 bg-card text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs active:scale-95"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ─── 3. PageSize Selector & Jump-to-Page ─── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Page Size Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground hidden sm:inline">Строк:</span>
          <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border/60 text-[11px] font-bold">
            {[20, 50, 100, 200].map((size) => (
              <button
                key={`size-${size}`}
                type="button"
                onClick={() => handlePageSizeChange(size)}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer font-mono ${
                  pageSize === size
                    ? 'bg-background text-foreground shadow-2xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title={`Показывать по ${size} услуг`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Jump To Page Input */}
        {totalPages > 1 && (
          <form onSubmit={handleJumpSubmit} className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpPage}
              onChange={(e) => setJumpPage(e.target.value)}
              placeholder={String(currentPage)}
              aria-label="Номер страницы"
              className="h-8 w-14 rounded-lg border border-border bg-background px-2 text-center text-xs font-mono font-bold text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary transition-all"
            />
            <span className="text-[11px] text-muted-foreground font-mono">/ {totalPages}</span>
            <button
              type="submit"
              disabled={!jumpPage || parseInt(jumpPage, 10) < 1 || parseInt(jumpPage, 10) > totalPages}
              title="Перейти на страницу"
              className="h-8 px-2 flex items-center justify-center rounded-lg border border-border/70 bg-card text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              <ArrowRight className="w-3 h-3" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
