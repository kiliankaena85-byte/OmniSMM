'use client';

import { motion } from "framer-motion";
import Link from "next/link";
import { 
  Sparkles, 
  ShieldCheck, 
  Diamond, 
  Terminal, 
  FileSpreadsheet, 
  ArrowUpRight 
} from "lucide-react";

export function WhyUs({ companyName = "SMMplan" }: { companyName?: string }) {
  return (
    <section aria-labelledby="why-us-heading" className="mx-auto max-w-6xl px-4 py-12 md:py-24">
      <div className="text-center mb-16">
        <h2 id="why-us-heading" className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-foreground mb-4 text-balance">
          Автоматизированное продвижение
        </h2>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto font-medium text-pretty">
          Надежная автоматизация для блогеров, агентств и брендов. Быстрый запуск и высокое качество услуг для стабильного роста аудитории.
        </p>
      </div>

      {/* BENTO GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Large Span AI Selection */}
        <div className="md:col-span-2 bg-content1 rounded-[2rem] p-5 md:p-8 relative overflow-hidden group border border-border/50 ring-1 ring-black/5 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 min-h-[280px]">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/15 rounded-full blur-3xl opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500 -translate-y-1/2 translate-x-1/2 dark:bg-primary/10 pointer-events-none" />
          <div className="relative z-10 flex flex-col justify-between md:h-full">
            <div>
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 text-primary group-hover:scale-110 transition-transform dark:bg-primary/10">
                <Sparkles className="w-6 h-6 shrink-0" strokeWidth={1.5} />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-3 tracking-tight">AI-подбор услуг</h3>
              <p className="text-muted-foreground font-medium leading-relaxed max-w-md">
                Вам больше не нужно разбираться в десятках категорий. Просто вставьте ссылку — наша система 
                автоматически определит платформу (Telegram, VK, YT) и сама подберёт оптимальный пакет продвижения.
              </p>
            </div>
          </div>
        </div>

        {/* Card 2: Small Span Transparent Conditions */}
        <div className="md:col-span-1 bg-content1 rounded-[2rem] p-5 md:p-8 relative overflow-hidden group border border-border/50 dark:border-border/40 ring-1 ring-black/5 hover:shadow-2xl hover:shadow-success/10 transition-all duration-300 min-h-[240px]">
          <div className="relative z-10 flex flex-col md:h-full">
            <div className="w-12 h-12 bg-success/10 rounded-2xl flex items-center justify-center mb-6 text-success group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-6 h-6 shrink-0" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-3">Прозрачные условия</h3>
            <p className="text-muted-foreground font-medium leading-relaxed text-sm">
              Никаких скрытых условий. Вы получаете ровно то качество и ту скорость, которые указаны в описании услуги.
            </p>
          </div>
        </div>

        {/* Card 3: Small Span Loyalty */}
        <div className="md:col-span-1 bg-content1 rounded-[2rem] p-5 md:p-8 relative overflow-hidden group border border-border/50 dark:border-border/40 ring-1 ring-black/5 hover:shadow-2xl hover:shadow-danger/10 transition-all duration-300 min-h-[240px]">
          <div className="relative z-10 flex flex-col md:h-full justify-between">
            <div>
              <div className="w-12 h-12 bg-danger/10 rounded-2xl flex items-center justify-center mb-6 text-danger group-hover:scale-110 transition-transform">
                <Diamond className="w-6 h-6 shrink-0" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Персональные скидки</h3>
              <p className="text-muted-foreground font-medium leading-relaxed text-sm">
                Получайте накопительные скидки в зависимости от вашего объема заказов. Автоматический расчет скидки в корзине.
              </p>
            </div>
          </div>
        </div>

        {/* Card 4: Platform Advantages & Intelligent Delivery Card */}
        <div className="md:col-span-2 bg-primary text-primary-foreground dark:bg-content1 dark:text-foreground border border-primary/20 dark:border-border/60 rounded-[2rem] p-5 pb-8 md:p-8 md:pb-10 relative overflow-hidden group shadow-2xl ring-1 ring-black/5 transition-all duration-300 hover:shadow-primary/10 min-h-[380px]">
          {/* Background Ambient Glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-secondary/20 to-primary/20 dark:from-primary/10 dark:to-transparent rounded-full blur-3xl opacity-60 group-hover:opacity-90 group-hover:scale-110 transition-all duration-500 -translate-y-1/3 translate-x-1/3 pointer-events-none" />
          
          {/* Grid Mesh Overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:16px_16px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

          <div className="relative z-10 flex flex-col justify-between md:h-full">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary-foreground/15 dark:bg-primary/15 rounded-xl flex items-center justify-center text-primary-foreground dark:text-primary group-hover:scale-110 transition-transform">
                  <Sparkles className="w-5 h-5 shrink-0" strokeWidth={1.5} />
                </div>
                <span className="text-xs font-bold text-primary-foreground dark:text-primary uppercase tracking-widest">Технологии & Надежность</span>
              </div>
              <h3 className="text-2xl font-bold text-primary-foreground dark:text-foreground mb-4 tracking-tight">Преимущества платформы {companyName}</h3>
              
              {/* Triple-Hook Feature List */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                <div className="flex items-start gap-2.5 bg-primary-foreground/10 dark:bg-content2/80 p-3.5 rounded-xl border border-primary-foreground/10 dark:border-border/50">
                  <Sparkles className="w-5 h-5 text-primary-foreground dark:text-primary shrink-0 mt-0.5" strokeWidth={1.5} />
                  <div>
                    <h4 className="text-sm font-semibold text-primary-foreground dark:text-foreground">Мгновенный старт</h4>
                    <p className="text-[11px] text-primary-foreground/80 dark:text-muted-foreground mt-0.5 leading-snug">Автоматический запуск заказов от 30 секунд в режиме 24/7</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2.5 bg-primary-foreground/10 dark:bg-content2/80 p-3.5 rounded-xl border border-primary-foreground/10 dark:border-border/50">
                  <ShieldCheck className="w-5 h-5 text-primary-foreground dark:text-primary shrink-0 mt-0.5" strokeWidth={1.5} />
                  <div>
                    <h4 className="text-sm font-semibold text-primary-foreground dark:text-foreground">Защита от списаний</h4>
                    <p className="text-[11px] text-primary-foreground/80 dark:text-muted-foreground mt-0.5 leading-snug">Плавный Drip-Feed и авто-докрутка (Refill) по гарантии</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 bg-primary-foreground/10 dark:bg-content2/80 p-3.5 rounded-xl border border-primary-foreground/10 dark:border-border/50">
                  <Diamond className="w-5 h-5 text-primary-foreground dark:text-primary shrink-0 mt-0.5" strokeWidth={1.5} />
                  <div>
                    <h4 className="text-sm font-semibold text-primary-foreground dark:text-foreground">Честные тарифы</h4>
                    <p className="text-[11px] text-primary-foreground/80 dark:text-muted-foreground mt-0.5 leading-snug">Прямые цены без посредников и без скрытых комиссий</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom CTA bar */}
            <div className="mt-6 sm:mt-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-primary-foreground/10 dark:border-border/50">
              <p className="text-xs text-primary-foreground/90 dark:text-muted-foreground">
                Запустите продвижение за 1 минуту без обязательств и скрытых условий.
              </p>
              <Link 
                href="#catalog"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-card hover:bg-muted text-foreground dark:bg-primary dark:hover:bg-primary/90 dark:text-primary-foreground text-xs font-extrabold shadow-lg shadow-background/10 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shrink-0 border border-border"
              >
                <span>Выбрать услугу</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
