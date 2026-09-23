import React from "react";
import { StepDef, ContentType, DeviceType } from "./types";

export function getInstagramSteps(contentType: ContentType, device: DeviceType): StepDef[] {
  const steps: StepDef[] = [];
  
  if (contentType === "profile") {
    steps.push(
      {
        title: "Зайдите на нужный профиль",
        desc: device === "mobile" 
          ? "Откройте страницу блогера или паблика в приложении Instagram." 
          : "Перейдите на страницу нужного пользователя в браузере.",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" className="text-content2 stroke-border/40" fill="currentColor" strokeWidth="1" />
            <circle cx="85" cy="45" r="16" fill="currentColor" className="text-muted/30" />
            <rect x="110" y="38" width="60" height="8" rx="2.5" fill="currentColor" className="text-muted-foreground/30" />
            <rect x="110" y="52" width="40" height="6" rx="2" fill="currentColor" className="text-muted-foreground/15" />
          </svg>
        )
      },
      {
        title: device === "mobile" ? "Нажмите «Поделиться»" : "Скопируйте URL",
        desc: device === "mobile" 
          ? "Под описанием профиля нажмите большую кнопку **«Поделиться профилем»**." 
          : "Кликните по адресной строке в верхней части браузера.",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="currentColor" className="text-content2 stroke-border/40" strokeWidth="1" />
            <rect x="62" y="80" width="55" height="18" rx="6" className="text-primary/10 stroke-primary" fill="currentColor" strokeWidth="1" />
            <text x="90" y="92" textAnchor="middle" className="fill-primary font-black text-[7px]">Поделиться</text>
            <g transform="translate(90, 95)">
              <circle cx="0" cy="0" r="8" className="fill-primary/20 animate-ping" />
              <circle cx="0" cy="0" r="3" className="fill-primary" />
            </g>
          </svg>
        )
      },
      {
        title: "«Копировать ссылку»",
        desc: device === "mobile" 
          ? "Во всплывающем меню выберите строчку **«Копировать ссылку»**." 
          : "Нажмите Ctrl+C, скопированная ссылка автоматически очистится от мусора в нашем поле ввода!",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="currentColor" className="text-content2 stroke-border/40" strokeWidth="1" />
            <rect x="52" y="95" width="136" height="73" rx="12" fill="currentColor" className="text-card" />
            <rect x="60" y="115" width="120" height="18" rx="5" className="text-primary/10 stroke-primary" fill="currentColor" strokeWidth="0.8" />
            <text x="68" y="127" className="fill-primary font-bold text-[8px]">Копировать ссылку</text>
            <g transform="translate(130, 124)">
              <circle cx="0" cy="0" r="8" className="fill-primary/20 animate-pulse" />
              <circle cx="0" cy="0" r="3" className="fill-primary" />
            </g>
          </svg>
        )
      }
    );
  } else if (contentType === "post") {
    steps.push(
      {
        title: "Откройте нужный пост/Reels",
        desc: "Перейдите к публикации, на которую хотите продвинуть лайки или просмотры.",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="currentColor" className="text-content2 stroke-border/40" strokeWidth="1" />
            <rect x="58" y="25" width="124" height="90" rx="6" fill="currentColor" className="text-muted/20" />
          </svg>
        )
      },
      {
        title: "Нажмите меню «⋯» или «Поделиться»",
        desc: device === "mobile"
          ? "Тапните по иконке самолетика (Поделиться) под постом или три точки в углу."
          : "Нажмите три точки справа от имени автора поста.",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="currentColor" className="text-content2 stroke-border/40" strokeWidth="1" />
            <g transform="translate(110, 130)">
              <circle cx="0" cy="0" r="10" className="fill-primary/20 animate-pulse" />
              <path d="M -5,-5 L 5,-1 L -1,1 Z" fill="currentColor" className="text-primary" />
            </g>
          </svg>
        )
      },
      {
        title: "«Копировать ссылку»",
        desc: "Нажмите кнопку «Копировать ссылку» (Copy Link). Ссылка готова для вставки!",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="currentColor" stroke="currentColor" strokeWidth="1" className="text-content2 stroke-border/40" />
            <rect x="52" y="90" width="136" height="78" rx="12" fill="currentColor" className="text-card" />
            <rect x="60" y="112" width="120" height="20" rx="6" className="text-primary/10 stroke-primary" fill="currentColor" strokeWidth="1" />
            <text x="120" y="125" textAnchor="middle" className="fill-primary font-bold text-[8px]">Скопировать ссылку</text>
          </svg>
        )
      }
    );
  } else if (contentType === "story") {
    steps.push(
      {
        title: "Откройте нужную историю",
        desc: "Запустите просмотр Stories нужного аккаунта.",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="#09090c" stroke="currentColor" className="text-border/40" strokeWidth="1" />
            <rect x="54" y="14" width="132" height="152" rx="12" fill="currentColor" className="text-muted/15" />
          </svg>
        )
      },
      {
        title: "Нажмите меню «⋯» или самолетик",
        desc: "В правом верхнем углу (на ПК) или правом нижнем (в телефоне) нажмите на иконку меню / поделиться.",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="#09090c" stroke="currentColor" className="text-border/40" strokeWidth="1" />
            <g transform="translate(170, 30)">
              <circle cx="0" cy="0" r="10" className="fill-primary/20 animate-ping" />
              <circle cx="-4" cy="0" r="1.5" fill="#ffffff" />
              <circle cx="0" cy="0" r="1.5" fill="#ffffff" />
              <circle cx="4" cy="0" r="1.5" fill="#ffffff" />
            </g>
          </svg>
        )
      },
      {
        title: "«Скопировать ссылку»",
        desc: "Выберите строчку «Скопировать ссылку». Помните, что история должна быть активной (с момента публикации прошло менее 24 часов).",
        svg: (
          <svg viewBox="0 0 240 180" className="w-full h-full max-h-[130px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="10" width="140" height="160" rx="16" fill="#0b0b0f" stroke="currentColor" className="text-border/40" strokeWidth="1" />
            <rect x="52" y="100" width="136" height="68" rx="12" fill="currentColor" className="text-card" />
            <rect x="60" y="120" width="120" height="18" rx="5" className="text-primary/10 stroke-primary" fill="currentColor" strokeWidth="0.8" />
            <text x="68" y="132" className="fill-primary font-bold text-[8px]">Скопировать ссылку</text>
          </svg>
        )
      }
    );
  }
  return steps;
}
