'use client';

import React, { useState, useEffect } from "react";
import { Check, CreditCard, Coins, Wallet } from "lucide-react";
import { getAvailableGatewaysAction } from "@/actions/order/checkout";

interface DrawerPaymentSelectorProps {
  gateway: "yookassa" | "cryptobot" | "balance";
  setGateway: (g: "yookassa" | "cryptobot" | "balance") => void;
  userBalanceCents?: number;
  totalCents: number;
}

export function DrawerPaymentSelector({
  gateway,
  setGateway,
  userBalanceCents = 0,
  totalCents
}: DrawerPaymentSelectorProps) {
  const [available, setAvailable] = useState<{ yookassa: boolean; robokassa: boolean; cryptobot: boolean } | null>(null);

  useEffect(() => {
    getAvailableGatewaysAction().then((res) => {
      if (res.success && res.data) {
        setAvailable(res.data);
        if (gateway !== "balance" && !res.data[gateway as keyof typeof res.data]) {
          const first = (["yookassa", "cryptobot"] as const).find((g) => res.data?.[g]);
          if (first) {
            setGateway(first);
          }
        }
      }
    });
  }, [gateway, setGateway]);

  const hasBalance = userBalanceCents > 0;
  const isBalanceSufficient = userBalanceCents >= totalCents;

  const allMethods = [
    {
      id: "yookassa" as const,
      name: "Карта РФ / СБП",
      description: "Оплата через ЮKassa или Систему быстрых платежей",
      icon: CreditCard,
      color: "text-primary border-primary/20 bg-primary/5",
      disabled: false
    },
    {
      id: "cryptobot" as const,
      name: "CryptoBot",
      description: "Оплата криптовалютой (USDT, TON и др.)",
      icon: Coins,
      color: "text-warning border-warning/20 bg-warning/5",
      disabled: false
    },
    ...(hasBalance ? [{
      id: "balance" as const,
      name: "Личный баланс",
      description: isBalanceSufficient
        ? `Баланс: ${(userBalanceCents / 100).toFixed(2)} ₽`
        : `Недостаточно: ${(userBalanceCents / 100).toFixed(2)} ₽ (нужно ${(totalCents / 100).toFixed(2)} ₽)`,
      icon: Wallet,
      color: isBalanceSufficient ? "text-success border-success/20 bg-success/5" : "text-muted-foreground border-border/80 bg-content2 opacity-60",
      disabled: !isBalanceSufficient
    }] : [])
  ];

  const paymentMethods = allMethods.filter((m) => {
    if (m.id === "balance") return true;
    if (!available) return m.id === "yookassa"; // optimistic default: only primary YooKassa until verified
    return available[m.id as keyof typeof available] === true;
  });

  return (
    <div className="bg-card border border-border/80 rounded-2xl p-5 space-y-3.5 shadow-sm">
      <label className="text-xs sm:text-sm font-black text-foreground uppercase tracking-wider block">
        Способ оплаты
      </label>

      <div className="flex flex-col gap-2.5">
        {paymentMethods.map((method) => {
          const isSelected = gateway === method.id;
          const Icon = method.icon;

          return (
            <button
              key={method.id}
              type="button"
              onClick={() => {
                if (method.disabled) return;
                setGateway(method.id);
              }}
              className={`w-full min-h-[56px] p-3.5 rounded-xl border text-left flex items-center gap-3.5 transition-all duration-200 active:scale-[0.99] ${
                method.disabled
                  ? "opacity-60 cursor-not-allowed border-border/40 bg-content2/50"
                  : isSelected
                  ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-xs cursor-pointer"
                  : "border-border/80 bg-background hover:border-border hover:bg-content2 cursor-pointer"
              }`}
            >
              <div className={`p-2.5 rounded-xl shrink-0 ${isSelected ? method.color : "bg-content2 text-foreground/70 border border-border/80"}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-sm font-black text-foreground leading-tight">
                  {method.name}
                </p>
                <p className="text-xs text-muted-foreground font-semibold mt-0.5 truncate leading-tight min-w-0">
                  {method.description}
                </p>
              </div>
              {isSelected && (
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-xs self-center">
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
