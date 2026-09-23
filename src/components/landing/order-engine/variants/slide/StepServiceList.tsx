'use client';

import React from "react";
import { Box, Clock, ShieldCheck, ArrowRightIcon, AlertCircle } from "lucide-react";
import { motion, type Variants } from "framer-motion";
import type { PublicCategory, PublicService } from "@/actions/order/catalog";

export interface StepServiceListProps {
  activeCategory: PublicCategory;
  services: PublicService[];
  isLoadingServices: boolean;
  onSelectService: (srv: PublicService) => void;
  onBackToCategories: () => void;
  containerVariants: Variants;
  itemVariants: Variants;
}

export function StepServiceList({
  activeCategory,
  services,
  isLoadingServices,
  onSelectService,
  onBackToCategories,
  containerVariants,
  itemVariants,
}: StepServiceListProps) {
  return (
    <div className="w-full max-w-3xl">
      <div className="mb-5 px-1">
        <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
          {activeCategory.name}
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Выберите подходящий тариф по скорости, гарантии и стоимости
        </p>
      </div>

      {isLoadingServices ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Box className="w-10 h-10 text-primary animate-pulse" />
          <span className="text-xs text-muted-foreground font-medium">Загрузка тарифов...</span>
        </div>
      ) : services.length === 0 ? (
        <div className="py-14 text-center bg-card border border-border/80 rounded-2xl p-6">
          <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-60" />
          <p className="font-bold text-foreground">В этой категории пока нет доступных тарифов</p>
          <p className="text-xs text-muted-foreground mt-1">Пожалуйста, выберите другую категорию</p>
          <button
            type="button"
            onClick={onBackToCategories}
            className="mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 cursor-pointer"
          >
            Вернуться к категориям
          </button>
        </div>
      ) : (
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          {services.map((service) => (
            <motion.div
              key={service.id}
              variants={itemVariants}
              role="button"
              tabIndex={0}
              onClick={() => onSelectService(service)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectService(service);
                }
              }}
              className="p-4 rounded-2xl bg-card border border-border/80 hover:border-primary/60 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer relative"
            >
              <div>
                <h4 className="font-bold text-foreground text-base leading-snug mb-2 group-hover:text-primary transition-colors">
                  {service.name}
                </h4>

                <div className="space-y-1 text-xs text-muted-foreground mb-4">
                  <p className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Старт: <strong className="text-foreground font-semibold">{service.speed || 'Моментально'}</strong></span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary/60 inline-block" />
                    <span>Лимиты: <strong className="text-foreground font-semibold font-mono">{service.minQty} – {service.maxQty} шт.</strong></span>
                  </p>
                  {service.warrantyDays ? (
                    <p className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Гарантия: {service.warrantyDays} дн.</span>
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="pt-3 border-t border-border/60 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  <span className="text-base sm:text-lg font-black text-foreground font-mono">
                    {service.pricePerUnitRub.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ₽
                  </span>
                  <span className="ml-1 text-[11px]">/ шт</span>
                </div>

                <button
                  type="button"
                  className="h-8 px-3.5 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer pointer-events-none"
                >
                  <span>Выбрать</span>
                  <ArrowRightIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
