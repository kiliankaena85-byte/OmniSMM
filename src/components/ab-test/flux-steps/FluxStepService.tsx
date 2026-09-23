'use client';

import React from "react";
import { Box } from "lucide-react";
import { motion, type Variants } from "framer-motion";
import type { FluxCategory, FluxService } from "@/types/flux";
import { ServiceIdBadge } from "@/components/ui/service-id-badge";

export interface FluxStepServiceProps {
  activeCategory: FluxCategory;
  services: FluxService[];
  isLoadingServices: boolean;
  onSelectService: (srv: FluxService) => void;
  containerVariants: Variants;
  itemVariants: Variants;
}

export function FluxStepService({
  activeCategory,
  services,
  isLoadingServices,
  onSelectService,
  containerVariants,
  itemVariants,
}: FluxStepServiceProps) {
  return (
    <div className="w-full transform-gpu">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground tracking-tight">{activeCategory.name}</h2>
      </div>

      {isLoadingServices ? (
        <div className="py-20 flex justify-center">
          <Box className="w-12 h-12 text-primary/50 animate-pulse" />
        </div>
      ) : (
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-5"
        >
          {services.map((service) => (
            <motion.div 
              key={service.id}
              role="button"
              tabIndex={0}
              variants={itemVariants}
              className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-[1.5rem] sm:rounded-[2rem] border border-white/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-md hover:shadow-xl hover:border-primary/50 transition-all duration-150 flex flex-col justify-between group relative min-h-[140px] sm:min-h-[160px] transform-gpu hover:scale-[1.01] active:scale-[0.99]"
              onClick={() => onSelectService(service)}
              onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectService(service); } }}
            >
              <div className="p-5 pb-14 sm:p-6 sm:pb-16">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {service.numericId && <ServiceIdBadge numericId={service.numericId} />}
                    <h4 className="font-bold text-foreground text-lg sm:text-xl leading-snug">{service.name}</h4>
                  </div>
                </div>
                
                <div className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2">
                  <p className="text-[12px] sm:text-[13px] text-muted-foreground flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> 
                    Старт: <span className="font-medium text-foreground">{service.speed || 'Моментально'}</span>
                  </p>
                  <p className="text-[12px] sm:text-[13px] text-muted-foreground flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> 
                    Лимиты: <span className="font-medium text-foreground tabular-nums font-mono">{service.minQty} - {service.maxQty} шт.</span>
                  </p>
                </div>
              </div>
              
              <div className="absolute bottom-4 left-4 sm:bottom-5 sm:left-5 bg-foreground text-background px-3 py-1.5 sm:px-4 sm:py-2 rounded-full font-bold text-[13px] sm:text-[14px] shadow-sm pointer-events-none tabular-nums font-mono">
                {service.pricePerUnitRub.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ₽ <span className="font-normal opacity-80 font-sans">/ шт</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
