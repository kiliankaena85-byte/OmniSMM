'use client';

import * as React from 'react';
import { 
  ShieldCheck, 
  Zap, 
  CreditCard, 
  Rocket 
} from 'lucide-react';
import { 
  type OrderEnvironmentMode, 
  ORDER_ENV_CONFIG,
  normalizeEnvironmentMode
} from '@/utils/order-environment';

interface OrderEnvironmentBadgeProps {
  mode?: OrderEnvironmentMode | string | null;
  size?: 'sm' | 'md';
  className?: string;
  showIcon?: boolean;
}

const ICONS: Record<OrderEnvironmentMode, React.ElementType> = {
  SANDBOX: ShieldCheck,
  HYBRID: Zap,
  ACQUIRING_TEST: CreditCard,
  PRODUCTION: Rocket,
};

export function OrderEnvironmentBadge({
  mode = 'PRODUCTION',
  size = 'sm',
  className = '',
  showIcon = true,
}: OrderEnvironmentBadgeProps) {
  const normalizedMode: OrderEnvironmentMode = normalizeEnvironmentMode(mode) || 'PRODUCTION';

  const config = ORDER_ENV_CONFIG[normalizedMode] || ORDER_ENV_CONFIG.PRODUCTION;
  const Icon = ICONS[normalizedMode] || Rocket;

  const isSmall = size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-bold tracking-tight border select-none whitespace-nowrap shadow-2xs transition-all ${config.badgeClass} ${
        isSmall 
          ? 'text-[10px] px-1.5 py-0.5 leading-none' 
          : 'text-xs px-2 py-0.5'
      } ${className}`}
      title={config.description}
      onClick={(e) => e.stopPropagation()}
    >
      {showIcon && (
        <Icon className={isSmall ? 'w-2.5 h-2.5 shrink-0' : 'w-3.5 h-3.5 shrink-0'} />
      )}
      <span>{config.shortLabel}</span>
    </span>
  );
}
