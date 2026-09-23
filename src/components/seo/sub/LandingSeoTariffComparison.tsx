import React from "react";
import { Award, CheckCircle2, ShieldCheck } from "lucide-react";

interface LandingSeoTariffComparisonProps {
  networkName: string;
  formattedMinPrice: string;
  minPrice: number;
}

export function LandingSeoTariffComparison({
  networkName,
  formattedMinPrice,
  minPrice,
}: LandingSeoTariffComparisonProps) {
  return (
    <section className="space-y-6">
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary">
          <Award className="w-3.5 h-3.5" />
          <span>Сравнение классов тарифов</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
          Какой тариф выбрать для {networkName}?
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Мы разделяем услуги по качеству аудитории, скорости и наличию гарантии
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Эконом */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Эконом / Базовый</span>
              <h3 className="text-xl font-black text-foreground">Быстрый старт</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Идеально для первичного визуального объема и создания массового эффекта популярности.
              </p>
            </div>

            <div className="space-y-2.5 pt-2 text-xs">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <span>Старт: 1–15 минут</span>
              </div>
              <div className="flex items-center gap-2 text-foreground font-medium">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <span>Скорость: до 20 000 / сут</span>
              </div>
              <div className="flex items-center gap-2 text-foreground font-medium">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <span>Аудитория: Смешанная (World/Bot)</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <ShieldCheck className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>Гарантия: Стандартная</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border/60 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-muted-foreground block font-bold uppercase">Цена от</span>
              <span className="text-lg font-black text-foreground font-mono">{formattedMinPrice} ₽</span>
              <span className="text-[10px] text-muted-foreground"> / шт</span>
            </div>
            <a href="#main-content" className="px-4 py-2 rounded-xl text-xs font-bold bg-secondary hover:bg-secondary/80 text-foreground transition-all">
              Выбрать
            </a>
          </div>
        </div>

        {/* Стандарт (Популярный) */}
        <div className="bg-card border-2 border-primary rounded-3xl p-6 shadow-md flex flex-col justify-between space-y-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow-sm">
            Хит продаж
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-primary uppercase tracking-wider">Офферы РФ и СНГ</span>
              <h3 className="text-xl font-black text-foreground">Стандарт + Гарантия</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Реальные аккаунты с аватарками и постами. Защита от списаний с автоматической докруткой.
              </p>
            </div>

            <div className="space-y-2.5 pt-2 text-xs">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Старт: Мгновенно (30 сек)</span>
              </div>
              <div className="flex items-center gap-2 text-foreground font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Плавное начисление без всплесков</span>
              </div>
              <div className="flex items-center gap-2 text-foreground font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Аудитория: Качественные профили РФ/СНГ</span>
              </div>
              <div className="flex items-center gap-2 text-foreground font-medium">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                <span>Гарантия Refill: 30–60 дней</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border/60 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-muted-foreground block font-bold uppercase">Цена от</span>
              <span className="text-xl font-black text-primary font-mono">{(minPrice * 1.5).toFixed(4)} ₽</span>
              <span className="text-[10px] text-muted-foreground"> / шт</span>
            </div>
            <a href="#main-content" className="px-5 py-2.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-sm">
              Заказать
            </a>
          </div>
        </div>

        {/* Премиум */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Максимум качества</span>
              <h3 className="text-xl font-black text-foreground">Премиум HQ</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Живая активная аудитория. Максимальный траст для алгоритмов ранжирования и рекомендаций.
              </p>
            </div>

            <div className="space-y-2.5 pt-2 text-xs">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Старт: Плавный безопасный запуск</span>
              </div>
              <div className="flex items-center gap-2 text-foreground font-medium">
                <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Просмотры историй и активность</span>
              </div>
              <div className="flex items-center gap-2 text-foreground font-medium">
                <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Списания: 0% (Бессрочная гарантия)</span>
              </div>
              <div className="flex items-center gap-2 text-foreground font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Полный иммунитет от фильтров</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border/60 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-muted-foreground block font-bold uppercase">Цена от</span>
              <span className="text-lg font-black text-foreground font-mono">{(minPrice * 2.8).toFixed(4)} ₽</span>
              <span className="text-[10px] text-muted-foreground"> / шт</span>
            </div>
            <a href="#main-content" className="px-4 py-2 rounded-xl text-xs font-bold bg-secondary hover:bg-secondary/80 text-foreground transition-all">
              Выбрать
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
