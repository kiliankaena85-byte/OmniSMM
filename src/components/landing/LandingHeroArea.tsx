'use client';

import React from "react";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { HeroInput } from "./order-engine/HeroInput";
import { OrderEngine } from "@/hooks/useOrderEngine";

export interface LandingHeroAreaProps {
  engine: OrderEngine;
  handleCheckout: (gateway?: string, email?: string) => void;
  linkHasError: boolean;
  setLinkHasError: (val: boolean) => void;
  onOpenGuide: () => void;
  customHeroTitle?: React.ReactNode;
  customHeroSubtitle?: string;
}

export function LandingHeroArea({
  engine,
  handleCheckout,
  linkHasError,
  setLinkHasError,
  onOpenGuide,
  customHeroTitle,
  customHeroSubtitle,
}: LandingHeroAreaProps) {
  return (
    <>
      {/* Мобильный компактный заголовок: First Screen Viewport Fit */}
      <div className="block md:hidden text-center mb-2.5 w-full px-2 animate-in fade-in duration-300">
        <div className="flex items-center justify-center gap-2 mb-2">
          <ThemeSwitcher />
        </div>
        <h1 className="text-xl font-black tracking-tight text-foreground leading-tight">
          Быстрый запуск в соцсетях
        </h1>
        <p className="text-[12px] text-muted-foreground font-medium mt-0.5">
          Без паролей и регистрации • Запуск за 30 секунд
        </p>
      </div>

      {/* Десктопный Hero блок */}
      <div className="hidden md:block text-center space-y-4 mb-8 max-w-4xl mx-auto relative z-20 w-full mt-2 px-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-2 flex items-center justify-center gap-3">
          <ThemeSwitcher />
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.08] drop-shadow-md text-balance">
          {customHeroTitle || (
            <>
              Продвижение в <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-indigo-500 to-pink-500 dark:from-sky-400 dark:via-indigo-400 dark:to-pink-400">Telegram, VK и соцсетях</span> от 0.01 ₽
            </>
          )}
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground leading-relaxed font-medium max-w-2xl mx-auto drop-shadow-sm text-pretty">
          {customHeroSubtitle || "Удобный сервис для продвижения социальных сетей. Без паролей и регистрации — мгновенный запуск за 30 секунд."}
        </p>
        <div className="flex items-center justify-center gap-4 sm:gap-6 md:gap-10 pt-1">
          <div className="text-center">
            <p className="text-xl sm:text-2xl font-black text-foreground tabular-nums tracking-tight drop-shadow-sm">15+</p>
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider drop-shadow-sm">Платформ</p>
          </div>
          <div className="w-px h-8 bg-border"></div>
          <div className="text-center">
            <p className="text-xl sm:text-2xl font-black text-foreground tabular-nums tracking-tight drop-shadow-sm">300+</p>
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider drop-shadow-sm">Услуг</p>
          </div>
          <div className="w-px h-8 bg-border"></div>
          <div className="text-center">
            <p className="text-xl sm:text-2xl font-black text-foreground tabular-nums tracking-tight drop-shadow-sm">9-21</p>
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider drop-shadow-sm">Поддержка (МСК)</p>
          </div>
        </div>

        {/* ГЛАВНЫЙ ИНПУТ ДЛЯ ВСТАВКИ ССЫЛКИ В HERO СЕКЦИИ (ТОЛЬКО ДЕСКТОП) */}
        <div className="pt-3 w-full">
          <HeroInput 
            engine={engine} 
            handleCheckout={handleCheckout} 
            linkHasError={linkHasError} 
            setLinkHasError={setLinkHasError} 
            onOpenGuide={onOpenGuide}
          />
        </div>
      </div>
    </>
  );
}
