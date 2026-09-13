'use client';

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Mail, Ticket, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { suggestEmailCorrection } from "@/lib/email-typo-guard";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { getServiceFlags } from "@/utils/url-analyzer";

interface DrawerFormInputsProps {
  email: string;
  setEmail: (e: string) => void;
  promoCode: string;
  setPromoCode: (p: string) => void;
  emailInputRef?: React.RefObject<HTMLInputElement | null>;
  emailHasError?: boolean;
  engine: OrderEngine;
}

export function DrawerFormInputs({
  email,
  setEmail,
  promoCode,
  setPromoCode,
  emailInputRef,
  emailHasError,
  engine
}: DrawerFormInputsProps) {
  const [showPromo, setShowPromo] = useState(promoCode.length > 0);
  const { selectedService, customData, setCustomData, setQuantity } = engine;

  useEffect(() => {
    if (promoCode.length > 0) {
      setShowPromo(true);
    }
  }, [promoCode]);

  const { isCustomComments, isPoll, customFieldLabel } = getServiceFlags(selectedService);

  // Auto-sync quantity with comments line count if it is a comments service
  const handleCustomDataChange = (val: string) => {
    setCustomData(val);
    if (isCustomComments) {
      const lines = val.split("\n").filter(line => line.trim().length > 0);
      setQuantity(lines.length || (selectedService?.minQty || 10));
    }
  };

  const linesCount = isCustomComments
    ? customData.split("\n").filter(line => line.trim().length > 0).length
    : 0;

  return (
    <div className="bg-card border border-border/80 rounded-2xl p-5 space-y-4 shadow-sm">
      {/* Custom Fields (Comments / Answer Option, etc.) */}
      {customFieldLabel && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <label className="text-xs sm:text-sm font-black text-foreground uppercase tracking-wider block">
              {customFieldLabel}
            </label>
            {isCustomComments && (
              <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20 tabular-nums">
                {linesCount} {linesCount === 1 ? "комментарий" : linesCount < 5 && linesCount > 0 ? "комментария" : "комментариев"}
              </span>
            )}
          </div>
          <div className="relative">
            {isCustomComments ? (
              <>
                <textarea
                  value={customData}
                  onChange={(e) => handleCustomDataChange(e.target.value)}
                  placeholder="Каждая строка — новый комментарий..."
                  className="w-full min-h-[110px] p-3.5 pb-8 rounded-xl border border-border/80 bg-background text-sm font-bold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-2xs resize-y"
                />
                <div className="absolute bottom-2.5 right-3 text-[10px] font-mono font-bold text-muted-foreground bg-background/90 px-2 py-0.5 rounded-md border border-border/60 shadow-2xs pointer-events-none tabular-nums">
                  Строк: {linesCount} {selectedService?.minQty ? `(мин: ${selectedService.minQty})` : ''}
                </div>
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={customData}
                  onChange={(e) => handleCustomDataChange(e.target.value)}
                  placeholder={isPoll ? "Например: 2" : "Слова через запятую..."}
                  className="w-full h-12 px-3.5 rounded-xl border border-border/80 bg-background text-sm font-bold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-2xs"
                />
                {isPoll && (
                  <p className="text-[11px] text-muted-foreground font-medium mt-1">
                    💡 Укажите номер варианта ответа (например: <strong>2</strong> — второй пункт в опросе).
                  </p>
                )}
              </>
            )}
          </div>
          {isCustomComments && (
            <div className="space-y-1 mt-1.5 ml-1">
              <p className="text-xs text-muted-foreground font-medium">
                Количество заказа автоматически установится равным числу комментариев.
              </p>
              {engine.quantity < (selectedService?.minQty || 10) ? (
                <p className="text-xs font-bold text-destructive animate-pulse">
                  ⚠️ Вы ввели {engine.quantity} {engine.quantity === 1 ? "комментарий" : engine.quantity < 5 && engine.quantity > 0 ? "комментария" : "комментариев"}. Для заказа требуется минимум {selectedService?.minQty || 10}.
                </p>
              ) : (
                <p className="text-xs font-bold text-success">
                  ✓ Введено {engine.quantity} комментариев (минимум {selectedService?.minQty || 10}).
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Email Input Block */}
      <div className="space-y-2">
        <label className="text-xs sm:text-sm font-black text-foreground uppercase tracking-wider block">
          Электронная почта
        </label>
        <motion.div
          animate={emailHasError ? { x: [0, -6, 6, -6, 6, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="relative"
        >
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary">
            <Mail className="w-5 h-5" />
          </div>
          <input
            type="email"
            ref={emailInputRef}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={`w-full h-13 pl-11 pr-4 rounded-xl border bg-background text-sm sm:text-base font-bold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-2xs ${
              emailHasError
                ? "border-destructive focus:border-destructive ring-2 ring-destructive/20 text-destructive"
                : "border-border/80"
            }`}
          />
        </motion.div>

        {/* Smart Typo Guard suggestion */}
        {(() => {
          const suggestion = suggestEmailCorrection(email);
          if (!suggestion) return null;
          return (
            <button
              type="button"
              onClick={() => setEmail(suggestion)}
              className="inline-flex items-center gap-1.5 text-xs text-primary font-bold bg-primary/10 hover:bg-primary/20 px-2.5 py-1.5 rounded-lg border border-primary/25 transition-all duration-200 cursor-pointer text-left animate-in fade-in slide-in-from-top-1"
            >
              <span>💡 Возможно, опечатка? Нажмите, чтобы исправить на <strong className="underline">{suggestion}</strong></span>
            </button>
          );
        })()}

        <p className="text-xs text-muted-foreground font-medium ml-1">
          {emailHasError ? (
            <span className="text-destructive font-bold">Введите корректный email для отслеживания заказа</span>
          ) : (
            "Для отслеживания статуса заказа"
          )}
        </p>
      </div>

      {/* Promo Code Input Block */}
      <div className="space-y-2 pt-1">
        {!showPromo ? (
          <button
            type="button"
            onClick={() => setShowPromo(true)}
            className="w-full h-12 border border-dashed border-border/90 hover:border-primary/70 bg-background hover:bg-primary/5 text-xs font-black uppercase tracking-wider text-foreground hover:text-primary rounded-xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.99] shadow-2xs cursor-pointer"
          >
            <Ticket className="w-4 h-4 text-primary shrink-0" />
            <span>У меня есть промокод</span>
          </button>
        ) : (
          <div className="space-y-1.5">
            <div className="relative animate-in slide-in-from-right-3 fade-in duration-200">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="ПРОМОКОД"
                className="w-full h-12 px-4 pr-10 rounded-xl border border-border/80 bg-background text-sm font-mono font-black tracking-widest uppercase text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-2xs"
              />
              <span className="absolute -top-2.5 left-3 text-[10px] font-black text-primary bg-background px-2 py-0.5 rounded-md uppercase tracking-wider border border-border/80">
                Промокод
              </span>
              <button
                type="button"
                onClick={() => {
                  setPromoCode("");
                  setShowPromo(false);
                }}
                className="absolute top-1/2 -translate-y-1/2 right-3 w-6 h-6 rounded-full bg-content2 hover:bg-content3 flex items-center justify-center text-foreground cursor-pointer transition-all active:scale-90"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Validation Feedback */}
            {engine.isCalculating && promoCode.trim().length > 0 && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1 font-medium animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                <span>Проверяем промокод...</span>
              </p>
            )}

            {engine.pricingError === 'voucher' && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Это ваучер для пополнения баланса. Активируйте в личном кабинете.</span>
              </p>
            )}

            {!engine.isCalculating && promoCode.trim().length > 0 && engine.pricing && engine.pricing.discountCents > 0 && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 mt-1 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Промокод активен! Скидка: {(engine.pricing.discountCents / 100).toFixed(2)} ₽</span>
              </p>
            )}

            {!engine.isCalculating && promoCode.trim().length > 0 && (!engine.pricing || engine.pricing.discountCents === 0) && !engine.pricingError && (
              <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1 mt-1 animate-in fade-in">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Промокод не найден или срок действия истёк</span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
