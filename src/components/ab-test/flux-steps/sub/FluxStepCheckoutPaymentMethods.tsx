import React from "react";
import { CreditCard, Wallet, Coins, Check } from "lucide-react";
import type { PaymentMethodItem } from "./types";

interface FluxStepCheckoutPaymentMethodsProps {
  selectedGateway: string;
  setSelectedGateway: (val: string) => void;
  availableGateways: { yookassa: boolean; robokassa: boolean; cryptobot: boolean } | null;
  userBalanceCents?: number;
  price: string;
}

export function FluxStepCheckoutPaymentMethods({
  selectedGateway,
  setSelectedGateway,
  availableGateways,
  userBalanceCents,
  price,
}: FluxStepCheckoutPaymentMethodsProps) {
  const totalCents = Math.round(parseFloat(price || "0") * 100);
  const hasBalance = userBalanceCents !== undefined && userBalanceCents > 0;
  const isBalanceSufficient = hasBalance && userBalanceCents >= totalCents;

  const methods: PaymentMethodItem[] = [
    ...(hasBalance ? [{
      id: "balance",
      name: "Личный баланс",
      desc: isBalanceSufficient
        ? `Доступно: ${(userBalanceCents / 100).toFixed(2)} ₽`
        : `Недостаточно: ${(userBalanceCents / 100).toFixed(2)} ₽ (нужно ${price} ₽)`,
      icon: Wallet,
      gradient: "from-emerald-500/15 via-teal-500/10 to-transparent",
      borderActive: "border-emerald-500 ring-2 ring-emerald-500/30",
      iconColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      disabled: !isBalanceSufficient
    }] : []),
    {
      id: "yookassa",
      name: "Карты РФ и СБП",
      desc: "Мгновенное зачисление, 0% комиссии",
      icon: CreditCard,
      gradient: "from-purple-500/15 via-fuchsia-500/10 to-transparent",
      borderActive: "border-purple-500 ring-2 ring-purple-500/30",
      iconColor: "text-purple-400 bg-purple-500/10 border-purple-500/20",
      disabled: false
    },
    {
      id: "robokassa",
      name: "Зарубежные карты и кошельки",
      desc: "Карты СНГ и международные платежи",
      icon: Coins,
      gradient: "from-blue-500/15 via-cyan-500/10 to-transparent",
      borderActive: "border-blue-500 ring-2 ring-blue-500/30",
      iconColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
      disabled: false
    },
    {
      id: "cryptobot",
      name: "Криптовалюта (CryptoBot)",
      desc: "USDT, TON, BTC, ETH. Анонимно",
      icon: Wallet,
      gradient: "from-amber-500/15 via-orange-500/10 to-transparent",
      borderActive: "border-amber-500 ring-2 ring-amber-500/30",
      iconColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      disabled: false
    }
  ];

  const activeMethods = methods.filter((m) => {
    if (m.id === "balance") return true;
    if (!availableGateways) return m.id === "yookassa";
    return availableGateways[m.id as keyof typeof availableGateways] === true;
  });

  return (
    <div className="w-full mb-4 space-y-2">
      <label className="block text-xs font-bold text-foreground/80 uppercase tracking-wider ml-1">
        Способ оплаты
      </label>
      <div className="grid grid-cols-1 gap-2">
        {activeMethods.map((m) => {
          const isSelected = selectedGateway === m.id;
          const IconComponent = m.icon;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                if (m.disabled) return;
                setSelectedGateway(m.id);
              }}
              className={`w-full min-h-[52px] p-3 rounded-2xl border text-left flex items-center gap-3 transition-all duration-200 ${
                m.disabled
                  ? "opacity-50 cursor-not-allowed border-border/40 bg-background/20"
                  : isSelected
                  ? `${m.borderActive} bg-gradient-to-r ${m.gradient} bg-background/80 shadow-md cursor-pointer active:scale-[0.99]`
                  : "border-border/60 bg-background/40 hover:border-border hover:bg-background/60 cursor-pointer active:scale-[0.99]"
              }`}
            >
              <div className={`p-2 rounded-xl shrink-0 border ${m.iconColor}`}>
                <IconComponent className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground leading-tight">
                  {m.name}
                </p>
                <p className="text-[11px] text-muted-foreground font-medium mt-0.5 truncate">
                  {m.desc}
                </p>
              </div>
              {isSelected && (
                <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
