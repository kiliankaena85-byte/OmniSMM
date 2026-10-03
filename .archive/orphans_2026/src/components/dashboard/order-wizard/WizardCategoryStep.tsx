'use client';

import React from 'react';
import { PublicCategory } from '@/actions/order/catalog';
import { Layers, ChevronLeft } from 'lucide-react';

interface WizardCategoryStepProps {
  categories: PublicCategory[];
  selectedCategory: PublicCategory | null;
  onSelectCategory: (cat: PublicCategory) => void;
  onBack: () => void;
  networkName: string;
}

export function WizardCategoryStep({
  categories,
  selectedCategory,
  onSelectCategory,
  onBack,
  networkName,
}: WizardCategoryStepProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 shrink-0" /> Назад к выбору соцсети
        </button>
        <span className="text-xs font-extrabold text-primary bg-primary/10 px-3 py-1 rounded-full">
          {networkName}
        </span>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-foreground">Выберите категорию продвижения:</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {categories.map((cat) => {
            const isSelected = selectedCategory?.id === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(cat)}
                className={`p-4 rounded-2xl border text-left flex items-center gap-3.5 transition-all duration-200 ${
                  isSelected
                    ? 'bg-primary/10 border-primary text-primary shadow-md'
                    : 'bg-card/75 border-border/30 hover:border-primary/30 hover:bg-card text-foreground'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-background flex items-center justify-center shrink-0 border border-border/40 text-primary">
                  <Layers className="w-4 h-4 shrink-0" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-xs block truncate min-w-0">{cat.name}</span>
                  <span className="text-[10px] text-muted-foreground font-medium block">
                    Доступно для заказа
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
