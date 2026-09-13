'use client';
import { PublicService } from '@/actions/order/catalog';

import React from "react";
import { motion } from "framer-motion";
import { Plus, Minus, Lock } from "lucide-react";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { getServiceFlags } from "@/utils/url-analyzer";
import { formatPricePerUnit } from "@/utils/format-price";

interface DrawerQuantityCardProps {
  selectedService: PublicService | null;
  quantity: number;
  setQuantity: (q: number) => void;
  pricing: OrderEngine["pricing"];
  engine: OrderEngine;
  quantityHasError?: boolean;
}

export function DrawerQuantityCard({
  selectedService,
  quantity,
  setQuantity,
  pricing,
  engine,
  quantityHasError = false
}: DrawerQuantityCardProps) {
  if (!selectedService) return null;
  const dripMultiplier = engine.dripFeedEnabled ? engine.runs : (engine.isSmartDrip ? engine.smartDripDays : 1);
  const min = (selectedService.minQty || 10) * dripMultiplier;
  const max = selectedService.maxQty || 100000;

  const { isCustomComments } = getServiceFlags(selectedService);

  const retailPricePerUnit = selectedService.pricePerUnitRub;
  const discountAmount = pricing && pricing.discountCents > 0 ? pricing.discountCents / 100 : 0;

  const handleIncrement = () => {
    if (isCustomComments) return;
    const step = quantity >= 1000 ? 500 : (quantity >= 100 ? 50 : (dripMultiplier > 1 ? dripMultiplier : 10));
    setQuantity(Math.min(max, quantity + step));
  };

  const handleDecrement = () => {
    if (isCustomComments) return;
    const step = quantity > 1000 ? 500 : (quantity > 100 ? 50 : (dripMultiplier > 1 ? dripMultiplier : 10));
    setQuantity(Math.max(min, quantity - step));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isCustomComments) return;
    const cleanValue = e.target.value.replace(/\D/g, "");
    let val = cleanValue === "" ? 0 : Number(cleanValue);
    if (val > max) val = max;
    setQuantity(val);
  };

  const handleInputBlur = () => {
    if (isCustomComments) return;
    if (!quantity || quantity < min) {
      setQuantity(min);
    } else if (quantity > max) {
      setQuantity(max);
    }
  };

  return (
    <motion.div
      animate={quantityHasError ? { x: [0, -6, 6, -6, 6, 0] } : {}}
      transition={{ duration: 0.4 }}
      className={`bg-card border rounded-2xl p-4 sm:p-4.5 space-y-3 shadow-sm ring-1 transition-all ${
        quantityHasError
          ? "border-destructive ring-destructive/30 bg-destructive/5"
          : "border-border/80 ring-primary/5"
      }`}
    >
      <div className="flex items-center justify-between">
        <label className="text-xs sm:text-sm font-black text-foreground uppercase tracking-wider">
          Количество заказа
        </label>
        <div className="flex items-center gap-2">
          {discountAmount > 0 && (
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
              Скидка −{discountAmount.toFixed(2)} ₽
            </span>
          )}
          <span className="text-xs sm:text-sm font-bold text-primary font-mono tabular-nums bg-primary/10 px-2.5 py-0.5 rounded-lg border border-primary/20">
            {formatPricePerUnit(retailPricePerUnit)} ₽ / шт
          </span>
        </div>
      </div>

      {/* Stepper controls */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={quantity <= min || isCustomComments}
          className="w-11 h-11 sm:w-12 sm:h-12 bg-background hover:bg-content2 border border-border/80 text-foreground rounded-xl flex items-center justify-center transition-all disabled:opacity-40 disabled:pointer-events-none active:scale-90 cursor-pointer shadow-2xs group shrink-0"
          title="Уменьшить"
        >
          <Minus className="w-4 h-4 sm:w-4.5 sm:h-4.5 group-hover:scale-110 transition-transform shrink-0" />
        </button>

        <div className="flex-1 relative">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            min={min}
            max={max}
            value={quantity || ""}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            disabled={isCustomComments}
            onFocus={(e) => {
              if (typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches) {
                e.currentTarget.select();
              }
            }}
            placeholder={String(min)}
            className={`w-full h-11 sm:h-12 px-3 rounded-xl border border-border/80 bg-background text-lg sm:text-xl font-black tabular-nums font-mono text-foreground text-center focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-2xs ${
              isCustomComments ? "opacity-75 cursor-not-allowed select-none bg-content2" : ""
            }`}
          />
          {isCustomComments && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" title="Количество заблокировано">
              <Lock className="w-4 h-4" />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleIncrement}
          disabled={quantity >= max || isCustomComments}
          className="w-11 h-11 sm:w-12 sm:h-12 bg-background hover:bg-content2 border border-border/80 text-foreground rounded-xl flex items-center justify-center transition-all disabled:opacity-40 disabled:pointer-events-none active:scale-90 cursor-pointer shadow-2xs group shrink-0"
          title="Увеличить"
        >
          <Plus className="w-4 h-4 sm:w-4.5 sm:h-4.5 group-hover:scale-110 transition-transform shrink-0" />
        </button>
      </div>

      {/* Compact limits hint */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium px-1">
        <span>
          Мин: <strong className="text-foreground font-mono">{min.toLocaleString("ru-RU")}</strong>
          {dripMultiplier > 1 && (
            <span className="text-primary font-normal text-[10px] ml-1">
              ({selectedService.minQty} × {dripMultiplier} зап.)
            </span>
          )}
        </span>
        <span>Макс: <strong className="text-foreground font-mono">{max.toLocaleString("ru-RU")}</strong></span>
      </div>
    </motion.div>
  );
}
