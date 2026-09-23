'use client';

import React from "react";
import { IntelligencePlatform } from "@/services/analyzer/link-rules";
import { AlertCircle, ChevronRight } from "lucide-react";

interface PlatformSelectorFallbackProps {
  onSelect: (platform: IntelligencePlatform) => void;
  availablePlatforms: { id: string; name: IntelligencePlatform; icon?: React.ReactNode }[];
}

export function PlatformSelectorFallback({ onSelect, availablePlatforms }: PlatformSelectorFallbackProps) {
  const fallbackList = availablePlatforms && availablePlatforms.length > 0
    ? availablePlatforms
    : [
        { id: "fallback-telegram", name: IntelligencePlatform.TELEGRAM },
        { id: "fallback-vk", name: IntelligencePlatform.VK },
        { id: "fallback-instagram", name: IntelligencePlatform.INSTAGRAM },
        { id: "fallback-youtube", name: IntelligencePlatform.YOUTUBE },
        { id: "fallback-tiktok", name: IntelligencePlatform.TIKTOK },
      ];

  const getBrandHoverClasses = (platform: IntelligencePlatform) => {
    switch (platform) {
      case IntelligencePlatform.TELEGRAM:
        return {
          button: "hover:border-sky-500 hover:bg-sky-500/5",
          text: "text-foreground group-hover:text-sky-600 dark:group-hover:text-sky-400",
          icon: "group-hover:text-sky-600 dark:group-hover:text-sky-400"
        };
      case IntelligencePlatform.VK:
        return {
          button: "hover:border-blue-600 hover:bg-blue-600/5",
          text: "text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400",
          icon: "group-hover:text-blue-600 dark:group-hover:text-blue-400"
        };
      case IntelligencePlatform.INSTAGRAM:
        return {
          button: "hover:border-pink-500 hover:bg-pink-500/5",
          text: "text-foreground group-hover:text-pink-600 dark:group-hover:text-pink-400",
          icon: "group-hover:text-pink-600 dark:group-hover:text-pink-400"
        };
      case IntelligencePlatform.YOUTUBE:
        return {
          button: "hover:border-red-600 hover:bg-red-600/5",
          text: "text-foreground group-hover:text-red-600 dark:group-hover:text-red-400",
          icon: "group-hover:text-red-600 dark:group-hover:text-red-400"
        };
      case IntelligencePlatform.TIKTOK:
        return {
          button: "hover:border-zinc-800 hover:bg-zinc-800/5 dark:hover:border-zinc-300 dark:hover:bg-zinc-300/5",
          text: "text-foreground group-hover:text-zinc-900 dark:group-hover:text-zinc-100",
          icon: "group-hover:text-zinc-900 dark:group-hover:text-zinc-100"
        };
      default:
        return {
          button: "hover:border-warning/50 hover:bg-warning/5",
          text: "text-foreground group-hover:text-warning",
          icon: "group-hover:text-warning"
        };
    }
  };

  return (
    <div className="w-full bg-content2/50 backdrop-blur-md border border-warning/30 shadow-xl rounded-3xl p-5 md:p-6 relative overflow-hidden transition-all duration-300">
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <AlertCircle className="w-24 h-24 text-warning" />
      </div>

      <div className="relative z-10 space-y-4">
        <div className="space-y-1">
          <h3 className="text-base md:text-lg font-extrabold text-foreground flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-warning shrink-0" />
            Не удалось определить платформу автоматически
          </h3>
          <p className="text-xs md:text-sm text-muted-foreground font-medium leading-relaxed">
            Ссылка имеет нестандартный формат. Пожалуйста, выберите нужную платформу вручную для отображения тарифов.
          </p>
        </div>

        <div 
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5" 
          data-testid="platform-fallback"
        >
          {fallbackList.map((pt) => {
            const brandCls = getBrandHoverClasses(pt.name);
            return (
              <button
                key={pt.id}
                onClick={() => onSelect(pt.name)}
                data-testid={`btn-${pt.name.toLowerCase()}`}
                className={`flex items-center justify-between px-4 py-3 bg-content1 border border-border rounded-2xl transition-all duration-200 group active:scale-[0.98] text-left cursor-pointer ${brandCls.button}`}
              >
                <span className={`font-bold text-sm transition-colors ${brandCls.text}`}>
                  {pt.name}
                </span>
                <ChevronRight className={`w-4 h-4 text-muted-foreground transition-all duration-200 group-hover:translate-x-0.5 ${brandCls.icon}`} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
