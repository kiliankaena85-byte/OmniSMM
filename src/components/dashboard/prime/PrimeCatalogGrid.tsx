'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Send,
  Share2,
  Camera,
  Video,
  PlaySquare,
  Radio,
  Sparkles,
  Flame,
  Star,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

export interface SocialPlatform {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  badge?: string;
  categories: Array<{
    id: string;
    title: string;
    description: string;
    minPrice: string;
    isHot?: boolean;
  }>;
}

export const PRIME_PLATFORMS: SocialPlatform[] = [
  {
    id: 'telegram',
    name: 'Telegram',
    icon: Send,
    color: 'from-sky-500 to-blue-600',
    badge: 'Топ 1',
    categories: [
      { id: 'tg-stars', title: 'Telegram Stars (Звёзды)', description: 'Официальные звёзды для ботов и каналов', minPrice: '1.45 ₽/шт', isHot: true },
      { id: 'tg-subscribers', title: 'Подписчики на канал', description: 'Живые пользователи, РФ, СНГ и мир', minPrice: '0.18 ₽/шт', isHot: true },
      { id: 'tg-views', title: 'Просмотры постов', description: 'Мгновенный старт, автопросмотры', minPrice: '0.002 ₽/шт' },
      { id: 'tg-reactions', title: 'Реакции (эмодзи)', description: 'Позитивные, огонь, сердечки, кастомные', minPrice: '0.02 ₽/шт' },
      { id: 'tg-boosts', title: 'Бусты (Boosts)', description: 'Для публикации историй каналами', minPrice: '12.50 ₽/шт' },
      { id: 'tg-premium', title: 'Премиум подписчики', description: 'Аккаунты с Telegram Premium подпиской', minPrice: '0.85 ₽/шт' },
    ],
  },
  {
    id: 'vk',
    name: 'ВКонтакте',
    icon: Share2,
    color: 'from-blue-600 to-indigo-700',
    categories: [
      { id: 'vk-followers', title: 'Подписчики в группу/паблик', description: 'С аватарками и постами, гарантия', minPrice: '0.22 ₽/шт', isHot: true },
      { id: 'vk-likes', title: 'Лайки на посты/фото', description: 'Высокая скорость, естественный прирост', minPrice: '0.06 ₽/шт' },
      { id: 'vk-views', title: 'Просмотры постов и видео', description: 'Увеличение охвата и виральности', minPrice: '0.004 ₽/шт' },
      { id: 'vk-music', title: 'Прослушивания плейлистов', description: 'Для музыкантов и треков', minPrice: '0.08 ₽/шт' },
      { id: 'vk-reposts', title: 'Репосты записей', description: 'Распространение контента по стенам', minPrice: '0.25 ₽/шт' },
    ],
  },
  {
    id: 'instagram',
    name: 'Instagram*',
    icon: Camera,
    color: 'from-pink-500 via-purple-500 to-amber-500',
    badge: 'Популярно',
    categories: [
      { id: 'inst-followers', title: 'Подписчики', description: 'Высокое качество, с аватарками и сторис', minPrice: '0.29 ₽/шт', isHot: true },
      { id: 'inst-likes', title: 'Лайки на фото и Reels', description: 'Быстрый выход в рекомендации', minPrice: '0.08 ₽/шт' },
      { id: 'inst-reels', title: 'Просмотры Reels / Stories', description: 'Алгоритмический буст охватов', minPrice: '0.005 ₽/шт' },
      { id: 'inst-threads', title: 'Threads Подписчики и лайки', description: 'Комплексное продвижение профилей Threads', minPrice: '0.35 ₽/шт' },
    ],
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: Video,
    color: 'from-teal-400 to-pink-500',
    categories: [
      { id: 'tt-views', title: 'Просмотры клипов', description: 'Для попадания в рекомендации "Для вас"', minPrice: '0.003 ₽/шт', isHot: true },
      { id: 'tt-followers', title: 'Подписчики профиля', description: 'Реальные профили, плавный рост', minPrice: '0.38 ₽/шт' },
      { id: 'tt-likes', title: 'Лайки на видео', description: 'Повышение удержания и активности', minPrice: '0.12 ₽/шт' },
      { id: 'tt-comments', title: 'Комментарии', description: 'Позитивные и тематические ветки', minPrice: '0.60 ₽/шт' },
    ],
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: PlaySquare,
    color: 'from-red-600 to-rose-700',
    categories: [
      { id: 'yt-subscribers', title: 'Подписчики на канал', description: 'С гарантией от списаний', minPrice: '0.95 ₽/шт', isHot: true },
      { id: 'yt-views', title: 'Просмотры видео и Shorts', description: 'С удержанием от 60 секунд', minPrice: '0.14 ₽/шт' },
      { id: 'yt-likes', title: 'Лайки на видео', description: 'Для продвижения в поисковой выдаче', minPrice: '0.15 ₽/шт' },
    ],
  },
  {
    id: 'twitch',
    name: 'Twitch',
    icon: Radio,
    color: 'from-purple-600 to-indigo-600',
    categories: [
      { id: 'twitch-viewers', title: 'Зрители на прямой эфир', description: 'Удержание до 3 часов, плавный вход', minPrice: '2.50 ₽/час' },
      { id: 'twitch-followers', title: 'Фолловеры канала', description: 'Быстрое достижение статуса компаньона', minPrice: '0.40 ₽/шт' },
    ],
  },
];

