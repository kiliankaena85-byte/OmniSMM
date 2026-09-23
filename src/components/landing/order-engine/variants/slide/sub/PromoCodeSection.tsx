'use client';

import React from "react";
import { Ticket, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export interface PromoCodeSectionProps {
  email: string;
  setEmail: (val: string) => void;
  emailRef: React.RefObject<HTMLInputElement | null>;
  showPromo: boolean;
  setShowPromo: (val: boolean) => void;
  promoCode: string;
  setPromoCode: (val: string) => void;
  appliedPromo: string;
  isApplyingPromo: boolean;
  promoMessage: { type: "success" | "error"; text: string } | null;
  onApplyPromo: () => void;
  onRemovePromo: () => void;
}

export function PromoCodeSection({
  email,
  setEmail,
  emailRef,
  showPromo,
  setShowPromo,
  promoCode,
  setPromoCode,
  appliedPromo,
  isApplyingPromo,
  promoMessage,
  onApplyPromo,
  onRemovePromo,
}: PromoCodeSectionProps) {
  return (
    <>
      {/* 5. Email */}
      <div id="field-email" className="mb-5">
        <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
          Email для чека и статуса
        </label>
        <input
          ref={emailRef}
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full h-11 px-3.5 rounded-xl bg-background border border-border/80 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm text-foreground"
          placeholder="example@mail.ru"
        />
      </div>

      {/* 5.5 Promo Code */}
      <div id="field-promo" className="mb-5">
        {!showPromo ? (
          <button
            type="button"
            onClick={() => setShowPromo(true)}
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1.5 min-h-[44px] py-2 cursor-pointer transition-colors"
          >
            <Ticket className="w-4 h-4" />
            <span>+ У меня есть промокод</span>
          </button>
        ) : (
          <div className="space-y-2 p-3.5 rounded-2xl bg-muted/40 border border-border/70 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Ticket className="w-3.5 h-3.5 text-primary" />
                <span>Промокод</span>
              </label>
              {appliedPromo && (
                <button
                  type="button"
                  onClick={onRemovePromo}
                  className="text-[11px] font-semibold text-muted-foreground hover:text-destructive cursor-pointer transition-colors"
                >
                  Удалить
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onApplyPromo();
                  }
                }}
                placeholder="ВВЕДИТЕ КОД"
                disabled={Boolean(appliedPromo) || isApplyingPromo}
                className="flex-1 h-11 px-3.5 rounded-xl bg-background border border-border/80 focus:border-primary focus:ring-1 focus:ring-primary outline-none font-mono text-sm font-bold uppercase text-foreground disabled:opacity-60"
              />
              {!appliedPromo ? (
                <button
                  type="button"
                  onClick={onApplyPromo}
                  disabled={!promoCode.trim() || isApplyingPromo}
                  className="h-11 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center shrink-0"
                >
                  {isApplyingPromo ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Применить"
                  )}
                </button>
              ) : (
                <div className="h-11 px-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1.5 shrink-0 select-none">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Активен</span>
                </div>
              )}
            </div>
            {promoMessage && (
              <p
                className={`text-xs font-semibold flex items-center gap-1 mt-1 ${
                  promoMessage.type === "success"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive"
                }`}
              >
                {promoMessage.type === "success" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{promoMessage.text}</span>
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
