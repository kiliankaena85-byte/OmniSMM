'use client';

import React from "react";
import { Plus, ArrowRight, ChevronDown, Loader2 } from "lucide-react";

export interface FluxStepLinkProps {
  link: string;
  setLink: (val: string) => void;
  isAnalyzing: boolean;
  onAnalyzeLink: (url: string) => void;
  onOpenCatalog: () => void;
  linkRef: React.RefObject<HTMLInputElement | null>;
}

export function FluxStepLink({
  link,
  setLink,
  isAnalyzing,
  onAnalyzeLink,
  onOpenCatalog,
  linkRef,
}: FluxStepLinkProps) {
  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (link.trim()) {
      onAnalyzeLink(link.trim());
    } else {
      onOpenCatalog();
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center pt-8 sm:pt-14 pb-8 px-2 sm:px-4">
      {/* ── 1. LOVABLE-STYLE HERO TYPOGRAPHY ── */}
      <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-8">
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-black dark:text-white leading-[1.08]">
          Что продвигаем сегодня?
        </h1>
      </div>

      {/* ── 2. LOVABLE PROMPT CONSOLE CAPSULE ── */}
      <div className="relative w-full max-w-2xl mx-auto group">
        {/* Ambient 360-degree radial diffusion shadow */}
        <div 
          className="absolute -inset-4 sm:-inset-6 rounded-[38px] sm:rounded-[42px] pointer-events-none opacity-85 dark:opacity-40 transition-opacity"
          style={{
            background: 'radial-gradient(ellipse 65% 65% at 50% 50%, rgba(15, 23, 42, 0.22) 0%, rgba(15, 23, 42, 0.10) 40%, rgba(15, 23, 42, 0.03) 65%, transparent 85%)',
            filter: 'blur(20px)',
          }}
        />
        <form
          onSubmit={handleSubmit}
          className="relative bg-white dark:bg-[#0f172a]/95 rounded-[26px] sm:rounded-[28px] border border-slate-200/80 dark:border-white/10 p-3.5 sm:p-5 shadow-[0_0_40px_rgba(0,0,0,0.08),0_10px_30px_-8px_rgba(0,0,0,0.10),0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_0_55px_rgba(0,0,0,0.12),0_14px_36px_-8px_rgba(0,0,0,0.13)] focus-within:border-slate-400 dark:focus-within:border-white/30 focus-within:shadow-[0_0_65px_rgba(0,0,0,0.15),0_16px_40px_-8px_rgba(0,0,0,0.16)] transition-all"
        >
          {/* Top text input area */}
          <div className="w-full mb-3 sm:mb-4">
            <input
              ref={linkRef}
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (text && text.trim()) {
                  setLink(text.trim());
                  setTimeout(() => onAnalyzeLink(text.trim()), 100);
                }
              }}
              placeholder="Вставьте ссылку на канал, группу, пост или профиль..."
              className="w-full bg-transparent text-sm sm:text-base md:text-lg font-medium text-slate-900 dark:text-white placeholder:text-slate-400 outline-none px-1.5 py-1"
              aria-label="Ссылка для продвижения"
            />
          </div>

          {/* Bottom toolbar inside the capsule */}
          <div className="flex items-center justify-between pt-1">
            {/* Left: Plus button & Catalog quick action */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="flux-open-catalog-btn"
                onClick={onOpenCatalog}
                className="w-8 h-8 sm:w-9 sm:h-9 min-h-[36px] min-w-[36px] rounded-full border border-slate-200 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-800/80 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer hover:scale-105 active:scale-95 shrink-0"
                title="Выбрать услугу из каталога"
                aria-label="Выбрать услугу из каталога"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onOpenCatalog}
                className="hidden sm:inline-block text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
              >
                Выбрать из каталога
              </button>
            </div>

            {/* Right: Dropdown indicator & Submit button */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={onOpenCatalog}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
              >
                <span>Услуги</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                type="submit"
                disabled={isAnalyzing}
                className="w-8 h-8 sm:w-9 sm:h-9 min-h-[36px] min-w-[36px] rounded-full bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-sm cursor-pointer disabled:opacity-50 shrink-0"
                title="Запустить"
                aria-label="Запустить"
              >
                {isAnalyzing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