export function PrimeCatalogGrid() {
  const [selectedPlatform, setSelectedPlatform] = useState<string>('telegram');

  const activePlatformData = PRIME_PLATFORMS.find((p) => p.id === selectedPlatform) || PRIME_PLATFORMS[0];
  const Icon = activePlatformData.icon;

  return (
    <div className="space-y-6 w-full">
      {/* ── Platform Tabs ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {PRIME_PLATFORMS.map((platform) => {
          const isSelected = platform.id === selectedPlatform;
          const PlatformIcon = platform.icon;

          return (
            <button
              key={platform.id}
              type="button"
              onClick={() => setSelectedPlatform(platform.id)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all duration-200 border ${
                isSelected
                  ? 'bg-card text-foreground border-primary shadow-md shadow-primary/10 ring-2 ring-primary/30'
                  : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground hover:bg-muted'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center bg-gradient-to-tr ${platform.color} text-white text-xs`}
              >
                <PlatformIcon className="w-3.5 h-3.5" />
              </div>
              <span>{platform.name}</span>
              {platform.badge && (
                <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded-md bg-primary/15 text-primary">
                  {platform.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Active Platform Header ── */}
      <div className="flex items-center justify-between p-4 sm:p-6 rounded-3xl bg-card border border-border/80 shadow-sm relative overflow-hidden">
        <div className="flex items-center gap-4 relative z-10">
          <div
            className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${activePlatformData.color} text-white flex items-center justify-center shadow-lg shadow-primary/20 shrink-0`}
          >
            <Icon className="w-6 h-6 shrink-0" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight">
              Услуги продвижения {activePlatformData.name}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Доступно {activePlatformData.categories.length} категорий с гарантией качества
            </p>
          </div>
        </div>

        <Link
          href={`/dashboard/order?platform=${activePlatformData.id}`}
          className="hidden sm:flex items-center gap-2 px-4 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-xl shadow-sm shadow-primary/20 hover:opacity-95 transition-all"
        >
          <span>Заказать сразу</span>
          <ArrowRight className="w-4 h-4 shrink-0" />
        </Link>
      </div>

      {/* ── Categories Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activePlatformData.categories.map((cat) => (
          <div
            key={cat.id}
            className="flex flex-col justify-between p-5 rounded-3xl bg-card border border-border hover:border-primary/50 transition-all duration-200 group hover:shadow-md"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-extrabold text-foreground text-base group-hover:text-primary transition-colors">
                  {cat.title}
                </h3>
                {cat.isHot && (
                  <span className="flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 shrink-0">
                    <Flame className="w-3 h-3 shrink-0" />
                    Хит
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {cat.description}
              </p>
            </div>

            <div className="pt-4 mt-4 border-t border-border/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Стоимость
                </span>
                <span className="text-sm font-black text-foreground">
                  от {cat.minPrice}
                </span>
              </div>

              <Link
                href={`/dashboard/order?platform=${activePlatformData.id}&cat=${cat.id}`}
                className="px-3 py-1.5 text-xs font-bold bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground rounded-xl transition-all duration-200 flex items-center gap-1.5"
              >
                <span>Выбрать</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
