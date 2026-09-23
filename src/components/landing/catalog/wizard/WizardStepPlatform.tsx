'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CatalogPlatform } from '../catalog-data';

interface WizardStepPlatformProps {
  platforms: CatalogPlatform[];
  selectedPlatform: CatalogPlatform;
  onSelectPlatform: (platform: CatalogPlatform) => void;
}

export function WizardStepPlatform({
  platforms,
  selectedPlatform,
  onSelectPlatform,
}: WizardStepPlatformProps) {
  return (
    <motion.div
      key="step-1"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
          Шаг 1: Выберите социальную сеть
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Выберите целевую платформу для запуска продвижения
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {platforms.map((platform) => {
          const isSelected = platform.id === selectedPlatform.id;
          const Icon = platform.icon;

          return (
            <button
              key={platform.id}
              type="button"
              className={`flex items-center gap-3.5 p-4 min-h-[44px] rounded-2xl border text-left transition-all duration-200 group hover:shadow-md ${
                isSelected
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-border bg-card hover:border-primary/40'
              }`}
              onClick={() => onSelectPlatform(platform)}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-tr ${platform.color} text-white shadow-sm shrink-0 group-hover:scale-105 transition-transform`}
              >
                <Icon className="w-5 h-5 shrink-0" />
              </div>
              <div className="truncate min-w-0">
                <div className="font-extrabold text-foreground text-sm sm:text-base tracking-tight">
                  {platform.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {platform.categories.length} категорий
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
