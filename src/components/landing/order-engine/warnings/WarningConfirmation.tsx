import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { OrderEngine } from "@/hooks/useOrderEngine";

interface WarningConfirmationProps {
  engine: OrderEngine;
  hasActiveWarnings: boolean;
}

export function WarningConfirmation({ engine, hasActiveWarnings }: WarningConfirmationProps) {
  if (!hasActiveWarnings) return null;

  return (
    <div className={`w-full mt-1 p-4 bg-warning/5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 ${
      engine.warningHasError 
        ? "border-destructive bg-destructive/5 shadow-md shadow-destructive/5 ring-2 ring-destructive/20 animate-pulse" 
        : engine.isWarningConfirmed 
          ? "border-success/30 bg-success/5" 
          : "border-warning/30"
    }`}>
      <div className="flex items-start gap-3 flex-1">
        <div className="relative flex items-center justify-center w-5 h-5 shrink-0 mt-0.5">
          <input
            id="warning-confirm-checkbox"
            type="checkbox"
            checked={engine.isWarningConfirmed || false}
            onChange={(e) => {
              engine.setIsWarningConfirmed(e.target.checked);
              if (e.target.checked) {
                engine.setWarningHasError(false);
              }
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <motion.div
            animate={{
              scale: engine.isWarningConfirmed ? [1, 1.15, 1] : 1,
              borderColor: engine.isWarningConfirmed ? "var(--color-success)" : "var(--color-warning)",
              backgroundColor: engine.isWarningConfirmed ? "var(--color-success)" : "rgba(217, 119, 6, 0)",
            }}
            className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors pointer-events-none"
          >
            {engine.isWarningConfirmed && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none" className="stroke-current stroke-[2.5]" style={{ strokeLinecap: "round", strokeLinejoin: "round", stroke: "var(--color-success-foreground)" }}>
                <path d="M1.5 4L4 6.5L8.5 1.5" />
              </svg>
            )}
          </motion.div>
        </div>
        <label htmlFor="warning-confirm-checkbox" className="text-xs font-bold text-foreground cursor-pointer select-none leading-relaxed">
          Я подтверждаю правильность ссылки и согласен с условиями
        </label>
      </div>
      
      {!engine.isWarningConfirmed && (
        <Button
          type="button"
          onClick={() => {
            engine.setIsWarningConfirmed(true);
            engine.setWarningHasError(false);
            toast.success("Предупреждение подтверждено");
          }}
          className="h-10 px-5 bg-warning hover:bg-warning/90 text-warning-foreground font-black text-xs rounded-xl shadow-md shadow-warning/20 transition-all shrink-0 active:scale-95 cursor-pointer"
        >
          Подтвердить
        </Button>
      )}
    </div>
  );
}
