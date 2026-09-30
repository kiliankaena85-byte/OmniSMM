'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Wallet,
  ArrowRight,
  RefreshCw,
  TrendingUp,
  Users,
  Copy,
  Check,
  Sparkles,
  Send,
  Eye,
  Heart,
  MessageSquare,
  Flame,
  CheckCircle2,
  ChevronRight,
  Zap,
} from 'lucide-react';

import { PaymentAutoSync } from '@/components/orders/PaymentAutoSync';
import { getStatusBadgeClass, getStatusLabel } from '@/utils/status-helpers';
import { formatRub, toCents } from '@/lib/money';
import { FluxOrder, FluxNetwork } from '@/types/flux';
import { useUserBalance } from '@/hooks/use-user-balance';

export interface FluxDashboardHomeLovableProps {
  user: {
    email: string;
    balanceCents: number;
    referralCode?: string | null;
    totalSpent?: number;
  };
  orders: FluxOrder[];
  referralCount: number;
  activeOrders: number;
  hasPendingPayments: boolean;
  origin: string;
  initialCatalog?: FluxNetwork[];
}

interface SocialPlatformPreset {
  id: string;
  name: string;
  slug: string;
  activeClass: string;
  inactiveClass: string;
  iconText: string;
  placeholder: string;
  urlPattern: RegExp;
  defaultRateUnit: number;
}

const SOCIAL_PLATFORMS: SocialPlatformPreset[] = [
  {
    id: 'tg',
    name: 'Telegram',
    slug: 'telegram',
    activeClass: 'bg-sky-500 text-white border-sky-500 shadow-md shadow-sky-500/25 scale-105',
    inactiveClass: 'bg-white/80 hover:bg-sky-50 border-slate-200 text-slate-700 hover:text-sky-700',
    iconText: 'TG',
    placeholder: 'https://t.me/channel_name или ссылка на пост...',
    urlPattern: /(?:t\.me|telegram\.me)\//i,
    defaultRateUnit: 0.18,
  },
  {
    id: 'vk',
    name: 'ВКонтакте',
    slug: 'vk',
    activeClass: 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/25 scale-105',
    inactiveClass: 'bg-white/80 hover:bg-blue-50 border-slate-200 text-slate-700 hover:text-blue-700',
    iconText: 'VK',
    placeholder: 'https://vk.com/public12345 или ссылка на запись...',
    urlPattern: /vk\.com\//i,
    defaultRateUnit: 0.14,
  },
  {
    id: 'yt',
    name: 'YouTube',
    slug: 'youtube',
    activeClass: 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/25 scale-105',
    inactiveClass: 'bg-white/80 hover:bg-red-50 border-slate-200 text-slate-700 hover:text-red-700',
    iconText: 'YT',
    placeholder: 'https://youtube.com/watch?v=... или ссылка на канал...',
    urlPattern: /(?:youtube\.com|youtu\.be)\//i,
    defaultRateUnit: 0.22,
  },
  {
    id: 'ig',
    name: 'Instagram',
    slug: 'instagram',
    activeClass: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-purple-500 shadow-md shadow-pink-500/25 scale-105',
    inactiveClass: 'bg-white/80 hover:bg-pink-50 border-slate-200 text-slate-700 hover:text-pink-700',
    iconText: 'IG',
    placeholder: 'https://instagram.com/p/... или профиль...',
    urlPattern: /(?:instagram\.com|instagr\.am)\//i,
    defaultRateUnit: 0.25,
  },
  {
    id: 'tt',
    name: 'TikTok',
    slug: 'tiktok',
    activeClass: 'bg-slate-900 text-white border-slate-900 shadow-md scale-105',
    inactiveClass: 'bg-white/80 hover:bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900',
    iconText: 'TT',
    placeholder: 'https://tiktok.com/@user/video/...',
    urlPattern: /(?:tiktok\.com)\//i,
    defaultRateUnit: 0.16,
  },
];

