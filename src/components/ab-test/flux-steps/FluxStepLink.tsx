'use client';

import React from "react";
import { Button } from "@heroui/react";
import { LinkIcon, ArrowRightIcon } from "lucide-react";

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
      <div className="text-center mb-8 max-w-2xl">
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-foreground mb-4">
          Продвижение соцсетей <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500 bg-clip-text text-transparent">
            нового поколения
          </span>
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto">
          Вставьте ссылку на ваш профиль, канал или публикацию для автоматического подбора услуг
        </p>
      </div>

      <div className="w-full max-w-xl relative group">
        <div className="relative flex items-center w-full bg-card rounded-[calc(2rem-1.5px)] p-1.5 sm:p-2 h-14 sm:h-16 md:h-[68px] z-10 shadow-inner border border-border/40">
          <LinkIcon className="text-muted-foreground w-5 h-5 sm:w-6 sm:h-6 ml-2 sm:ml-3 flex-shrink-0 group-focus-within:text-foreground transition-colors" />
          <input
            ref={linkRef}
            className="flex-1 text-base sm:text-lg py-2 sm:py-3 px-3 sm:px-4 bg-transparent outline-none w-full font-medium text-foreground placeholder:text-muted-foreground/50"
            placeholder="Вставьте ссылку..."
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
            className="rounded-[1rem] sm:rounded-[1.2rem] bg-foreground text-background shadow-md mr-0.5 sm:mr-1 w-11 h-11 min-w-[44px] min-h-[44px] flex-shrink-0 flex items-center justify-center p-0 hover:bg-foreground/90 transition-all hover:-translate-y-0.5"
            isPending={isAnalyzing}
            onPress={() => onAnalyzeLink(link)}
          >
            <ArrowRightIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
        </div>
      </div>

      <div className="mt-8 flex justify-center w-full">
        <button
          type="button"
          data-testid="flux-open-catalog-btn"
          onClick={onOpenCatalog}
          className="group inline-flex items-center gap-2 px-6 py-3 rounded-full bg-card text-foreground border border-border/80 hover:border-purple-500/50 shadow-md text-xs sm:text-sm font-black transition-all hover:scale-105 active:scale-95 cursor-pointer transform-gpu"
        >
          <span>Или выберите платформу из каталога</span>
          <ArrowRightIcon className="w-4 h-4 text-purple-500 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}
