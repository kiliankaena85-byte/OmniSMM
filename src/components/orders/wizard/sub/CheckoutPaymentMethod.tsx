'use client';
import React from 'react';
import { Wallet, CreditCard, ShieldCheck } from 'lucide-react';
import { formatCents } from '@/lib/utils';
import { PaymentGateway, AvailableGateways } from '../types';

interface CheckoutPaymentMethodProps {
  gateway: PaymentGateway;
  setGateway: (g: PaymentGateway) => void;
  userBalanceCents: number;
  availableGateways: AvailableGateways | null;
}

export function CheckoutPaymentMethod({ gateway, setGateway, userBalanceCents, availableGateways }: CheckoutPaymentMethodProps) {
  return (
    <div className="space-y-3 pt-2">
      <label className="text-sm font-bold text-foreground block">Способ оплаты</label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button type="button" onClick={() => setGateway('balance')} className={`p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 ${gateway === 'balance' ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm' : 'border-border/60 bg-background/60 hover:bg-card'}`}>
          <Wallet className="w-5 h-5 text-primary shrink-0" />
          <div>
            <span className="text-xs font-bold block text-foreground">С баланса</span>
            <span className="text-[11px] text-muted-foreground block">Доступно: {formatCents(userBalanceCents)} ₽</span>
          </div>
        </button>
        <button type="button" onClick={() => setGateway('yookassa')} className={`p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 ${gateway === 'yookassa' ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm' : 'border-border/60 bg-background/60 hover:bg-card'}`}>
          <CreditCard className="w-5 h-5 text-primary shrink-0" />
          <div>
            <span className="text-xs font-bold block text-foreground">СБП / Карты</span>
            <span className="text-[11px] text-muted-foreground block">ЮKassa (Мгновенно)</span>
          </div>
        </button>
        {availableGateways?.cryptobot && (
          <button type="button" onClick={() => setGateway('cryptobot')} className={`p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 ${gateway === 'cryptobot' ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm' : 'border-border/60 bg-background/60 hover:bg-card'}`}>
            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <span className="text-xs font-bold block text-foreground">CryptoBot</span>
              <span className="text-[11px] text-muted-foreground block">USDT / Кратко</span>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
