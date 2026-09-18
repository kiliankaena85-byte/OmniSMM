'use client';

import React from 'react';
import { Mail } from 'lucide-react';
import { PublicNetwork, PublicService } from '@/actions/order/catalog';
import { PricingResult } from '@/services/marketing.service';
import { PlanCheckoutLink } from './PlanCheckoutLink';
import { PlanCheckoutQuantity } from './PlanCheckoutQuantity';
import { PlanCheckoutCustomData } from './PlanCheckoutCustomData';
import { PlanCheckoutPromo } from './PlanCheckoutPromo';

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
  compatibilityWarning?: string | null;
  isLinkOverridden?: boolean;
  setIsLinkOverridden?: (val: boolean) => void;
  promoCode?: string;
  setPromoCode?: (code: string) => void;
  isCalculating?: boolean;
  pricing?: PricingResult | null;
  pricingError?: 'voucher' | null;
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
  compatibilityWarning,
  isLinkOverridden,
  setIsLinkOverridden,
  promoCode = '',
  setPromoCode,
  isCalculating = false,
  pricing = null,
  pricingError = null,
}: PlanCheckoutInputsProps) {
  return (
    <div className="space-y-5">
      {/* 1. Ссылка */}
      <PlanCheckoutLink
        url={url}
        setUrl={setUrl}
        selectedService={selectedService}
        activeNetwork={activeNetwork}
        linkInputRef={linkInputRef}
        setLocalError={setLocalError}
        compatibilityWarning={compatibilityWarning}
        isLinkOverridden={isLinkOverridden}
        setIsLinkOverridden={setIsLinkOverridden}
      />

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

      {/* 4. Промокод */}
      {setPromoCode && (
        <PlanCheckoutPromo
          promoCode={promoCode}
          setPromoCode={setPromoCode}
          isCalculating={isCalculating}
          pricing={pricing}
          pricingError={pricingError}
          setLocalError={setLocalError}
        />
      )}
    </div>
  );
}
