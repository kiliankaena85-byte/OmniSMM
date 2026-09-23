'use client';

import React from "react";
import { LinkIcon, ArrowRightIcon, HelpCircle, X } from "lucide-react";
import type { PublicNetwork } from "@/actions/order/catalog";

export interface StepLinkInputProps {
  link: string;
  setLink: (val: string) => void;
  isAnalyzing: boolean;
  onAnalyzeLink: (url: string) => void;
  onOpenGuide: () => void;
  onSelectFromCatalog: () => void;
  onQuickSelectNetwork: (net: PublicNetwork) => void;
  popularNetworks: PublicNetwork[];
  linkInputRef: React.RefObject<HTMLInputElement | null>;
}

export function StepLinkInput({
  link,
  setLink,
  isAnalyzing,
  onAnalyzeLink,
  onOpenGuide,
  onSelectFromCatalog,
  onQuickSelectNetwork,
  popularNetworks,
  linkInputRef,
}: StepLinkInputProps) {
  return (
    <div className="w-full max-w-2xl flex flex-col items-center">
      <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground mb-3 text-center leading-tight px-2 text-balance">
        Что хотите <span className="text-primary underline decoration-primary/30 decoration-wavy underline-offset-4">продвигать</span> сегодня?
      </h1>
      <p className="text-xs sm:text-sm md:text-base text-muted-foreground text-center mb-6 max-w-lg">
        Вставьте ссылку на канал, группу, профиль или публикацию — алгоритм моментально определит соцсеть и совместимые услуги.
      </p>

      {/* Main Input Box */}
      <div className="w-full relative">
        <div 
          className={`relative w-full rounded-2xl sm:rounded-3xl transition-all duration-200 bg-card border ${
            isAnalyzing 
              ? "border-primary shadow-lg ring-2 ring-primary/20" 
              : "border-border/80 hover:border-primary/50 shadow-md"
          } p-1.5 sm:p-2 flex items-center gap-2`}
        >
          <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center flex-shrink-0 ml-1">
            <LinkIcon className="text-muted-foreground w-5 h-5 shrink-0" />
          </div>
          
          <input
            ref={linkInputRef}
            type="url"
            className="flex-1 text-sm sm:text-base py-2 px-1 bg-transparent outline-none w-full font-medium text-foreground placeholder:text-muted-foreground/60"
            placeholder="Например: https://t.me/channel или @channel"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && link) onAnalyzeLink(link);
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (text) {
                setTimeout(() => onAnalyzeLink(text), 80);
              }
            }}
          />

          {link && (
            <button
              type="button"
              onClick={() => setLink("")}
              className="w-7 h-7 rounded-lg hover:bg-muted text-muted-foreground flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            disabled={isAnalyzing || !link.trim()}
            onClick={() => onAnalyzeLink(link)}
            className={`h-10 sm:h-11 px-4 sm:px-5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
              link.trim() 
                ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md" 
                : "bg-muted text-muted-foreground opacity-60 cursor-not-allowed"
            }`}
          >
            {isAnalyzing ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                <span>Анализ...</span>
              </>
            ) : (
              <>
                <span>Далее</span>
                <ArrowRightIcon className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Secondary Helpers */}
        <div className="flex items-center justify-between mt-3 px-2 text-xs">
          <button
            type="button"
            onClick={onOpenGuide}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Где взять ссылку?</span>
          </button>

          <button
            type="button"
            onClick={onSelectFromCatalog}
            className="text-primary hover:text-primary/80 font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>Выбрать из каталога →</span>
          </button>
        </div>
      </div>

      {/* Quick Network Pills */}
      <div className="mt-8 w-full">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider text-center mb-3">
          Популярные платформы
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
          {popularNetworks.slice(0, 7).map((net) => (
            <button
              key={net.id}
              type="button"
              onClick={() => onQuickSelectNetwork(net)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card border border-border/70 hover:border-primary/50 hover:bg-muted/40 text-foreground font-semibold text-xs transition-all shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
            >
              {net.icon && (
                <img src={net.icon} alt="" className="w-4 h-4 object-contain" />
              )}
              <span>{net.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