const PROMPT_GOALS = [
  { id: 'followers', label: 'Подписчики', icon: Users, defaultQty: 1000 },
  { id: 'views', label: 'Просмотры', icon: Eye, defaultQty: 2500 },
  { id: 'likes', label: 'Лайки', icon: Heart, defaultQty: 500 },
  { id: 'reactions', label: 'Реакции', icon: Flame, defaultQty: 1000 },
  { id: 'comments', label: 'Комментарии', icon: MessageSquare, defaultQty: 100 },
];

const QUANTITY_PRESETS = [500, 1000, 2500, 5000, 10000];

export function FluxDashboardHomeLovable({
  user,
  orders,
  referralCount,
  activeOrders,
  hasPendingPayments,
  origin,
  initialCatalog = [],
}: FluxDashboardHomeLovableProps) {
  const router = useRouter();
  const { balance: liveBalance } = useUserBalance(user.balanceCents);

  // Lovable Prompt Console State (Light & Vibrant)
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatformPreset>(SOCIAL_PLATFORMS[0]);
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [selectedGoal, setSelectedGoal] = useState<string>('followers');
  const [quantity, setQuantity] = useState<number>(1000);
  const [autoDetected, setAutoDetected] = useState<boolean>(false);

  // Referral copy state
  const [copied, setCopied] = useState<boolean>(false);
  const copyTimerRef = useRef<NodeJS.Timeout | null>(null);

  const refCode = user.referralCode ?? '';
  const refLink = refCode ? `${origin}?ref=${encodeURIComponent(refCode)}` : origin;
  const isRefLinkAvailable = Boolean(refCode);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Auto-detect platform when targetUrl changes
  const handleUrlChange = (value: string) => {
    setTargetUrl(value);
    const matched = SOCIAL_PLATFORMS.find((p) => p.urlPattern.test(value));
    if (matched && matched.id !== selectedPlatform.id) {
      setSelectedPlatform(matched);
      setAutoDetected(true);
      setTimeout(() => setAutoDetected(false), 2500);
    }
  };

  // ExactMath Calculations: Unit rate and total sum
  const unitRateRub = selectedPlatform.defaultRateUnit;
  const totalCostRub = useMemo(() => {
    const kopecksPerUnit = BigInt(Math.round(unitRateRub * 100));
    const totalKopecks = BigInt(quantity) * kopecksPerUnit;
    return (Number(totalKopecks) / 100).toFixed(2);
  }, [quantity, unitRateRub]);

  const copyRefLink = () => {
    if (!isRefLinkAvailable) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard
        .writeText(refLink)
        .then(() => {
          setCopied(true);
          if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
          copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {});
    }
  };

  const handleLaunchCampaign = () => {
    const queryParams = new URLSearchParams();
    if (targetUrl) queryParams.set('link', targetUrl);
    queryParams.set('network', selectedPlatform.slug);
    queryParams.set('goal', selectedGoal);
    queryParams.set('qty', String(quantity));
    router.push(`/dashboard/new-order?${queryParams.toString()}`);
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-3 duration-500 max-w-6xl mx-auto">
      {hasPendingPayments && <PaymentAutoSync />}

      {/* ── 1. LOVABLE GENERATIVE COMMAND CENTER (LIGHT & VIBRANT HERO PROMPT BOX) ── */}
      <section className="relative overflow-hidden rounded-[2.5rem] p-6 sm:p-10 bg-white/80 dark:bg-card/80 backdrop-blur-2xl border border-white/90 dark:border-border/60 shadow-[0_12px_36px_rgba(100,116,139,0.08)] transition-all">
        {/* Rainbow Accent Top Strip */}
        <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-blue-500 via-purple-500 via-pink-500 to-orange-400" />

        <div className="relative z-10 flex flex-col items-center text-center space-y-4 max-w-3xl mx-auto">
          {/* Sparkle Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-50 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800 text-xs font-bold text-purple-700 dark:text-purple-300 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
            <span>SMMflux Generative Engine · v2026</span>
          </div>

          {/* High-Impact Headline */}
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-950 dark:text-white leading-tight">
            Что продвигаем{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600">
              сегодня?
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 dark:text-muted-foreground max-w-xl font-medium">
            Вставьте ссылку на канал, профиль или публикацию — алгоритм автоматически распознает соцсеть,
            подберёт оптимальный тариф и запустит выполнение за секунды.
          </p>

          {/* Social Platform Selection Capsules */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 w-full">
            {SOCIAL_PLATFORMS.map((platform) => {
              const isSelected = selectedPlatform.id === platform.id;
              return (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => setSelectedPlatform(platform)}
                  className={`min-h-[44px] px-4 py-2 rounded-full text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer border ${
                    isSelected ? platform.activeClass : platform.inactiveClass
                  }`}
                  aria-pressed={isSelected}
                >
                  <span className="font-extrabold text-[11px] tracking-wider px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/10">
                    {platform.iconText}
                  </span>
                  <span>{platform.name}</span>
                </button>
              );
            })}
          </div>

          {/* The Prompt Console Input Container */}
          <div className="w-full mt-4 space-y-4">
            <div className="relative group w-full">
              <div className="relative flex items-center w-full bg-white/95 dark:bg-card/95 rounded-2xl sm:rounded-full p-2 border border-slate-200 dark:border-border shadow-[0_4px_24px_rgba(100,116,139,0.08)] focus-within:border-purple-400 focus-within:ring-4 focus-within:ring-purple-100 dark:focus-within:ring-purple-950 transition-all min-h-[62px]">
                <div className="pl-4 pr-2 shrink-0">
                  <Send className="w-5 h-5 text-slate-400 group-focus-within:text-purple-600 dark:group-focus-within:text-purple-400 transition-colors" />
                </div>

                <input
                  type="url"
                  value={targetUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder={selectedPlatform.placeholder}
                  className="flex-1 min-w-0 bg-transparent text-sm sm:text-base font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none px-2"
                  aria-label="Ссылка для продвижения"
                />

                {autoDetected && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800 animate-in fade-in zoom-in-95 duration-200 mr-2 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Распознано
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleLaunchCampaign}
                  className="min-h-[46px] px-6 sm:px-8 py-2.5 rounded-xl sm:rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:opacity-95 active:scale-95 text-white font-bold text-xs sm:text-sm tracking-wide shadow-[0_4px_16px_rgba(168,85,247,0.35)] flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
                >
                  <span>Запустить</span>
                  <Sparkles className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Action Goals & Quantity Row */}
            <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-muted/40 border border-slate-200/80 dark:border-border/60 flex flex-col md:flex-row items-center justify-between gap-4 text-left">
              {/* Goal Capsules */}
              <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                <span className="text-xs font-bold text-slate-500 mr-1 hidden sm:inline uppercase tracking-wider">Цель:</span>
                {PROMPT_GOALS.map((goal) => {
                  const isSelected = selectedGoal === goal.id;
                  const Icon = goal.icon;
                  return (
                    <button
                      key={goal.id}
                      type="button"
                      onClick={() => {
                        setSelectedGoal(goal.id);
                        setQuantity(goal.defaultQty);
                      }}
                      className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold shadow-xs'
                          : 'bg-white dark:bg-card text-slate-700 dark:text-slate-300 hover:text-slate-950 border border-slate-200 dark:border-border'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{goal.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Quantity Selector & ExactMath Live Pricing */}
              <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 w-full md:w-auto shrink-0 border-t md:border-t-0 border-slate-200 dark:border-border pt-3 md:pt-0">
                <div className="flex items-center gap-1.5">
                  {QUANTITY_PRESETS.slice(0, 3).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setQuantity(preset)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        quantity === preset
                          ? 'bg-purple-100 text-purple-700 border border-purple-300 dark:bg-purple-950/60 dark:text-purple-300'
                          : 'bg-white dark:bg-card text-slate-600 dark:text-slate-400 hover:text-slate-950 border border-slate-200 dark:border-border'
                      }`}
                    >
                      {preset.toLocaleString('ru-RU')}
                    </button>
                  ))}
                </div>

                <div className="text-right shrink-0">
                  <div className="text-base font-black text-slate-950 dark:text-white font-mono tabular-nums">
                    {totalCostRub} ₽
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-muted-foreground font-semibold">
                    ~{unitRateRub.toFixed(2)} ₽ / шт
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Catalog Link */}
            <div className="pt-1 flex items-center justify-center gap-2">
              <Link
                href="/dashboard/new-order"
                className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-800 flex items-center gap-1.5 transition-colors group"
              >
                <span>Или открыть расширенный каталог всех {initialCatalog.length > 0 ? initialCatalog.length * 30 : '500'}+ услуг</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. METRICS & RECENT CAMPAIGNS GRID ── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Balance & Active Orders Cards */}
        <div className="space-y-6 lg:col-span-1">
          {/* Balance Glass Card */}
          <div className="relative overflow-hidden rounded-[2rem] p-6 bg-white/80 dark:bg-card/80 backdrop-blur-2xl border border-white/90 dark:border-border/60 shadow-[0_10px_30px_-5px_rgba(100,116,139,0.07)] hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0" />
                </div>
                <span className="font-bold text-slate-900 dark:text-foreground text-base">Баланс аккаунта</span>
              </div>
              <Link
                href="/dashboard/finance"
                className="min-h-[40px] text-xs font-bold px-4 py-2 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 text-white rounded-xl shadow-[0_4px_16px_rgba(168,85,247,0.3)] hover:opacity-95 active:scale-95 transition-all flex items-center justify-center"
              >
                + Пополнить
              </Link>
            </div>

            <div className="text-3xl sm:text-4xl font-black tabular-nums tracking-tight mb-2 text-slate-950 dark:text-white font-mono">
              {liveBalance}
            </div>

            <div className="text-xs text-slate-500 dark:text-muted-foreground font-semibold flex items-center gap-1.5 pt-2 border-t border-slate-200/60 dark:border-border/40">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Потрачено всего: {formatRub(Number(user.totalSpent || 0))} ₽</span>
            </div>
          </div>

          {/* Active Orders Glass Card */}
          <div className="relative overflow-hidden rounded-[2rem] p-6 bg-white/80 dark:bg-card/80 backdrop-blur-2xl border border-white/90 dark:border-border/60 shadow-[0_10px_30px_-5px_rgba(100,116,139,0.07)] hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-100 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-sky-600 dark:text-sky-400 animate-spin-slow shrink-0" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-foreground text-base">В работе</span>
                  {activeOrders > 0 && (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                  )}
                </div>
              </div>
              <Link
                href="/dashboard/orders"
                className="min-h-[40px] text-xs font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1 hover:underline px-2 py-1"
              >
                Все заказы <ArrowRight className="w-3 h-3 shrink-0" />
              </Link>
            </div>

            <div className="text-3xl sm:text-4xl font-black tabular-nums tracking-tight mb-1 text-slate-950 dark:text-white font-mono">
              {activeOrders}
            </div>
            <div className="text-xs text-slate-500 dark:text-muted-foreground font-medium">Кампаний выполняется прямо сейчас</div>
          </div>
        </div>

        {/* Right Column: Recent Activity Feed */}
        <div className="relative overflow-hidden rounded-[2rem] p-6 bg-white/80 dark:bg-card/80 backdrop-blur-2xl border border-white/90 dark:border-border/60 shadow-[0_10px_30px_-5px_rgba(100,116,139,0.07)] hover:shadow-md lg:col-span-2 flex flex-col justify-between transition-all">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-950 dark:text-white text-lg">Последняя активность</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 font-bold mono">
                  {orders.length}
                </span>
              </div>
              <Link
                href="/dashboard/orders"
                className="min-h-[40px] text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 transition-colors px-2 py-1"
              >
                Вся история <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3">
              {orders.length === 0 ? (
                <div className="text-center py-12 rounded-2xl bg-slate-50/60 dark:bg-muted/20 border border-slate-200/60 dark:border-border/40">
                  <Zap className="w-10 h-10 mx-auto mb-2 text-slate-400" />
                  <p className="font-semibold text-sm text-slate-900 dark:text-foreground mb-1">Кампаний пока нет</p>
                  <p className="text-xs text-slate-500 dark:text-muted-foreground max-w-xs mx-auto">
                    Используйте командную строку выше, чтобы запустить свой первый заказ.
                  </p>
                </div>
              ) : (
                orders.map((order) => {
                  const color = getStatusBadgeClass(order.status);
                  const label = getStatusLabel(order.status);
                  const cost = formatRub(order.chargeCents ?? toCents(order.charge));

                  return (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-card border border-slate-200/80 dark:border-border/60 hover:border-purple-200 transition-colors gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 ${color}`}>
                          {label}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-foreground text-sm truncate min-w-0">
                            {order.service.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-muted-foreground font-medium flex items-center gap-2">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{order.quantity.toLocaleString('ru-RU')} шт.</span>
                            {order.link && (
                              <span className="truncate max-w-[180px] sm:max-w-[280px] text-slate-400 text-[11px]">
                                {order.link}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                          {cost} ₽
                        </span>
                        <Link
                          href={`/dashboard/new-order?serviceId=${order.service?.id || ''}&link=${encodeURIComponent(
                            order.link || ''
                          )}`}
                          title="Повторить заказ"
                          className="min-h-[38px] min-w-[38px] hidden sm:flex items-center justify-center p-2 rounded-xl bg-slate-100 hover:bg-purple-100 text-slate-500 hover:text-purple-700 transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. REFERRAL PROGRAM LOVABLE GLASS BANNER (LIGHT & VIBRANT) ── */}
      <section className="relative overflow-hidden rounded-[2.5rem] p-6 sm:p-8 bg-gradient-to-r from-purple-50/90 via-white to-pink-50/90 dark:from-purple-950/30 dark:via-card/80 dark:to-pink-950/20 border border-purple-100 dark:border-purple-900/50 shadow-[0_10px_30px_rgba(192,38,211,0.06)] text-slate-900 dark:text-white backdrop-blur-2xl">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-bold uppercase tracking-wider border border-purple-200 dark:border-purple-800">
              <Users className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Партнёрская программа</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white">
              Зарабатывайте до 10% с каждого пополнения
            </h2>
            <p className="text-sm text-slate-600 dark:text-muted-foreground max-w-xl font-medium">
              Делитесь персональной ссылкой с коллегами, клиентами и в соцсетях. Начисления поступают на ваш
              баланс моментально и бессрочно.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
            <div className="bg-white dark:bg-card px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-border text-center flex-1 sm:flex-none min-w-[110px] shadow-2xs">
              <span className="text-[11px] text-slate-500 font-bold block uppercase tracking-wider">
                Приглашено
              </span>
              <span className="text-xl font-black font-mono text-purple-700 dark:text-purple-400">{referralCount} чел.</span>
            </div>

            <button
              type="button"
              onClick={copyRefLink}
              disabled={!isRefLinkAvailable}
              title={!isRefLinkAvailable ? 'Код скоро появится' : undefined}
              className="min-h-[44px] w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 text-white font-bold text-sm shadow-[0_4px_16px_rgba(168,85,247,0.35)] hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-white shrink-0" /> : <Copy className="w-4 h-4" />}
              <span>
                {copied
                  ? 'Ссылка скопирована!'
                  : !isRefLinkAvailable
                  ? 'Код формируется...'
                  : 'Скопировать ссылку'}
              </span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
