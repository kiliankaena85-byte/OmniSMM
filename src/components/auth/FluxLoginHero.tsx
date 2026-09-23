import React from 'react';
import Link from 'next/link';
import { Sparkles, Zap, ShieldCheck } from 'lucide-react';

export const FluxLoginHero: React.FC = () => {
  return (
    <div className="hidden lg:flex flex-col space-y-8 p-8">
      <Link href="/?tenant=flux" className="flex items-center gap-3 group select-none" aria-label="SMMflux — На главную">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 text-white flex items-center justify-center font-black text-2xl shadow-xl shadow-purple-500/30 group-hover:scale-105 transition-transform duration-200">
          <Sparkles className="w-6 h-6 animate-pulse" />
        </div>
        <span className="font-black text-3xl tracking-tight text-foreground">SMMflux</span>
      </Link>

      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/25 text-purple-700 dark:text-purple-300 text-xs font-black uppercase tracking-wider shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-pink-500" /> FLUX Next-Gen Platform
        </div>
        <h1 className="text-4xl xl:text-5xl font-black text-foreground tracking-tight leading-tight">
          Продвижение нового поколения
        </h1>
        <p className="text-muted-foreground font-medium text-base leading-relaxed bg-card/85 backdrop-blur-md p-6 rounded-[2rem] border border-border/80 shadow-sm">
          Войдите в личный кабинет SMMflux — управляйте заказами с максимальной скоростью, чеками 54-ФЗ и защитой от списаний.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: <Sparkles className="w-5 h-5 text-purple-600 mb-1" />, value: 'AI-Driven', label: 'Алгоритмы' },
          { icon: <Zap className="w-5 h-5 text-pink-500 mb-1" />, value: 'От 1 шт', label: 'Без опта' },
          { icon: <ShieldCheck className="w-5 h-5 text-emerald-600 mb-1" />, value: '54-ФЗ', label: 'Чек на почту' },
        ].map(({ icon, value, label }) => (
          <div
            key={label}
            className="bg-card/90 backdrop-blur-xl border border-border/80 shadow-sm p-4 text-center rounded-2xl flex flex-col items-center justify-center min-h-[104px] hover:scale-105 transition-all duration-300"
          >
            {icon}
            <div className="text-base font-black text-foreground">{value}</div>
            <div className="text-[11px] text-muted-foreground font-semibold mt-0.5">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
