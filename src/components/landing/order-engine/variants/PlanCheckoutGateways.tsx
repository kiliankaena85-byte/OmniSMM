'use client';

import React from 'react';
import { CreditCard, Coins, Wallet, Check } from 'lucide-react';

export interface PlanCheckoutGatewaysProps {
  selectedGateway: string;
  setSelectedGateway: (gateway: string) => void;
  availableGateways: { yookassa: boolean; robokassa?: boolean; cryptobot: boolean } | null;
  userBalanceCents: number;
  totalCents: number;
  setLocalError: (err: string | null) => void;
}

export function PlanCheckoutGateways({
  selectedGateway,
  setSelectedGateway,
  availableGateways,
  userBalanceCents,
  totalCents,
  setLocalError,
}: PlanCheckoutGatewaysProps) {
  const hasBalance = userBalanceCents > 0;
  const isBalanceSufficient = userBalanceCents >= totalCents;

  const paymentOptions = [
    {
      id: 'yookassa',
      name: 'Банковская карта РФ / СБП',
      desc: 'Оплата без комиссии через ЮKassa, Mir Pay, SberPay, СБП',
      icon: CreditCard,
      active: availableGateways?.yookassa ?? true,
      disabled: false,
    },
    {
      id: 'cryptobot',
      name: 'CryptoBot',
      desc: 'Криптовалюта (USDT, TON, BTC)',
      icon: Coins,
      active: availableGateways?.cryptobot ?? false,
      disabled: false,
    },
    ...(hasBalance ? [{
      id: 'balance',
      name: 'Личный баланс',
      desc: isBalanceSufficient
        ? `Баланс: ${(userBalanceCents / 100).toFixed(2)} ₽`
        : `Недостаточно средств: ${(userBalanceCents / 100).toFixed(2)} ₽ (нужно ${(totalCents / 100).toFixed(2)} ₽)`,
      icon: Wallet,
      active: true,
      disabled: !isBalanceSufficient,
    }] : []),
  ].filter(opt => opt.active);

  return (
    <div className="space-y-2.5">
      <label className="text-xs font-black text-foreground uppercase tracking-wider block">
        Способ оплаты
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {paymentOptions.map((opt) => {
          const isSelected = selectedGateway === opt.id;
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={opt.disabled}
              onClick={() => {
                if (opt.disabled) return;
                setSelectedGateway(opt.id);
                setLocalError(null);
              }}
              className={`min-h-[56px] p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer active:scale-98 ${
                opt.disabled
                  ? 'opacity-50 cursor-not-allowed bg-muted/20 border-border/40'
                  : isSelected
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-xs'
                  : 'border-border/80 bg-background hover:bg-muted/40 hover:border-border'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                <Icon className="w-5 h-5 shrink-0" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-xs sm:text-sm text-foreground truncate min-w-0">
                  {opt.name}
                </p>
                <p className="text-[11px] text-muted-foreground line-clamp-1">
                  {opt.desc}
                </p>
              </div>
              {isSelected && (
                <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 stroke-[3] shrink-0" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
