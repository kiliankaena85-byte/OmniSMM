'use client';

import React from "react";
import { LinkIcon } from "lucide-react";
import type { PublicService } from "@/actions/order/catalog";

export interface RecapAndLinkSectionProps {
  selectedService: PublicService;
  link: string;
  setLink: (val: string) => void;
  quantity: number | string;
  setQuantity: (val: number | string) => void;
  linkRef: React.RefObject<HTMLInputElement | null>;
  quantityRef: React.RefObject<HTMLInputElement | null>;
}

export function RecapAndLinkSection({
  selectedService,
  link,
  setLink,
  quantity,
  setQuantity,
  linkRef,
  quantityRef,
}: RecapAndLinkSectionProps) {
  return (
    <>
      {/* Selected Tariff Recap */}
      <div className="mb-4 pb-4 border-b border-border/60 flex justify-between items-start gap-3">
        <div>
          <span className="text-[10px] font-bold text-primary uppercase tracking-wider block mb-0.5">
            Выбранный тариф
          </span>
          <h3 className="text-lg sm:text-xl font-extrabold text-foreground leading-snug">
            {selectedService.name}
          </h3>
        </div>

        <div className="text-right flex-shrink-0">
          <span className="text-lg sm:text-xl font-black text-primary font-mono block">
            {selectedService.pricePerUnitRub.toFixed(2)} ₽
          </span>
          <span className="text-[10px] text-muted-foreground">за 1 шт</span>
        </div>
      </div>

      {/* Service description if present */}
      {selectedService.description && (
        <div className="mb-4 p-3 rounded-xl bg-muted/50 border border-border/50 text-xs text-muted-foreground leading-relaxed max-h-24 overflow-y-auto whitespace-pre-wrap">
          {selectedService.description}
        </div>
      )}

      {/* 0. Ссылка для заказа */}
      <div id="field-link" className="mb-4">
        <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
          <LinkIcon className="w-3.5 h-3.5 text-primary" />
          <span>Ссылка для заказа</span>
          <span className="text-destructive font-bold">*</span>
        </label>
        <input
          ref={linkRef}
          name="link"
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          className="w-full h-11 px-3.5 rounded-xl bg-background border border-border/80 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm font-medium text-foreground"
          placeholder="https://t.me/channel"
        />
      </div>

      {/* 1. Количество */}
      <div id="field-quantity" className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <span>Количество</span>
            <span className="text-destructive font-bold">*</span>
          </label>
          <span className="text-[11px] text-muted-foreground font-mono">
            Мин: {selectedService.minQty} · Макс: {selectedService.maxQty.toLocaleString('ru-RU')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={quantityRef}
            name="quantity"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={quantity}
            onFocus={(e) => { const t = e.target; setTimeout(() => t.select(), 10); }}
            onClick={(e) => { const t = e.target as HTMLInputElement; setTimeout(() => t.select(), 10); }}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '');
              setQuantity(val ? parseInt(val) : '');
            }}
            className="flex-1 h-11 px-3.5 rounded-xl bg-background border border-border/80 focus:border-primary focus:ring-1 focus:ring-primary outline-none font-mono text-base font-bold text-foreground"
            placeholder={String(selectedService.minQty)}
          />
        </div>
      </div>
    </>
  );
}
