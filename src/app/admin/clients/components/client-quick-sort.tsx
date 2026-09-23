'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { ArrowUpDown, Check, X, Sparkles } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { UserSortField, SortOrder } from '@/services/admin/user.service';

interface SortPreset {
  id: string;
  label: string;
  sortBy: UserSortField;
  sortOrder: SortOrder;
  icon?: string;
  category: string;
}

const SORT_PRESETS: SortPreset[] = [
  {
    id: 'createdAt-desc',
    label: '⚡ Новые клиенты сначала',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    category: 'По дате',
  },
  {
    id: 'createdAt-asc',
    label: '⏳ Старейшие клиенты',
    sortBy: 'createdAt',
    sortOrder: 'asc',
    category: 'По дате',
  },
  {
    id: 'balance-desc',
    label: '💰 Баланс: по убыванию (Whales)',
    sortBy: 'balance',
    sortOrder: 'desc',
    category: 'Финансы',
  },
  {
    id: 'balance-asc',
    label: '🪙 Баланс: по возрастанию (0 ₽)',
    sortBy: 'balance',
    sortOrder: 'asc',
    category: 'Финансы',
  },
  {
    id: 'totalSpent-desc',
    label: '💎 LTV: топ клиентов (VIP)',
    sortBy: 'totalSpent',
    sortOrder: 'desc',
    category: 'Финансы',
  },
  {
    id: 'orders-desc',
    label: '📦 Заказы: самые активные',
    sortBy: 'orders',
    sortOrder: 'desc',
    category: 'Активность',
  },
  {
    id: 'orders-asc',
    label: '💤 Заказы: спящие (0 заказов)',
    sortBy: 'orders',
    sortOrder: 'asc',
    category: 'Активность',
  },
  {
    id: 'email-asc',
    label: '🔤 Email: от А до Я',
    sortBy: 'email',
    sortOrder: 'asc',
    category: 'Алфавит',
  },
];

export function ClientQuickSort() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSortBy = (searchParams.get('sortBy') as UserSortField) || 'createdAt';
  const currentSortOrder = (searchParams.get('sortOrder') as SortOrder) || 'desc';

  const activePreset = SORT_PRESETS.find(
    (p) => p.sortBy === currentSortBy && p.sortOrder === currentSortOrder
  );

  const isCustomSort = currentSortBy !== 'createdAt' || currentSortOrder !== 'desc';

  const handleSelectPreset = (preset: SortPreset) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('cursor');
    params.set('page', '1');

    if (preset.sortBy === 'createdAt' && preset.sortOrder === 'desc') {
      // Clean up defaults from URL for tidy query strings
      params.delete('sortBy');
      params.delete('sortOrder');
    } else {
      params.set('sortBy', preset.sortBy);
      params.set('sortOrder', preset.sortOrder);
    }

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleResetSort = (e: React.MouseEvent) => {
    e.stopPropagation();
    const params = new URLSearchParams(searchParams.toString());
    params.delete('cursor');
    params.set('page', '1');
    params.delete('sortBy');
    params.delete('sortOrder');
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-background/60 hover:bg-muted/80 text-foreground border border-border/70 rounded-lg transition-all shadow-xs outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer select-none">
          <ArrowUpDown className="w-3.5 h-3.5 text-primary" />
          <span className="hidden sm:inline text-muted-foreground font-normal">Сортировка:</span>
          <span className="font-bold truncate max-w-[160px]">
            {activePreset ? activePreset.label.replace(/^[^\s]+\s/, '') : `${currentSortBy} (${currentSortOrder})`}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 p-1.5 shadow-xl border-border bg-card/95 backdrop-blur-md">
          <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground px-2 py-1 uppercase tracking-wider">
            Пресеты сортировки
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="my-1 bg-border/60" />
          
          {SORT_PRESETS.map((preset) => {
            const isSelected = preset.sortBy === currentSortBy && preset.sortOrder === currentSortOrder;
            return (
              <DropdownMenuItem
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                  isSelected ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-muted'
                }`}
              >
                <span>{preset.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Active Sort Pill with 1-Click Clear */}
      {isCustomSort && (
        <button
          type="button"
          onClick={handleResetSort}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all select-none cursor-pointer"
          title="Сбросить сортировку (вернуться к новым)"
        >
          <span>{activePreset?.label.replace(/^[^\s]+\s/, '') || currentSortBy}</span>
          <X className="w-3 h-3 hover:scale-110 transition-transform" />
        </button>
      )}
    </div>
  );
}
