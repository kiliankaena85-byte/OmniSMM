import React from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { OrderEngine } from "@/hooks/useOrderEngine";

interface MobileStep1DetectionBadgeProps {
  engine: OrderEngine;
  url: string;
}

export function MobileStep1DetectionBadge({ engine, url }: MobileStep1DetectionBadgeProps) {
  if (url.trim().length < 5) return null;

  const upperType = engine.detectedType ? String(engine.detectedType).toUpperCase() : "";

  return (
    <div className="p-2.5 rounded-2xl bg-content2/80 border border-border/50 text-xs flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
      {engine.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-[11px] font-medium">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
          <span>Определяем соцсеть и тип ссылки...</span>
        </div>
      ) : engine.platform ? (
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="px-2 py-0.5 rounded-lg bg-primary/15 text-primary text-[10px] font-black uppercase tracking-wider shrink-0">
              {engine.platform}
            </span>
            <span className="text-[11px] font-bold text-foreground truncate flex items-center gap-1 min-w-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
              <span>
                {upperType === "POST" || upperType === "PRIVATE_POST" || upperType === "PHOTO"
                  ? "Публикация / Пост"
                  : upperType === "CHANNEL" || upperType === "CHAT" || upperType === "GROUP"
                  ? "Канал / Сообщество"
                  : upperType === "PROFILE" || upperType === "USER" || upperType === "ACCOUNT"
                  ? "Профиль / Пользователь"
                  : upperType === "VIDEO" || upperType === "REEL" || upperType === "REELS" || upperType === "CLIP"
                  ? "Видео / Reels"
                  : "Объект проверен"}
              </span>
            </span>
          </div>
          <span className="text-[10px] font-bold text-success shrink-0">
            ✓ Ссылка подходит
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
          <AlertCircle className="w-3.5 h-3.5 text-warning shrink-0" />
          <span>Проверьте формат ссылки (например, https://t.me/...)</span>
        </div>
      )}
    </div>
  );
}
