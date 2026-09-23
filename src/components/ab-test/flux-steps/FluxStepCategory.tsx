'use client';

import React from "react";
import { ArrowRightIcon } from "lucide-react";
import { motion, type Variants } from "framer-motion";
import type { FluxNetwork, FluxCategory } from "@/types/flux";
import { CategoryIcon, cleanCategoryName } from "@/components/ui/CategoryIcon";
import { matchesSuggestedCategory } from "@/services/analyzer/category-matcher";

export interface FluxStepCategoryProps {
  activeNetwork: FluxNetwork;
  suggestedCategories: string[];
  detectedType: string | null;
  onSelectCategory: (cat: FluxCategory) => void;
  containerVariants: Variants;
  itemVariants: Variants;
}

export function FluxStepCategory({
  activeNetwork,
  suggestedCategories,
  detectedType,
  onSelectCategory,
  containerVariants,
  itemVariants,
}: FluxStepCategoryProps) {
  const availableCategories = activeNetwork.categories || [];
  const filteredCategories = (suggestedCategories.length > 0 || detectedType)
    ? availableCategories.filter(c => matchesSuggestedCategory(c.name, suggestedCategories, undefined, detectedType))
    : [];
  const displayCategories = filteredCategories.length > 0 ? filteredCategories : availableCategories;

  return (
    <div className="w-full transform-gpu">
      <div className="mb-6 w-full">
        <div className="flex items-center gap-3 mb-6">
          <img 
            src={activeNetwork.icon || undefined} 
            alt={activeNetwork.name} 
            className="w-8 h-8 object-contain" 
            loading="lazy"
            decoding="async"
          />
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Выберите категорию</h2>
        </div>
      </div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5"
      >
        {displayCategories.map((cat: FluxCategory) => (
          <motion.div 
            key={cat.id}
            role="button"
            tabIndex={0}
            variants={itemVariants}
            onClick={() => onSelectCategory(cat)}
            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectCategory(cat); } }}
            className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] border border-white/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-md hover:shadow-xl hover:border-primary/50 transition-all duration-150 flex items-center justify-between group transform-gpu hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <div className="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <CategoryIcon name={cat.name} icon={cat.icon} size={18} />
              </div>
              <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-base sm:text-lg truncate">{cleanCategoryName(cat.name)}</h4>
            </div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/5 group-hover:bg-primary flex items-center justify-center transition-colors shrink-0">
              <ArrowRightIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary group-hover:text-primary-foreground" />
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
