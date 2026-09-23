'use client';

import React from 'react';
import { PublicService } from '@/actions/order/catalog';

export interface PlanCheckoutCustomDataProps {
  selectedService: PublicService;
  isWarningConfirmed: boolean;
  setIsWarningConfirmed: (val: boolean) => void;
  customData: string;
  setCustomData: (val: string) => void;
  setLocalError: (err: string | null) => void;
}

export function PlanCheckoutCustomData({
  selectedService,
  isWarningConfirmed,
  setIsWarningConfirmed,
  customData,
  setCustomData,
  setLocalError,
}: PlanCheckoutCustomDataProps) {
  return (
    <>
      {/* Warning / Client Requirement Checkbox */}
      {(selectedService.clientRequirement || selectedService.clientConfirmation || selectedService.requireWarning) && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isWarningConfirmed}
              onChange={(e) => {
                setIsWarningConfirmed(e.target.checked);
                setLocalError(null);
              }}
              className="w-4 h-4 rounded text-primary focus:ring-primary mt-0.5 cursor-pointer"
            />
            <span className="text-foreground font-medium leading-relaxed">
              {selectedService.warningMessage || selectedService.clientRequirement || 'Подтверждаю, что мой канал/профиль открыт и ссылка верна'}
            </span>
          </label>
        </div>
      )}

      {/* Custom Data Textarea */}
      {selectedService.customDataType && selectedService.customDataType !== 'NONE' && (
        <div id="field-customData" className="space-y-1.5">
          <label className="block text-xs font-black text-foreground uppercase tracking-wider">
            {selectedService.customDataLabel || 'Дополнительные данные'}
            <span className="text-destructive font-bold ml-1">*</span>
          </label>
          <textarea
            value={customData}
            onChange={(e) => {
              setCustomData(e.target.value);
              setLocalError(null);
            }}
            placeholder="Укажите текст комментариев, ответы или параметры услуги"
            className="w-full h-20 p-3 rounded-2xl bg-background border border-border/80 focus:border-primary outline-none text-xs text-foreground resize-none transition-all"
          />
        </div>
      )}
    </>
  );
}
