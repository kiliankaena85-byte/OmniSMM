'use client';

import React from "react";
import { CreditCard, Wallet, Coins } from "lucide-react";

export interface PaymentGatewaySectionProps {
  selectedGateway: string;
  setSelectedGateway: (val: string) => void;
  availableGateways: { yookassa: boolean; robokassa: boolean; cryptobot: boolean } | null;
  userBalanceCents: number;
}

export function PaymentGatewaySection({
  selectedGateway,
  setSelectedGateway,
  availableGateways,
  userBalanceCents,
}: PaymentGatewaySectionProps) {
  return (
    <div className="mb-5">
      <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">
        Способ оплаты
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {(availableGateways?.yookassa ?? true) && (
          <button
            type="button"
            onClick={() => setSelectedGateway("yookassa")}
            className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
              selectedGateway === "yookassa" 
                ? "border-primary bg-primary/10 shadow-sm" 
                : "border-border/70 hover:border-border bg-background"
            }`}
          >
            <CreditCard className="w-5 h-5 text-primary mb-1.5" />
            <div>
              <p className="font-bold text-xs text-foreground">Банковская карта</p>
              <p className="text-[10px] text-muted-foreground">РФ, СБП, Mir</p>
            </div>
          </button>
        )}

        {userBalanceCents > 0 && (
          <button
            type="button"
            onClick={() => setSelectedGateway("balance")}
            className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
              selectedGateway === "balance" 
                ? "border-primary bg-primary/10 shadow-sm" 
                : "border-border/70 hover:border-border bg-background"
            }`}
          >
            <Wallet className="w-5 h-5 text-emerald-500 mb-1.5" />
            <div>
              <p className="font-bold text-xs text-foreground">Мой баланс</p>
              <p className="text-[10px] text-muted-foreground font-mono">{(userBalanceCents / 100).toFixed(0)} ₽</p>
            </div>
          </button>
        )}

        {availableGateways?.robokassa && (
          <button
            type="button"
            onClick={() => setSelectedGateway("robokassa")}
            className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
              selectedGateway === "robokassa" 
                ? "border-primary bg-primary/10 shadow-sm" 
                : "border-border/70 hover:border-border bg-background"
            }`}
          >
            <CreditCard className="w-5 h-5 text-indigo-500 mb-1.5" />
            <div>
              <p className="font-bold text-xs text-foreground">Robokassa</p>
              <p className="text-[10px] text-muted-foreground">СБП, Карты</p>
            </div>
          </button>
        )}

        {availableGateways?.cryptobot && (
          <button
            type="button"
            onClick={() => setSelectedGateway("cryptobot")}
            className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
              selectedGateway === "cryptobot" 
                ? "border-primary bg-primary/10 shadow-sm" 
                : "border-border/70 hover:border-border bg-background"
            }`}
          >
            <Coins className="w-5 h-5 text-amber-500 mb-1.5" />
            <div>
              <p className="font-bold text-xs text-foreground">Криптовалюта</p>
              <p className="text-[10px] text-muted-foreground">USDT, TON, BTC</p>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
