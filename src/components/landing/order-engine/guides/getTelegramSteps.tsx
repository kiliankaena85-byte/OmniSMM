import React from "react";
import { StepDef, ContentType, DeviceType } from "./types";

export function getTelegramSteps(contentType: ContentType, device: DeviceType): StepDef[] {
  const steps: StepDef[] = [];
  
  if (contentType === "profile") {
    steps.push(
      {
        title: "Откройте инфо о канале/группе",
        desc: device === "mobile" 
          ? "Тапните по названию или аватару канала/группы вверху экрана." 
          : "Нажмите на заголовок канала в верхней панели Telegram Desktop.",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" className="text-content2 stroke-border/40" fill="currentColor" strokeWidth="1" />
            <rect x="65" y="22" width="110" height="18" rx="6" className="text-primary/10 stroke-primary" fill="currentColor" strokeWidth="1.5" />
            <text x="120" y="34" textAnchor="middle" className="fill-primary font-black text-[7px]">Durov's Channel</text>
            <g transform="translate(120, 31)">
              <circle cx="0" cy="0" r="8" className="fill-primary/20 animate-ping" />
            </g>
          </svg>
        )
      },
      {
        title: "Найдите ссылку",
        desc: "В блоке информации найдите строчку вида `t.me/имя_канала` (для публичных) или `t.me/+ссылка` (для закрытых каналов).",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="currentColor" stroke="currentColor" strokeWidth="1" className="text-content2 stroke-border/40" />
            <circle cx="120" cy="50" r="18" fill="currentColor" className="text-muted/30" />
            <rect x="80" y="85" width="80" height="12" rx="4" className="text-primary/10 stroke-primary" fill="currentColor" strokeWidth="0.5" />
            <text x="120" y="93" textAnchor="middle" className="fill-primary font-bold text-[7px]">t.me/durov</text>
          </svg>
        )
      },
      {
        title: "Скопируйте ссылку",
        desc: "Зажмите ссылку пальцем (или кликните правой кнопкой мыши на ПК) и выберите «Копировать» (Copy Link).",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="currentColor" stroke="currentColor" strokeWidth="1" className="text-content2 stroke-border/40" />
            <rect x="52" y="85" width="136" height="83" rx="12" fill="currentColor" className="text-card" />
            <rect x="60" y="110" width="120" height="20" rx="6" className="text-primary/10 stroke-primary" fill="currentColor" strokeWidth="1" />
            <text x="68" y="123" className="fill-primary font-bold text-[8px]">Копировать ссылку</text>
          </svg>
        )
      }
    );
  } else if (contentType === "post") {
    steps.push(
      {
        title: "Найдите нужный пост",
        desc: "Перейдите в канал и выберите конкретную запись.",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="currentColor" stroke="currentColor" strokeWidth="1" className="text-content2 stroke-border/40" />
            <rect x="62" y="40" width="116" height="50" rx="8" fill="currentColor" className="text-card" />
          </svg>
        )
      },
      {
        title: "Нажмите на пост / стрелочку",
        desc: device === "mobile"
          ? "Быстро тапните по телу поста (или зажмите его) и нажмите на стрелочку «Поделиться»."
          : "Нажмите правой кнопкой мыши на пост или на значок стрелки рядом.",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="currentColor" stroke="currentColor" strokeWidth="1" className="text-content2 stroke-border/40" />
            <rect x="62" y="40" width="116" height="50" rx="8" fill="currentColor" className="text-card" />
            <g transform="translate(155, 65)">
              <circle cx="0" cy="0" r="10" className="fill-primary/20 animate-ping" />
              <circle cx="0" cy="0" r="3" className="fill-primary" />
            </g>
          </svg>
        )
      },
      {
        title: "«Копировать ссылку»",
        desc: "Выберите пункт «Копировать ссылку» (Copy Link). Мы распознаем посты как из публичных, так и из закрытых каналов (при наличии инвайта).",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="currentColor" stroke="currentColor" strokeWidth="1" className="text-content2 stroke-border/40" />
            <rect x="52" y="90" width="136" height="78" rx="12" fill="currentColor" className="text-card" />
            <rect x="60" y="112" width="120" height="20" rx="6" className="text-primary/10 stroke-primary" fill="currentColor" strokeWidth="1" />
            <text x="120" y="125" textAnchor="middle" className="fill-primary font-bold text-[8px]">Копировать ссылку</text>
          </svg>
        )
      }
    );
  } else if (contentType === "photo") {
    steps.push(
      {
        title: "Ссылка на ПЕРВОЕ фото (пост)",
        desc: "Найдите альбом в канале. Скопируйте ссылку на первое фото (или сам пост) через меню «Поделиться» или правый клик. Это основная ссылка вида t.me/channel/100, вставьте её в верхнее поле заказа.",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" className="text-content2 stroke-border/40" fill="currentColor" strokeWidth="1" />
            <rect x="62" y="32" width="56" height="52" rx="6" className="text-primary/20 stroke-primary" fill="currentColor" strokeWidth="1.5" />
            <text x="90" y="62" textAnchor="middle" className="fill-primary font-black text-[12px]">#1</text>
            <rect x="122" y="32" width="56" height="52" rx="6" fill="currentColor" className="text-muted/20" />
            <rect x="62" y="88" width="56" height="52" rx="6" fill="currentColor" className="text-muted/20" />
            <rect x="122" y="88" width="56" height="52" rx="6" fill="currentColor" className="text-muted/20" />
            <g transform="translate(90, 58)">
              <circle cx="0" cy="0" r="10" className="fill-primary/20 animate-ping" />
            </g>
          </svg>
        )
      },
      {
        title: "Откройте ПОСЛЕДНЕЕ фото",
        desc: "Тапните по последнему фото/видео в альбоме, чтобы развернуть его на весь экран (на телефоне), или наведите курсор на последнее фото (на ПК).",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="currentColor" stroke="currentColor" strokeWidth="1" className="text-content2 stroke-border/40" />
            <rect x="62" y="32" width="56" height="52" rx="6" fill="currentColor" className="text-muted/20" />
            <rect x="122" y="32" width="56" height="52" rx="6" fill="currentColor" className="text-muted/20" />
            <rect x="62" y="88" width="56" height="52" rx="6" fill="currentColor" className="text-muted/20" />
            <rect x="122" y="88" width="56" height="52" rx="6" className="text-primary/20 stroke-primary" fill="currentColor" strokeWidth="1.5" />
            <text x="150" y="118" textAnchor="middle" className="fill-primary font-black text-[12px]">#4</text>
            <g transform="translate(150, 114)">
              <circle cx="0" cy="0" r="10" className="fill-primary/20 animate-ping" />
            </g>
          </svg>
        )
      },
      {
        title: "Ссылка на последнее фото",
        desc: "Нажмите меню «⋯» или «Поделиться» и скопируйте ссылку. Она будет иметь ID последнего поста (напр., t.me/channel/103). Вставьте её во второе поле ввода! Система автоматически запустит просмотры на все фото в этом диапазоне (100-103).",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="currentColor" stroke="currentColor" strokeWidth="1" className="text-content2 stroke-border/40" />
            <rect x="58" y="32" width="124" height="42" rx="8" className="text-success/10 stroke-success" fill="currentColor" strokeWidth="1" />
            <text x="120" y="56" textAnchor="middle" className="fill-success font-black text-[7px]">Диапазон: 100 ➔ 103 (Всего 4)</text>
            <rect x="52" y="90" width="136" height="78" rx="12" fill="currentColor" className="text-card" />
            <rect x="60" y="112" width="120" height="20" rx="6" className="text-primary/10 stroke-primary" fill="currentColor" strokeWidth="1" />
            <text x="120" y="125" textAnchor="middle" className="fill-primary font-bold text-[7px]">Второе поле: Ссылка на последнее фото</text>
          </svg>
        )
      }
    );
  }
  return steps;
}
