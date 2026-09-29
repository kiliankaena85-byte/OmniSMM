'use client';

import React from "react";
import { Button } from "@heroui/react";
import { LinkIcon, ArrowRightIcon, Sparkles } from "lucide-react";

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
  return (
    <div className="w-full flex flex-col items-center">
      <div className="text-center mb-6 max-w-xl">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider mb-3 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>Быстрый запуск заказа</span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-foreground mb-3 leading-snug">
          Что хотите{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 dark:from-purple-400 dark:via-pink-400 dark:to-indigo-400 font-black">
            продвигать
          </span>{' '}
          сегодня?
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
          Вставьте ссылку на ваш профиль, канал или публикацию — алгоритм автоматически подберёт лучшие тарифы
        </p>
      </div>

      <div className="w-full max-w-lg relative group">
        <div className="relative flex items-center w-full bg-card/90 backdrop-blur-xl rounded-2xl p-1.5 sm:p-2 h-13 sm:h-14 z-10 shadow-sm border border-border/60 focus-within:border-primary/50 transition-colors">
          <LinkIcon className="text-muted-foreground w-4 h-4 sm:w-5 sm:h-5 ml-2.5 sm:ml-3 flex-shrink-0 group-focus-within:text-primary transition-colors" />
          <input
            ref={linkRef}
            className="flex-1 text-sm sm:text-base py-2 px-3 bg-transparent outline-none w-full font-medium text-foreground placeholder:text-muted-foreground/60"
            placeholder="Вставьте ссылку на пост, канал или профиль..."
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && link) onAnalyzeLink(link);
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              setTimeout(() => onAnalyzeLink(text), 100);
            }}
          />
          <Button 
            className="rounded-xl bg-foreground text-background shadow-xs mr-0.5 w-10 h-10 min-w-[40px] min-h-[40px] flex-shrink-0 flex items-center justify-center p-0 hover:bg-foreground/90 transition-all hover:scale-105 active:scale-95"
            isPending={isAnalyzing}
            onPress={() => onAnalyzeLink(link)}
          >
            <ArrowRightIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="mt-6 flex justify-center w-full">
        <button
          type="button"
          data-testid="flux-open-catalog-btn"
          onClick={onOpenCatalog}
          className="group inline-flex items-center gap-2 px-5 py-2 rounded-full bg-card/80 hover:bg-muted/80 text-foreground border border-border/70 hover:border-primary/50 shadow-xs text-xs sm:text-sm font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer"
        >
          <span>Выбрать платформу из каталога</span>
          <ArrowRightIcon className="w-3.5 h-3.5 text-primary group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}
