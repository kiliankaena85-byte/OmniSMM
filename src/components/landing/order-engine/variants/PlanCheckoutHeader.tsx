'use client';

import React from 'react';
import { ArrowLeft, X, Sparkles, Clock } from 'lucide-react';
import { PublicNetwork, PublicService } from '@/actions/order/catalog';

function formatEtaSpeedBadge(service: PublicService): string {
  if (service.speed && service.speed.trim()) {
    return service.speed;
  }
  return 'Моментально (до 15 мин)';
}

export interface PlanCheckoutHeaderProps {
  selectedService: PublicService;
  activeNetwork: PublicNetwork | null;
  activeCategory: { id: string; name: string } | null;
  minQty: number;
  maxQty: number;
  onBackClick: () => void;
  onResetClick: () => void;
}

export function PlanCheckoutHeader({
  selectedService,
  activeNetwork,
  activeCategory,
  minQty,
  maxQty,
  onBackClick,
  onResetClick,
}: PlanCheckoutHeaderProps) {
  return (
    <>
      {/* ── TOP NAVIGATION BAR ── */}
      <div className="w-full max-w-2xl sm:max-w-3xl flex items-center justify-between mb-4 sm:mb-6 p-2.5 sm:p-3 rounded-2xl bg-card border border-border/80 shadow-md">
        <button
          type="button"
          onClick={onBackClick}
          className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl hover:bg-muted text-foreground text-xs sm:text-sm font-extrabold transition-all cursor-pointer active:scale-95 shadow-xs"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          <span>Назад к тарифам</span>
        </button>

        <div className="flex items-center gap-2 px-2 min-w-0">
          {activeNetwork?.icon && (
            <img src={activeNetwork.icon} alt="" className="w-5 h-5 object-contain shrink-0" />
          )}
          <span className="font-extrabold text-xs sm:text-sm text-foreground truncate">
            {activeNetwork?.name || 'Каталог'} {activeCategory ? `• ${activeCategory.name}` : ''}
          </span>
        </div>

        <button
          type="button"
          onClick={onResetClick}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-bold transition-all cursor-pointer active:scale-95 shrink-0"
          title="Сбросить выбор услуги"
        >
          <X className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Сброс</span>
        </button>
      </div>

      {/* ── TARIFF RECAP HEADER ── */}
      <div className="mb-5 pb-5 border-b border-border/60 flex flex-col sm:flex-row justify-between items-start gap-3">
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-black uppercase tracking-wider mb-2">
            <Sparkles className="w-3 h-3" />
            Выбранный тариф
          </span>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-foreground leading-tight tracking-tight">
            {selectedService.name}
          </h1>
        </div>

        <div className="sm:text-right shrink-0">
          <span className="text-2xl sm:text-3xl font-black text-primary font-mono block tabular-nums">
            {selectedService.pricePerUnitRub.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ₽
          </span>
          <span className="text-xs text-muted-foreground font-medium block">
            за 1 шт.
          </span>
        </div>
      </div>

      {/* Tariff Description */}
      {selectedService.description && (
        <div className="mb-5 p-3.5 rounded-2xl bg-muted/50 border border-border/50 text-xs sm:text-[13px] text-muted-foreground leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
          {selectedService.description}
        </div>
      )}

      {/* Speed / Limits Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-6">
        <div className="p-3 rounded-2xl bg-muted/30 border border-border/50">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-bold mb-0.5">
            Мин. заказ
          </p>
          <p className="font-extrabold text-sm sm:text-base text-foreground font-mono">
            {minQty} шт.
          </p>
        </div>

        <div className="p-3 rounded-2xl bg-muted/30 border border-border/50">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-bold mb-0.5">
            Макс. заказ
          </p>
          <p className="font-extrabold text-sm sm:text-base text-foreground font-mono">
            {maxQty.toLocaleString('ru-RU')} шт.
          </p>
        </div>

        <div className="p-3 rounded-2xl bg-muted/30 border border-border/50 col-span-2 sm:col-span-1">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-bold mb-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3 text-emerald-500" />
            Старт / Скорость
          </p>
          <p className="font-bold text-xs sm:text-sm text-foreground truncate">
            {formatEtaSpeedBadge(selectedService)}
          </p>
        </div>
      </div>
    </>
  );
}
