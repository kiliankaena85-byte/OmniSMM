'use client';

import React from 'react';
import { PublicService } from '@/actions/order/catalog';
import { ChevronLeft, Zap, ShieldCheck } from 'lucide-react';
import { formatEtaSpeedBadge } from '@/utils/format-eta';

interface WizardServiceStepProps {
  services: PublicService[];
  isLoadingServices: boolean;
  selectedService: PublicService | null;
  onSelectService: (srv: PublicService) => void;
  onBack: () => void;
  categoryName: string;
}

export function WizardServiceStep({
  services,
  isLoadingServices,
  selectedService,
  onSelectService,
  onBack,
  categoryName,
}: WizardServiceStepProps) {
  if (isLoadingServices) {
    return (
      <div className="p-12 text-center space-y-3">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-semibold text-muted-foreground">Загрузка доступных тарифов...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 shrink-0" /> Назад к выбору категории
        </button>
        <span className="text-xs font-extrabold text-primary bg-primary/10 px-3 py-1 rounded-full">
          {categoryName}
        </span>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-foreground">Выберите нужный тариф:</h3>
        <div className="space-y-3">
          {services.map((srv) => {
            const isSelected = selectedService?.id === srv.id;
            const pricePerUnit = srv.pricePerUnitRub || 0;
            const speedInfo = formatEtaSpeedBadge(srv);

            return (
              <div
                key={srv.id}
                onClick={() => onSelectService(srv)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 space-y-3 ${
                  isSelected
                    ? 'bg-primary/10 border-primary shadow-md'
                    : 'bg-card/75 border-border/30 hover:border-primary/30 hover:bg-card'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <h4 className="font-extrabold text-xs text-foreground leading-snug">{srv.name}</h4>
                    {srv.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{srv.description}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-sm font-black text-foreground">
                      {pricePerUnit.toFixed(2)} ₽ <span className="text-[10px] font-normal text-muted-foreground">/ шт</span>
                    </div>
                    <span className="text-[9px] font-semibold text-muted-foreground">
                      Мин: {srv.minQty} • Макс: {srv.maxQty}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/10 text-[10px] font-semibold">
                  <span className="inline-flex items-center gap-1 bg-muted px-2.5 py-0.5 rounded-lg text-muted-foreground">
                    <Zap className="w-3 h-3 text-amber-500 shrink-0" /> {speedInfo}
                  </span>
                  {srv.isRefillEnabled ? (
                    <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-lg border border-emerald-500/20">
                      <ShieldCheck className="w-3 h-3 shrink-0" /> Гарантия
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-muted px-2.5 py-0.5 rounded-lg text-muted-foreground">
                      Быстрый старт
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
