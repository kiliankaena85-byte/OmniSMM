'use client';

import React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize = 12,
  onPageChange,
}: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;

    if (onPageChange) {
      onPageChange(page);
    } else if (pathname && searchParams) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', page.toString());
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (totalPages <= 1 && totalItems <= pageSize) return null;

  // Generate range: 1, 2, 3 ... 10
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const delta = 2;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }
    return pages;
  };

  const startItem = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <nav
      className="flex flex-col md:flex-row items-center justify-between gap-4 mt-8 pt-4 border-t border-border/50 text-xs text-muted-foreground w-full"
      aria-label="Pagination"
    >
      <div className="text-xs text-muted-foreground">
        Показано <span className="font-semibold text-foreground">{startItem}</span> -{' '}
        <span className="font-semibold text-foreground">{endItem}</span> из{' '}
        <span className="font-semibold text-foreground">{totalItems}</span> услуг
      </div>

      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        {/* First Page Button */}
        <button
          type="button"
          onClick={() => handlePageChange(1)}
          disabled={currentPage === 1}
          aria-disabled={currentPage === 1}
          aria-label="Первая"
          className="px-2.5 py-1.5 rounded-lg border border-border bg-card text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors flex items-center gap-1 font-medium cursor-pointer"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Первая</span>
        </button>

        {/* Previous Page Button */}
        <button
          type="button"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-disabled={currentPage === 1}
          aria-label="Назад"
          className="px-2.5 py-1.5 rounded-lg border border-border bg-card text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors flex items-center gap-1 font-medium cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Назад</span>
        </button>

        {/* Numeric Page Buttons */}
        <div className="flex items-center gap-1">
          {getPageNumbers().map((page, idx) =>
            page === '...' ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground font-mono select-none">
                ...
              </span>
            ) : (
              <button
                key={page}
                type="button"
                onClick={() => handlePageChange(page as number)}
                aria-current={currentPage === page ? 'page' : undefined}
                aria-label={`Страница ${page}`}
                className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  currentPage === page
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'border border-border bg-card text-foreground hover:bg-muted'
                }`}
              >
                {page}
              </button>
            )
          )}
        </div>

        {/* Next Page Button */}
        <button
          type="button"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-disabled={currentPage >= totalPages}
          aria-label="Вперед"
          className="px-2.5 py-1.5 rounded-lg border border-border bg-card text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors flex items-center gap-1 font-medium cursor-pointer"
        >
          <span>Вперед</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Last Page Button */}
        <button
          type="button"
          onClick={() => handlePageChange(totalPages)}
          disabled={currentPage >= totalPages}
          aria-disabled={currentPage >= totalPages}
          aria-label="Последняя"
          className="px-2.5 py-1.5 rounded-lg border border-border bg-card text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors flex items-center gap-1 font-medium cursor-pointer"
        >
          <span className="hidden sm:inline">Последняя</span>
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </nav>
  );
}
