'use client';

import React from "react";
import type { PublicService } from "@/actions/order/catalog";

export interface DripAndCustomDataSectionProps {
  selectedService: PublicService;
  numericQuantity: number;
  isDripFeedEnabled: boolean;
  setIsDripFeedEnabled: (val: boolean) => void;
  dripRuns: number;
  setDripRuns: (val: number) => void;
  dripInterval: number;
  setDripInterval: (val: number) => void;
  customData: string;
  setCustomData: (val: string) => void;
  isRequirementsConfirmed: boolean;
  setIsRequirementsConfirmed: (val: boolean) => void;
}

export function DripAndCustomDataSection({
  selectedService,
  numericQuantity,
  isDripFeedEnabled,
  setIsDripFeedEnabled,
  dripRuns,
  setDripRuns,
  dripInterval,
  setDripInterval,
  customData,
  setCustomData,
  isRequirementsConfirmed,
  setIsRequirementsConfirmed,
}: DripAndCustomDataSectionProps) {
  return (
    <>
      {/* 2. Drip-feed Option */}
      {selectedService.isDripFeedEnabled && (
        <div className="mb-4 p-3.5 rounded-2xl bg-muted/40 border border-border/70">
          <label className="text-xs font-bold text-foreground cursor-pointer flex items-center gap-2">
            <input
              type="checkbox"
              checked={isDripFeedEnabled}
              onChange={(e) => setIsDripFeedEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-primary focus:ring-primary"
            />
            <span>Постепенная накрутка (Drip-Feed)</span>
          </label>

          {isDripFeedEnabled && (
            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border/40 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1">Количество запусков</label>
                <input
                  type="number"
                  min={2}
                  max={100}
                  value={dripRuns}
                  onChange={(e) => setDripRuns(parseInt(e.target.value) || 2)}
                  className="w-full h-9 px-2 rounded-lg bg-background border border-border font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">Интервал (мин)</label>
                <input
                  type="number"
                  min={10}
                  max={1440}
                  value={dripInterval}
                  onChange={(e) => setDripInterval(parseInt(e.target.value) || 60)}
                  className="w-full h-9 px-2 rounded-lg bg-background border border-border font-mono text-xs"
                />
              </div>
              <p className="col-span-2 text-xs text-muted-foreground font-medium">
                Заказ выполнится за {dripRuns} запусков по {dripRuns > 0 ? Math.floor(numericQuantity / dripRuns) : 0} шт. Всего: <strong className="text-foreground">{numericQuantity} шт.</strong>
              </p>
            </div>
          )}
        </div>
      )}

      {/* 3. Custom Data Input (if required) */}
      {selectedService.customDataType && selectedService.customDataType !== "NONE" && (
        <div id="field-customData" className="mb-4">
          <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
            {selectedService.customDataLabel || "Дополнительные данные"}
          </label>
          <textarea
            value={customData}
            onChange={(e) => setCustomData(e.target.value)}
            placeholder="Укажите комментарии, текст или параметры услуги"
            className="w-full h-20 p-3 rounded-xl bg-background border border-border/80 focus:border-primary outline-none text-xs text-foreground resize-none"
          />
        </div>
      )}

      {/* 4. Client Requirement Confirmation */}
      {(selectedService.clientRequirement || selectedService.clientConfirmation || selectedService.requireWarning) && (
        <div id="field-requirement" className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isRequirementsConfirmed}
              onChange={(e) => setIsRequirementsConfirmed(e.target.checked)}
              className="w-4 h-4 rounded text-primary focus:ring-primary mt-0.5"
            />
            <span className="text-foreground leading-relaxed">
              {selectedService.warningMessage || selectedService.clientRequirement || "Подтверждаю, что мой канал/профиль открыт и ссылка верна"}
            </span>
          </label>
        </div>
      )}
    </>
  );
}
