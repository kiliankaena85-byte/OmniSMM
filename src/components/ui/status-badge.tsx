import React from 'react';
import { cn } from '@/lib/utils';

type BadgeStatus = 
  | 'PENDING'
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'CLOSED'
  | 'PARTIAL'
  | 'CANCELED'
  | 'ERROR'
  | 'FAIL'
  | string;

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: BadgeStatus;
  count?: number;
  label?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  // Pending / Waiting
  PENDING: { label: 'Ожидает', className: 'bg-muted text-foreground border-border' },
  OPEN: { label: 'Открыт', className: 'bg-primary/10 text-primary border-primary/20' },
  
  // Active / Processing
  IN_PROGRESS: { label: 'В работе', className: 'bg-primary/10 text-primary border-primary/20' },
  PROCESSING: { label: 'В процессе', className: 'bg-primary/10 text-primary border-primary/20' },
  
  // Success / Completed
  COMPLETED: { label: 'Выполнен', className: 'bg-primary text-primary-foreground border-primary' },
  CLOSED: { label: 'Закрыт', className: 'bg-muted text-muted-foreground border-border' },
  
  // Warning / Partial
  PARTIAL: { label: 'Частично', className: 'bg-destructive/20 text-destructive border-destructive/30' },
  
  // Error / Canceled
  CANCELED: { label: 'Отменен', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  ERROR: { label: 'Ошибка', className: 'bg-destructive text-destructive-foreground border-destructive' },
  FAIL: { label: 'Сбой', className: 'bg-destructive text-destructive-foreground border-destructive' },
};

export function StatusBadge({ status, count, label, className, ...props }: StatusBadgeProps) {
  const normalizedStatus = status?.toUpperCase() || 'UNKNOWN';
  const config = statusConfig[normalizedStatus] || { 
    label: status || 'Неизвестно', 
    className: 'bg-muted text-muted-foreground border-border' 
  };

  const displayLabel = label !== undefined ? label : config.label;

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md border",
        config.className,
        className
      )}
      {...props}
    >
      {displayLabel && <span>{displayLabel}</span>}
      {count !== undefined && count > 0 && (
        <span className={cn(
          "px-1 py-0.5 rounded-sm bg-background/20 text-[9px] leading-none",
          displayLabel ? "ml-1.5" : ""
        )}>
          {count}
        </span>
      )}
    </span>
  );
}
