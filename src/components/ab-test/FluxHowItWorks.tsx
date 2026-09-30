'use client';

import React from 'react';
import { Link2, Zap, TrendingUp, Sparkles, ArrowRight } from 'lucide-react';

interface FluxHowItWorksProps {
  onStartClick?: () => void;
}

const STEPS = [
  {
    step: '01',
    badge: 'Шаг первый',
    title: 'Укажите ссылку на пост или канал',
    description:
      'Без регистрации и паролей. Умный алгоритм автоматически определит соцсеть, формат контента и подберёт оптимальные тарифы.',
    icon: Link2,
    chip: '100% анонимно',
    glowColor: 'from-blue-500/20 to-cyan-500/20',
    borderColor: 'group-hover:border-cyan-400/60',
    iconColor: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/60 dark:text-cyan-400',
  },
  {
    step: '02',
    badge: 'Шаг второй',
    title: 'Выберите тариф и оплатите в 1 клик',
    description:
      'СБП без комиссии, банковские карты РФ и зарубежья, криптовалюта. Моментальный фискальный чек 54-ФЗ сразу на вашу почту.',
    icon: Zap,
    chip: 'СБП 0% • Чек 54-ФЗ',
    glowColor: 'from-purple-500/20 to-pink-500/20',
    borderColor: 'group-hover:border-purple-400/60',
    iconColor: 'text-purple-500 bg-purple-50 dark:bg-purple-950/60 dark:text-purple-400',
  },
  {
    step: '03',
    badge: 'Шаг третий',
    title: 'Наблюдайте за взрывным ростом',
    description:
      'Старт выполнения от 4 секунд. Живой трекер в личном кабинете, умная плавная скорость подачи и авто-докрутка при списаниях.',
    icon: TrendingUp,
    chip: 'Старт от 4 сек • Refill',
    glowColor: 'from-emerald-500/20 to-teal-500/20',
    borderColor: 'group-hover:border-emerald-400/60',
    iconColor: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400',
  },
];

export function FluxHowItWorks({ onStartClick }: FluxHowItWorksProps) {
  const scrollToHero = () => {
    if (onStartClick) {
      onStartClick();
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-4 py-12 md:py-16">
      {/* Заголовок секции */}
      <div className="flex flex-col items-center text-center mb-10 md:mb-14">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/80 mb-3 shadow-xs">
          <Sparkles className="w-3.5 h-3.5" />
          <span>ПРОСТОТА & СКОРОСТЬ</span>
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Как запустить продвижение за 60 секунд
        </h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-2.5 max-w-2xl">
          Три понятных шага без утомительных регистраций, сложных настроек и риска для аккаунта
        </p>
      </div>

      {/* 3 Карточки шагов */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
        {STEPS.map((s, idx) => {
          const Icon = s.icon;
          return (
            <div
              key={s.step}
              className={`group relative rounded-3xl p-6 sm:p-7 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-slate-200/90 dark:border-zinc-800 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between overflow-hidden ${s.borderColor}`}
            >
              {/* Фоновое свечение при ховере */}
              <div
                className={`absolute -top-16 -right-16 w-40 h-40 bg-gradient-to-br ${s.glowColor} rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`}
              />

              <div>
                {/* Шапка карточки: Номер и Иконка */}
                <div className="flex items-center justify-between mb-5">
                  <span className="text-3xl sm:text-4xl font-black font-mono tracking-tighter text-slate-200 dark:text-zinc-800 group-hover:text-indigo-500/40 transition-colors">
                    {s.step}
                  </span>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center p-2.5 shadow-xs ${s.iconColor}`}>
                    <Icon className="w-6 h-6 shrink-0" />
                  </div>
                </div>

                <div className="inline-block px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-2">
                  {s.badge}
                </div>

                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-2.5 leading-snug">
                  {s.title}
                </h3>

                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {s.description}
                </p>
              </div>

              {/* Футер карточки: микро-чип */}
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {s.chip}
                </span>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  Попробовать <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Быстрый триггер перехода */}
      <div className="mt-8 flex justify-center">
        <button
          onClick={scrollToHero}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-xs sm:text-sm font-bold border border-indigo-200/80 dark:border-indigo-800/80 transition-colors cursor-pointer"
        >
          <span>Вставить ссылку и рассчитать стоимость</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
}
