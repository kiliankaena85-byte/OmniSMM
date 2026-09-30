'use client';

import React from 'react';
import Link from 'next/link';
import { Rocket, ArrowUpRight, ShieldCheck, Clock, Receipt, Sparkles } from 'lucide-react';
import { ROUTES } from '@/lib/routes';

interface FluxPreFooterCTAProps {
  siteName?: string;
  onStartClick?: () => void;
}

export function FluxPreFooterCTA({ siteName = 'SMMflux', onStartClick }: FluxPreFooterCTAProps) {
  const handleScrollToTop = () => {
    if (onStartClick) {
      onStartClick();
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-4 py-12 md:py-16">
      <div className="relative rounded-3xl md:rounded-[36px] bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white p-8 sm:p-12 md:p-14 overflow-hidden border border-slate-800 shadow-2xl">
        {/* Фоновые сияющие сферы Lovable */}
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-cyan-500/25 blur-[90px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-pink-500/25 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-purple-500/15 blur-[80px] rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center max-w-3xl mx-auto">
          {/* Верхний бейдж */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-white/10 text-cyan-300 border border-white/15 mb-4 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>СТАРТ ЗА 60 СЕКУНД БЕЗ РЕГИСТРАЦИИ</span>
          </div>

          {/* Главный заголовок */}
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Готовы вывести соцсети на новый уровень?
          </h2>

          <p className="text-sm sm:text-base md:text-lg text-slate-300 mt-4 max-w-2xl leading-relaxed">
            Присоединяйтесь к более чем 10 000 блогеров, брендов и агентств. Первые просмотры и подписчики начнут поступать уже через пару минут.
          </p>

          {/* Кнопки действий */}
          <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <button
              onClick={handleScrollToTop}
              className="w-full sm:w-auto h-14 px-8 rounded-2xl bg-white text-slate-950 font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 hover:bg-slate-100 hover:shadow-lg hover:shadow-white/20 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
            >
              <Rocket className="w-4 h-4 text-indigo-600" />
              <span>Начать продвижение 🚀</span>
            </button>

            <Link
              href={ROUTES.SERVICES.INDEX}
              className="w-full sm:w-auto h-14 px-7 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm sm:text-base border border-white/20 flex items-center justify-center gap-2 backdrop-blur-md hover:-translate-y-0.5 active:translate-y-0 transition-all"
            >
              <span>Открыть каталог услуг</span>
              <ArrowUpRight className="w-4 h-4 text-slate-400" />
            </Link>
          </div>

          {/* Полоса гарантий под кнопками */}
          <div className="mt-10 pt-6 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
            <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-medium text-slate-300">
              <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Мгновенный старт от 4 секунд</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-300">
              <Receipt className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Официальный чек 54-ФЗ</span>
            </div>
            <div className="flex items-center justify-center sm:justify-end gap-2 text-xs font-medium text-slate-300">
              <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
              <span>100% гарантия от списаний (Refill)</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
