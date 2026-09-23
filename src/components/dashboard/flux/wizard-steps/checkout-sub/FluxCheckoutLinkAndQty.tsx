'use client';

import React from 'react';
import { HelpCircle, LinkIcon } from 'lucide-react';
import type { FluxService } from '@/types/flux';

interface FluxCheckoutLinkAndQtyProps {
  selectedService: FluxService;
  link: string;
  setLink: (link: string) => void;
  linkRef: React.RefObject<HTMLInputElement | null>;
  quantity: number | string;
  setQuantity: (qty: number | string) => void;
  quantityRef: React.RefObject<HTMLInputElement | null>;
  qtyNum: number;
  errorField: string | null;
  shakeKey: number;
  setIsTgGuideOpen: (open: boolean) => void;
}

export function FluxCheckoutLinkAndQty({
  selectedService,
  link,
  setLink,
  linkRef,
  quantity,
  setQuantity,
  quantityRef,
  qtyNum,
  errorField,
  shakeKey,
  setIsTgGuideOpen,
}: FluxCheckoutLinkAndQtyProps) {
  return (
    <>
      {/* Link Input Field */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-foreground">Ссылка для продвижения</label>
          <button
            type="button"
            onClick={() => setIsTgGuideOpen(true)}
            className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" /> Как правильно скопировать ссылку?
          </button>
        </div>
        <div className="relative">
          <LinkIcon className="text-muted-foreground w-4 h-4 absolute left-4 top-4" />
          <input
            ref={linkRef}
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://t.me/... или https://vk.com/..."
            className={`w-full h-12 pl-11 pr-4 bg-background border ${
              errorField === 'link' ? 'border-destructive animate-shake' : 'border-border/60 focus:border-primary'
            } rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground transition-all`}
            key={errorField === 'link' ? `link-${shakeKey}` : 'link-ok'}
          />
        </div>
      </div>

      {/* Quantity Field */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-foreground">Количество</label>
          <span className="text-[11px] text-muted-foreground font-mono">
            {selectedService.minQty} — {selectedService.maxQty} шт
          </span>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={quantityRef}
            type="number"
            min={selectedService.minQty}
            max={selectedService.maxQty}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
            className={`w-36 h-12 px-4 text-center font-mono font-black text-lg bg-background border ${
              errorField === 'quantity' ? 'border-destructive animate-shake' : 'border-border/60 focus:border-primary'
            } rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground transition-all`}
            key={errorField === 'quantity' ? `qty-${shakeKey}` : 'qty-ok'}
          />
          <input
            type="range"
            min={selectedService.minQty}
            max={Math.min(10000, selectedService.maxQty)}
            step={10}
            value={qtyNum}
            onChange={(e) => setQuantity(parseInt(e.target.value))}
            className="flex-1 accent-primary h-2 bg-muted rounded-lg cursor-pointer"
          />
        </div>
      </div>
    </>
  );
}
