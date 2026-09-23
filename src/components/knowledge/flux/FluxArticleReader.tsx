'use client';

import React from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, Eye, Sparkles, MessageSquare, Zap, BookOpen, Layers, CheckCircle2, Share2, Copy } from "lucide-react";
import { toast } from "sonner";

interface ArticleItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  category: string;
  viewCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface RelatedArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
}

interface FluxArticleReaderProps {
  article: ArticleItem;
  renderedMarkdown: React.ReactNode;
  relatedArticles: RelatedArticle[];
  recommendedServices?: {
    id: string;
    name: string;
    categoryName: string;
    pricePerUnitRub: number;
  }[];
  allCategoryServices?: {
    id: string;
    name: string;
    targetType: string;
    pricePerUnitRub: number;
    categoryName: string;
  }[];
  siteName?: string;
}

export function FluxArticleReader({ article, renderedMarkdown, relatedArticles, recommendedServices = [] }: FluxArticleReaderProps) {
  const dateStr = new Date(article.createdAt).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      
      {/* ── Breadcrumbs & Back Navigation ── */}
      <div className="flex items-center justify-between mb-8">
        <Link
          href="/knowledge"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-card/85 backdrop-blur-xl border border-border/80 text-foreground hover:text-purple-600 hover:border-purple-400/60 text-xs sm:text-sm font-bold transition-all shadow-sm group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform text-purple-600" />
          <span>Все материалы базы знаний</span>
        </Link>

        <div className="hidden sm:inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/25 text-purple-700 dark:text-purple-300 text-xs font-black uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-pink-500" />
          <span>FLUX Media Lab</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* ── Main Article Reader Container (8 cols) ── */}
        <article className="lg:col-span-8 rounded-[2.5rem] bg-card/90 backdrop-blur-2xl border border-border/80 p-6 sm:p-10 md:p-12 shadow-[0_20px_60px_rgba(0,0,0,0.05)] space-y-8 overflow-hidden relative">
          {/* Internal gradient glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-pink-500/10 blur-[100px] rounded-full pointer-events-none" />

          {/* Header Metadata Chips */}
          <div className="flex flex-wrap items-center gap-3 relative z-10">
            <span className="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/25">
              {article.category}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <Calendar className="w-3.5 h-3.5 text-purple-500" />
              <time dateTime={article.createdAt.toString()}>{dateStr}</time>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <Eye className="w-3.5 h-3.5 text-purple-500" />
              <span>{article.viewCount} просмотров</span>
            </div>
          </div>

          {/* Article Title */}
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tight leading-tight relative z-10">
            {article.title}
          </h1>

          {/* Summary / Lead */}
          {article.description && (
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground font-medium leading-relaxed bg-muted/40 p-6 rounded-2xl border border-border/60 relative z-10">
              {article.description}
            </p>
          )}

          {/* Article Content / Markdown Body */}
          <div className="prose dark:prose-invert max-w-none prose-headings:font-black prose-headings:tracking-tight prose-a:text-purple-600 prose-img:rounded-3xl relative z-10 text-sm sm:text-base leading-relaxed">
            {renderedMarkdown}
          </div>

          {/* Social Share & Quality Assurance Guarantee */}
          <div className="pt-8 border-t border-border/80 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Проверено редакцией SMMflux</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    navigator.clipboard.writeText(window.location.href);
                    toast.success("Ссылка на статью скопирована!");
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-card border border-border/80 text-foreground hover:border-purple-400 hover:text-purple-600 text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Скопировать</span>
              </button>

              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}&text=${encodeURIComponent(article.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/25 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 text-xs font-bold transition-all cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Поделиться</span>
              </a>
            </div>
          </div>
        </article>

        {/* ── Sidebar (4 cols) ── */}
        <aside className="lg:col-span-4 space-y-6">
          
          {/* Quick Launch Card */}
          <div className="rounded-[2.5rem] bg-gradient-to-b from-card/95 to-muted/40 backdrop-blur-xl border border-border/80 p-6 sm:p-7 space-y-5 shadow-sm">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/25 text-[11px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300">
              <Zap className="w-3 h-3 text-purple-600" />
              <span>Мгновенный старт</span>
            </div>

            <h3 className="text-lg font-black text-foreground">
              Готовы протестировать продвижение?
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Запустите тестовый заказ от 1 штуки без регистрации и оцените качество алгоритмов SMMflux.
            </p>

            <Link
              href="/"
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(168,85,247,0.35)] hover:shadow-[0_6px_25px_rgba(236,72,153,0.45)] hover:-translate-y-0.5 transition-all"
            >
              <Layers className="w-4 h-4" />
              <span>Каталог услуг SMMflux</span>
            </Link>
          </div>

          {/* Related Articles */}
          {relatedArticles.length > 0 && (
            <div className="rounded-[2.5rem] bg-card/85 backdrop-blur-xl border border-border/80 p-6 sm:p-7 space-y-4 shadow-sm">
              <h3 className="text-base font-black text-foreground flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-pink-500" />
                <span>Материалы по теме</span>
              </h3>

              <div className="space-y-3">
                {relatedArticles.map((rel) => (
                  <Link
                    key={rel.id}
                    href={`/knowledge/${rel.slug}`}
                    className="block p-3.5 rounded-2xl bg-muted/40 border border-transparent hover:border-purple-400/40 hover:bg-purple-500/5 transition-all duration-200 group/rel"
                  >
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-full">
                      {rel.category}
                    </span>
                    <h4 className="text-xs font-bold text-foreground group-hover/rel:text-purple-600 transition-colors mt-1.5 leading-snug">
                      {rel.title}
                    </h4>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Telegram Support Launcher */}
          <div className="rounded-[2.5rem] bg-card/85 backdrop-blur-xl border border-border/80 p-6 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center mx-auto">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-foreground">Возник вопрос?</h4>
              <p className="text-xs text-muted-foreground">
                Техподдержка ответит в течение 1–2 минут в Telegram.
              </p>
            </div>
            <a
              href="/api/support/telegram"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 text-xs font-bold transition-all w-full"
            >
              Связаться с поддержкой
            </a>
          </div>

        </aside>

      </div>
    </div>
  );
}
