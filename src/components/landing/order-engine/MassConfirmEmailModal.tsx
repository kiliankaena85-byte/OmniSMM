'use client';

import React, { useState } from "react";
import { motion } from "framer-motion";
import { X, Mail, ChevronRight, Loader2, Info, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MassConfirmEmailModal({
  showMassConfirmModal,
  setShowMassConfirmModal,
  email,
  setEmail,
  totalPriceFormatted,
  isSubmitting,
  handleMassCheckoutConfirm,
  validCount,
}: {
  showMassConfirmModal: boolean;
  setShowMassConfirmModal: (show: boolean) => void;
  email: string;
  setEmail: (email: string) => void;
  totalPriceFormatted: string;
  isSubmitting: boolean;
  handleMassCheckoutConfirm: (email: string) => void;
  validCount: number;
}) {
  const [localEmail, setLocalEmail] = useState(email || "");
  const [errorMsg, setErrorMsg] = useState("");

  if (!showMassConfirmModal) return null;

  const handleConfirm = () => {
    const trimmed = localEmail.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setErrorMsg("Укажите корректный адрес почты");
      return;
    }
    setErrorMsg("");
    setEmail(trimmed);
    handleMassCheckoutConfirm(trimmed);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
      onClick={() => setShowMassConfirmModal(false)}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="bg-content1 rounded-[2rem] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.2)] p-8 w-full max-w-lg relative border border-border/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-black text-foreground">Подтверждение заказа</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Бесшовное оформление и создание аккаунта
            </p>
          </div>
          <button
            onClick={() => setShowMassConfirmModal(false)}
            className="w-8 h-8 rounded-full bg-default-100 hover:bg-default-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Dynamic Mass Preview Box */}
        <div className="bg-content2 rounded-2xl p-4 flex items-start gap-4 mb-6 border border-border/50">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
            <ShoppingCart className="w-6 h-6 text-primary shrink-0" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest leading-none mb-1">
              Пакет массового заказа
            </p>
            <p className="text-lg font-black text-foreground leading-tight">
              {validCount} {validCount === 1 ? "услуга" : validCount < 5 ? "услуги" : "услуг"} в корзине
            </p>
          </div>
        </div>

        {/* Security / Care Banner */}
        <div className="bg-primary/5 rounded-2xl p-4 flex gap-3 mb-6 border border-primary/10">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-foreground/90 leading-relaxed">
            Мы автоматически создадим защищенный личный кабинет на этот email и отправим данные для входа. Вы сможете отслеживать статус выполнения каждого заказа в реальном времени.
          </p>
        </div>

        <div className="relative mb-2">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="email"
            value={localEmail}
            onChange={(e) => {
              setLocalEmail(e.target.value);
              if (errorMsg) setErrorMsg("");
            }}
            placeholder="you@example.com"
            autoFocus
            className={`w-full h-14 pl-12 pr-6 rounded-2xl border-2 bg-content1 text-[15px] font-semibold text-foreground placeholder-slate-400 focus:shadow-[0_8px_20px_-6px] focus:shadow-primary/15 outline-none transition-all ${
              errorMsg ? "border-red-400 focus:border-red-500" : "border-border focus:border-primary/50"
            }`}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleConfirm();
              }
            }}
          />
        </div>

        {errorMsg && (
          <p className="text-xs font-bold text-destructive mb-4 ml-1">{errorMsg}</p>
        )}

        <div className="flex items-center justify-between gap-4 mt-6">
          <div className="text-right flex-1 flex flex-col justify-end h-full">
            <p className="text-xs text-muted-foreground font-bold uppercase">Итого к оплате</p>
            <p className="text-2xl font-black text-foreground tabular-nums leading-none mt-1">{totalPriceFormatted} ₽</p>
          </div>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="h-14 px-8 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base shadow-lg transition-all flex items-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Да, перейти к оплате <ChevronRight className="w-5 h-5" />
              </>
            )}
          </Button>
        </div>

        {Number(totalPriceFormatted) > 0 && Number(totalPriceFormatted) < 10 && (
          <div className="mt-4 p-3 rounded-xl bg-warning/10 border border-warning/20 text-warning-text text-[11px] leading-relaxed animate-in fade-in">
            <div className="font-bold flex items-center gap-1 mb-1">
              <span>💡</span> Минимальный платеж — 10 ₽
            </div>
            Технически эквайринг не принимает менее 10 ₽. Из них <strong>{totalPriceFormatted} ₽</strong> пойдет за заказ, а сдача <strong>{(10 - Number(totalPriceFormatted)).toFixed(2)} ₽</strong> будет зачислена на баланс вашего нового аккаунта.
          </div>
        )}

        <div className="flex items-center justify-center gap-2 mt-5 text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
          <span>Карты РФ</span>
          <span className="w-1 h-1 rounded-full bg-default-200"></span>
          <span>СБП</span>
          <span className="w-1 h-1 rounded-full bg-default-200"></span>
          <span>Крипта</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
