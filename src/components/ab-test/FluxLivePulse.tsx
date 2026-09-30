'use client';

import React from 'react';
import { Activity, ShieldCheck, Zap, Users } from 'lucide-react';

const RECENT_ACTIVITY = [
  { network: 'YouTube', iconBg: 'bg-red-500/10 text-red-500', action: '1 000 просмотров (Россия)', time: '4 сек назад' },
  { network: 'Telegram', iconBg: 'bg-sky-500/10 text-sky-500', action: '500 подписчиков в канал', time: '11 сек назад' },
  { network: 'ВКонтакте', iconBg: 'bg-blue-500/10 text-blue-500', action: '250 живых лайков на пост', time: '19 сек назад' },
  { network: 'Instagram', iconBg: 'bg-pink-500/10 text-pink-500', action: '5 000 просмотров Reels', time: '26 сек назад' },
  { network: 'TikTok', iconBg: 'bg-slate-900/10 text-slate-800 dark:text-slate-200', action: '2 000 просмотров в рекомендации', time: '34 сек назад' },
];

export function FluxLivePulse() {
  return (
    <section className="w-full max-w-7xl mx-auto px-4 py-4 md:py-6">
      <div className="rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-slate-200/80 dark:border-zinc-800 p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Живой индикатор платформы */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-900 dark:text-white">Сеть активна</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-semibold">
                99.98%
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Средняя скорость старта: 4.2 сек</p>
          </div>
        </div>

        {/* Бегущая строка недавних заказов */}
        <div className="w-full lg:max-w-2xl overflow-hidden relative">
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
            {RECENT_ACTIVITY.map((item, idx) => (
              <div
                key={idx}
                className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/70 dark:border-zinc-700/60 text-xs shadow-2xs"
              >
                <span className={`px-1.5 py-0.5 rounded-md font-bold text-[10px] ${item.iconBg}`}>
                  {item.network}
                </span>
                <span className="font-medium text-slate-700 dark:text-slate-200">{item.action}</span>
                <span className="text-[10px] text-slate-400 font-mono">{item.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Ключевое преимущество */}
        <div className="hidden xl:flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 shrink-0">
          <ShieldCheck className="w-4 h-4 text-indigo-500" />
          <span>Защита от списаний Refill</span>
        </div>
      </div>
    </section>
  );
}
