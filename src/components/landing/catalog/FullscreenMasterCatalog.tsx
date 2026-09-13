'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Share2,
  Camera,
  Video,
  PlaySquare,
  Radio,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ShieldCheck,
  Zap,
  Flame,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

export interface CatalogServiceItem {
  id: string;
  title: string;
  badge?: string;
  speed: string;
  guarantee: string;
  minMax: string;
  pricePerUnit: string;
  isPopular?: boolean;
}

export interface CatalogCategory {
  id: string;
  title: string;
  iconName?: string;
  services: CatalogServiceItem[];
}

export interface CatalogPlatform {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  categories: CatalogCategory[];
}

export const ALL_PLATFORMS: CatalogPlatform[] = [
  {
    id: 'telegram',
    name: 'Telegram',
    icon: Send,
    color: 'from-sky-500 to-blue-600',
    categories: [
      {
        id: 'tg-subs',
        title: 'Подписчики',
        services: [
          {
            id: 'tg-sub-1',
            title: 'Живые подписчики (РФ и СНГ)',
            badge: 'Хит продаж',
            speed: 'Мгновенный старт (1-3 мин)',
            guarantee: 'Гарантия от списаний: 30 дней',
            minMax: 'Лимиты: 50 — 100 000 шт',
            pricePerUnit: '0.18 ₽ / шт',
            isPopular: true,
          },
          {
            id: 'tg-sub-2',
            title: 'Премиум подписчики (TG Premium)',
            badge: 'Дают бусты',
            speed: 'Плавный старт (10-30 мин)',
            guarantee: 'Гарантия: 90 дней',
            minMax: 'Лимиты: 10 — 10 000 шт',
            pricePerUnit: '0.85 ₽ / шт',
          },
          {
            id: 'tg-sub-3',
            title: 'Подписчики (Мир)',
            speed: 'Высокая скорость: до 50k / день',
            guarantee: 'Авто-рефилл 365 дней',
            minMax: 'Лимиты: 500 — 500 000 шт',
            pricePerUnit: '0.09 ₽ / шт',
          },
        ],
      },
      {
        id: 'tg-views',
        title: 'Просмотры постов',
        services: [
          {
            id: 'tg-v-1',
            title: 'Быстрые просмотры на 1 пост',
            speed: 'Старт 30 секунд',
            guarantee: '100% охват',
            minMax: 'Лимиты: 100 — 1 000 000 шт',
            pricePerUnit: '0.002 ₽ / шт',
            isPopular: true,
          },
          {
            id: 'tg-v-2',
            title: 'Авто-просмотры на будущие посты',
            speed: 'Моментально при публикации',
            guarantee: 'Подписка на 30 дней',
            minMax: 'Лимиты: от 10 постов',
            pricePerUnit: '0.003 ₽ / шт',
          },
        ],
      },
      {
        id: 'tg-stars',
        title: 'Telegram Stars (Звёзды)',
        services: [
          {
            id: 'tg-star-1',
            title: 'Официальные звёзды Stars для ботов и каналов',
            badge: 'Official API',
            speed: 'Мгновенная доставка',
            guarantee: '100% защита от бана',
            minMax: 'Лимиты: 50 — 50 000 Stars',
            pricePerUnit: '1.45 ₽ / шт',
            isPopular: true,
          },
        ],
      },
      {
        id: 'tg-reactions',
        title: 'Реакции (эмодзи)',
        services: [
          {
            id: 'tg-react-1',
            title: 'Позитивные реакции (Огонь, Сердечки, Палец вверх)',
            speed: 'Старт 1-2 мин',
            guarantee: 'Без списаний',
            minMax: 'Лимиты: 50 — 50 000 шт',
            pricePerUnit: '0.02 ₽ / шт',
          },
        ],
      },
      {
        id: 'tg-boosts',
        title: 'Бусты для историй',
        services: [
          {
            id: 'tg-boost-1',
            title: 'Бусты от реальных Level-аккаунтов',
            badge: 'Уровень 1-10',
            speed: 'Плавный старт',
            guarantee: 'Удержание до 30 дней',
            minMax: 'Лимиты: 1 — 100 бустов',
            pricePerUnit: '12.50 ₽ / шт',
          },
        ],
      },
    ],
  },
  {
    id: 'vk',
    name: 'ВКонтакте',
    icon: Share2,
    color: 'from-blue-600 to-indigo-700',
    categories: [
      {
        id: 'vk-followers',
        title: 'Подписчики в группу',
        services: [
          {
            id: 'vk-f-1',
            title: 'Живые участники с аватарками и постами',
            badge: 'Рекомендуем',
            speed: 'Старт 5-15 мин',
            guarantee: 'Гарантия 30 дней',
            minMax: 'Лимиты: 50 — 50 000 шт',
            pricePerUnit: '0.22 ₽ / шт',
            isPopular: true,
          },
        ],
      },
      {
        id: 'vk-likes',
        title: 'Лайки на посты',
        services: [
          {
            id: 'vk-l-1',
            title: 'Быстрые лайки от пользователей РФ',
            speed: 'Мгновенный старт',
            guarantee: 'Без собачек',
            minMax: 'Лимиты: 20 — 20 000 шт',
            pricePerUnit: '0.06 ₽ / шт',
          },
        ],
      },
    ],
  },
  {
    id: 'instagram',
    name: 'Instagram*',
    icon: Camera,
    color: 'from-pink-500 via-purple-500 to-amber-500',
    categories: [
      {
        id: 'inst-followers',
        title: 'Подписчики профиля',
        services: [
          {
            id: 'inst-f-1',
            title: 'HQ Подписчики с заполненными профилями',
            badge: 'High Quality',
            speed: 'Старт 5 мин',
            guarantee: 'Гарантия 60 дней',
            minMax: 'Лимиты: 50 — 50 000 шт',
            pricePerUnit: '0.29 ₽ / шт',
            isPopular: true,
          },
        ],
      },
      {
        id: 'inst-reels',
        title: 'Просмотры Reels',
        services: [
          {
            id: 'inst-r-1',
            title: 'Виральные просмотры для попадания в рекомендации',
            speed: 'Скорость до 100k/сутки',
            guarantee: 'Высокое удержание',
            minMax: 'Лимиты: 500 — 1 000 000 шт',
            pricePerUnit: '0.005 ₽ / шт',
          },
        ],
      },
    ],
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: PlaySquare,
    color: 'from-red-600 to-rose-700',
    categories: [
      {
        id: 'yt-subs',
        title: 'Подписчики канала',
        services: [
          {
            id: 'yt-s-1',
            title: 'Реальные подписчики с гарантией от списаний',
            badge: 'Безопасно',
            speed: 'Плавный старт (1-6 часов)',
            guarantee: 'Гарантия 90 дней',
            minMax: 'Лимиты: 50 — 20 000 шт',
            pricePerUnit: '0.95 ₽ / шт',
            isPopular: true,
          },
        ],
      },
    ],
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: Video,
    color: 'from-teal-400 to-pink-500',
    categories: [
      {
        id: 'tt-views',
        title: 'Просмотры клипов',
        services: [
          {
            id: 'tt-v-1',
            title: 'Мгновенные просмотры для алгоритмов Рекомендаций',
            badge: 'Топ трендов',
            speed: 'Старт 1 мин',
            guarantee: '100% доставка',
            minMax: 'Лимиты: 1 000 — 5 000 000 шт',
            pricePerUnit: '0.003 ₽ / шт',
            isPopular: true,
          },
        ],
      },
    ],
  },
  {
    id: 'twitch',
    name: 'Twitch',
    icon: Radio,
    color: 'from-purple-600 to-indigo-600',
    categories: [
      {
        id: 'twitch-viewers',
        title: 'Зрители на стрим',
        services: [
          {
            id: 'tw-1',
            title: 'Зрители онлайн с удержанием до 3 часов',
            speed: 'Вход за 5-10 минут',
            guarantee: 'Плавный график онлайна',
            minMax: 'Лимиты: 10 — 1 000 зрителей',
            pricePerUnit: '2.50 ₽ / час',
          },
        ],
      },
    ],
  },
];

