import React from "react";
import { Platform, ContentType } from "./types";

interface GuideTabsProps {
  platform: Platform;
  setPlatform: (p: Platform) => void;
  contentType: ContentType;
  setContentType: (c: ContentType) => void;
}

const platformsList: { id: Platform; label: string; icon: string }[] = [
  { id: "telegram", label: "Telegram", icon: "✈️" },
  { id: "instagram", label: "Instagram", icon: "📸" },
  { id: "vk", label: "ВКонтакте", icon: "💙" }
];

export function GuideTabs({ platform, setPlatform, contentType, setContentType }: GuideTabsProps) {
  const contentTypesList: { id: ContentType; label: string; platforms: Platform[] }[] = [
    { id: "profile", label: platform === "telegram" ? "Канал / Группа" : "Профиль / Сообщество", platforms: ["instagram", "telegram", "vk"] },
    { id: "post", label: platform === "telegram" ? "Пост" : "Пост / Reels", platforms: ["instagram", "telegram", "vk"] },
    { id: "photo", label: "Фотография / Альбом", platforms: ["telegram", "vk"] },
    { id: "story", label: "Stories / Истории", platforms: ["instagram", "vk"] },
    { id: "comment", label: "Комментарий (VK)", platforms: ["vk"] }
  ];

  return (
    <>
      {/* Social Platform Tabs */}
      <div className="flex gap-2 sm:gap-3 overflow-x-auto py-4 border-b border-border/20 scrollbar-none select-none">
        {platformsList.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setPlatform(p.id);
              setContentType("profile");
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold border transition-all duration-200 whitespace-nowrap active:scale-95 ${
              platform === p.id
                ? "bg-primary/10 border-primary text-foreground shadow-[0_0_15px_rgba(99,102,241,0.1)]"
                : "bg-transparent border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <span className="text-base">{p.icon}</span>
            {p.label}
          </button>
        ))}
      </div>

      {/* Content Type Tabs */}
      <div className="flex gap-2 overflow-x-auto py-3 select-none scrollbar-none">
        {contentTypesList
          .filter((c) => c.platforms.includes(platform))
          .map((c) => (
            <button
              key={c.id}
              onClick={() => setContentType(c.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                contentType === c.id
                  ? "bg-foreground text-background"
                  : "bg-default-100 dark:bg-default-100/10 text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.label}
            </button>
          ))}
      </div>
    </>
  );
}
