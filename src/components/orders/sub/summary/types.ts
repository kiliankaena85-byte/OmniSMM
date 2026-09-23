import type { OrderEngine } from '@/hooks/useOrderEngine';

export interface OrderSummaryCardProps {
  userBalanceCents: number;
  engine: OrderEngine;
}

export type PaymentGateway = 'yookassa' | 'balance' | 'cryptobot';

export const inputCls =
  'w-full rounded-xl border border-border bg-background text-foreground ' +
  'text-sm outline-none placeholder:text-muted-foreground ' +
  'focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200';
