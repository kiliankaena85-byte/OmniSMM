'use client';

import React, { useState } from "react";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { PublicService } from "@/actions/order/catalog";
import { LegalCheckbox } from "../LegalCheckbox";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { MobileCheckoutLinkField } from "./MobileCheckoutLinkField";
import { MobileCheckoutQuantity } from "./MobileCheckoutQuantity";

export interface MobileCheckoutInputsProps {
  engine: OrderEngine;
  selectedService: PublicService;
  linkConfig: {
    label?: string;
    badge?: string;
    placeholder?: string;
    hint?: string;
  };
  setActiveStep: (step: 1 | 2 | 3 | 4) => void;
  emailInputRef?: React.RefObject<HTMLInputElement | null>;
  emailHasError?: boolean;
  localError: string | null;
  setLocalError: (err: string | null) => void;
  onOpenDocument?: (slug: string) => void;
}

export function MobileCheckoutInputs({
  engine,
  selectedService,
  linkConfig,
  setActiveStep,
  emailInputRef,
  emailHasError,
  localError,
  setLocalError,
  onOpenDocument,
}: MobileCheckoutInputsProps) {
  const [showPromo, setShowPromo] = useState(false);

  const {
    email, setEmail,
    promoCode, setPromoCode,
    agreedToTerms, setAgreedToTerms,
  } = engine;

  React.useEffect(() => {
    if (promoCode && promoCode.length > 0) {
      setShowPromo(true);
    }
  }, [promoCode]);

  return (
    <div className="space-y-4">
      {/* Контекстная ссылка */}
      <MobileCheckoutLinkField
        engine={engine}
        linkConfig={linkConfig}
        setActiveStep={setActiveStep}
      />

      {/* Количество со степперами и Drip-Feed */}
      <MobileCheckoutQuantity
        engine={engine}
        selectedService={selectedService}
      />

      {/* Email */}
      <div className="space-y-1.5">
        <label htmlFor="email-input" className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">
          Email для отслеживания
        </label>
        <input
          id="email-input"
          type="email"
          ref={emailInputRef}
          value={email}
          onChange={e => {
            setEmail(e.target.value);
            if (localError) setLocalError(null);
          }}
          placeholder="you@example.com"
          className={`w-full h-11 px-4 rounded-2xl border bg-background text-base text-foreground outline-none transition-all ${
            emailHasError || (localError && (!email || !email.includes('@')))
              ? 'border-danger focus:border-danger ring-2 ring-danger/30 animate-shake'
              : 'border-border focus:border-primary focus:ring-2 ring-primary/30'
          }`}
        />
        {(emailHasError || (localError && (!email || !email.includes('@')))) && (
          <p className="text-[11px] font-bold text-danger pl-1 animate-in fade-in duration-200">
            Укажите email — на него придёт доступ к заказу
          </p>
        )}
      </div>

      {/* Промокод */}
      <div className="space-y-1.5">
        {!showPromo ? (
          <button
            type="button"
            onClick={() => setShowPromo(true)}
            className="text-xs font-extrabold text-primary uppercase tracking-wider pl-1 hover:underline flex items-center gap-1 transition-all h-11 min-h-[44px] cursor-pointer"
          >
            + Есть промокод?
          </button>
        ) : (
          <div className="space-y-1 animate-in fade-in duration-200">
            <label htmlFor="promo-input" className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">
              Промокод
            </label>
            <div className="relative">
              <input
                id="promo-input"
                type="text"
                value={promoCode}
                onChange={e => setPromoCode(e.target.value)}
                placeholder="Введите промокод..."
                className="w-full h-11 px-4 rounded-2xl border border-border bg-background text-base text-foreground outline-none focus:border-primary focus:ring-2 ring-primary/20 transition-all"
              />
            </div>
          </div>
        )}
      </div>

      {/* Согласие 152-ФЗ */}
      <LegalCheckbox
        id="standard-legal-checkbox"
        checked={agreedToTerms}
        onChange={(val) => {
          setAgreedToTerms(val);
          if (val && engine.setTermsHasError) engine.setTermsHasError(false);
        }}
        hasError={engine.termsHasError}
        labelClassName="text-muted-foreground font-medium text-xs"
        onOpenDocument={onOpenDocument}
      />

      <div className="flex items-center gap-2">
        <Button
          type="button"
          intent="outline"
          onClick={() => setActiveStep(3)}
          className="flex-1 text-xs font-bold h-11 min-h-[44px] rounded-xl bg-content2 text-foreground border-border/40 hover:bg-content3 cursor-pointer"
        >
          Назад к тарифам
        </Button>
        <Button
          type="button"
          intent="ghost"
          onClick={() => {
            engine.resetOrder();
            setActiveStep(1);
          }}
          className="text-xs font-bold h-11 min-h-[44px] rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer flex items-center gap-1.5 px-3 shrink-0"
          title="Сбросить выбранную услугу и ссылку"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Сбросить всё</span>
        </Button>
      </div>
    </div>
  );
}
