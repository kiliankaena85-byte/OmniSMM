'use client';

import React, { useEffect, useState } from "react";
import { Sparkles, LayoutList } from "lucide-react";

export type OrderFlowVariant = 'slide' | 'classic';

interface LayoutVariantToggleProps {
  currentFlow: OrderFlowVariant;
  onFlowChange: (flow: OrderFlowVariant) => void;
  className?: string;
}

export function LayoutVariantToggle({
  currentFlow,
  onFlowChange,
  className = ""
}: LayoutVariantToggleProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check URL or localStorage on mount
    if (typeof window !== "undefined") {
      try {
        const params = new URLSearchParams(window.location.search);
        const urlFlow = params.get("flow");
        if (urlFlow === "slide" || urlFlow === "classic") {
          if (urlFlow !== currentFlow) onFlowChange(urlFlow as OrderFlowVariant);
          return;
        }
        if (typeof window.localStorage !== "undefined" && typeof window.localStorage.getItem === "function") {
          const saved = window.localStorage.getItem("smmplan_order_flow") as OrderFlowVariant;
          if (saved === "slide" || saved === "classic") {
            if (saved !== currentFlow) onFlowChange(saved);
          }
        }
      } catch {}
    }
  }, [currentFlow, onFlowChange]);

  const handleSelect = (flow: OrderFlowVariant) => {
    onFlowChange(flow);
    if (typeof window !== "undefined") {
      try {
        if (typeof window.localStorage !== "undefined" && typeof window.localStorage.setItem === "function") {
          window.localStorage.setItem("smmplan_order_flow", flow);
        }
        document.cookie = `smmplan_order_flow=${flow}; path=/; max-age=31536000; SameSite=Lax`;
        const url = new URL(window.location.href);
        url.searchParams.set("flow", flow);
        window.history.replaceState({}, "", url.toString());
      } catch {}
    }
  };

  if (!mounted) return null;

  return (
    <div 
      className={`inline-flex items-center p-1 rounded-2xl bg-card border border-border/80 shadow-sm backdrop-blur-md transition-all ${className}`}
      role="group"
      aria-label="Переключение вида визарда заказа"
    >
      <button
        type="button"
        onClick={() => handleSelect('slide')}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
          currentFlow === 'slide'
            ? "bg-primary text-primary-foreground shadow-sm scale-100"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        }`}
        title="Экранный слайд-визард (как в SMMflux): пошаговый экран без скролла"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>Слайд-визард (Flux-стиль)</span>
      </button>

      <button
        type="button"
        onClick={() => handleSelect('classic')}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
          currentFlow === 'classic'
            ? "bg-primary text-primary-foreground shadow-sm scale-100"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        }`}
        title="Классический последовательный аккордеон"
      >
        <LayoutList className="w-3.5 h-3.5" />
        <span>Классический</span>
      </button>
    </div>
  );
}
