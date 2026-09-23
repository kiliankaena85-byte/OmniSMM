'use client';

import React from "react";
import Link from "next/link";
import { inferTargetTypeFromCategory } from "@/utils/target-type";

interface MappedService {
  id: string;
  name: string;
  targetType: string;
  pricePerUnitRub: number;
  categoryName: string;
}

interface UrlMatcherWidgetProps {
  services: MappedService[];
}

export function detectLinkTargetType(url: string): "CHANNEL" | "POST" {
  if (!url || !url.trim()) return "CHANNEL";

  const cleanUrl = url.trim();
  const postPatterns = [
    /\/\d+($|\/|\?)/, // slash followed by digits: e.g. /123, /123/, /123?w=
    /status\/\d+/,    // Twitter-style status/123
    /\/p\/[A-Za-z0-9_-]+/, // Instagram post /p/abc
    /\/reel\/[A-Za-z0-9_-]+/, // Instagram reel /reel/abc
    /\/wall-?\d+_\d+/, // VK wall post /wall-123_456
    /w=wall-?\d+_\d+/, // VK query w=wall-123_456
  ];

  const isPost = postPatterns.some(pattern => pattern.test(cleanUrl));
  return isPost ? "POST" : "CHANNEL";
}

export function UrlMatcherWidget({ services }: UrlMatcherWidgetProps) {
  const [url, setUrl] = React.useState("");

  // Determine target type based on link path/format
  const inferredLinkType = React.useMemo(() => {
    if (!url.trim()) return null;
    return detectLinkTargetType(url);
  }, [url]);

  // Filter category services matching the inferred link type (or fallback to category keywords if targetType is undefined/missing)
  const matchedServices = React.useMemo(() => {
    if (!inferredLinkType) return [];

    return services.filter(s => {
      const sTargetType = s.targetType || inferTargetTypeFromCategory(s.categoryName);
      return sTargetType === inferredLinkType;
    });
  }, [services, inferredLinkType]);

  return (
    <div className="bg-card rounded-[10px] border border-border p-6 shadow-sm space-y-4 transition-all duration-200">
      <h2 className="text-lg font-extrabold text-foreground tracking-tight border-b border-border/40 pb-2">
        Подберите идеальный тариф
      </h2>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Проверьте свой аккаунт на безопасность и подберите оптимальный тариф. Вставьте ссылку на канал или отдельный пост ниже:
      </p>

      {/* URL Input */}
      <div className="space-y-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Вставьте ссылку (t.me/username или t.me/username/123)"
          className="w-full h-11 min-h-[44px] px-3 rounded-[10px] border border-border bg-background text-foreground text-sm font-medium focus:outline-none focus:border-primary transition-all duration-200 placeholder:text-muted-foreground/60"
        />
      </div>

      {/* Analysis Status */}
      {url.trim() && (
        <div className="p-3 bg-primary/5 border border-primary/10 rounded-[10px] text-xs font-semibold text-primary transition-all duration-200">
          {inferredLinkType === "POST" ? (
            <span>🔍 Ссылка на публикацию/пост. Рекомендуем лайки, просмотры, реакции:</span>
          ) : (
            <span>🔍 Ссылка на канал/профиль. Рекомендуем подписчиков, участников, бусты:</span>
          )}
        </div>
      )}

      {/* Matched Services List */}
      {url.trim() ? (
        matchedServices.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Нет активных услуг для выбранного типа ссылки в этой категории.
          </p>
        ) : (
          <div className="space-y-3 pt-2">
            {matchedServices.slice(0, 3).map((s) => (
              <div
                key={s.id}
                className="p-3 bg-background border border-border rounded-[10px] space-y-2 flex flex-col justify-between hover:border-primary/30 transition-all duration-200"
              >
                <div>
                  <span className="text-[9px] font-bold text-primary uppercase tracking-wider bg-primary/5 px-2 py-0.5 rounded-[3px]">
                    {s.categoryName} ({s.targetType || "CHANNEL"})
                  </span>
                  <h3 className="text-xs font-bold text-foreground line-clamp-2 mt-1 leading-snug">
                    {s.name}
                  </h3>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-border/30">
                  <div className="text-[10px] text-muted-foreground">
                    Цена за 1 шт:
                  </div>
                  <div className="text-xs font-extrabold text-foreground">
                    {s.pricePerUnitRub.toLocaleString("ru-RU", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 4
                    })} ₽ / шт
                  </div>
                </div>

                <Link
                  href={`/?serviceId=${s.id}`}
                  className="min-h-[44px] h-11 w-full px-4 py-2 bg-primary text-primary-foreground font-bold rounded-[10px] text-xs flex items-center justify-center hover:opacity-95 transition-opacity mt-1 text-center"
                >
                  Заказать эту услугу
                </Link>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="p-4 bg-muted/20 border border-dashed border-border/60 rounded-[10px] text-center text-xs text-muted-foreground">
          Введите ссылку выше, чтобы запустить автоподбор тарифов.
        </div>
      )}
    </div>
  );
}