export function FullscreenMasterCatalog({
  onSelectService,
}: {
  onSelectService?: (service: CatalogServiceItem, platformName: string, categoryName: string) => void;
}) {
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>('telegram');
  const [isExpanded, setIsExpanded] = useState(false);

  const activePlatform = ALL_PLATFORMS.find((p) => p.id === selectedPlatformId) || ALL_PLATFORMS[0];
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    activePlatform.categories[0]?.id || ''
  );

  const activeCategory =
    activePlatform.categories.find((c) => c.id === selectedCategoryId) ||
    activePlatform.categories[0];

  const visiblePlatforms = isExpanded ? ALL_PLATFORMS : ALL_PLATFORMS.slice(0, 5);

  const handlePlatformChange = (pId: string) => {
    setSelectedPlatformId(pId);
    const targetPlatform = ALL_PLATFORMS.find((p) => p.id === pId);
    if (targetPlatform && targetPlatform.categories.length > 0) {
      setSelectedCategoryId(targetPlatform.categories[0].id);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* ── 1. Top Platform Ribbon ── */}
      <div className="p-4 sm:p-5 rounded-3xl bg-card border border-border/80 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Выберите социальную сеть:
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline focus-visible:outline-none min-h-[44px] px-2"
          >
            <span>{isExpanded ? 'Свернуть' : 'Ещё 15+ соцсетей'}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
          {visiblePlatforms.map((platform) => {
            const isSelected = platform.id === selectedPlatformId;
            const Icon = platform.icon;

            return (
              <button
                key={platform.id}
                type="button"
                onClick={() => handlePlatformChange(platform.id)}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 min-h-[44px] rounded-2xl font-bold text-xs sm:text-sm transition-all duration-200 border text-left ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20 scale-[1.02]'
                    : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground hover:bg-muted active:scale-98'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center bg-gradient-to-tr ${platform.color} text-white shrink-0`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="truncate min-w-0">{platform.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 2. Category Selector Ribbon ── */}
      {activePlatform.categories.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {activePlatform.categories.map((cat) => {
            const isCatActive = cat.id === selectedCategoryId;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`px-4 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-200 border ${
                  isCatActive
                    ? 'bg-foreground text-background border-foreground shadow-sm'
                    : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted'
                }`}
              >
                {cat.title}
              </button>
            );
          })}
        </div>
      )}

      {/* ── 3. Full-Width Services Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {activeCategory?.services.map((srv) => (
          <div
            key={srv.id}
            className={`flex flex-col justify-between p-6 rounded-3xl bg-card border transition-all duration-200 relative group hover:shadow-lg ${
              srv.isPopular ? 'border-primary/60 shadow-md shadow-primary/5' : 'border-border hover:border-primary/40'
            }`}
          >
            {srv.badge && (
              <div className="absolute -top-3 right-6 px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1">
                <Flame className="w-3 h-3 shrink-0" />
                {srv.badge}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <h3 className="text-base sm:text-lg font-black text-foreground group-hover:text-primary transition-colors">
                  {srv.title}
                </h3>
              </div>

              {/* Characteristics Matrix */}
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>{srv.speed}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{srv.guarantee}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <span>{srv.minMax}</span>
                </div>
              </div>
            </div>

            {/* Bottom Pricing & Action */}
            <div className="pt-5 mt-5 border-t border-border/80 flex items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Розничная цена
                </span>
                <span className="text-base sm:text-lg font-mono font-black text-foreground tabular-nums">
                  {srv.pricePerUnit}
                </span>
              </div>

              <button
                type="button"
                onClick={() => onSelectService?.(srv, activePlatform.name, activeCategory.title)}
                className="px-5 py-2.5 min-h-[44px] text-xs sm:text-sm font-bold bg-primary text-primary-foreground rounded-xl shadow-sm shadow-primary/20 hover:opacity-95 active:scale-98 transition-all flex items-center gap-2"
              >
                <span>Оформить</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
