import React from "react";
import { Sparkles, Star } from "lucide-react";

interface LandingSeoFactBoxProps {
  currentTitle: string;
  networkName: string;
  siteName: string;
}

export function LandingSeoFactBox({
  currentTitle,
  networkName,
  siteName,
}: LandingSeoFactBoxProps) {
  return (
    <section className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <span className="text-xs font-bold text-primary uppercase tracking-wider">AEO Спецификация</span>
          <h2 className="text-xl sm:text-2xl font-black text-foreground">
            Характеристики услуги: {currentTitle}
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground bg-secondary px-3 py-1.5 rounded-xl w-fit">
          <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
          <span>Верифицировано {siteName}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
        <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/50 space-y-1">
          <span className="text-muted-foreground block text-[11px]">Минимальный объем</span>
          <span className="font-extrabold text-foreground text-sm">от 1–10 шт.</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/50 space-y-1">
          <span className="text-muted-foreground block text-[11px]">Скорость запуска</span>
          <span className="font-extrabold text-foreground text-sm">от 30 секунд</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/50 space-y-1">
          <span className="text-muted-foreground block text-[11px]">Приватность</span>
          <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">100% Без пароля</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/50 space-y-1">
          <span className="text-muted-foreground block text-[11px]">Гарантия от списаний</span>
          <span className="font-extrabold text-foreground text-sm">До 90 дней (Refill)</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/50 space-y-1">
          <span className="text-muted-foreground block text-[11px]">Платформа</span>
          <span className="font-extrabold text-foreground text-sm">{networkName}</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/50 space-y-1">
          <span className="text-muted-foreground block text-[11px]">Способы оплаты</span>
          <span className="font-extrabold text-foreground text-sm">МИР, СБП, Карты</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/50 space-y-1">
          <span className="text-muted-foreground block text-[11px]">Фискальный чек</span>
          <span className="font-extrabold text-foreground text-sm">54-ФЗ Онлайн</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/50 space-y-1">
          <span className="text-muted-foreground block text-[11px]">Рейтинг пользователей</span>
          <div className="flex items-center gap-1 font-extrabold text-foreground text-sm">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>4.95 / 5.0</span>
          </div>
        </div>
      </div>
    </section>
  );
}
