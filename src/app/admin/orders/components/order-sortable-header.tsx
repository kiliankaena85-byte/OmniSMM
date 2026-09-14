'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type OrderSortField = 'numericId' | 'client' | 'createdAt' | 'charge' | 'status';
export type OrderSortDirection = 'asc' | 'desc';

interface OrderSortableHeaderProps {
  title: string;
  field: OrderSortField;
  align?: 'left' | 'right' | 'center';
  defaultOrder?: OrderSortDirection;
  className?: string;
}

export function OrderSortableHeader({
  title,
  field,
  align = 'left',
  defaultOrder,
  className,
}: OrderSortableHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeSortField = searchParams.get('sort') || searchParams.get('sortBy') || 'createdAt';
  const activeSortOrder = ((searchParams.get('order') || searchParams.get('sortOrder')) as OrderSortDirection) || 'desc';

  const isActive = activeSortField === field;

  // Semantic defaults:
  // - numericId, createdAt, charge: 'desc' (highest ID, newest date, largest amount first)
  // - client, status: 'asc' (alphabetical by client email, sequential status first)
  const resolvedDefaultOrder: OrderSortDirection = defaultOrder ?? (
    ['numericId', 'createdAt', 'charge'].includes(field) ? 'desc' : 'asc'
  );

  const handleSort = (e: React.MouseEvent) => {
    e.stopPropagation();
    const params = new URLSearchParams(searchParams.toString());

    // Reset cursor & pagination on sort change
    params.delete('cursor');
    params.set('page', '1');

    let nextOrder: OrderSortDirection = resolvedDefaultOrder;

    if (isActive) {
      // Toggle between desc and asc
      nextOrder = activeSortOrder === 'desc' ? 'asc' : 'desc';
    }

    params.set('sort', field);
    params.set('order', nextOrder);

    // Clean up any legacy param aliases
    params.delete('sortBy');
    params.delete('sortOrder');

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
        'group inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider select-none cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-sm',
        align === 'right' && 'ml-auto flex-row-reverse text-right',
        align === 'center' && 'mx-auto justify-center',
        isActive
          ? 'text-foreground font-bold'
          : 'text-muted-foreground hover:text-foreground',
        className
      )}
      title={`Сортировка: ${title} (${
        isActive
          ? activeSortOrder === 'desc'
            ? 'сейчас по убыванию, нажать для возрастания (ASC)'
            : 'сейчас по возрастанию, нажать для убывания (DESC)'
          : 'нажать для сортировки'
      })`}
    >
      <span>{title}</span>
      <span className="flex items-center justify-center shrink-0">
        {isActive ? (
          activeSortOrder === 'desc' ? (
            <ArrowDown className="w-3 h-3 text-primary animate-in fade-in duration-150" />
          ) : (
            <ArrowUp className="w-3 h-3 text-primary animate-in fade-in duration-150" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 text-muted-foreground/35 group-hover:text-foreground/70 transition-colors" />
        )}
      </span>
    </button>
  );
}
