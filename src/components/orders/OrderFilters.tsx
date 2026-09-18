'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface OrderFiltersProps {
  initialSearch: string;
  initialStatus: string;
  initialNetwork: string;
  availableNetworks: { slug: string; name: string }[];
  currentPage: number;
  totalPages: number;
  statusCounts?: Record<string, number>;
}

export function OrderFilters({
  initialSearch,
  initialStatus,
  initialNetwork,
  availableNetworks,
  currentPage,
  totalPages,
  statusCounts = {},
}: OrderFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(initialSearch);

  const handleApplyFilters = (updates: { search?: string; status?: string; network?: string; page?: number }) => {
    const params = new URLSearchParams(searchParams.toString());

    // Merge search
    if (updates.search !== undefined) {
      if (updates.search.trim()) params.set('search', updates.search.trim());
      else params.delete('search');
    }

    // Merge status
    if (updates.status !== undefined) {
      if (updates.status && updates.status !== 'ALL') params.set('status', updates.status);
      else params.delete('status');
    }

    // Merge network
    if (updates.network !== undefined) {
      if (updates.network && updates.network !== 'ALL') params.set('network', updates.network);
      else params.delete('network');
    }

    // Merge page
    if (updates.page !== undefined) {
      params.set('page', updates.page.toString());
    } else {
      params.set('page', '1'); // reset to page 1 on filter updates
    }

    router.push(`/dashboard/orders?${params.toString()}`);
  };

  const handleReset = () => {
    setSearch('');
    router.push('/dashboard/orders');
  };

  const statuses = [
    { value: 'ALL', label: 'Все' },
    { value: 'PENDING', label: 'В очереди' },
    { value: 'PENDING_CHECK', label: 'На проверке' },
    { value: 'IN_PROGRESS', label: 'В работе' },
    { value: 'COMPLETED', label: 'Выполнены' },
    { value: 'AWAITING_PAYMENT', label: 'Ожидают оплаты' },
    { value: 'PARTIAL', label: 'Частично' },
    { value: 'ERROR', label: 'Ошибка' },
    { value: 'CANCELED', label: 'Отменены' },
  ];

  return (
    <div className="space-y-4">
      {/* ── STATUS TABS PANEL (Stripe / Vercel style) ── */}
      <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
        {statuses.map((stat) => {
          const count = stat.value === 'ALL'
            ? Object.values(statusCounts).reduce((a, b) => a + b, 0)
            : statusCounts[stat.value] || 0;
          const isActive = (initialStatus || 'ALL') === stat.value;
          return (
            <button
              key={stat.value}
              type="button"
              onClick={() => handleApplyFilters({ status: stat.value })}
              className={`h-9 px-4 shrink-0 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-2 select-none cursor-pointer active:scale-95 ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/15'
                  : 'bg-card border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{stat.label}</span>
              {count > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted-foreground/15 text-muted-foreground'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── FILTER INPUTS PANEL ── */}
      <form 
        onSubmit={(e) => {
          e.preventDefault();
          handleApplyFilters({ search });
        }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 bg-card border border-border/60 rounded-2xl p-3 sm:p-4 shadow-sm select-none"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 flex-1 w-full min-w-0">
          
          {/* Smart Search */}
          <div className="relative flex-1 min-w-0 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Поиск по ID или названию тарифа..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 sm:h-9 pl-9 pr-4 bg-muted border border-border/60 rounded-xl text-xs font-medium placeholder:text-muted-foreground outline-none focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
            />
          </div>

          {/* Dropdown filters: 2 equal columns on mobile, inline on sm+ */}
          <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto shrink-0">
            {/* Status filter (Mobile only, hidden on desktop since we have tabs there) */}
            <div className="sm:hidden w-full min-w-0">
              <Select
                value={initialStatus || 'ALL'}
                onValueChange={(val) => handleApplyFilters({ status: val ?? 'ALL' })}
              >
                <SelectTrigger 
                  className="h-10 bg-muted border border-border/60 rounded-xl px-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary cursor-pointer select-none transition-all hover:bg-muted/80 flex items-center justify-between gap-1 w-full min-w-0"
                  aria-label="Фильтр по статусу"
                >
                  <SelectValue placeholder="Все статусы" className="min-w-0 truncate text-left">
                    {(value: string) => {
                      if (!value || value === 'ALL') return 'Все статусы';
                      const matched = statuses.find(s => s.value === value);
                      if (!matched) return value;
                      const count = statusCounts[value] || 0;
                      return count > 0 ? `${matched.label} (${count})` : matched.label;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground border border-border rounded-xl shadow-md p-1 max-h-60 overflow-y-auto">
                  {statuses.map((stat) => {
                    const count = stat.value === 'ALL'
                      ? Object.values(statusCounts).reduce((a, b) => a + b, 0)
                      : statusCounts[stat.value] || 0;
                    return (
                      <SelectItem key={stat.value} value={stat.value}>
                        {stat.label} {count > 0 ? `(${count})` : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Social Network filter */}
            <div className="w-full sm:w-[170px] min-w-0">
              <Select
                value={initialNetwork || 'ALL'}
                onValueChange={(val) => handleApplyFilters({ network: val ?? 'ALL' })}
              >
                <SelectTrigger 
                  className="h-10 sm:h-9 bg-muted border border-border/60 rounded-xl px-2.5 sm:px-3 text-xs font-semibold text-foreground outline-none focus:border-primary cursor-pointer select-none transition-all hover:bg-muted/80 flex items-center justify-between gap-1 w-full min-w-0"
                  aria-label="Фильтр по соцсети"
                >
                  <SelectValue placeholder="Все соцсети" className="min-w-0 truncate text-left">
                    {(value: string) => {
                      if (!value || value === 'ALL') return 'Все соцсети';
                      return availableNetworks.find(net => net.slug === value)?.name ?? value;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground border border-border rounded-xl shadow-md p-1 max-h-60 overflow-y-auto">
                  <SelectItem value="ALL">Все соцсети</SelectItem>
                  {availableNetworks.map((net) => (
                    <SelectItem key={net.slug} value={net.slug}>
                      {net.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <button
            type="submit"
            className="flex-1 sm:flex-initial h-10 sm:h-9 px-5 sm:px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs transition-all cursor-pointer shadow-sm active:scale-95 text-center whitespace-nowrap"
          >
            Применить
          </button>
          
          {(initialSearch || initialStatus || initialNetwork) && (
            <button
              type="button"
              onClick={handleReset}
              className="h-10 w-10 sm:h-9 sm:w-9 shrink-0 flex items-center justify-center bg-content2 border border-border/60 hover:bg-content3 text-muted-foreground hover:text-foreground rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
              title="Сбросить все фильтры"
            >
              <RotateCcw className="w-4 h-4 shrink-0" />
            </button>
          )}
        </div>
      </form>

      {/* ── PAGINATION CONTROLS ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 select-none">
          <p className="text-xs text-muted-foreground">
            Страница <span className="font-semibold text-foreground">{currentPage}</span> из <span className="font-semibold text-foreground">{totalPages}</span>
          </p>

          <div className="flex gap-1.5">
            <button
              onClick={() => handleApplyFilters({ page: currentPage - 1 })}
              disabled={currentPage <= 1}
              className="h-11 w-11 md:h-9 md:w-9 flex items-center justify-center rounded-xl border border-border bg-content1 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
              title="Предыдущая страница"
            >
              <ChevronLeft className="w-4 h-4 shrink-0" />
            </button>

            {Array.from({ length: totalPages }).map((_, idx) => {
              const p = idx + 1;
              // Show window around current page to prevent massive numbers
              if (totalPages > 6 && Math.abs(p - currentPage) > 2 && p !== 1 && p !== totalPages) {
                if (p === 2 || p === totalPages - 1) {
                  return <span key={`dots-${p}`} className="h-11 w-11 md:h-9 md:w-9 flex items-center justify-center text-xs text-muted-foreground font-bold select-none">...</span>;
                }
                return null;
              }

              return (
                <button
                  key={`page-${p}`}
                  onClick={() => handleApplyFilters({ page: p })}
                  className={`h-11 w-11 md:h-9 md:w-9 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                    currentPage === p
                      ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                      : 'border border-border bg-content1 text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {p}
                </button>
              );
            })}

            <button
              onClick={() => handleApplyFilters({ page: currentPage + 1 })}
              disabled={currentPage >= totalPages}
              className="h-11 w-11 md:h-9 md:w-9 flex items-center justify-center rounded-xl border border-border bg-content1 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
              title="Следующая страница"
            >
              <ChevronRight className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
