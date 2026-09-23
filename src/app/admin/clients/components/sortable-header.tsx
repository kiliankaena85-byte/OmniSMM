'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserSortField, SortOrder } from '@/services/admin/user.service';

interface SortableHeaderProps {
  title: string;
  field: UserSortField;
  currentSortBy?: string;
  currentSortOrder?: 'asc' | 'desc';
  align?: 'left' | 'right' | 'center';
  defaultOrder?: SortOrder;
  className?: string;
}

export function SortableHeader({
  title,
  field,
  currentSortBy,
  currentSortOrder,
  align = 'left',
  defaultOrder,
  className,
}: SortableHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // If not explicitly passed, read from URL
  const activeSortBy = currentSortBy ?? (searchParams.get('sortBy') || 'createdAt');
  const activeSortOrder = (currentSortOrder ?? (searchParams.get('sortOrder') as SortOrder)) || 'desc';

  const isActive = activeSortBy === field;

  // Semantic default: finances, volume, orders, and date default to 'desc' (highest/newest first)
  const resolvedDefaultOrder: SortOrder = defaultOrder ?? (
    ['balance', 'totalSpent', 'orders', 'createdAt'].includes(field) ? 'desc' : 'asc'
  );

  const handleSort = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('cursor'); // Reset cursor on sort change
    params.set('page', '1'); // Always reset to page 1 on sort change

    let nextOrder: SortOrder = resolvedDefaultOrder;

    if (isActive) {
      // Toggle between desc and asc
      nextOrder = activeSortOrder === 'desc' ? 'asc' : 'desc';
    }

    params.set('sortBy', field);
    params.set('sortOrder', nextOrder);

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const ariaSort = isActive
    ? activeSortOrder === 'asc'
      ? 'ascending'
      : 'descending'
    : 'none';

  return (
    <button
      type="button"
      onClick={handleSort}
      aria-sort={ariaSort}
      className={cn(
        'group inline-flex items-center gap-1.5 py-1 text-xs font-semibold select-none cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-md px-1 -mx-1',
        align === 'right' && 'ml-auto flex-row-reverse text-right',
        align === 'center' && 'mx-auto justify-center',
        isActive
          ? 'text-foreground font-bold'
          : 'text-muted-foreground hover:text-foreground',
        className
      )}
      title={`Сортировать по: ${title} (${isActive && activeSortOrder === 'desc' ? 'по возрастанию' : 'по убыванию'})`}
    >
      <span>{title}</span>
      <span className="flex items-center justify-center shrink-0">
        {isActive ? (
          activeSortOrder === 'desc' ? (
            <ArrowDown className="w-3.5 h-3.5 text-primary animate-in fade-in duration-200" />
          ) : (
            <ArrowUp className="w-3.5 h-3.5 text-primary animate-in fade-in duration-200" />
          )
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-foreground/70 transition-colors" />
        )}
      </span>
    </button>
  );
}
