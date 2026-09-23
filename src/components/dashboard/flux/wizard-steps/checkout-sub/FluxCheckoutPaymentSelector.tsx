'use client';

import React from 'react';
import { Wallet, CheckCircle2 } from 'lucide-react';

interface FluxCheckoutPaymentSelectorProps {
  gateway: 'balance' | 'yookassa' | 'cryptobot';
  setGateway: (gateway: 'balance' | 'yookassa' | 'cryptobot') => void;
  availableGateways: { yookassa: boolean; robokassa: boolean; cryptobot: boolean };
  userBalanceRub: string;
}

export function FluxCheckoutPaymentSelector({
  gateway,
  setGateway,
  availableGateways,
  userBalanceRub,
}: FluxCheckoutPaymentSelectorProps) {
  return (
    <div className="space-y-2 pt-2">
      <label className="text-xs font-bold text-foreground">Способ оплаты</label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={() => setGateway('balance')}
          className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
            gateway === 'balance'
              ? 'bg-primary/10 border-primary text-primary shadow-xs'
              : 'bg-background border-border/40 hover:border-primary/40 text-foreground'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Wallet className="w-4 h-4 text-emerald-500 shrink-0" />
            <div>
              <span className="font-bold text-xs block">С баланса</span>
              <span className="text-[10px] text-muted-foreground font-mono">{userBalanceRub} ₽</span>
            </div>
          </div>
          {gateway === 'balance' && <CheckCircle2 className="w-4 h-4 text-primary" />}
        </button>

        <button
          type="button"
          onClick={() => setGateway('yookassa')}
          className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
            gateway === 'yookassa'
              ? 'bg-primary/10 border-primary text-primary shadow-xs'
              : 'bg-background border-border/40 hover:border-primary/40 text-foreground'
          }`}
        >
          <div>
            <span className="font-bold text-xs block">ЮKassa / СБП</span>
            <span className="text-[10px] text-muted-foreground">Карты РФ, QR-код</span>
          </div>
          {gateway === 'yookassa' && <CheckCircle2 className="w-4 h-4 text-primary" />}
        </button>

        {availableGateways?.cryptobot && (
          <button
            type="button"
            onClick={() => setGateway('cryptobot')}
            className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
              gateway === 'cryptobot'
                ? 'bg-primary/10 border-primary text-primary shadow-xs'
                : 'bg-background border-border/40 hover:border-primary/40 text-foreground'
            }`}
          >
            <div>
              <span className="font-bold text-xs block">CryptoBot</span>
              <span className="text-[10px] text-muted-foreground">USDT, TON, BTC</span>
            </div>
            {gateway === 'cryptobot' && <CheckCircle2 className="w-4 h-4 text-primary" />}
          </button>
        )}
      </div>
    </div>
  );
}
