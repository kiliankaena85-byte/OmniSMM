'use client';

import React from 'react';
import type { FluxService } from '@/types/flux';

interface FluxCheckoutCustomDataAndRequirementsProps {
  selectedService: FluxService;
  customData: string;
  setCustomData: (data: string) => void;
  customDataRef: React.RefObject<HTMLTextAreaElement | null>;
  isRequirementsConfirmed: boolean;
  setIsRequirementsConfirmed: (confirmed: boolean) => void;
  requirementRef: React.RefObject<HTMLDivElement | null>;
  email: string;
  setEmail: (email: string) => void;
  emailRef: React.RefObject<HTMLInputElement | null>;
  errorField: string | null;
  shakeKey: number;
}

export function FluxCheckoutCustomDataAndRequirements({
  selectedService,
  customData,
  setCustomData,
  customDataRef,
  isRequirementsConfirmed,
  setIsRequirementsConfirmed,
  requirementRef,
  email,
  setEmail,
  emailRef,
  errorField,
  shakeKey,
}: FluxCheckoutCustomDataAndRequirementsProps) {
  return (
    <>
      {/* Custom Data Field */}
      {selectedService.customDataType && selectedService.customDataType !== 'NONE' && (
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-foreground">
            {selectedService.customDataLabel || 'Параметры заказа (текст/комментарии)'}
          </label>
          <textarea
            ref={customDataRef}
            rows={3}
            value={customData}
            onChange={(e) => setCustomData(e.target.value)}
            placeholder="Введите каждый комментарий с новой строки..."
            className={`w-full bg-background border ${
              errorField === 'customData' ? 'border-destructive animate-shake' : 'border-border/60 focus:border-primary'
            } rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground`}
            key={errorField === 'customData' ? `cd-${shakeKey}` : 'cd-ok'}
          />
        </div>
      )}

      {/* Requirement Checkbox */}
      {(selectedService.clientRequirement || selectedService.clientConfirmation || selectedService.requireWarning) && (
        <div
          ref={requirementRef}
          className={`p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 ${
            errorField === 'requirement' ? 'animate-shake' : ''
          }`}
          key={errorField === 'requirement' ? `req-${shakeKey}` : 'req-ok'}
        >
          <input
            type="checkbox"
            id="req-confirm"
            checked={isRequirementsConfirmed}
            onChange={(e) => setIsRequirementsConfirmed(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded accent-primary cursor-pointer"
          />
          <label htmlFor="req-confirm" className="text-xs text-amber-700 dark:text-amber-300 font-medium leading-tight cursor-pointer">
            {selectedService.clientRequirement || selectedService.clientConfirmation || 'Я подтверждаю, что мой аккаунт/канал открыт и соответствует правилам сервиса.'}
          </label>
        </div>
      )}

      {/* Email Field */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-foreground">Email для чека и уведомлений</label>
        <input
          ref={emailRef}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className={`w-full h-12 px-4 bg-background border ${
            errorField === 'email' ? 'border-destructive animate-shake' : 'border-border/60 focus:border-primary'
          } rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground transition-all`}
          key={errorField === 'email' ? `email-${shakeKey}` : 'email-ok'}
        />
      </div>
    </>
  );
}
