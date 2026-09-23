'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftIcon, Box } from 'lucide-react';
import type { FluxNetwork, FluxCategory, FluxService } from '@/types/flux';
import { formatPricePerUnit } from '@/utils/format-price';
import { slideVariants, containerVariants, itemVariants } from './types';

interface FluxDashboardStepServiceProps {
  direction: number;
  activeNetwork: FluxNetwork | null;
  activeCategory: FluxCategory;
  isLoadingServices: boolean;
  services: FluxService[];
  onNavigateBack: () => void;
  onSelectService: (service: FluxService) => void;
}

export function FluxDashboardStepService({
  direction,
  activeNetwork,
  activeCategory,
  isLoadingServices,
  services,
  onNavigateBack,
  onSelectService
}: FluxDashboardStepServiceProps) {
  return (
    <motion.div
      key="step-service"
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className="w-full space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">{activeCategory.name}</h2>
          <p className="text-xs text-muted-foreground font-medium">
            {activeNetwork?.name} • Выберите подходящий тариф
          </p>
        </div>
        <button
          type="button"
          onClick={onNavigateBack}
          className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer"
        >
          <ArrowLeftIcon className="w-3.5 h-3.5" /> Назад к категориям
        </button>
      </div>

      {isLoadingServices ? (
        <div className="py-20 flex justify-center">
          <Box className="w-12 h-12 text-primary/50 animate-pulse" />
        </div>
      ) : services.length === 0 ? (
        <div className="p-8 text-center bg-card/50 rounded-2xl border border-border/40 text-muted-foreground text-sm">
          В данной категории пока нет активных тарифов. Пожалуйста, выберите другую категорию.
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4"
        >
          {services.map((service) => (
            <motion.div
              key={service.id}
              role="button"
              tabIndex={0}
              variants={itemVariants}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.99 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-[1.5rem] border border-border/40 bg-card/85 backdrop-blur-md hover:bg-card hover:border-primary/50 hover:shadow-lg transition-colors duration-150 flex flex-col justify-between group relative min-h-[140px]"
              onClick={() => onSelectService(service)}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectService(service);
                }
              }}
            >
              <div className="p-5 pb-14 sm:p-6 sm:pb-16">
                <h4 className="font-bold text-foreground text-base sm:text-lg leading-snug mb-2">{service.name}</h4>

                <div className="space-y-1.5">
                  <p className="text-[12px] text-muted-foreground flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Старт: <span className="font-medium text-foreground">{service.speed || 'Моментально'}</span>
                  </p>
                  <p className="text-[12px] text-muted-foreground flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    Лимиты: <span className="font-medium text-foreground tabular-nums font-mono">{service.minQty} - {service.maxQty} шт.</span>
                  </p>
                </div>
              </div>

              <div className="absolute bottom-4 left-4 sm:bottom-5 sm:left-5 bg-foreground text-background px-3 py-1.5 rounded-full font-bold text-xs sm:text-sm shadow-sm pointer-events-none tabular-nums font-mono">
                {formatPricePerUnit(service.pricePerUnitRub)} ₽ <span className="font-normal opacity-80 font-sans">/ шт</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
