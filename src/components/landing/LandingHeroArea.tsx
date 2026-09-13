'use client';

import React from "react";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { HeroInput } from "./order-engine/HeroInput";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { SocialIcon } from "@/components/ui/SocialIcon";
import { Lock, ShieldCheck, Zap } from "lucide-react";

export interface LandingHeroAreaProps {
  engine: OrderEngine;
  handleCheckout: (gateway?: string, email?: string) => void;
  linkHasError: boolean;
  setLinkHasError: (val: boolean) => void;
  onOpenGuide: () => void;
  customHeroTitle?: React.ReactNode;
  customHeroSubtitle?: string;
  tenantId?: string;
}

export function LandingHeroArea({
  engine,
  handleCheckout,
  linkHasError,
  setLinkHasError,
  onOpenGuide,
  customHeroTitle,
  customHeroSubtitle,
  tenantId,
}: LandingHeroAreaProps) {
  return (
    <>
      {/* Мобильный блок позиционирования и доверия: Mobile Trust Header (First-Screen Viewport Fit) */}
      <div className="block md:hidden text-center mb-3 w-full px-2 animate-in fade-in duration-300">
        <div className="flex items-center justify-center gap-2 mb-2">
          <ThemeSwitcher />
        </div>

        {/* Микро-бейдж доверия */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold shadow-xs">
          <span className="flex items-center text-amber-500">⭐ 4.9</span>
          <span className="text-muted-foreground/60">•</span>
          <span>2M+ заказов</span>
          <span className="text-muted-foreground/60">•</span>
          <span className="flex items-center gap-1 text-success font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-success inline-block animate-pulse" />
            24/7 Онлайн
          </span>
        </div>

        {/* Четкий H1 заголовок позиционирования */}
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground leading-tight text-balance">
          Продвижение в{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-indigo-500 to-pink-500 dark:from-sky-400 dark:via-indigo-400 dark:to-pink-400">
            Telegram, VK и соцсетях
          </span>
        </h1>

        {/* Понятное УТП: что мы делаем */}
        <p className="text-[12px] sm:text-xs text-muted-foreground font-medium mt-1 leading-snug max-w-sm mx-auto text-pretty">
          Живые подписчики, просмотры и реакции от 0.01 ₽ • Запуск за 30 секунд
        </p>

        {/* Микро-лента поддерживаемых площадок */}
        <div 
          data-testid="mobile-social-bar"
          className="flex items-center justify-center gap-2.5 mt-2.5 py-1 px-2.5 bg-content1/70 backdrop-blur-md rounded-xl border border-border/40 shadow-xs max-w-fit mx-auto"
        >
          <div className="flex items-center gap-2 text-foreground">
            <span title="Telegram" className="flex items-center"><SocialIcon slug="telegram" size={15} colored /></span>
            <span title="ВКонтакте" className="flex items-center"><SocialIcon slug="vk" size={15} colored /></span>
            <span title="YouTube" className="flex items-center"><SocialIcon slug="youtube" size={15} colored /></span>
            <span title="Instagram" className="flex items-center"><SocialIcon slug="instagram" size={15} colored /></span>
            <span title="TikTok" className="flex items-center"><SocialIcon slug="tiktok" size={15} colored /></span>
          </div>
          <span className="w-px h-3.5 bg-border/60" />
          <span className="text-[10px] font-extrabold text-foreground/80 tracking-wide uppercase">
            15+ соцсетей
          </span>
        </div>

        {/* Ключевые гарантии безопасности */}
        <div className="flex items-center justify-center gap-2.5 mt-2 text-[10px] sm:text-[11px] font-semibold text-muted-foreground">
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-primary shrink-0" />
            Без паролей
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-success shrink-0" />
            Гарантия
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-500 shrink-0" />
            Старт 4 сек
          </span>
        </div>
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
