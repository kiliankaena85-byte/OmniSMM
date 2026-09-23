'use client';

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link2, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { SocialIcon } from "@/components/ui/SocialIcon";
import { PublicService } from "@/actions/order/catalog";

interface StickyCheckoutTriggerBarProps {
  selectedService: PublicService | null;
  url: string;
  pricing: OrderEngine["pricing"];
  engine: OrderEngine;
  onOpenCheckout: () => void;
  onClearSelection: () => void;
}

export function StickyCheckoutTriggerBar({
  selectedService,
  url,
  pricing,
  engine,
  onOpenCheckout,
  onClearSelection
}: StickyCheckoutTriggerBarProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Hide on scroll down past 100px threshold
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } 
      // Show on scroll up
      else if (currentScrollY < lastScrollY) {
        setIsVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  useEffect(() => {
    if (selectedService) {
      setIsVisible(true);
    }
  }, [selectedService?.id]);

  if (!selectedService) return null;

  const selectedNetworkObj = engine.catalog.find(n => n.id === engine.networkId);
  const networkSlug = selectedNetworkObj?.slug || "other";
  const formattedTotal = pricing ? (pricing.totalCents / 100).toFixed(2) : "0.00";

  return (
    <motion.div
      initial={{ y: 150, opacity: 0, x: "-50%" }}
      animate={{ y: isVisible ? 0 : 150, opacity: isVisible ? 1 : 0, x: "-50%" }}
      exit={{ y: 150, opacity: 0, x: "-50%" }}
      transition={{ type: "spring", damping: 30, stiffness: 400 }}
      className="fixed bottom-6 left-1/2 w-full max-w-4xl z-40 px-4"
    >
      <div className="bg-card/90 backdrop-blur-xl border border-border/80 shadow-[0_20px_50px_rgba(0,0,0,0.08)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.35)] rounded-2xl py-3.5 px-6 relative flex items-center justify-between gap-4">
        
        {/* Close Button to Reset */}
        <button
          type="button"
          onClick={onClearSelection}
          className="absolute -top-2.5 -right-2.5 w-7.5 h-7.5 bg-card hover:bg-muted text-foreground hover:text-destructive rounded-full flex items-center justify-center border border-border shadow-md transition-all z-10 active:scale-90 cursor-pointer"
          title="Сбросить выбор"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Selected Service details */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="p-1.5 bg-background rounded-xl border border-border/40 shrink-0">
            <SocialIcon slug={networkSlug} size={20} colored />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-foreground truncate max-w-[250px] leading-tight min-w-0">
              {selectedService.name}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5 opacity-90">
              <Link2 className="w-3 h-3 text-primary shrink-0" />
              <p className="text-[10px] font-bold text-muted-foreground truncate max-w-[150px] min-w-0">
                {url || "Ссылка не указана"}
              </p>
            </div>
          </div>
        </div>

        {/* Price & Checkout Action Button */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider block leading-none mb-0.5">
              Итого
            </span>
            <p className="text-lg font-black text-foreground tabular-nums leading-none">
              {formattedTotal}
              <span className="text-primary ml-0.5 text-sm">₽</span>
            </p>
          </div>

          <Button
            type="button"
            onClick={onOpenCheckout}
            className="h-10 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold text-xs shadow-md shadow-primary/10 transition-all flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-95 cursor-pointer"
          >
            <span>Оформить заказ</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>

      </div>
    </motion.div>
  );
}
