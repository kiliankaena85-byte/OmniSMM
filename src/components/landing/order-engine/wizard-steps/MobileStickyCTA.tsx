import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap } from "lucide-react";
import { toast } from "sonner";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { Button } from "@/components/ui/button";
import { safeFocus } from "@/utils/scroll-helpers";

interface MobileStickyCTAProps {
  engine: OrderEngine;
  currentStep: number;
  setActiveStep: (step: 1 | 2 | 3 | 4) => void;
  isLinkFilled: boolean;
}

export function MobileStickyCTA({
  engine,
  currentStep,
  setActiveStep,
  isLinkFilled
}: MobileStickyCTAProps) {
  const { selectedService, quantity, isCalculating, totalPriceFormatted, categoryId } = engine;

  return (
    <AnimatePresence>
      {currentStep !== 4 && selectedService && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="fixed bottom-0 left-0 right-0 z-[150] bg-card/95 backdrop-blur-md border-t border-border/50 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.15)]"
        >
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider truncate min-w-0">
                {selectedService.name}
              </p>
              <p className="text-xs font-black text-foreground truncate min-w-0">
                {quantity.toLocaleString()} шт {isCalculating ? '' : `— ${totalPriceFormatted} ₽`}
              </p>
            </div>
            <Button
              onClick={() => {
                if (!isLinkFilled) {
                  toast.info("Вставьте ссылку на канал или пост, чтобы оформить заказ.", {
                    position: "top-center",
                    duration: 3000
                  });
                  setActiveStep(1);
                  setTimeout(() => {
                    const urlInput = document.getElementById("standard-url-input");
                    if (urlInput instanceof HTMLInputElement) safeFocus(urlInput, true);
                  }, 120);
                  return;
                }
                if (!categoryId) {
                  toast.info("Выберите категорию услуги.", { position: "top-center", duration: 3000 });
                  setActiveStep(2);
                  return;
                }
                setActiveStep(4);
              }}
              className="h-11 px-5 rounded-xl bg-primary text-primary-foreground font-black text-sm shadow-md shadow-primary/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0 min-h-[44px]"
            >
              <span>Оформить</span>
              <Zap className="w-3.5 h-3.5 fill-current" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
