'use client';

import React, { useState } from "react";
import { Minus, Plus, Sliders, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { PublicService } from "@/actions/order/catalog";
import { DripFeedConfigurator } from "../DripFeedConfigurator";

export interface MobileCheckoutQuantityProps {
  engine: OrderEngine;
  selectedService: PublicService;
}

export function MobileCheckoutQuantity({
  engine,
  selectedService,
}: MobileCheckoutQuantityProps) {
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);
  const { quantity, setQuantity } = engine;

  const minQty = selectedService.minQty || 10;
  const maxQty = selectedService.maxQty || 1000000;

  const handleStepQuantity = (delta: number) => {
    const nextVal = Math.min(maxQty, Math.max(minQty, quantity + delta));
    setQuantity(nextVal);
  };

  return (
    <div className="space-y-4">
      {/* Количество со степперами */}
      <div className="space-y-2 bg-content2/40 p-3 rounded-2xl border border-border/40">
        <div className="flex items-center justify-between">
          <label htmlFor="quantity-input" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Количество (мин: {minQty.toLocaleString()})
          </label>
          <span className="text-xs font-extrabold text-foreground tabular-nums">
            {quantity.toLocaleString()} шт
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleStepQuantity(-100)}
            disabled={quantity <= minQty}
            aria-label="Уменьшить количество на 100"
            className="w-11 h-11 rounded-xl bg-content2 hover:bg-content3 disabled:opacity-40 border border-border/50 flex items-center justify-center text-foreground font-black shrink-0 active:scale-95 transition-all cursor-pointer"
          >
            <Minus className="w-4 h-4 shrink-0" />
          </button>

          <input
            id="quantity-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={quantity || ''}
            onFocus={(e) => {
              const target = e.currentTarget;
              setTimeout(() => {
                target.focus();
                target.select();
              }, 10);
            }}
            onClick={(e) => {
              e.currentTarget.focus();
              e.currentTarget.select();
            }}
            onChange={e => {
              const clean = e.target.value.replace(/\D/g, '');
              let val = clean ? parseInt(clean, 10) : 0;
              if (maxQty && val > maxQty) val = maxQty;
              setQuantity(val);
            }}
            onBlur={() => {
              if (!quantity || quantity < minQty) {
                setQuantity(minQty);
              }
            }}
            className={`w-full h-11 px-3 text-center rounded-xl border bg-background text-base font-black tabular-nums text-foreground outline-none transition-all ${
              quantity < minQty
                ? 'border-danger focus:border-danger ring-2 ring-danger/20'
                : 'border-border focus:border-primary focus:ring-2 ring-primary/20'
            }`}
          />

          <button
            type="button"
            onClick={() => handleStepQuantity(100)}
            disabled={quantity >= maxQty}
            aria-label="Увеличить количество на 100"
            className="w-11 h-11 rounded-xl bg-content2 hover:bg-content3 disabled:opacity-40 border border-border/50 flex items-center justify-center text-foreground font-black shrink-0 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
          </button>
        </div>

        {quantity > 0 && quantity < minQty && (
          <p className="text-[11px] font-bold text-danger pl-1 animate-in fade-in duration-200">
            Минимум: {minQty} шт. При потере фокуса исправим автоматически.
          </p>
        )}
      </div>

      {/* Дополнительные параметры (Drip-feed) */}
      {(selectedService.isDripFeedEnabled || selectedService.smartConfig?.isEnabled) && (
        <div className="space-y-2 border border-border/50 rounded-2xl bg-content2/40 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvancedParams(!showAdvancedParams)}
            className="w-full h-11 px-4 flex items-center justify-between text-xs font-extrabold text-foreground uppercase tracking-wider hover:bg-content2/80 active:scale-[0.99] transition-all cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-primary shrink-0" />
              <span>Дополнительные параметры</span>
            </span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${showAdvancedParams ? 'rotate-180' : ''}`} />
          </button>
          
          <AnimatePresence>
            {showAdvancedParams && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden px-3 pb-3"
              >
                <DripFeedConfigurator engine={engine} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
