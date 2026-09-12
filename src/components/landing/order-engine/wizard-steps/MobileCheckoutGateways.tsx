'use client';

import React from "react";

export interface MobileCheckoutGatewaysProps {
  selectedGateway: string;
  setSelectedGateway: (gateway: string) => void;
  availableGateways: { yookassa: boolean; robokassa: boolean; cryptobot: boolean } | null;
  userBalanceCents?: number;
  totalCents: number;
  setLocalError: (err: string | null) => void;
  setShakeKey: React.Dispatch<React.SetStateAction<number>>;
}

export function MobileCheckoutGateways({
  selectedGateway,
  setSelectedGateway,
  availableGateways,
  userBalanceCents,
  totalCents,
  setLocalError,
  setShakeKey,
}: MobileCheckoutGatewaysProps) {
  const safeBalanceCents = userBalanceCents ?? 0;
  const hasBalance = userBalanceCents !== undefined && userBalanceCents > 0;
  const isBalanceSufficient = hasBalance && safeBalanceCents >= totalCents;

  const gateways = [
    ...(hasBalance ? [{
      id: "balance",
      name: "Мой баланс",
      subtitle: `${(safeBalanceCents / 100).toFixed(0)} ₽`,
      badge: isBalanceSufficient ? "БАЛАНС" : "МАЛО",
      icon: "💰",
      disabled: !isBalanceSufficient
    }] : []),
    ...((availableGateways?.yookassa ?? true) ? [{
      id: "yookassa",
      name: "СБП / Карты",
      subtitle: "0% комиссия",
      badge: "ХИТ",
      icon: "⚡",
      disabled: false
    }] : []),
    ...(availableGateways?.cryptobot ? [{
      id: "cryptobot",
      name: "Крипта",
      subtitle: "USDT / TON",
      icon: "💎",
      disabled: false
    }] : []),
    ...(availableGateways?.robokassa ? [{
      id: "robokassa",
      name: "Зарубежные",
      subtitle: "Карты / СНГ",
      icon: "🌐",
      disabled: false
    }] : []),
  ];

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-center justify-between px-1">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Способ оплаты
        </label>
        <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
          0% комиссия через СБП
        </span>
      </div>

      <div className={`grid gap-1.5 ${
        gateways.length === 1
          ? "grid-cols-1"
          : gateways.length === 2
          ? "grid-cols-2"
          : gateways.length === 3
          ? "grid-cols-2 sm:grid-cols-3"
          : "grid-cols-2 sm:grid-cols-4"
      }`}>
        {gateways.map((gateway) => {
          const isSelected = selectedGateway === gateway.id;
          return (
            <button
              key={gateway.id}
              type="button"
              onClick={() => {
                if (gateway.disabled) {
                  setLocalError(`Недостаточно средств на балансе (${(safeBalanceCents / 100).toFixed(2)} ₽). Пополните баланс в ЛК или выберите оплату картой.`);
                  setShakeKey(prev => prev + 1);
                  return;
                }
                setLocalError(null);
                setSelectedGateway(gateway.id);
              }}
              className={`p-2 rounded-xl border text-left flex flex-col justify-between gap-0.5 transition-all cursor-pointer active:scale-95 min-h-[52px] relative overflow-hidden ${
                gateway.disabled
                  ? "opacity-60 cursor-not-allowed border-border/30 bg-content2/50 text-muted-foreground"
                  : isSelected
                  ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm"
                  : "border-border/50 bg-content2 hover:bg-content3 hover:border-border text-muted-foreground"
              }`}
            >
              {gateway.badge && (
                <span className={`absolute top-1 right-1 text-[8px] font-black uppercase tracking-wider px-1 py-0.2 rounded ${
                  gateway.id === 'balance' && isBalanceSufficient
                    ? "bg-success text-success-foreground"
                    : gateway.disabled
                    ? "bg-muted text-muted-foreground"
                    : "bg-primary text-primary-foreground"
                }`}>
                  {gateway.badge}
                </span>
              )}
              <div className="flex items-center gap-1">
                <span className="text-sm">{gateway.icon}</span>
                <span className={`text-[11px] font-bold ${isSelected ? "text-foreground" : "text-foreground/80"}`}>
                  {gateway.name}
                </span>
              </div>
              <span className="text-[9px] font-medium text-muted-foreground">
                {gateway.subtitle}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
