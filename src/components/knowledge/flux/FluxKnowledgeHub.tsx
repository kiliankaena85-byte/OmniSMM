'use client';

import React from "react";
import Link from "next/link";
import { Search, Sparkles, BookOpen, Eye, Calendar, ArrowRight, Zap, Layers } from "lucide-react";
import { SearchAutocomplete } from "@/app/knowledge/components/SearchAutocomplete";

interface ArticleItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  viewCount: number;
  createdAt: Date | string;
}

interface FluxKnowledgeHubProps {
  articles: ArticleItem[];
  activeCategory: string;
  searchQuery: string;
  groupedArticles: Record<string, { id: string; slug: string; title: string; category: string }[]>;
}

export function FluxKnowledgeHub({
  articles,
  activeCategory,
  searchQuery,
  groupedArticles,
}: FluxKnowledgeHubProps) {
  const categories = ["Все", ...Object.keys(groupedArticles)];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      
      {/* ── Radiant Light Glass Hero Section ── */}
      <section className="relative w-full rounded-[2.5rem] bg-card/85 backdrop-blur-2xl border border-border/80 p-8 sm:p-12 md:p-16 mb-12 shadow-[0_20px_60px_rgba(0,0,0,0.05)] overflow-hidden">
        {/* Subtle glowing color accents inside card */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-pink-500/15 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-600/15 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/25 text-purple-700 dark:text-purple-300 text-xs font-black uppercase tracking-widest shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-pink-500 animate-spin-slow" />
            <span>FLUX Knowledge Engine & Media Lab</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-foreground leading-tight">
            База знаний <span className="bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent">&</span> Гайды
          </h1>

          <p className="text-sm sm:text-base md:text-lg text-muted-foreground font-medium leading-relaxed max-w-2xl mx-auto">
            Эксклюзивные алгоритмы, гайды по органическому росту каналов и инсайты продвижения в Telegram, YouTube и соцсетях.
          </p>

          {/* Search Bar Container */}
          <div className="pt-2 max-w-xl mx-auto">
            <SearchAutocomplete initialSearch={searchQuery} activeCategory={activeCategory} isFlux={true} />
          </div>
        </div>
      </section>

      {/* ── Category Pill Filter ── */}
      <section className="mb-10 w-full overflow-x-auto pb-4 hide-scrollbar">
        <nav className="flex items-center justify-start sm:justify-center gap-3 w-max mx-auto px-2" aria-label="Категории статей SMMflux">
          {categories.map((cat) => {
            const isSelected = activeCategory === cat;
            const url = cat === "Все" 
              ? "/knowledge" 
              : `/knowledge?category=${encodeURIComponent(cat)}`;

            return (
              <Link
                key={cat}
                href={url}
                className={`min-h-[44px] px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold flex items-center gap-2 transition-all duration-300 border cursor-pointer ${
                  isSelected
                    ? "bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 text-white border-transparent shadow-[0_4px_20px_rgba(168,85,247,0.35)] scale-105"
                    : "bg-card/85 text-foreground border-border/80 hover:border-purple-400 hover:text-purple-600 shadow-sm"
                }`}
              >
                {cat === "Все" ? <Layers className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
                <span>{cat}</span>
              </Link>
            );
          })}
        </nav>
      </section>

      {/* ── Stats & Status Bar ── */}
      <div className="flex items-center justify-between px-6 py-3.5 rounded-2xl bg-card/80 backdrop-blur-xl border border-border/80 mb-8 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-muted-foreground font-semibold">Раздел:</span>
          <span className="text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
            {activeCategory}
          </span>
        </div>
        <div className="text-xs font-semibold text-muted-foreground">
          Материалов: <span className="text-foreground font-bold">{articles.length}</span>
        </div>
      </div>

      {/* ── Articles Grid: SMMflux Radiant Light Bento ── */}
      {articles.length === 0 ? (
        <div className="w-full rounded-[2.5rem] bg-card/85 backdrop-blur-xl border border-border/80 p-12 sm:p-16 text-center shadow-md">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center mx-auto mb-4 text-2xl">
            <Search className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Статьи не найдены</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed mb-6">
            {searchQuery
              ? `По запросу «${searchQuery}» ничего не найдено в категории «${activeCategory}».`
              : "В данном разделе пока нет опубликованных материалов. Мы уже готовим новые кейсы!"}
          </p>
          {(searchQuery || activeCategory !== "Все") && (
            <Link
              href="/knowledge"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold shadow-[0_4px_20px_rgba(168,85,247,0.3)] hover:opacity-95 transition-opacity"
            >
              Сбросить фильтры
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {articles.map((article) => {
            const dateStr = new Date(article.createdAt).toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });

            return (
              <article
                key={article.id}
                className="group relative rounded-[2rem] bg-card/90 backdrop-blur-xl border border-border/80 hover:border-purple-400/60 p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 hover:shadow-[0_16px_40px_rgba(168,85,247,0.12)] hover:-translate-y-1 overflow-hidden"
              >
                <div className="space-y-4">
                  {/* Category Tag & Reading Meta */}
                  <div className="flex items-center justify-between">
                    <span className="px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                      {article.category}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                      <Eye className="w-3.5 h-3.5" />
                      <span>{article.viewCount}</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h2 className="text-lg sm:text-xl font-black text-foreground group-hover:text-purple-600 transition-colors line-clamp-2 leading-snug">
                    {article.title}
                  </h2>

                  {/* Description */}
                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-3 leading-relaxed font-normal">
                    {article.description}
                  </p>
                </div>

                {/* Footer Read Action */}
                <div className="pt-6 mt-6 border-t border-border/60 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                    <Calendar className="w-3 h-3 text-purple-500" />
                    <time dateTime={article.createdAt.toString()}>{dateStr}</time>
                  </div>

                  <Link
                    href={`/knowledge/${article.slug}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 hover:text-pink-600 transition-colors"
                  >
                    <span>Читать гайд</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ── Bottom Callout ── */}
      <section className="mt-16 p-8 sm:p-10 rounded-[2.5rem] bg-gradient-to-r from-purple-600/10 via-fuchsia-500/10 to-pink-600/10 border border-purple-500/25 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
        <div className="space-y-2 text-center md:text-left">
          <h3 className="text-xl font-black text-foreground flex items-center justify-center md:justify-start gap-2">
            <Zap className="w-5 h-5 text-purple-600 fill-current" />
            Нужна индивидуальная стратегия продвижения?
          </h3>
          <p className="text-sm text-muted-foreground font-medium">
            Наша команда экспертов поможет составить персональный медиа-план и запустить продвижение за считанные минуты.
          </p>
        </div>
        <a
          href="/api/support/telegram"
          target="_blank"
          rel="noopener noreferrer"
          className="px-7 py-3.5 rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 text-white font-bold text-sm shadow-[0_4px_20px_rgba(168,85,247,0.35)] hover:shadow-[0_6px_25px_rgba(236,72,153,0.45)] hover:-translate-y-0.5 transition-all shrink-0 active:scale-95"
        >
          Написать в Telegram
        </a>
      </section>

    </div>
  );
}
