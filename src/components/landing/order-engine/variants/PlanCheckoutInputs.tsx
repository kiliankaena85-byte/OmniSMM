'use client';

import React from 'react';
import { Link as LinkIcon, X, Mail } from 'lucide-react';
import { PublicNetwork, PublicService } from '@/actions/order/catalog';
import { PlanCheckoutQuantity } from './PlanCheckoutQuantity';
import { PlanCheckoutCustomData } from './PlanCheckoutCustomData';

export interface PlanCheckoutInputsProps {
  url: string;
  setUrl: (url: string) => void;
  selectedService: PublicService;
  activeNetwork: PublicNetwork | null;
  linkInputRef: React.RefObject<HTMLInputElement | null>;
  emailInputRef: React.RefObject<HTMLInputElement | null>;
  quantityInputRef: React.RefObject<HTMLInputElement | null>;
  isWarningConfirmed: boolean;
  setIsWarningConfirmed: (val: boolean) => void;
  customData: string;
  setCustomData: (val: string) => void;
  quantity: number;
  setQuantity: (qty: number) => void;
  minQty: number;
  maxQty: number;
  effectiveMinQty: number;
  handleStepQuantity: (delta: number) => void;
  dripFeedEnabled: boolean;
  setDripFeedEnabled: (val: boolean) => void;
  runs: number;
  setRuns: (r: number) => void;
  dripInterval: number;
  setDripInterval: (i: number) => void;
  email: string;
  setEmail: (email: string) => void;
  setLocalError: (err: string | null) => void;
}

export function PlanCheckoutInputs({
  url,
  setUrl,
  selectedService,
  activeNetwork,
  linkInputRef,
  emailInputRef,
  quantityInputRef,
  isWarningConfirmed,
  setIsWarningConfirmed,
  customData,
  setCustomData,
  quantity,
  setQuantity,
  minQty,
  maxQty,
  effectiveMinQty,
  handleStepQuantity,
  dripFeedEnabled,
  setDripFeedEnabled,
  runs,
  setRuns,
  dripInterval,
  setDripInterval,
  email,
  setEmail,
  setLocalError,
}: PlanCheckoutInputsProps) {
  return (
    <div className="space-y-5">
      {/* 1. Ссылка */}
      <div id="field-link" className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="landing-url" className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <LinkIcon className="w-3.5 h-3.5 text-primary" />
            <span>Ссылка для заказа</span>
            <span className="text-destructive font-bold">*</span>
          </label>
          {activeNetwork && (
            <span className="text-[11px] font-bold text-primary">
              {activeNetwork.name}
            </span>
          )}
        </div>

        <div className="relative flex items-center">
          <input
            ref={linkInputRef}
            id="landing-url"
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setLocalError(null);
            }}
            placeholder={
              selectedService.linkPlaceholder ||
              (activeNetwork?.slug === 'telegram'
                ? 'https://t.me/channel или @channel'
                : activeNetwork?.slug === 'vk'
                ? 'https://vk.com/...'
                : activeNetwork?.slug === 'instagram'
                ? 'https://instagram.com/...'
                : 'Вставьте ссылку на канал, группу, профиль или пост')
            }
            className="w-full h-12 px-3.5 pr-10 rounded-2xl bg-background border border-border/80 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none font-bold text-base sm:text-sm text-foreground font-mono transition-all"
          />
          {url.trim().length > 0 && (
            <button
              type="button"
              onClick={() => setUrl('')}
              className="absolute right-3 w-6 h-6 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground flex items-center justify-center transition-colors cursor-pointer"
              title="Очистить ссылку"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground pl-1">
          {selectedService.linkHint || 'Укажите ссылку на открытый канал, группу или конкретный пост.'}
        </p>
      </div>

      {/* Warning & Custom Data */}
      <PlanCheckoutCustomData
        selectedService={selectedService}
        isWarningConfirmed={isWarningConfirmed}
        setIsWarningConfirmed={setIsWarningConfirmed}
        customData={customData}
        setCustomData={setCustomData}
        setLocalError={setLocalError}
      />

      {/* 2. Количество & Drip-Feed */}
      <PlanCheckoutQuantity
        quantity={quantity}
        setQuantity={setQuantity}
        quantityInputRef={quantityInputRef}
        minQty={minQty}
        maxQty={maxQty}
        effectiveMinQty={effectiveMinQty}
        handleStepQuantity={handleStepQuantity}
        selectedService={selectedService}
        dripFeedEnabled={dripFeedEnabled}
        setDripFeedEnabled={setDripFeedEnabled}
        runs={runs}
        setRuns={setRuns}
        dripInterval={dripInterval}
        setDripInterval={setDripInterval}
        setLocalError={setLocalError}
      />

      {/* 3. Email */}
      <div id="field-email" className="space-y-1.5">
        <label htmlFor="email-input" className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5 text-primary" />
          <span>Email для чека (54-ФЗ) и доступа</span>
          <span className="text-destructive font-bold">*</span>
        </label>
        <input
          ref={emailInputRef}
          id="email-input"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setLocalError(null);
          }}
          placeholder="example@mail.ru"
          className="w-full h-12 px-3.5 rounded-2xl bg-background border border-border/80 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none font-bold text-base sm:text-sm text-foreground transition-all"
        />
        <p className="text-[11px] text-muted-foreground pl-1">
          По закону 54-ФЗ фискальный чек об оплате и ссылка на статус заказа будут отправлены на этот адрес.
        </p>
      </div>
    </div>
  );
}
