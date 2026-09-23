'use client';

import React, { useState } from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Link2, ArrowRight, Sparkles, Check, Target, CreditCard, X } from 'lucide-react';
import { stripQueryParams, normalizeUsername } from '@/utils/link-normalizer';
import { detectPlatformLite } from '@/utils/link-extractor';
import { toast } from 'sonner';
import { PublicNetwork, PublicCategory, PublicService } from '@/actions/order/catalog';

interface DashboardHeroLinkInputProps {
  link: string;
  setLink: (val: string) => void;
  networks: PublicNetwork[];
  selectedNetwork: PublicNetwork | null;
  setSelectedNetwork: (net: PublicNetwork | null) => void;
  selectedCategory: PublicCategory | null;
  selectedService: PublicService | null;
  step: 1 | 2 | 3 | 4;
  onAdvanceStep?: () => void;
}

export function DashboardHeroLinkInput({
  link,
  setLink,
  networks,
  selectedNetwork,
  setSelectedNetwork,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  selectedCategory,
  selectedService,
  step,
  onAdvanceStep,
}: DashboardHeroLinkInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleProcessLink = (rawInput: string) => {
    let clean = stripQueryParams(rawInput.trim());
    if (!clean) {
      setLink('');
      return;
    }

    // Attempt smart platform detection
    const detectedPlatform = detectPlatformLite(clean);
    const platformSlug = String(detectedPlatform).toLowerCase();

    // FIX(BUG-B4): нормализуем ТОЛЬКО явный username (@channel) или доменную ссылку.
    // Раньше произвольное слово без '/' и '.' молча превращалось в https://t.me/<слово> —
    // фабриковались ссылки, которых пользователь не вводил.
    const isUsername = clean.startsWith('@');
    const isDomainish = clean.includes('.') || clean.includes('/');

    if (isUsername) {
      clean = normalizeUsername(clean, platformSlug !== 'other' ? platformSlug : 'telegram');
    } else if (!/^https?:\/\//i.test(clean) && isDomainish && !clean.includes(' ')) {
      clean = `https://${clean}`;
    }

    setLink(clean);

    // FIX(BUG-B1): авто-определение сети больше НЕ выполняет навигацию по шагам
    // и НЕ перебивает ручной выбор. Сеть подставляется тихо, пользователь остаётся
    // на текущем шаге и осознанно нажимает «Продолжить».
    // Автоподстановка — только если платформа реально распознана по домену ссылки.
    if (platformSlug && platformSlug !== 'other' && isDomainish) {
      // FIX(B4-strict): точное совпадение slug. Раньше name.includes(platformSlug)
      // ловило ложные срабатывания ('ok' ⊂ 'TikTok'). Нечётный матчинг запрещён:
      // авто-подстановка сети допустима только при однозначном распознавании.
      const matched = networks.find((n) => n.slug.toLowerCase() === platformSlug);
      if (matched && (!selectedNetwork || selectedNetwork.id !== matched.id)) {
        setSelectedNetwork(matched);
        toast.success(`Платформа ${matched.name} определена автоматически`, {
          icon: '✨',
        });
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (pastedText) {
      e.preventDefault();
      handleProcessLink(pastedText);
      // FIX(BUG-B4): убран второй toast — раньше дублировался с тостом авто-определения
    }
  };

  const handleStartOrder = () => {
    if (!link.trim()) {
      toast.error('Пожалуйста, вставьте ссылку для продолжения.');
      return;
    }
    if (onAdvanceStep) {
      onAdvanceStep();
    }
  };

  return (
    <div className="w-full space-y-4 font-sans text-foreground">
      {/* ── 3-Step Interactive Breadcrumb Strip (Like Main Landing) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 select-none">
        {/* Step 1 */}
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-300 ${
            !link
              ? 'bg-primary/5 border-primary/30 text-foreground shadow-sm shadow-primary/10'
              : 'bg-emerald-500/5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
          }`}
        >
          <div
            className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
              !link
                ? 'bg-primary text-primary-foreground scale-105 shadow-md shadow-primary/20 animate-pulse'
                : 'bg-emerald-500 text-white'
            }`}
          >
            {!link ? '1' : <Check className="w-3.5 h-3.5" />}
          </div>
          <div className="text-left min-w-0">
            <p className="text-[9px] font-extrabold uppercase tracking-wider opacity-60">Шаг 1</p>
            <p className="text-xs font-black truncate">Укажите ссылку</p>
          </div>
          <div className="ml-auto text-muted-foreground/60 shrink-0">
            <Link2 className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Step 2 */}
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-300 ${
            link && !selectedService
              ? 'bg-primary/5 border-primary/30 text-foreground shadow-sm shadow-primary/10'
              : link && selectedService
              ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
              : 'bg-muted/30 border-border/50 text-muted-foreground opacity-60'
          }`}
        >
          <div
            className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
              link && !selectedService
                ? 'bg-primary text-primary-foreground scale-105 shadow-md shadow-primary/20 animate-pulse'
                : link && selectedService
                ? 'bg-emerald-500 text-white'
                : 'bg-muted border border-border/50 text-muted-foreground'
            }`}
          >
            {link && selectedService ? <Check className="w-3.5 h-3.5" /> : '2'}
          </div>
          <div className="text-left min-w-0">
            <p className="text-[9px] font-extrabold uppercase tracking-wider opacity-60">Шаг 2</p>
            <p className="text-xs font-black truncate">
              {selectedService ? selectedService.name : 'Выберите тариф'}
            </p>
          </div>
          <div className="ml-auto text-muted-foreground/60 shrink-0">
            <Target className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Step 3 */}
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-300 ${
            selectedService && step === 4
              ? 'bg-primary/5 border-primary/30 text-foreground shadow-sm shadow-primary/10 animate-pulse'
              : 'bg-muted/30 border-border/50 text-muted-foreground opacity-60'
          }`}
        >
          <div
            className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
              selectedService && step === 4
                ? 'bg-primary text-primary-foreground scale-105 shadow-md shadow-primary/20'
                : 'bg-muted border border-border/50 text-muted-foreground'
            }`}
          >
            3
          </div>
          <div className="text-left min-w-0">
            <p className="text-[9px] font-extrabold uppercase tracking-wider opacity-60">Шаг 3</p>
            <p className="text-xs font-black truncate">Быстрая оплата</p>
          </div>
          <div className="ml-auto text-muted-foreground/60 shrink-0">
            <CreditCard className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* ── Premium Google Shimmer Glowing Input Wrapper (Landing Page Style) ── */}
      <div
        className={`relative w-full group rounded-full transition-all duration-300 ${
          isFocused ? 'p-[3px] scale-[1.005]' : 'p-[2px] scale-100'
        }`}
      >
        {/* Shimmer Border */}
        <div className="absolute inset-0 rounded-full google-border-shimmer opacity-100 pointer-events-none" />

        {/* Soft Ambient Glow */}
        <div
          className={`absolute inset-0 rounded-full transition-all duration-300 pointer-events-none blur-md ${
            isFocused
              ? 'google-border-shimmer opacity-80 scale-[1.02]'
              : 'google-border-shimmer opacity-35 group-hover:opacity-60'
          }`}
        />

        <div className="relative flex items-center w-full bg-card rounded-full p-1.5 sm:p-2 h-14 sm:h-16 z-10 border border-border/60 shadow-sm">
          <div className="pl-3 sm:pl-4 pr-2 flex-shrink-0">
            <Link2 className="w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          </div>

          <input
            type="text"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onPaste={handlePaste}
            onBlur={(e) => {
              setIsFocused(false);
              handleProcessLink(e.target.value);
            }}
            onFocus={() => setIsFocused(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleProcessLink(link);
                handleStartOrder();
              }
            }}
            placeholder="Вставьте ссылку на канал, пост, профиль или группу (автоопределение сети)..."
            className="w-full bg-transparent border-none outline-none text-xs sm:text-sm md:text-base font-semibold text-foreground placeholder:text-muted-foreground/60 px-2 truncate"
          />

          {link && (
            <button
              type="button"
              onClick={() => setLink('')}
              className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors mr-1 shrink-0"
              title="Очистить ссылку"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handleStartOrder}
            className="rounded-full px-3.5 sm:px-6 py-2.5 sm:py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold text-xs sm:text-sm shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all shrink-0 flex items-center gap-1.5 cursor-pointer"
          >
            <span className="hidden sm:inline">{selectedService ? 'К оформлению' : 'Продолжить'}</span>
            <span className="sm:hidden">{selectedService ? 'Далее' : 'Старт'}</span>
            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
