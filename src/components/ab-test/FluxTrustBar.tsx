'use client';

import React from "react";
import { motion } from "framer-motion";
import { Users, Timer, CheckCircle, Headphones } from "lucide-react";

export function FluxTrustBar() {
  const stats = [
    { value: '2,000,000+', label: 'Заказов выполнено', icon: CheckCircle, color: 'text-emerald-500' },
    { value: '4 секунды', label: 'Среднее время старта', icon: Timer, color: 'text-amber-500' },
    { value: '99.9%', label: 'Успешных заказов', icon: Users, color: 'text-purple-500' },
    { value: '09:00 - 21:00 МСК', label: 'Живая поддержка', icon: Headphones, color: 'text-pink-500' },
  ];

  // Quadruple items for perfectly seamless infinite continuous loop
  const marqueeItems = [...stats, ...stats, ...stats, ...stats];

  return (
    <section aria-label="Статистика платформы" className="w-full py-6 md:py-8 bg-transparent overflow-hidden relative">
      <div 
        className="flex w-full overflow-hidden"
        style={{
          maskImage: 'linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)'
        }}
      >
        <motion.div
          animate={{ x: ["0%", "-50%"] }}
          transition={{
            repeat: Infinity,
            repeatType: "loop",
            ease: "linear",
            duration: 30,
          }}
          className="flex gap-4 sm:gap-6 px-4 shrink-0 items-center whitespace-nowrap will-change-transform"
        >
          {marqueeItems.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={`${s.label}-${idx}`}
                className="flex items-center gap-3.5 bg-card/95 border border-purple-500/20 rounded-full px-6 sm:px-8 py-3 sm:py-3.5 shrink-0 shadow-sm hover:shadow-md hover:border-purple-500/40 transition-colors duration-150 group"
              >
                <div className={`p-2 rounded-full bg-neutral-100 dark:bg-neutral-800/80 shrink-0 ${s.color} group-hover:scale-110 transition-transform`}>
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5 drop-shadow-sm" />
                </div>
                <div className="flex flex-col">
                  <div className="text-base sm:text-lg font-black tracking-tight text-neutral-900 dark:text-white tabular-nums">
                    {s.value}
                  </div>
                  <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    {s.label}
                  </div>
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
