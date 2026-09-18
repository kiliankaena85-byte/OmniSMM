import React, { useEffect, useMemo, useState } from "react";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { checkServiceRefill } from "@/utils/service-refill";
import { CheckoutMode, CheckoutVariantProps } from "./variants/types";
import { InCardAccordionCheckout } from "./variants/InCardAccordionCheckout";
import { ServiceIdBadge } from "@/components/ui/service-id-badge";

interface ServiceGridProps {
  engine: OrderEngine;
  checkoutMode?: CheckoutMode;
  checkoutProps?: CheckoutVariantProps;
}

/**
 * AUD-07 (3.2): progressive disclosure for large category catalogs.
 * All services stay available (data layer limit raised to 500), but the DOM
 * renders in chunks of 24 with a "show more" button — no silent truncation,
 * no giant first paint.
 */
const INITIAL_VISIBLE = 24;
const VISIBLE_STEP = 24;

export function ServiceGrid({ engine, checkoutMode, checkoutProps }: ServiceGridProps) {
  const { services, selectedService, setSelectedService, networkId, catalog, isLoading } = engine;
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  // Reset chunking when the category changes
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
  }, [networkId, engine.categoryId]);

  const selectedNetworkObj = useMemo(() => {
    return catalog.find(n => n.id === networkId);
  }, [catalog, networkId]);

  const visibleServices = useMemo(
    () => services.slice(0, visibleCount),
    [services, visibleCount]
  );

  const desktopGridContent = useMemo(() => {
    return visibleServices.map((srv, i) => {
      const isSelected = selectedService?.id === srv.id;
      const isQuarantined = srv.cooldownUntil && new Date(srv.cooldownUntil) > new Date();

      const descriptionText = isQuarantined 
        ? "Услуга временно приостановлена. Пожалуйста, выберите аналогичную услугу из списка."
        : srv.description 
          ? srv.description
          : srv.name.toLowerCase().includes('без гарант')
            ? "Услуга без гарантии. В случае отписок восстановление не производится."
            : "Стандартные условия сервиса. Скорость зависит от текущей нагрузки провайдера.";

      return (
        <div
          key={srv.id}
          className="h-full animate-in fade-in duration-300"
        >
          <Card 
            data-testid="service-card"
            onClick={() => {
              if (isQuarantined) return;
              setSelectedService(srv);
            }}
            className={`group w-full flex flex-col p-4 sm:p-5 border-2 rounded-[2rem] relative overflow-visible transition-all duration-300 ease-out h-full ${
              isQuarantined ? 'cursor-not-allowed opacity-75 grayscale-[0.5] bg-content2 border-transparent' 
              : isSelected ? 'cursor-pointer border-transparent text-primary-foreground z-[50] bg-primary shadow-[0_20px_40px_-10px_var(--tw-shadow-color)] shadow-primary/30 scale-[1.02]' 
              : 'cursor-pointer bg-content1 border-border/40 z-[1] hover:border-border hover:shadow-2xl hover:shadow-black/5 hover:-translate-y-1'
            }`}
          >
            <div className={`absolute inset-0 rounded-[2rem] opacity-0 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-white/20 to-transparent ${isSelected && !isQuarantined ? 'opacity-100' : 'group-hover:opacity-10'}`} />
          
          {(() => {
            const { hasRefill, badgeLabel } = checkServiceRefill(srv);
            const isFast = srv.name.toLowerCase().includes('быстр') || srv.name.toLowerCase().includes('мгновен') || srv.name.toLowerCase().includes('speed');
            const displayBadge = srv.badge || (
              hasRefill
                ? (badgeLabel || '🛡️ Refill Гарантия')
                : isFast
                ? '⚡️ Топ скорость'
                : i === 0
                ? '🔥 Выбор клиентов'
                : null
            );

            if (isQuarantined) {
              return (
                <div className="absolute -top-3 -right-2 z-20 px-3 py-1 rounded-full text-[10px] tracking-widest font-black uppercase shadow-sm bg-danger text-danger-foreground border-2 border-danger-200">
                  КАРАНТИН
                </div>
              );
            }

            if (displayBadge) {
              return (
                <div 
                  className={`absolute -top-3 -right-2 z-20 px-3 py-1 rounded-full text-[10px] tracking-wider font-black uppercase transition-all duration-300 pointer-events-none flex items-center justify-center transform-gpu border-2 ${
                    isSelected 
                      ? 'bg-content1 text-primary border-primary shadow-lg shadow-primary/30' 
                      : 'bg-primary text-primary-foreground border-transparent shadow-md'
                  }`}
                >
                  {displayBadge}
                </div>
              );
            }
            return null;
          })()}
          
          <div className="flex-1 flex flex-col pt-2 relative z-10">
             <h4 className={`font-extrabold text-base transition-colors duration-300 leading-snug mb-4 min-h-[44px] break-words flex items-center flex-wrap gap-2 ${isSelected ? 'text-primary-foreground' : 'text-foreground'}`}>
               <ServiceIdBadge 
                 numericId={srv.numericId} 
                 className={isSelected ? 'bg-primary-foreground/25 text-primary-foreground border-primary-foreground/30' : ''} 
               />
               <span>{srv.name}</span>
             </h4>
              <div className="flex-1 mb-6 flex flex-col">
                 <p className={`text-sm font-medium leading-relaxed p-4 rounded-2xl border transition-all duration-300 text-pretty h-full ${
                   isSelected && !isQuarantined ? 'bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground/90 shadow-inner' 
                   : isQuarantined ? 'bg-danger/10 border-danger/20 text-danger' 
                   : 'bg-content2/50 border-border/50 text-muted-foreground'
                 }`}>
                   <span className="line-clamp-[10] whitespace-pre-line block">
                     {descriptionText.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
                       if (part.startsWith('**') && part.endsWith('**')) {
                         return <strong key={index} className="font-extrabold text-foreground">{part.slice(2, -2)}</strong>;
                       }
                       return part;
                     })}
                   </span>
                 </p>
              </div>
             <p className={`text-xs font-bold flex items-center transition-colors duration-300 justify-between mt-auto px-1 ${isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground/80'}`}>
               <span>Запуск: <span className={isSelected ? 'text-primary-foreground' : 'text-foreground'}>{srv.speed}</span></span>
               <span>Мин: <span className={isSelected ? 'text-primary-foreground' : 'text-foreground'}>{srv.minQty}</span></span>
             </p>
          </div>
          
          <div className={`mt-6 pt-5 flex justify-between items-center px-1 relative z-10 transition-colors duration-300 ${isSelected ? 'border-t border-primary-foreground/20' : 'border-t border-border/40'}`}>
            <div>
              <p className={`text-[10px] uppercase font-black tracking-wider mb-1.5 transition-colors duration-300 ${isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>Цена за 1 шт.</p>
              <p className={`text-2xl sm:text-3xl font-black tabular-nums leading-none transition-colors duration-300 ${isSelected ? 'text-primary-foreground' : 'text-foreground'}`}>
                  {srv.pricePerUnitRub} <span className="text-xl font-bold">₽</span>
              </p>
            </div>
            <div
              data-testid="select-service-checkbox"
              className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'bg-primary-foreground text-primary border-primary-foreground shadow-md scale-105'
                  : 'border-border/80 bg-background/50 text-transparent group-hover:border-primary/60'
              }`}
            >
              <Check className={`w-5 h-5 stroke-[3] transition-all duration-150 ${isSelected ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`} />
            </div>
          </div>

          {checkoutMode === "card" && isSelected && checkoutProps && (
            <InCardAccordionCheckout {...checkoutProps} />
          )}
          </Card>
        </div>
      );
    });
  }, [visibleServices, selectedService, selectedNetworkObj, setSelectedService, checkoutMode, checkoutProps]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div 
            key={i} 
            className="w-full flex flex-col p-6 border-2 border-border/30 rounded-3xl bg-content1 h-[320px] justify-between animate-pulse"
          >
            <div className="flex-1 flex flex-col pt-2 gap-4">
              <div className="space-y-2">
                <div className="h-5 w-5/6 bg-content2 rounded-xl" />
                <div className="h-5 w-1/2 bg-content2 rounded-xl" />
              </div>
              <div className="h-28 w-full bg-content2/50 border border-border/30 rounded-2xl" />
              <div className="flex justify-between items-center px-1">
                <div className="h-3.5 w-1/3 bg-content2 rounded" />
                <div className="h-3.5 w-1/4 bg-content2 rounded" />
              </div>
            </div>
            
            <div className="mt-6 pt-5 border-t border-border/30 flex justify-between items-end px-1">
              <div className="space-y-2">
                <div className="h-3 w-16 bg-content2 rounded" />
                <div className="h-8 w-24 bg-content2 rounded-xl" />
              </div>
              <div className="w-8 h-8 rounded-full bg-content2 shrink-0 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {desktopGridContent}
      </div>
      {/* AUD-07 (3.2): "show more" instead of silent truncation at 100 */}
      {services.length > visibleCount && (
        <div className="flex flex-col items-center gap-1.5 pt-2 pb-6">
          <Button
            intent="outline"
            onClick={() => setVisibleCount((prev) => prev + VISIBLE_STEP)}
            className="h-11 px-8 font-bold text-sm"
          >
            <ChevronDown className="w-4 h-4" />
            Показать ещё {Math.min(VISIBLE_STEP, services.length - visibleCount)} из {services.length - visibleCount}
          </Button>
          <span className="text-[11px] text-muted-foreground">
            Показано {visibleCount} из {services.length} услуг
          </span>
        </div>
      )}
    </div>
  );
}
