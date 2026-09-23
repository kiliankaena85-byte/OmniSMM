'use client';

import React from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, BookOpen, Zap, Layers, ChevronRight } from "lucide-react";

interface NetworkItem {
  id: string;
  name: string;
  slug: string;
  categories?: { id: string; name: string }[];
}

interface FeaturedArticle {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  authorName: string;
  authorRole: string;
}

interface FluxServicesCatalogProps {
  networks: NetworkItem[];
  featuredArticles: FeaturedArticle[];
}

export function FluxServicesCatalog({ networks, featuredArticles }: FluxServicesCatalogProps) {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      
      {/* ── Radiant Light Glass Hero Section ── */}
      <section className="relative w-full rounded-[2.5rem] bg-card/85 backdrop-blur-2xl border border-border/80 p-8 sm:p-12 md:p-16 mb-12 shadow-[0_20px_60px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-pink-500/15 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-600/15 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/25 text-purple-700 dark:text-purple-300 text-xs font-black uppercase tracking-widest shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-pink-500 animate-spin-slow" />
            <span>FLUX Matrix & Social Ecosystem</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-foreground leading-tight">
            Каталог сервисов <span className="bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent">&</span> Сетей
          </h1>

          <p className="text-sm sm:text-base md:text-lg text-muted-foreground font-medium leading-relaxed max-w-2xl mx-auto">
            Мгновенный старт, алгоритмическая безопасность и розничные цены за 1 единицу без переплат.
          </p>
        </div>
      </section>

      {/* ── Main Bento Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Platform Selector Cards (Bento 7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-600" />
              <span>Доступные платформы</span>
            </h2>
            <span className="text-xs text-purple-700 dark:text-purple-300 font-bold uppercase tracking-wider bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
              {networks.length} Сетей online
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {networks.map((net) => {
              const slug = net.slug.toLowerCase();
              return (
                <Link
                  key={net.id}
                  href={`/services/${net.slug}`}
                  className="group relative rounded-[2rem] bg-card/90 backdrop-blur-xl border border-border/80 hover:border-purple-400 p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-[0_16px_40px_rgba(168,85,247,0.12)] hover:-translate-y-1 overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-muted/60 border border-border flex items-center justify-center p-2.5 shadow-sm group-hover:scale-110 transition-transform">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/brands/${slug}.svg`}
                        alt={net.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                  </div>

                  <div>
                    <h3 className="text-lg font-black text-foreground group-hover:text-purple-600 transition-colors">
                      {net.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 font-medium">
                      Подписчики, реакции, просмотры и активность
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-purple-600 font-bold">
                    <span>Открыть тарифы</span>
                    <span>&rarr;</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right: Media Lab & Guides (Bento 5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-pink-500" />
              <span>FLUX Академия</span>
            </h2>
            <Link
              href="/knowledge"
              className="text-xs text-purple-600 hover:text-pink-600 font-bold transition-colors"
            >
              Все гайды &rarr;
            </Link>
          </div>

          <div className="rounded-[2.5rem] bg-card/85 backdrop-blur-xl border border-border/80 p-6 sm:p-7 space-y-4 shadow-sm">
            {featuredArticles.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Новые материалы скоро появятся.
              </div>
            ) : (
              featuredArticles.map((art) => (
                <Link
                  key={art.id}
                  href={`/knowledge/${art.slug}`}
                  className="block p-4 rounded-2xl bg-muted/40 border border-transparent hover:border-purple-400/40 hover:bg-purple-500/5 transition-all duration-200 group/art"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-500/10 px-2.5 py-0.5 rounded-full">
                      {art.category}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      {art.authorName}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-foreground group-hover/art:text-purple-600 transition-colors leading-snug">
                    {art.title}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                    {art.description}
                  </p>
                </Link>
              ))
            )}

            <div className="pt-4 border-t border-border/60">
              <Link
                href="/knowledge"
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-[0_4px_16px_rgba(168,85,247,0.3)] hover:opacity-95 transition-opacity"
              >
                <span>Перейти в базу знаний</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

      </div>

      {/* ── Smart Link Analyzer CTA Banner ── */}
      <section className="mt-14 p-8 sm:p-12 rounded-[2.5rem] bg-gradient-to-r from-purple-600/10 via-fuchsia-500/10 to-pink-600/10 border border-purple-500/25 flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm relative overflow-hidden">
        <div className="space-y-3 text-center md:text-left max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-[11px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300">
            <Zap className="w-3.5 h-3.5 text-purple-600" />
            <span>Интеллектуальный помощник</span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            Не знаете, какой тариф выбрать?
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed font-normal">
            Просто вставьте ссылку на ваш профиль или публикацию в умную форму заказа. Система автоматически определит тип ссылки и предложит подходящие услуги.
          </p>
        </div>

        <Link
          href="/"
          className="px-8 py-4 rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 text-white font-bold text-sm shadow-[0_4px_25px_rgba(168,85,247,0.35)] hover:shadow-[0_6px_30px_rgba(236,72,153,0.45)] hover:-translate-y-0.5 transition-all shrink-0 active:scale-95 whitespace-nowrap"
        >
          Оформить быстрый заказ
        </Link>
      </section>

    </div>
  );
}
