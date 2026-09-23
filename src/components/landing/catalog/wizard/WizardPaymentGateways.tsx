'use client';

import React from 'react';
import { Wallet, QrCode, CreditCard } from 'lucide-react';
export type PaymentMethodType = 'sbp' | 'card' | 'crypto' | 'balance';

interface GatewaysConfig {
  yookassa: boolean;
  sbp?: boolean;
  robokassa: boolean;
  cryptobot: boolean;
}

interface WizardPaymentGatewaysProps {
  paymentMethod: PaymentMethodType;
  setPaymentMethod: (method: PaymentMethodType) => void;
  availableGateways: GatewaysConfig | null;
  userBalanceCents: number;
}

export function WizardPaymentGateways({
  paymentMethod,
  setPaymentMethod,
  availableGateways,
  userBalanceCents,
}: WizardPaymentGatewaysProps) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
        Способ оплаты:
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
        {userBalanceCents > 0 && (
          <button
            type="button"
            className={`p-3 min-h-[44px] rounded-2xl border text-left transition-all cursor-pointer ${
              paymentMethod === 'balance'
                ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20'
                : 'border-border bg-card hover:border-border/80'
            }`}
            onClick={() => setPaymentMethod('balance')}
          >
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="font-bold text-xs">Мой баланс</span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              {(userBalanceCents / 100).toFixed(2)} ₽
            </span>
          </button>
        )}

        {(!availableGateways || availableGateways.yookassa) && (
          <button
            type="button"
            className={`p-3 min-h-[44px] rounded-2xl border text-left transition-all cursor-pointer ${
              paymentMethod === 'sbp'
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                : 'border-border bg-card hover:border-border/80'
            }`}
            onClick={() => setPaymentMethod('sbp')}
          >
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-primary shrink-0" />
              <span className="font-bold text-xs">СБП / QR</span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">0% комиссии</span>
          </button>
        )}

        {(!availableGateways || availableGateways.yookassa) && (
          <button
            type="button"
            className={`p-3 min-h-[44px] rounded-2xl border text-left transition-all cursor-pointer ${
              paymentMethod === 'card'
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                : 'border-border bg-card hover:border-border/80'
            }`}
            onClick={() => setPaymentMethod('card')}
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary shrink-0" />
              <span className="font-bold text-xs">Карта РФ</span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">МИР / Visa / MC</span>
          </button>
        )}

        {(!availableGateways || availableGateways.cryptobot) && (
          <button
            type="button"
            className={`p-3 min-h-[44px] rounded-2xl border text-left transition-all cursor-pointer ${
              paymentMethod === 'crypto'
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                : 'border-border bg-card hover:border-border/80'
            }`}
            onClick={() => setPaymentMethod('crypto')}
          >
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary shrink-0" />
              <span className="font-bold text-xs">Crypto</span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">USDT / TON / BTC</span>
          </button>
        )}
      </div>
    </div>
  );
}
