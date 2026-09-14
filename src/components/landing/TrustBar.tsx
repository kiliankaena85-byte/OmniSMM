'use client';

import { motion } from "framer-motion";
import { Users, Timer, CheckCircle, Headphones } from "lucide-react";

export function TrustBar() {
  const stats = [
    { value: '2,000,000+', label: 'Заказов выполнено', icon: CheckCircle, color: 'text-success' },
    { value: '4 секунды', label: 'Среднее время старта', icon: Timer, color: 'text-warning' },
    { value: '99.9%', label: 'Успешных заказов', icon: Users, color: 'text-primary' },
    { value: '09:00 - 21:00 МСК', label: 'Живая поддержка', icon: Headphones, color: 'text-secondary' },
  ];

  // We duplicate the array to create a seamless infinite loop
  const marqueeItems = [...stats, ...stats, ...stats];

  return (
    <section aria-label="Статистика платформы" className="w-full py-12 bg-content1 border-y border-border/50 overflow-hidden relative">
      <div className="absolute left-0 top-0 w-32 h-full bg-gradient-to-r from-content1 to-transparent z-10 pointer-events-none hidden md:block" />
      <div className="absolute right-0 top-0 w-32 h-full bg-gradient-to-l from-content1 to-transparent z-10 pointer-events-none hidden md:block" />
      
      {/* Mobile Grid Layout (< md) */}
      <div className="grid grid-cols-2 gap-3 px-4 w-full md:hidden">
        {stats.map((s, idx) => {
          const Icon = s.icon;
          return (
            <div
              key={`${s.label}-${idx}`}
              className="flex items-start gap-2.5 bg-content2 border border-border/50 rounded-2xl p-3 w-full shadow-sm hover:border-primary/20 transition-all duration-300"
            >
              <div className={`p-2 rounded-xl bg-content1 shadow-sm border border-border/50 shrink-0 mt-0.5 ${s.color}`}>
                <Icon className="w-4 h-4 drop-shadow-sm" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="text-sm font-bold tracking-tight text-foreground tabular-nums leading-tight">{s.value}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-normal leading-tight mt-0.5">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Marquee (>= md) */}
      <div className="hidden md:flex w-full overflow-hidden">
        <motion.div
          animate={{ x: ["0%", "-50%"] }}
          transition={{
            repeat: Infinity,
            ease: "linear",
            duration: 40,
          }}
          className="flex gap-4 sm:gap-8 px-4 sm:px-8 shrink-0 items-center whitespace-nowrap"
        >
          {marqueeItems.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={`${s.label}-${idx}`}
                className="flex items-center gap-4 bg-content2 border border-border/50 rounded-full px-6 py-3 shrink-0"
              >
                <div className={`p-2 rounded-full bg-content1 shadow-sm border border-border/50 ${s.color}`}>
                  <Icon className="w-5 h-5 drop-shadow-sm" />
                </div>
                <div className="flex flex-col">
                  <div className="text-xl font-bold tracking-tight text-foreground tabular-nums">{s.value}</div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</div>
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
