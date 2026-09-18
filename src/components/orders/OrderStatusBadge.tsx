'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { getStatusConfig } from '@/utils/status-helpers';

interface OrderStatusBadgeProps {
  status: string;
  className?: string;
  size?: 'sm' | 'md';
  showDot?: boolean;
}

export function OrderStatusBadge({
  status,
  className,
  size = 'md',
  showDot = true,
}: OrderStatusBadgeProps) {
  const config = getStatusConfig(status);
  const normalized = (status || '').toUpperCase();
  // WRK-06: PROVISIONING is displayed but never assigned by any worker/action.
  // Kept for future "dispatched, awaiting provider acceptance" state.
  const isLive = normalized === 'IN_PROGRESS' || normalized === 'PROVISIONING' || normalized === 'CANCELING';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-bold uppercase tracking-wider rounded-lg border transition-all duration-200 shadow-xs',
        size === 'sm' ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]',
        config.badgeClass,
        className
      )}
    >
      {showDot && (
        <span className="relative flex h-2 w-2 items-center justify-center">
          {isLive && (
            <span
              className={cn(
                'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
                config.dotClass
              )}
            />
          )}
          <span
            className={cn(
              'relative inline-flex rounded-full h-1.5 w-1.5',
              config.dotClass
            )}
          />
        </span>
      )}
      <span>{config.label}</span>
    </span>
  );
}
