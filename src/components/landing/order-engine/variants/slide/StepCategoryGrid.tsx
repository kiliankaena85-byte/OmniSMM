'use client';

import React from "react";
import { ArrowRightIcon } from "lucide-react";
import { motion, type Variants } from "framer-motion";
import type { PublicNetwork, PublicCategory } from "@/actions/order/catalog";
import { CategoryIcon, cleanCategoryName } from "@/components/ui/CategoryIcon";
import { matchesSuggestedCategory } from "@/services/analyzer/category-matcher";

export interface StepCategoryGridProps {
  activeNetwork: PublicNetwork;
  suggestedCategories: string[];
  detectedType: string | null;
  onSelectCategory: (cat: PublicCategory) => void;
  onResetCategoryFilter: () => void;
  containerVariants: Variants;
  itemVariants: Variants;
}

export function StepCategoryGrid({
  activeNetwork,
  suggestedCategories,
  detectedType,
  onSelectCategory,
  onResetCategoryFilter,
  containerVariants,
  itemVariants,
}: StepCategoryGridProps) {
  const availableCategories = activeNetwork.categories || [];
  const filteredCategories = (suggestedCategories.length > 0 || detectedType)
    ? availableCategories.filter(c => matchesSuggestedCategory(c.name, suggestedCategories, undefined, detectedType))
    : [];
  const displayCategories = filteredCategories.length > 0 ? filteredCategories : availableCategories;

  return (
    <div className="w-full max-w-3xl">
      <div className="flex items-center justify-between mb-5 px-1">
        <div>
          <div className="flex items-center gap-2">
            {activeNetwork.icon && (
              <img src={activeNetwork.icon} alt="" className="w-5 h-5 object-contain" />
            )}
            <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
              {activeNetwork.name}: выберите категорию
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {filteredCategories.length > 0 
              ? "Показаны категории, подходящие к вашей ссылке" 
              : "Выберите нужный тип активности"}
          </p>
        </div>

        {filteredCategories.length > 0 && filteredCategories.length < availableCategories.length && (
          <button
            type="button"
            onClick={onResetCategoryFilter}
            className="text-xs text-primary font-semibold hover:underline cursor-pointer"
          >
            Все {availableCategories.length} категорий
          </button>
        )}
      </div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3"
      >
        {displayCategories.map((cat) => (
          <motion.div
            key={cat.id}
            variants={itemVariants}
            role="button"
            tabIndex={0}
            onClick={() => onSelectCategory(cat)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectCategory(cat);
              }
            }}
            className="p-3.5 sm:p-4 rounded-2xl bg-card border border-border/80 hover:border-primary/60 hover:bg-primary/5 shadow-sm hover:shadow-md transition-all flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <CategoryIcon name={cat.name} size={20} />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-foreground text-sm sm:text-base truncate min-w-0">
                  {cleanCategoryName(cat.name)}
                </h4>
                {cat.serviceCount !== undefined && cat.serviceCount > 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    {cat.serviceCount} тарифов
                  </span>
                )}
              </div>
            </div>

            <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
              <ArrowRightIcon className="w-3.5 h-3.5" />
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
