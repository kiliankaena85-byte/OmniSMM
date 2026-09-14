import React from "react";
import { motion } from "framer-motion";
import { ChevronDown, Sparkles, Lightbulb, ArrowRight } from "lucide-react";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { TariffCard } from "../TariffCard";
import { Button } from "@/components/ui/button";
import { BrandStyle } from "@/utils/brand-styles";

interface MobileStep3ServiceProps {
  engine: OrderEngine;
  currentStep: number;
  setActiveStep: (step: 1 | 2 | 3 | 4) => void;
  shouldShowTariffs: boolean;
  selectedCategoryName: string;
  brandStyle?: BrandStyle;
  step3Ref: React.RefObject<HTMLDivElement | null>;
}

export function MobileStep3Service({
  engine,
  currentStep,
  setActiveStep,
  shouldShowTariffs,
  selectedCategoryName,
  brandStyle,
  step3Ref
}: MobileStep3ServiceProps) {
  const [showAllTariffs, setShowAllTariffs] = React.useState(false);
  const { selectedService, setSelectedService, isServicesLoading, isLoading, services } = engine;
  const isTariffLoading = typeof isServicesLoading === 'boolean' ? isServicesLoading : isLoading;

  // RULE OF 3 (CRO Optimization): Group services into Economy, Hit (Recommended), and Premium
  const displayedServices = React.useMemo(() => {
    if (services.length <= 3 || showAllTariffs) return services;

    // Pick Economy (cheapest), Premium (most comprehensive), and Hit (popular middle)
    const sortedByPrice = [...services].sort((a, b) => a.pricePerUnitRub - b.pricePerUnitRub);
    const economy = sortedByPrice[0];
    const premium = sortedByPrice[sortedByPrice.length - 1];
    const hit = sortedByPrice[Math.floor(sortedByPrice.length / 2)];

    const result = [economy];
    if (hit && hit.id !== economy.id && hit.id !== premium.id) result.push(hit);
    if (premium && premium.id !== economy.id) result.push(premium);

    return result;
  }, [services, showAllTariffs]);

  if (!(currentStep === 3 || (currentStep !== 3 && !!selectedService)) || !shouldShowTariffs) {
    return null;
  }

  return (
    <motion.div
      id="step-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      ref={step3Ref}
      className="space-y-3 overflow-visible border-t border-border/30 pt-3 scroll-mt-20"
    >
      {currentStep === 3 ? (
        <>
          <div className="flex items-center justify-between pl-1">
            <span className="block text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">
              3. Выберите тариф • {selectedCategoryName}
            </span>
            <span className="text-[11px] font-bold text-primary">
              {isTariffLoading ? 'Загрузка...' : `${services.length} ${services.length === 1 ? 'тариф' : 'тарифов'}`}
            </span>
          </div>

          {isTariffLoading ? (
            <div className="grid grid-cols-1 gap-2.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 rounded-2xl bg-content2/70 animate-pulse border border-border/40" />
              ))}
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-6 px-4 bg-primary/5 rounded-2xl border border-primary/20 space-y-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
                <Lightbulb className="w-5 h-5 shrink-0" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">
                  В категории «{selectedCategoryName}» нет тарифов для вашей ссылки
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Наша система подобрала подходящие категории специально для вашего типа объекта.
                </p>
              </div>
              <div className="pt-1">
                <Button
                  type="button"
                  onClick={() => setActiveStep(2)}
                  className="w-full h-11 min-h-[44px] text-xs font-bold bg-primary text-primary-foreground rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 cursor-pointer active:scale-95"
                >
                  <span>Выбрать подходящую категорию</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {displayedServices.map((srv) => (
                <TariffCard
                  key={srv.id}
                  service={srv}
                  isSelected={selectedService?.id === srv.id}
                  onSelect={(s) => {
                    setSelectedService(s);
                    setActiveStep(4);
                  }}
                  brandStyle={brandStyle}
                />
              ))}

              {services.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllTariffs(!showAllTariffs)}
                  className="py-2 px-3 min-h-[44px] rounded-xl bg-content2 hover:bg-content3 text-[11px] font-extrabold text-primary border border-border/50 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] mt-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{showAllTariffs ? "Показать только рекомендуемые (3 тарифа)" : `Показать все ${services.length} тарифов ▾`}</span>
                </button>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              intent="outline"
              onClick={() => setActiveStep(2)}
              className="w-full text-xs font-bold h-11 min-h-[44px] rounded-xl bg-content2 text-foreground border-border/40 hover:bg-content3 cursor-pointer"
            >
              Назад
            </Button>
            {!!selectedService && (
              <Button
                type="button"
                onClick={() => setActiveStep(4)}
                className="w-full text-xs font-bold h-11 min-h-[44px] rounded-xl bg-primary text-primary-foreground cursor-pointer"
              >
                К оформлению →
              </Button>
            )}
          </div>
        </>
      ) : (
        !!selectedService && (
          <button
            type="button"
            onClick={() => setActiveStep(3)}
            className="w-full text-left p-3 bg-content2 hover:bg-content3 border border-border/40 rounded-2xl flex items-center justify-between transition-all cursor-pointer active:scale-[0.99]"
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[10px] text-muted-foreground uppercase font-extrabold tracking-wider">3. Выбранный тариф</span>
              <span className="text-xs font-bold text-foreground truncate min-w-0">
                {selectedService.name}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 rotate-90" />
          </button>
        )
      )}
    </motion.div>
  );
}
