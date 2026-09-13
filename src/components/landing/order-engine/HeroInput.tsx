'use client';
// audit-disable STR-002

import React, { useState } from "react";
import { Loader2, Link2, Mail, HelpCircle, Target, CreditCard, Sparkles, Zap, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { VisualLinkGuideModal } from "./VisualLinkGuideModal";
import { stripQueryParams, normalizeUsername } from "@/utils/link-normalizer";

interface HeroInputProps {
  engine: OrderEngine;
  handleCheckout: () => void;
  linkHasError: boolean;
  setLinkHasError: (val: boolean) => void;
  onOpenGuide: () => void;
}

export function HeroInput({ engine, handleCheckout, linkHasError, setLinkHasError, onOpenGuide }: HeroInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { url, setUrl, setEmail, isMassMode, isMassCalculating, categoryId, selectedService } = engine;

  const isEmailDetected = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url.trim());

  const handleStartAction = () => {
    const trimmedUrl = url.trim();
    if (trimmedUrl.length === 0) {
      toast.error("Пожалуйста, введите ссылку для продолжения.", { position: "top-center" });
      const inputEl = document.getElementById("landing-url");
      inputEl?.focus();
      return;
    }

    if (isEmailDetected) {
      setEmail(trimmedUrl);
      setUrl("");
      toast.success("Email сохранен для чекаута! Теперь укажите ссылку на объект продвижения.", { position: "top-center" });
      const inputEl = document.getElementById("landing-url");
      inputEl?.focus();
      return;
    }

    if (linkHasError) {
      toast.error("Пожалуйста, укажите корректную ссылку.", { position: "top-center" });
      return;
    }

    // Scroll smoothly to the catalog tariffs section
    const catalogEl = document.getElementById("catalog-section");
    if (catalogEl) {
      catalogEl.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 500, behavior: "smooth" });
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto relative z-20 mb-4 md:mb-10 mt-4">
      <AnimatePresence>
        {isEmailDetected && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            className="mb-4 bg-primary/10 border border-primary/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-md relative z-30"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
                <Mail className="w-5 h-5 shrink-0" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Похоже, вы ввели email-адрес</p>
                <p className="text-xs text-muted-foreground">Использовать его для связи и быстрой регистрации?</p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => {
                  setEmail(url.trim());
                  setUrl("");
                  toast.success("Отлично! Мы сохранили ваш Email. Теперь вставьте ссылки на продвижение.");
                }}
                className="bg-primary text-primary-foreground font-bold rounded-xl"
              >
                Да, запомнить
              </Button>
              <Button
                size="sm"
                intent="ghost"
                onClick={() => setUrl("")}
                className="text-muted-foreground hover:text-foreground font-bold"
              >
                Нет, очистить
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isMassMode ? (
        <div
          className={`relative flex flex-col w-full bg-content1 rounded-[2rem] p-4 sm:p-5 border-2 transition-all shadow-[0_8px_30px_-10px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_40px_-10px_rgba(0,0,0,0.08)] ${
            linkHasError
              ? "border-red-400 focus-within:border-red-500 focus-within:shadow-[0_12px_50px_-12px_rgba(248,113,113,0.3)]"
              : "border-border/50 focus-within:border-primary/40 focus-within:shadow-[0_12px_50px_-12px] focus-within:shadow-primary/20"
          }`}
        >
          <textarea
            id="landing-url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (linkHasError) setLinkHasError(false);
            }}
            placeholder={`ID услуги | Ссылка | Количество\nПример:\n15 | https://t.me/durov | 100\n18 | https://vk.com/wall-1_1 | 500\n\n(Каждый заказ с новой строки)`}
            className="w-full min-h-[140px] bg-transparent border-none outline-none text-base sm:text-lg font-semibold text-foreground placeholder:text-muted-foreground px-2 sm:px-4 py-2 resize-none"
          />
          <div className="flex items-center justify-between border-t border-border/50 pt-3 mt-2">
            <div className="flex items-center gap-2 pl-2">
              {isMassCalculating ? (
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              ) : (
                <Link2 className="w-5 h-5 text-primary" />
              )}
              <span className="text-sm font-bold text-muted-foreground">Режим массового заказа</span>
            </div>
            <Button
              onClick={() => handleCheckout()}
              disabled={isMassCalculating}
              className="rounded-full px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base shadow-lg shadow-primary/30 transition-all hover:scale-[1.02] active:scale-95"
            >
              {isMassCalculating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Оформить пакет"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Visual Step Guide Indicator (Redesigned modern interactive step cards) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-2 select-none">
            {/* Step 1 */}
            <div
              onClick={() => {
                const inputEl = document.getElementById("landing-url");
                inputEl?.focus();
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-300 cursor-pointer ${
                !url 
                  ? 'bg-primary/5 border-primary/30 text-foreground shadow-[0_0_15px_rgba(3,105,161,0.08)]' 
                  : 'bg-success/5 border-success/30 text-success-text'
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                !url ? 'bg-primary text-primary-foreground scale-110 shadow-md shadow-primary/20 animate-pulse' : 'bg-success text-success-foreground'
              }`}>
                {!url ? '1' : '✓'}
              </div>
              <div className="text-left">
                <p className="text-[9px] font-extrabold uppercase tracking-wider opacity-60">Шаг 1</p>
                <p className="text-xs sm:text-sm font-black whitespace-nowrap">Укажите ссылку</p>
              </div>
              <div className="ml-auto text-muted-foreground/60 shrink-0">
                <Link2 className="w-4 h-4" />
              </div>
            </div>

            {/* Step 2 */}
            <div
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-300 ${
                url && !selectedService 
                  ? 'bg-primary/5 border-primary/30 text-foreground shadow-[0_0_15px_rgba(3,105,161,0.08)]' 
                  : url && selectedService 
                  ? 'bg-success/5 border-success/30 text-success-text' 
                  : 'bg-muted/30 border-border/50 text-muted-foreground'
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                url && !selectedService 
                  ? 'bg-primary text-primary-foreground scale-110 shadow-md shadow-primary/20 animate-pulse' 
                  : url && selectedService 
                  ? 'bg-success text-success-foreground' 
                  : 'bg-muted border border-border/50 text-muted-foreground'
              }`}>
                {url && selectedService ? '✓' : '2'}
              </div>
              <div className="text-left">
                <p className="text-[9px] font-extrabold uppercase tracking-wider opacity-60">Шаг 2</p>
                <p className="text-xs sm:text-sm font-black whitespace-nowrap">Выберите тариф</p>
              </div>
              <div className="ml-auto text-muted-foreground/60 shrink-0">
                <Target className="w-4 h-4" />
              </div>
            </div>

            {/* Step 3 */}
            <div
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-300 ${
                selectedService 
                  ? 'bg-primary/5 border-primary/30 text-foreground shadow-[0_0_15px_rgba(3,105,161,0.08)] animate-pulse' 
                  : 'bg-muted/30 border-border/50 text-muted-foreground'
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                selectedService 
                  ? 'bg-primary text-primary-foreground scale-110 shadow-md shadow-primary/20' 
                  : 'bg-muted border border-border/50 text-muted-foreground'
              }`}>
                3
              </div>
              <div className="text-left">
                <p className="text-[9px] font-extrabold uppercase tracking-wider opacity-60">Шаг 3</p>
                <p className="text-xs sm:text-sm font-black whitespace-nowrap">Быстрая оплата</p>
              </div>
              <div className="ml-auto text-muted-foreground/60 shrink-0">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Premium Google Shimmer Border Wrapper */}
          <div className={`relative w-full group rounded-full transition-all duration-300 select-text ${isFocused ? 'p-[4px] scale-[1.01]' : 'p-[3px] scale-100'}`}>
            {/* Shimmer Border */}
            <div
              className={`absolute inset-0 rounded-full transition-opacity duration-300 pointer-events-none ${
                linkHasError
                  ? "warning-border-shimmer opacity-100"
                  : "google-border-shimmer opacity-100"
              }`}
            />
            
            {/* Soft backdrop blur glow */}
            <div
              className={`absolute inset-0 rounded-full transition-all duration-300 pointer-events-none blur-md ${
                linkHasError
                  ? "warning-border-shimmer opacity-50"
                  : isFocused
                  ? "google-border-shimmer opacity-80 scale-[1.02]"
                  : "google-border-shimmer opacity-40 group-hover:opacity-60"
              }`}
            />
            
            <div
              className="relative flex items-center w-full bg-content1 rounded-full p-1.5 sm:p-2 h-14 sm:h-16 md:h-[68px] z-10"
            >
              <div className="pl-3 sm:pl-5 pr-1.5 sm:pr-2 flex-shrink-0">
                <Link2 className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground group-focus-within:text-primary transition-colors" />
              </div>
              <textarea
                id="landing-url"
                rows={1}
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (linkHasError) setLinkHasError(false);
                }}
                onFocus={() => setIsFocused(true)}
                onPaste={(e) => {
                  const pastedText = e.clipboardData.getData("text");
                  if (pastedText.includes('\n') || pastedText.split(/\s+/).filter(Boolean).length > 1) {
                     e.preventDefault();
                     setUrl(pastedText);
                     if (linkHasError) setLinkHasError(false);
                     toast.success("Режим Умной Корзины активирован!");
                     return;
                  }

                  const activeNetwork = engine.catalog.find(n => n.id === engine.networkId);
                  const platformSlug = activeNetwork?.slug || "";
                  
                  // 1. Clean tracking parameters from pasted text
                  let cleaned = stripQueryParams(pastedText);
                  
                  // 2. Normalize username if applicable
                  if (platformSlug && (cleaned.startsWith("@") || (!cleaned.includes("/") && !cleaned.includes(".") && cleaned.trim().length > 0))) {
                    cleaned = normalizeUsername(cleaned, platformSlug);
                  }
                  
                  e.preventDefault();
                  setUrl(cleaned);
                  if (linkHasError) setLinkHasError(false);
                  toast.success("Ссылка очищена и нормализована!");
                }}
                onBlur={(e) => {
                  setTimeout(() => setIsFocused(false), 200);
                  let val = e.target.value.trim();
                  const activeNetwork = engine.catalog.find(n => n.id === engine.networkId);
                  const platformSlug = activeNetwork?.slug || "";

                  if (val) {
                    // 1. Clean parameters
                    val = stripQueryParams(val);
                    
                    // 2. Normalize handle
                    if (platformSlug && (val.startsWith("@") || (!val.includes("/") && !val.includes(".") && val.trim().length > 0))) {
                      val = normalizeUsername(val, platformSlug);
                    } else if (!/^https?:\/\//i.test(val) && val.includes(".") && !val.includes(" ") && !val.includes("@")) {
                      val = `https://${val}`;
                    }
                    
                    setUrl(val);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleStartAction();
                  }
                }}
                placeholder="Вставьте ссылку на канал, группу или пост..."
                className="flex-1 min-w-0 bg-transparent border-none outline-none text-base sm:text-base md:text-lg font-semibold text-foreground placeholder:text-muted-foreground px-1.5 sm:px-3 w-full resize-none overflow-hidden whitespace-nowrap self-center leading-tight"
              />
              {url.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setUrl("");
                    if (linkHasError) setLinkHasError(false);
                  }}
                  className="w-7 h-7 rounded-full bg-content2 hover:bg-content3 border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer mr-1.5 shrink-0"
                  title="Очистить ссылку"
                  aria-label="Очистить ссылку"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <Button
                type="button"
                onClick={handleStartAction}
                disabled={isMassCalculating}
                className="h-full rounded-full px-4 sm:px-6 md:px-10 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm sm:text-base md:text-lg shadow-lg shadow-primary/30 transition-all hover:scale-[1.02] active:scale-95 shrink-0"
              >
                {isMassCalculating ? <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" /> : "Показать тарифы →"}
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center px-4 sm:px-6 gap-3">
            <button
              type="button"
              onClick={onOpenGuide}
              className="text-xs font-bold text-muted-foreground hover:text-primary flex items-center gap-1.5 transition-all duration-200 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-primary/80 animate-pulse shrink-0" />
              Как правильно скопировать ссылку для заказа?
            </button>

            {/* Micro-Trust Highlights */}
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-semibold">
              <span className="flex items-center gap-1 text-foreground">
                <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                <span className="font-bold">4.9/5</span> (12k+ отзывов)
              </span>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-primary shrink-0" />
                Старт за 30с
              </span>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                Без паролей
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
