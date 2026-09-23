'use client';

import React, { useEffect, useState } from "react";
import { CheckoutMode } from "./types";
import { Layers, ChevronUp, ChevronDown, Check } from "lucide-react";

interface SwitcherProps {
  currentMode: CheckoutMode;
  onModeChange: (mode: CheckoutMode) => void;
}

const MODES: { id: CheckoutMode; num: number; label: string; desc: string }[] = [
  { id: "card", num: 2, label: "В карточке", desc: "In-Card Accordion" },
  { id: "modal", num: 3, label: "Центр. окно", desc: "Centered Quick Dialog" },
  { id: "wizard", num: 4, label: "Визард", desc: "Step-by-Step Focus Wizard" },
  { id: "hud", num: 5, label: "Остров", desc: "Floating Dynamic HUD" },
  { id: "bottom", num: 6, label: "Снизу", desc: "Bottom Sheet Dock" },
  { id: "table", num: 7, label: "Таблица", desc: "Quick Table Row" },
];

export function AdminCheckoutVariantSwitcher({ currentMode, onModeChange }: SwitcherProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Check URL parameters on mount
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get("checkout") || params.get("checkout_mode");
    if (modeParam) {
      const matched = MODES.find(m => m.id === modeParam || m.num.toString() === modeParam);
      if (matched) {
        onModeChange(matched.id);
        return;
      }
    }

    // Check localStorage
    const saved = localStorage.getItem("smmplan_checkout_mode") as CheckoutMode;
    if (saved && MODES.some(m => m.id === saved)) {
      onModeChange(saved);
    }
  }, [onModeChange]);

  const handleSelect = (mode: CheckoutMode) => {
    onModeChange(mode);
    localStorage.setItem("smmplan_checkout_mode", mode);
    // Update URL query without page reload
    const url = new URL(window.location.href);
    url.searchParams.set("checkout", mode);
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <aside aria-label="Панель переключения чекаута" className="fixed bottom-4 left-4 z-[999] font-sans">
      <div className="bg-card/95 dark:bg-content1/95 backdrop-blur-xl border border-border shadow-2xl rounded-2xl p-2.5 transition-all duration-300">
        {/* Header Toggle */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-muted/80 text-foreground transition-all cursor-pointer text-xs font-black tracking-wide"
        >
          <div className="w-6 h-6 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <span>Режим чекаута:</span>
          <span className="px-2 py-0.5 rounded-md bg-primary text-primary-foreground font-black text-[11px]">
            {MODES.find(m => m.id === currentMode)?.num}. {MODES.find(m => m.id === currentMode)?.label}
          </span>
          {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
        </button>

        {/* Expanded Mode Selector */}
        {isExpanded && (
          <div className="mt-2.5 pt-2.5 border-t border-border/60 grid grid-cols-2 sm:grid-cols-3 gap-1.5 min-w-[280px] sm:min-w-[420px]">
            {MODES.map((m) => {
              const active = currentMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    handleSelect(m.id);
                    setIsExpanded(false);
                  }}
                  className={`flex flex-col items-start p-2 rounded-xl text-left transition-all cursor-pointer border ${
                    active
                      ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                      : "bg-muted/40 hover:bg-muted text-foreground border-transparent hover:border-border"
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-0.5">
                    <span className={`text-[11px] font-black uppercase tracking-wider ${active ? "text-primary-foreground" : "text-foreground"}`}>
                      {m.num}. {m.label}
                    </span>
                    {active && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <span className={`text-[10px] leading-tight ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {m.desc}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
