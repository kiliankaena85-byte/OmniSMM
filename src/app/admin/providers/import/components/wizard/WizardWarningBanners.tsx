'use client';

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { CategoryItem } from '../../types';
import type { MixedTypeWarning } from './types';

interface WizardWarningBannersProps {
  error: string | null;
  onClearError: () => void;
  success: string | null;
  onClearSuccess: () => void;
  missingCategoryIds: Set<string>;
  bulkCategory: string;
  localCategories: CategoryItem[];
  onAssignMissingToBulk: () => void;
  showMixedTypeWarning: boolean;
  mixedTypeWarnings: MixedTypeWarning[];
  onProceedMixedImport: () => void;
  onCancelMixedImport: () => void;
}

export function WizardWarningBanners({
  error,
  onClearError,
  success,
  onClearSuccess,
  missingCategoryIds,
  bulkCategory,
  onAssignMissingToBulk,
  showMixedTypeWarning,
  mixedTypeWarnings,
  onProceedMixedImport,
  onCancelMixedImport,
}: WizardWarningBannersProps) {
  return (
    <>
      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <div className="flex items-center gap-2">
              {missingCategoryIds.size > 0 && bulkCategory && (
                <button
                  type="button"
                  onClick={onAssignMissingToBulk}
                  className="px-3 py-1.5 rounded-lg bg-destructive text-white text-xs font-bold hover:opacity-90 transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                >
                  Назначить всем нераспределённым ({missingCategoryIds.size})
                </button>
              )}
              <button
                onClick={onClearError}
                className="p-1 hover:bg-destructive/20 rounded-lg transition-colors cursor-pointer"
                title="Закрыть"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-medium flex items-center justify-between gap-3">
          <span>{success}</span>
          <button
            onClick={onClearSuccess}
            className="p-1 hover:bg-emerald-500/20 rounded-lg transition-colors cursor-pointer"
            title="Закрыть"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {showMixedTypeWarning && mixedTypeWarnings.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/8 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                ⚠️ Обнаружено смешение типов услуг в одной категории
              </p>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/70 mt-1">
                Вы импортируете услуги разных типов (подписчики, реакции, лайки и т.д.) в одну категорию.
                Это приведёт к тому, что в визарде заказа пользователь увидит всё вперемешку.
              </p>
              <div className="mt-3 space-y-2">
                {mixedTypeWarnings.map((w, wi) => (
                  <div key={wi} className="bg-amber-500/10 rounded-lg p-3">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1.5">
                      Категория: «{w.targetCategoryName}»
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {w.types.map((t, ti) => (
                        <span
                          key={ti}
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                          title={`Примеры: ${t.examples.join(', ')}`}
                        >
                          {t.normCategory} ({t.count} шт)
                        </span>
                      ))}
                    </div>
                    <p className="text-[10px] text-amber-600/70 dark:text-amber-400/60 mt-1.5">
                      💡 Рекомендация: создайте отдельные категории (Подписчики {w.targetCategoryName.split(' ').pop()}, Реакции {w.targetCategoryName.split(' ').pop()}) или запустите скрипт исправления данных.
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={onProceedMixedImport}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors cursor-pointer"
                >
                  Всё равно импортировать
                </button>
                <button
                  onClick={onCancelMixedImport}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                >
                  Отмена — исправить категории
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
