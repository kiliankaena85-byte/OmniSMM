'use client';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React, { useEffect } from "react";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Activity, Clock, Plus, Minus } from "lucide-react";

export function DripFeedConfigurator({ engine }: { engine: OrderEngine }) {
  const { selectedService, validationErrors } = engine;

  if (!selectedService) return null;

  const canDrip = selectedService.isDripFeedEnabled;
  const canSmartDrip = selectedService.smartConfig?.isEnabled;

  if (!canDrip && !canSmartDrip) {
    return null;
  }

  // Effect to automatically select a mode if user opens it, or keep it closed by default
  const isAnyDripEnabled = engine.dripFeedEnabled || engine.isSmartDrip;

  const toggleDripFeed = () => {
    if (isAnyDripEnabled) {
      engine.setDripFeedEnabled(false);
      engine.setIsSmartDrip(false);
    } else {
      if (canSmartDrip) {
        const minReq = selectedService.minQty * engine.smartDripDays;
        if (engine.quantity < minReq) engine.setQuantity(minReq);
        engine.setIsSmartDrip(true);
        engine.setDripFeedEnabled(false);
      } else {
        const minReq = selectedService.minQty * engine.runs;
        if (engine.quantity < minReq) engine.setQuantity(minReq);
        engine.setDripFeedEnabled(true);
        engine.setIsSmartDrip(false);
      }
    }
  };

  const handleSetRuns = (newRuns: number) => {
    const clamped = Math.max(2, Math.min(100, newRuns));
    const minReq = selectedService.minQty * clamped;
    if (engine.quantity < minReq) {
      engine.setQuantity(minReq);
    }
    engine.setRuns(clamped);
  };

  const handleSetSmartDays = (newDays: number) => {
    const clamped = Math.max(1, Math.min(30, newDays));
    const minReq = selectedService.minQty * clamped;
    if (engine.quantity < minReq) {
      engine.setQuantity(minReq);
    }
    engine.setSmartDripDays(clamped);
  };

  const perRunQty = engine.runs > 0 ? Math.floor(engine.quantity / engine.runs) : 0;
  const isPerRunBelowMin = perRunQty < selectedService.minQty;
  const minRequiredTotal = selectedService.minQty * engine.runs;

  return (
    <div className="w-full bg-card border border-border/80 rounded-2xl p-5 shadow-sm mb-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <p className="text-xs sm:text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary shrink-0" /> Плавное продвижение (Drip-Feed)
          </p>
          <p className="text-xs text-muted-foreground mt-1 leading-snug font-medium">
            Распределите выполнение заказа на части, чтобы имитировать естественный рост
          </p>
        </div>
        <button
          type="button"
          onClick={toggleDripFeed}
          className={`h-11 min-h-[44px] px-5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer active:scale-95 shadow-2xs ${
            isAnyDripEnabled
              ? "bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25"
              : "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
          }`}
        >
          {isAnyDripEnabled ? "Выключить" : "Настроить"}
        </button>
      </div>

      <AnimatePresence>
        {isAnyDripEnabled && (
          <motion.div
            initial={{ height: 0, opacity: 0, marginTop: 0 }}
            animate={{ height: "auto", opacity: 1, marginTop: 12 }}
            exit={{ height: 0, opacity: 0, marginTop: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-3 border-t border-border/50">
              {/* Mode Selector */}
              {canDrip && canSmartDrip && (
                <div className="flex p-1 bg-content2 rounded-xl mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      const minReq = selectedService.minQty * engine.smartDripDays;
                      if (engine.quantity < minReq) engine.setQuantity(minReq);
                      engine.setIsSmartDrip(true);
                      engine.setDripFeedEnabled(false);
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 h-11 rounded-lg text-[10px] font-black uppercase transition-all ${
                      engine.isSmartDrip
                        ? "bg-background text-primary shadow-sm ring-1 ring-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Sparkles className="w-3 h-3" /> Умный Drip
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const minReq = selectedService.minQty * engine.runs;
                      if (engine.quantity < minReq) engine.setQuantity(minReq);
                      engine.setIsSmartDrip(false);
                      engine.setDripFeedEnabled(true);
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 h-11 rounded-lg text-[10px] font-black uppercase transition-all ${
                      engine.dripFeedEnabled
                        ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Clock className="w-3 h-3" /> Обычный Drip
                  </button>
                </div>
              )}

              {/* SMART DRIP SETTINGS */}
              {engine.isSmartDrip && (
                <div className="animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-extrabold text-foreground uppercase tracking-widest">
                      Срок выполнения (Дней)
                    </label>
                    <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                      +{selectedService.smartConfig?.markup ? (selectedService.smartConfig.markup * 100) : 0}% к цене
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between gap-3 bg-content2 p-1 rounded-xl border border-border">
                    <button
                      type="button"
                      onClick={() => handleSetSmartDays(engine.smartDripDays - 1)}
                      className="w-11 h-11 flex items-center justify-center rounded-lg bg-background border border-border text-foreground hover:border-primary hover:text-primary transition-all active:scale-95"
                    >
                      <Minus className="w-4 h-4 shrink-0" />
                    </button>
                    <div className="flex flex-col items-center">
                      <span className="text-base font-black tabular-nums">{engine.smartDripDays}</span>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Дней</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSetSmartDays(engine.smartDripDays + 1)}
                      className="w-11 h-11 flex items-center justify-center rounded-lg bg-background border border-border text-foreground hover:border-primary hover:text-primary transition-all active:scale-95"
                    >
                      <Plus className="w-4 h-4 shrink-0" />
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed text-center px-2">
                    Нейросеть автоматически распределит <b>{engine.quantity}</b> ед. на <b>{engine.smartDripDays} дней</b> (мин. {selectedService.minQty} ед./день), имитируя случайные всплески активности.
                  </p>
                  {validationErrors?.dripfeed && engine.isSmartDrip && (
                    <p className="text-[10px] font-bold text-danger text-center mt-2 px-2">
                      {validationErrors.dripfeed}
                    </p>
                  )}
                </div>
              )}

              {/* STANDARD DRIP SETTINGS */}
              {engine.dripFeedEnabled && (
                <div className="animate-in fade-in zoom-in-95 duration-200 grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-foreground uppercase tracking-widest ml-1">
                      Запусков (Runs)
                    </label>
                    <div className="flex items-center justify-between bg-content2 p-1 rounded-xl border border-border">
                      <button
                        type="button"
                        onClick={() => handleSetRuns(engine.runs - 1)}
                        className="w-11 h-11 flex items-center justify-center rounded-lg bg-background border border-border hover:border-primary active:scale-95 transition-all"
                      >
                        <Minus className="w-3 h-3 shrink-0" />
                      </button>
                      <span className="text-sm font-black tabular-nums">{engine.runs}</span>
                      <button
                        type="button"
                        onClick={() => handleSetRuns(engine.runs + 1)}
                        className="w-11 h-11 flex items-center justify-center rounded-lg bg-background border border-border hover:border-primary active:scale-95 transition-all"
                      >
                        <Plus className="w-3 h-3 shrink-0" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-foreground uppercase tracking-widest ml-1">
                      Интервал (Мин)
                    </label>
                    <div className="flex items-center justify-between bg-content2 p-1 rounded-xl border border-border">
                      <button
                        type="button"
                        onClick={() => engine.setDripInterval(Math.max(5, engine.dripInterval - 5))}
                        className="w-11 h-11 flex items-center justify-center rounded-lg bg-background border border-border hover:border-primary active:scale-95 transition-all"
                      >
                        <Minus className="w-3 h-3 shrink-0" />
                      </button>
                      <span className="text-sm font-black tabular-nums">{engine.dripInterval}</span>
                      <button
                        type="button"
                        onClick={() => engine.setDripInterval(Math.min(2880, engine.dripInterval + 5))}
                        className="w-11 h-11 flex items-center justify-center rounded-lg bg-background border border-border hover:border-primary active:scale-95 transition-all"
                      >
                        <Plus className="w-3 h-3 shrink-0" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="col-span-2 text-center mt-1">
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Будет выполнено <b>{engine.runs}</b> {engine.runs < 5 ? 'запуска' : 'запусков'} по <b>{perRunQty}</b> ед. каждые <b>{engine.dripInterval} минут</b>.
                      <br/> Итого: <b className="text-foreground">{engine.quantity}</b> ед. <span className="text-muted-foreground">(Мин. на 1 запуск: {selectedService.minQty} ед.)</span>
                    </p>
                    {isPerRunBelowMin ? (
                      <div className="mt-2 p-2 bg-destructive/15 border border-destructive/30 rounded-lg text-[10px] font-bold text-destructive flex items-center justify-between gap-2">
                        <span>⚠️ Мин. {selectedService.minQty} шт./запуск. Требуется минимум {minRequiredTotal} шт.</span>
                        <button
                          type="button"
                          onClick={() => engine.setQuantity(minRequiredTotal)}
                          className="px-2 py-1 bg-destructive text-destructive-foreground rounded-md text-[10px] font-black cursor-pointer hover:opacity-90"
                        >
                          Установить {minRequiredTotal}
                        </button>
                      </div>
                    ) : validationErrors?.dripfeed ? (
                      <p className="text-[10px] font-bold text-danger mt-2">
                        {validationErrors.dripfeed}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
