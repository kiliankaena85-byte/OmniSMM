'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftIcon, ArrowRightIcon, Layers } from 'lucide-react';
import type { FluxNetwork, FluxCategory } from '@/types/flux';
import { matchesSuggestedCategory } from '@/services/analyzer/category-matcher';
import { slideVariants, containerVariants, itemVariants } from './types';

interface FluxDashboardStepCategoryProps {
  direction: number;
  activeNetwork: FluxNetwork;
  suggestedCategories: string[];
  detectedType: string | null;
  onNavigateBack: () => void;
  onSelectCategory: (category: FluxCategory) => void;
}

export function FluxDashboardStepCategory({
  direction,
  activeNetwork,
  suggestedCategories,
  detectedType,
  onNavigateBack,
  onSelectCategory
}: FluxDashboardStepCategoryProps) {
  const availableCategories = activeNetwork.categories || [];
  const filteredCategories = (suggestedCategories.length > 0 || detectedType)
    ? availableCategories.filter(c => matchesSuggestedCategory(c.name, suggestedCategories, undefined, detectedType))
    : [];
  const displayCategories = filteredCategories.length > 0 ? filteredCategories : availableCategories;

  return (
    <motion.div
      key="step-category"
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className="w-full space-y-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={activeNetwork.icon || undefined}
            alt={activeNetwork.name}
            className="w-8 h-8 object-contain"
            loading="lazy"
            decoding="async"
          />
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">Выберите категорию</h2>
            <p className="text-xs text-muted-foreground font-medium">Платформа: {activeNetwork.name}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onNavigateBack}
          className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer"
        >
          <ArrowLeftIcon className="w-3.5 h-3.5" /> Сменить сеть
        </button>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
      >
        {displayCategories.map((cat) => (
          <motion.div
            key={cat.id}
            role="button"
            tabIndex={0}
            variants={itemVariants}
            whileHover={{ y: -3, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            onClick={() => onSelectCategory(cat)}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectCategory(cat);
              }
            }}
            className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary p-4 sm:p-5 rounded-[1.5rem] border border-border/40 bg-card/85 backdrop-blur-md hover:bg-card hover:border-primary/50 hover:shadow-lg transition-colors duration-150 flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4 shrink-0" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-foreground text-sm block truncate group-hover:text-primary transition-colors min-w-0">
                  {cat.name}
                </span>
                {typeof cat.serviceCount === 'number' && cat.serviceCount > 0 && (
                  <span className="text-[10px] font-medium text-muted-foreground block">
                    {cat.serviceCount} услуг
                  </span>
                )}
              </div>
            </div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/5 group-hover:bg-primary flex items-center justify-center transition-colors">
              <ArrowRightIcon className="w-3.5 h-3.5 text-primary group-hover:text-primary-foreground" />
            </div>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}
