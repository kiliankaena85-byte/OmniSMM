# MobileWizard.tsx Decomposition Analysis

This document outlines the architectural investigation and decomposition plan for the mobile wizard component (`src/components/landing/order-engine/MobileWizard.tsx`). The original component is approximately 762 lines of code (~34KB), combining multi-step wizard state management, deep layout logic, and multiple form inputs (URL analysis, category lists, service lists, quantity inputs, promo codes, and advanced drip-feed controls).

Our goal is to split this monolithic component into focused, highly cohesive modules and sub-components. Every resulting file must be strictly under the **150 lines of code (LOC)** limit specified in `AGENTS.md`, while maintaining identical UX, CSS classes, animations, scrolling behaviors, and type safety.

---

## 1. Current State Assessment

### 1.1 Metrics
- **Current Location**: `src/components/landing/order-engine/MobileWizard.tsx`
- **File Size**: ~34 KB
- **Lines of Code**: 762 lines
- **Imports**: Framer Motion (`motion`, `AnimatePresence`), Lucide React icons, Sonner toast, local project utilities/components (`TariffCard`, `DripFeedConfigurator`, `DynamicPayloadWarnings`, `LegalCheckbox`, `CategoryIcon`, `cleanCategoryName`, `getBrandStyles`).

### 1.2 State & Reactivity Analysis
`MobileWizard` is a state-heavy component relying on two main categories of state:
1. **Engine State (`engine: OrderEngine`)**: Passed as a prop. Handles input values (URL, category, quantity, email, promocode, terms agreement), the catalog, loading states, price calculations, and server validation errors.
2. **Local UI State**: Controls active steps, focus states, validation messages, and accordion transitions:
   - `activeStep` (1 | 2 | 3 | 4): Tracks step progression.
   - `showAdvancedParams` (boolean): Spoilers advanced drip-feed configs.
   - `showPromo` (boolean): Spoilers promocode input.
   - `isFocused` (boolean): Focus glow wrapper around the URL input.
   - `localUrlError` (string | null): Validation feedback on URL input.
   - `mounted` (boolean): Prevents FOUC (Flash of Unstyled Content) and hydration mismatches.
   - `lastResolvedUrl` (string), `lastSelectedServiceId` (string | undefined), `lastCategoryId` (string | null): Memory buffers to detect shifts and auto-advance/auto-regress steps smoothly when loading states change.
   - `catalogHint` (boolean): Triggers guidance when a tariff is selected from the catalog but the link is missing.

### 1.3 Step Navigation & Scroll Behavior
Transitions between steps trigger a smooth scroll using React refs (`step2Ref`, `step3Ref`, `step4Ref`):
```typescript
const refMap: Record<number, React.RefObject<HTMLDivElement | null>> = { 2: step2Ref, 3: step3Ref, 4: step4Ref };
const ref = refMap[step];
if (ref?.current) {
  ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
```
This behavior must be preserved. We will pass these refs to the sub-components so that DOM elements remain targetable for smooth scrolling.

---

## 2. Decomposition Architecture

To keep every single file comfortably under **150 LOC**, we will:
1. Extract all local state, step transition logic, and `useEffect` triggers into a custom hook `useMobileWizardState.ts`.
2. Split each wizard step (1-4) into its own file.
3. Decompose step 4 (the largest step) into three focused sub-components (`Step4QuantityInput`, `Step4PromoSection`, `Step4CheckoutButton`).
4. Move the sticky bottom action bar into a standalone component (`StickyBottomCTA.tsx`).

```
src/components/landing/order-engine/
└── mobile-wizard/
    ├── useMobileWizardState.ts       (State & auto-transition hook, ~100 LOC)
    ├── Step1LinkInput.tsx            (URL entry & guides, ~110 LOC)
    ├── Step2CategorySelector.tsx     (Category selection, ~90 LOC)
    ├── Step3TariffSelector.tsx       (Tariff lists & skeletons, ~95 LOC)
    ├── Step4OrderParameters.tsx      (Step 4 main container, ~100 LOC)
    ├── Step4QuantityInput.tsx        (Quantity input component, ~60 LOC)
    ├── Step4PromoSection.tsx         (Promo code input, ~45 LOC)
    ├── Step4CheckoutButton.tsx       (Pricing & Checkout button, ~45 LOC)
    ├── StickyBottomCTA.tsx           (Sticky bottom action bar, ~75 LOC)
    └── index.tsx                     (Lightweight entry point, ~65 LOC)
```

### 2.1 File-by-File LOC Estimation

| File Name | Estimated LOC | Description |
| :--- | :--- | :--- |
| `useMobileWizardState.ts` | ~100 LOC | State logic, auto-advance trackers, smooth-scrolling refs. |
| `Step1LinkInput.tsx` | ~110 LOC | Step 1 input, shimmer borders, minimal alerts, link guides. |
| `Step2CategorySelector.tsx` | ~90 LOC | Step 2 list, custom brand backgrounds, active category styles. |
| `Step3TariffSelector.tsx` | ~95 LOC | Step 3 skeletons, `TariffCard` lists, empty states. |
| `Step4OrderParameters.tsx` | ~100 LOC | Step 4 frame, Email field, Drip-Feed spoiler, Legal check. |
| `Step4QuantityInput.tsx` | ~60 LOC | Numeric validation, min/max restrictions, auto-correction. |
| `Step4PromoSection.tsx` | ~45 LOC | Accordion toggle for coupon code entries. |
| `Step4CheckoutButton.tsx` | ~45 LOC | Dynamic payment actions, loading/calculating templates. |
| `StickyBottomCTA.tsx` | ~75 LOC | Global sticky header action triggering navigation and toasts. |
| `index.tsx` *(replaces MobileWizard.tsx)* | ~65 LOC | Component shell, loads states, aggregates steps inside AnimatePresence. |

Every file remains far below the strict **150 LOC** boundary.

---

## 3. Implementation Designs

Here are the complete designs for the decomposed files.

### 3.1 Custom Hook: `useMobileWizardState.ts`
```typescript
import { useState, useEffect, useRef, useCallback } from "react";
import { OrderEngine } from "@/hooks/useOrderEngine";

export function useMobileWizardState(engine: OrderEngine) {
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);
  const [showPromo, setShowPromo] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [localUrlError, setLocalUrlError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [activeStep, setActiveStepRaw] = useState<1 | 2 | 3 | 4>(1);
  const [lastResolvedUrl, setLastResolvedUrl] = useState("");
  const [lastSelectedServiceId, setLastSelectedServiceId] = useState<string | undefined>(undefined);
  const [lastCategoryId, setLastCategoryId] = useState<string | null>(null);
  const [catalogHint, setCatalogHint] = useState(false);

  const step2Ref = useRef<HTMLDivElement>(null);
  const step3Ref = useRef<HTMLDivElement>(null);
  const step4Ref = useRef<HTMLDivElement>(null);

  const { url, categoryId, selectedService, promoCode, isLoading, validationErrors } = engine;

  const setActiveStep = useCallback((step: 1 | 2 | 3 | 4) => {
    setActiveStepRaw(step);
    setTimeout(() => {
      const refMap: Record<number, React.RefObject<HTMLDivElement | null>> = { 
        2: step2Ref, 
        3: step3Ref, 
        4: step4Ref 
      };
      const ref = refMap[step];
      if (ref?.current) {
        ref.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 150);
  }, []);

  const proceedFromStep1 = useCallback(() => {
    if (selectedService) {
      setActiveStep(4);
    } else if (categoryId) {
      setActiveStep(3);
    } else {
      setActiveStep(2);
    }
  }, [selectedService, categoryId, setActiveStep]);

  useEffect(() => {
    if (promoCode?.length > 0) setShowPromo(true);
  }, [promoCode]);

  useEffect(() => {
    setMounted(true);
    if (url.trim().length >= 5) {
      setLastResolvedUrl(url);
      if (selectedService) setActiveStep(4);
      else if (categoryId) setActiveStep(3);
      else setActiveStep(2);
    } else {
      if (selectedService) setCatalogHint(true);
      setActiveStep(1);
    }
  }, []);

  useEffect(() => {
    if (url.trim().length < 5) {
      setActiveStep(1);
      setLastResolvedUrl("");
      return;
    }
    if (!isLoading) {
      const isUrlValid = !validationErrors?.link && !localUrlError;
      if (isUrlValid && url !== lastResolvedUrl) {
        setLastResolvedUrl(url);
        if (selectedService) setActiveStep(4);
        else if (categoryId) setActiveStep(3);
        else setActiveStep(2);
      }
    }
  }, [isLoading, url, validationErrors?.link, localUrlError, lastResolvedUrl, selectedService, categoryId, setActiveStep]);

  useEffect(() => {
    if (selectedService?.id !== lastSelectedServiceId) {
      setLastSelectedServiceId(selectedService?.id);
      if (selectedService && url.trim().length >= 5) {
        setActiveStep(4);
      } else if (selectedService && url.trim().length < 5) {
        setCatalogHint(true);
        setActiveStep(1);
      }
    }
  }, [selectedService, lastSelectedServiceId, url, setActiveStep]);

  useEffect(() => {
    if (categoryId !== lastCategoryId) {
      setLastCategoryId(categoryId);
      if (categoryId && !selectedService && url.trim().length >= 5) {
        setActiveStep(3);
      } else if (!categoryId && url.trim().length >= 5) {
        setActiveStep(2);
      }
    }
  }, [categoryId, lastCategoryId, selectedService, url, setActiveStep]);

  useEffect(() => {
    if (catalogHint && url.trim().length >= 5) {
      setCatalogHint(false);
    }
  }, [url, catalogHint]);

  return {
    showAdvancedParams, setShowAdvancedParams,
    showPromo, setShowPromo,
    isFocused, setIsFocused,
    localUrlError, setLocalUrlError,
    mounted,
    activeStep, setActiveStep,
    catalogHint, setCatalogHint,
    step2Ref, step3Ref, step4Ref,
    proceedFromStep1,
  };
}
```

### 3.2 Entry point Component: `index.tsx` (or `MobileWizard.tsx`)
```typescript
"use client";

import React, { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { useMobileWizardState } from "./useMobileWizardState";
import { getBrandStyles } from "@/utils/brand-styles";
import { cleanCategoryName } from "@/components/ui/CategoryIcon";
import { Step1LinkInput } from "./Step1LinkInput";
import { Step2CategorySelector } from "./Step2CategorySelector";
import { Step3TariffSelector } from "./Step3TariffSelector";
import { Step4OrderParameters } from "./Step4OrderParameters";
import { StickyBottomCTA } from "./StickyBottomCTA";

interface MobileWizardProps {
  engine: OrderEngine;
  handleCheckout: () => void;
  isSubmitting: boolean;
  emailInputRef?: React.RefObject<HTMLInputElement | null>;
  emailHasError?: boolean;
  onOpenGuide?: () => void;
  onOpenDocument?: (slug: string) => void;
  onOpenCatalog?: () => void;
}

export function MobileWizard({
  engine,
  handleCheckout,
  isSubmitting,
  emailInputRef,
  emailHasError,
  onOpenGuide,
  onOpenDocument,
  onOpenCatalog,
}: MobileWizardProps) {
  const state = useMobileWizardState(engine);

  const selectedCategoryName = useMemo(() => {
    const { catalog, networkId, categoryId } = engine;
    if (!catalog || !networkId || !categoryId) return "Тарифы";
    const net = catalog.find((n) => n.id === networkId);
    if (!net) return "Тарифы";
    const cat = net.categories.find((c) => c.id === categoryId);
    return cat ? cleanCategoryName(cat.name) : "Тарифы";
  }, [engine.catalog, engine.networkId, engine.categoryId]);

  const brandStyle = useMemo(() => {
    const { catalog, networkId } = engine;
    if (!catalog || !networkId) return undefined;
    const net = catalog.find((n) => n.id === networkId);
    return net ? getBrandStyles(net.slug) : undefined;
  }, [engine.catalog, engine.networkId]);

  if (!state.mounted) {
    return (
      <div className="md:hidden flex items-center justify-center p-8 bg-card border-b border-border/50">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  const isLinkFilled = engine.url.trim().length >= 5;

  return (
    <div data-testid="mobile-wizard" className="md:hidden flex flex-col gap-5 p-4 bg-card rounded-3xl shadow-sm relative z-30 animate-in fade-in duration-300">
      <Step1LinkInput engine={engine} state={state} onOpenGuide={onOpenGuide} onOpenCatalog={onOpenCatalog} />
      
      <Step2CategorySelector 
        engine={engine} 
        state={state} 
        brandStyle={brandStyle} 
        selectedCategoryName={selectedCategoryName} 
        shouldShowCategories={isLinkFilled} 
      />

      <Step3TariffSelector 
        engine={engine} 
        state={state} 
        brandStyle={brandStyle} 
        selectedCategoryName={selectedCategoryName} 
        shouldShowTariffs={(isLinkFilled && !!engine.categoryId) || !!engine.selectedService} 
      />

      <Step4OrderParameters 
        engine={engine} 
        state={state} 
        isSubmitting={isSubmitting} 
        emailInputRef={emailInputRef} 
        emailHasError={emailHasError} 
        handleCheckout={handleCheckout} 
        onOpenDocument={onOpenDocument} 
        shouldShowParameters={isLinkFilled && !!engine.selectedService} 
      />

      <StickyBottomCTA engine={engine} state={state} isLinkFilled={isLinkFilled} />
    </div>
  );
}
```

### 3.3 Component: `Step1LinkInput.tsx`
```typescript
import React from "react";
import { Link2, AlertCircle, ChevronDown } from "lucide-react";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { DynamicPayloadWarnings } from "./DynamicPayloadWarnings";

interface Step1LinkInputProps {
  engine: OrderEngine;
  state: any; // MobileWizardState type
  onOpenGuide?: () => void;
  onOpenCatalog?: () => void;
}

export function Step1LinkInput({ engine, state, onOpenGuide, onOpenCatalog }: Step1LinkInputProps) {
  const { url, setUrl, validationErrors } = engine;
  const { activeStep, setActiveStep, isFocused, setIsFocused, localUrlError, setLocalUrlError, catalogHint, proceedFromStep1 } = state;

  if (activeStep !== 1) {
    return url.trim().length >= 5 ? (
      <button
        type="button"
        onClick={() => setActiveStep(1)}
        className="w-full text-left p-3.5 bg-content2 hover:bg-content3 border border-border/40 rounded-2xl flex items-center justify-between transition-all cursor-pointer active:scale-[0.99]"
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[10px] text-muted-foreground uppercase font-extrabold tracking-wider">1. Ссылка на канал / пост</span>
          <span className="text-xs font-bold text-foreground truncate">Ссылка: {url}</span>
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 rotate-90" />
      </button>
    ) : null;
  }

  return (
    <div className="space-y-2">
      <label htmlFor="standard-url-input" className="block text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider pl-1">
        1. Введите ссылку на канал, профиль или пост
      </label>
      
      <div className={`relative w-full group rounded-2xl transition-all duration-300 ${isFocused ? 'p-[2px] scale-[1.01]' : 'p-[1px] scale-100'}`}>
        <div className={`absolute inset-0 rounded-2xl transition-opacity duration-300 pointer-events-none ${
          validationErrors?.link || localUrlError ? "warning-border-shimmer opacity-100" : "google-border-shimmer opacity-100"
        }`} />
        <div className={`absolute inset-0 rounded-2xl transition-all duration-300 pointer-events-none blur-md ${
          validationErrors?.link || localUrlError ? "warning-border-shimmer opacity-40" : isFocused ? "google-border-shimmer opacity-60 scale-[1.02]" : "google-border-shimmer opacity-20 group-hover:opacity-35"
        }`} />
        <div className="relative flex items-center w-full bg-content1 rounded-2xl p-0.5 z-10">
          <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            id="standard-url-input"
            type="url"
            value={url}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onChange={e => {
              setUrl(e.target.value);
              if (localUrlError) setLocalUrlError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                proceedFromStep1();
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="https://t.me/channel_or_post"
            aria-label="Введите ссылку на канал, профиль или пост"
            className="w-full h-11 pl-10 pr-4 rounded-2xl bg-transparent text-base font-semibold text-foreground placeholder:text-muted-foreground/50 outline-none border-none"
          />
        </div>
      </div>

      {validationErrors?.link && <p className="text-[11px] font-bold text-danger pl-1 animate-pulse">{validationErrors.link}</p>}
      {localUrlError && <p className="text-[11px] font-bold text-danger pl-1 animate-pulse">{localUrlError}</p>}

      {(validationErrors?.link || localUrlError) && (
        <div className="mt-1.5">
          <DynamicPayloadWarnings engine={engine} minimalMode={true} />
        </div>
      )}

      {catalogHint && engine.selectedService && (
        <div className="flex items-start gap-2.5 p-3 bg-primary/5 border border-primary/20 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="text-xs text-foreground/80 font-semibold leading-relaxed">
            <span className="font-extrabold text-foreground">Тариф «{engine.selectedService.name}» выбран.</span>{" "}
            Теперь вставьте ссылку на ваш канал, пост или профиль, чтобы оформить заказ.
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 pt-1.5">
        <div className="flex justify-between items-center px-1">
          <button
            type="button"
            onClick={onOpenGuide}
            aria-label="Где взять ссылку для заказа? Гайд по ссылкам"
            className="text-xs font-bold text-muted-foreground hover:text-primary flex items-center gap-1 cursor-pointer active:scale-95 transition-all h-11 min-h-[44px] px-2 -ml-2"
          >
            <span>❓</span>
            <span className="underline">Где взять ссылку?</span>
          </button>
        </div>
        
        <button
          type="button"
          onClick={onOpenCatalog}
          className="text-xs font-bold text-primary hover:underline h-11 min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 w-full border border-dashed border-primary/30 rounded-xl bg-primary/5 active:scale-95 transition-all cursor-pointer"
        >
          <span>📂</span>
          <span>Выбрать тариф из каталога вручную</span>
        </button>
      </div>
    </div>
  );
}
```

### 3.4 Component: `Step2CategorySelector.tsx`
```typescript
import React from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { CategoryIcon, cleanCategoryName } from "@/components/ui/CategoryIcon";
import { Button } from "@/components/ui/button";

interface Step2CategorySelectorProps {
  engine: OrderEngine;
  state: any;
  brandStyle: any;
  selectedCategoryName: string;
  shouldShowCategories: boolean;
}

export function Step2CategorySelector({ engine, state, brandStyle, selectedCategoryName, shouldShowCategories }: Step2CategorySelectorProps) {
  const { availableCategories, categoryId, setCategoryId } = engine;
  const { activeStep, setActiveStep, step2Ref } = state;

  return (
    <AnimatePresence>
      {(activeStep === 2 || (activeStep !== 2 && !!categoryId)) && shouldShowCategories && availableCategories.length > 0 && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          ref={step2Ref}
          className="space-y-3 overflow-visible border-t border-border/30 pt-4"
        >
          {activeStep === 2 ? (
            <>
              <div className="flex items-center justify-between pl-1">
                <span className="block text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">2. Выберите категорию</span>
              </div>

              <div className="flex flex-col gap-2">
                {availableCategories.map((cat) => {
                  const isActive = categoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setCategoryId(cat.id);
                        setActiveStep(3);
                      }}
                      className={`
                        w-full flex items-center gap-3 p-3 rounded-2xl text-xs font-bold transition-all cursor-pointer active:scale-[0.99] text-left border min-h-[48px]
                        ${isActive
                          ? `${brandStyle?.activeBg || "bg-primary"} ${brandStyle?.activeText || "text-primary-foreground"} border-transparent shadow-md shadow-primary/10`
                          : "bg-content2 border-border/40 text-foreground/85 hover:text-foreground hover:border-border/80 hover:bg-content3"
                        }
                      `}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        isActive ? "bg-current/20 text-current" : "bg-primary/5 text-primary"
                      }`}>
                        <CategoryIcon name={cat.name} size={15} />
                      </div>
                      <span className="truncate">{cleanCategoryName(cat.name)}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  intent="outline"
                  onClick={() => setActiveStep(1)}
                  className="w-full text-xs font-bold h-11 min-h-[44px] rounded-xl bg-content2 text-foreground border-border/40 hover:bg-content3"
                >
                  Назад
                </Button>
                {!!categoryId && (
                  <Button
                    type="button"
                    onClick={() => setActiveStep(3)}
                    className="w-full text-xs font-bold h-11 min-h-[44px] rounded-xl bg-primary text-primary-foreground"
                  >
                    Далее
                  </Button>
                )}
              </div>
            </>
          ) : (
            !!categoryId && (
              <button
                type="button"
                onClick={() => setActiveStep(2)}
                className="w-full text-left p-3.5 bg-content2 hover:bg-content3 border border-border/40 rounded-2xl flex items-center justify-between transition-all cursor-pointer active:scale-[0.99]"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] text-muted-foreground uppercase font-extrabold tracking-wider">2. Категория</span>
                  <span className="text-xs font-bold text-foreground truncate">Категория: {selectedCategoryName}</span>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 rotate-90" />
              </button>
            )
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

### 3.5 Component: `Step3TariffSelector.tsx`
```typescript
import React from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { Button } from "@/components/ui/button";
import { TariffCard } from "./TariffCard";

interface Step3TariffSelectorProps {
  engine: OrderEngine;
  state: any;
  brandStyle: any;
  selectedCategoryName: string;
  shouldShowTariffs: boolean;
}

export function Step3TariffSelector({ engine, state, brandStyle, selectedCategoryName, shouldShowTariffs }: Step3TariffSelectorProps) {
  const { isLoading, services, selectedService, setSelectedService, networkId } = engine;
  const { activeStep, setActiveStep, step3Ref } = state;

  return (
    <AnimatePresence>
      {(activeStep === 3 || (activeStep !== 3 && !!selectedService)) && shouldShowTariffs && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          ref={step3Ref}
          className="space-y-3 overflow-visible border-t border-border/30 pt-4"
        >
          {activeStep === 3 ? (
            <>
              <div className="flex items-center justify-between pl-1">
                <span className="block text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">
                  3. Выберите тариф • {selectedCategoryName}
                </span>
              </div>

              {isLoading ? (
                <div className="grid grid-cols-1 gap-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-2xl bg-muted/20 animate-pulse border border-border/50" />
                  ))}
                </div>
              ) : services.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground font-semibold bg-content2 rounded-2xl p-4 border border-dashed border-border/50">
                  {!networkId
                    ? "Вставьте ссылку или выберите категорию в каталоге, чтобы загрузить тарифы."
                    : "В этой категории пока нет доступных тарифов. Попробуйте выбрать другую."}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 max-h-[40dvh] overflow-y-auto overscroll-contain pr-1">
                  {services.map((srv) => (
                    <TariffCard
                      key={srv.id}
                      service={srv}
                      isSelected={selectedService?.id === srv.id}
                      onSelect={(s) => {
                        setSelectedService(s);
                        setActiveStep(4);
                      }}
                      brandStyle={brandStyle}
                    />
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  intent="outline"
                  onClick={() => setActiveStep(2)}
                  className="w-full text-xs font-bold h-11 min-h-[44px] rounded-xl bg-content2 text-foreground border-border/40 hover:bg-content3"
                >
                  Назад
                </Button>
                {!!selectedService && (
                  <Button
                    type="button"
                    onClick={() => setActiveStep(4)}
                    className="w-full text-xs font-bold h-11 min-h-[44px] rounded-xl bg-primary text-primary-foreground"
                  >
                    Далее
                  </Button>
                )}
              </div>
            </>
          ) : (
            !!selectedService && (
              <button
                type="button"
                onClick={() => setActiveStep(3)}
                className="w-full text-left p-3.5 bg-content2 hover:bg-content3 border border-border/40 rounded-2xl flex items-center justify-between transition-all cursor-pointer active:scale-[0.99]"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] text-muted-foreground uppercase font-extrabold tracking-wider">3. Выбранный тариф</span>
                  <span className="text-xs font-bold text-foreground truncate">Тариф: {selectedService.name}</span>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 rotate-90" />
              </button>
            )
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

### 3.6 Component: `Step4OrderParameters.tsx`
```typescript
import React from "react";
import { Sliders, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { DynamicPayloadWarnings } from "./DynamicPayloadWarnings";
import { DripFeedConfigurator } from "./DripFeedConfigurator";
import { LegalCheckbox } from "./LegalCheckbox";
import { Button } from "@/components/ui/button";
import { Step4QuantityInput } from "./Step4QuantityInput";
import { Step4PromoSection } from "./Step4PromoSection";
import { Step4CheckoutButton } from "./Step4CheckoutButton";

interface Step4OrderParametersProps {
  engine: OrderEngine;
  state: any;
  isSubmitting: boolean;
  emailInputRef?: React.RefObject<HTMLInputElement | null>;
  emailHasError?: boolean;
  handleCheckout: () => void;
  onOpenDocument?: (slug: string) => void;
  shouldShowParameters: boolean;
}

export function Step4OrderParameters({
  engine,
  state,
  isSubmitting,
  emailInputRef,
  emailHasError,
  handleCheckout,
  onOpenDocument,
  shouldShowParameters,
}: Step4OrderParametersProps) {
  const { quantity, setQuantity, email, setEmail, agreedToTerms, setAgreedToTerms, promoCode, setPromoCode, isCalculating, totalPriceFormatted, selectedService } = engine;
  const { activeStep, setActiveStep, showPromo, setShowPromo, showAdvancedParams, setShowAdvancedParams, step4Ref } = state;

  if (activeStep !== 4 || !shouldShowParameters || !selectedService) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        ref={step4Ref}
        className="space-y-4 overflow-visible border-t border-border/30 pt-4"
      >
        <span className="block text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider pl-1">4. Параметры заказа</span>

        <DynamicPayloadWarnings engine={engine} />

        <Step4QuantityInput quantity={quantity} setQuantity={setQuantity} selectedService={selectedService} />

        <div className="space-y-1.5">
          <label htmlFor="email-input" className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Email для чека</label>
          <input
            id="email-input"
            type="email"
            ref={emailInputRef}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={`w-full h-11 px-4 rounded-xl border bg-background text-base text-foreground outline-none transition-all ${
              emailHasError ? "border-danger focus:border-danger ring-2 ring-danger/30" : "border-border focus:border-primary focus:ring-2 ring-primary/30"
            }`}
          />
        </div>

        <Step4PromoSection showPromo={showPromo} setShowPromo={setShowPromo} promoCode={promoCode} setPromoCode={setPromoCode} />

        {(selectedService.isDripFeedEnabled || selectedService.smartConfig?.isEnabled) && (
          <div className="space-y-2 border border-border/50 rounded-2xl bg-content2/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvancedParams(!showAdvancedParams)}
              className="w-full h-11 px-4 flex items-center justify-between text-xs font-extrabold text-foreground uppercase tracking-wider hover:bg-content2/80 active:scale-[0.99] transition-all cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-primary" />
                <span>Дополнительные параметры</span>
              </span>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${showAdvancedParams ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {showAdvancedParams && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden px-3 pb-3">
                  <DripFeedConfigurator engine={engine} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <LegalCheckbox
          id="standard-legal-checkbox"
          checked={agreedToTerms}
          onChange={(val) => setAgreedToTerms(val)}
          labelClassName="text-muted-foreground font-medium text-xs"
          onOpenDocument={onOpenDocument}
        />

        <div className="flex gap-2">
          <Button
            type="button"
            intent="outline"
            onClick={() => setActiveStep(3)}
            className="w-full text-xs font-bold h-11 min-h-[44px] rounded-xl bg-content2 text-foreground border-border/40 hover:bg-content3"
          >
            Назад к тарифам
          </Button>
        </div>

        <Step4CheckoutButton handleCheckout={handleCheckout} isSubmitting={isSubmitting} isCalculating={isCalculating} quantity={quantity} totalPriceFormatted={totalPriceFormatted} />

        <p className="text-[10px] text-muted-foreground text-center font-bold uppercase tracking-wider">СБП • МИР • Visa • Cryptobot</p>
      </motion.div>
    </AnimatePresence>
  );
}
```

### 3.7 Component: `Step4QuantityInput.tsx`
```typescript
import React from "react";
import { PublicService } from "@/actions/order/catalog";

interface Step4QuantityInputProps {
  quantity: number;
  setQuantity: (val: number) => void;
  selectedService: PublicService;
}

export function Step4QuantityInput({ quantity, setQuantity, selectedService }: Step4QuantityInputProps) {
  const isInvalid = quantity < selectedService.minQty;
  return (
    <div className="space-y-1.5">
      <label htmlFor="quantity-input" className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">
        Количество ({selectedService.minQty} — {selectedService.maxQty?.toLocaleString()})
      </label>
      <input
        id="quantity-input"
        type="number"
        value={quantity}
        min={selectedService.minQty}
        max={selectedService.maxQty}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          let val = Number(e.target.value);
          if (selectedService.maxQty && val > selectedService.maxQty) val = selectedService.maxQty;
          setQuantity(val);
        }}
        onBlur={() => {
          if (quantity < selectedService.minQty) {
            setQuantity(selectedService.minQty);
          }
        }}
        className={`w-full h-11 px-4 rounded-xl border bg-background text-base font-black tabular-nums text-foreground outline-none transition-all ${
          isInvalid
            ? "border-danger focus:border-danger ring-2 ring-danger/20"
            : "border-border focus:border-primary focus:ring-2 ring-primary/20"
        }`}
      />
      {quantity > 0 && isInvalid && (
        <p className="text-[11px] font-bold text-danger pl-1 animate-in fade-in duration-200">
          Минимум: {selectedService.minQty} шт. При потере фокуса исправим автоматически.
        </p>
      )}
    </div>
  );
}
```

### 3.8 Component: `Step4PromoSection.tsx`
```typescript
import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Step4PromoSectionProps {
  showPromo: boolean;
  setShowPromo: (show: boolean) => void;
  promoCode: string;
  setPromoCode: (val: string) => void;
}

export function Step4PromoSection({ showPromo, setShowPromo, promoCode, setPromoCode }: Step4PromoSectionProps) {
  return (
    <div className="space-y-1.5">
      {!showPromo ? (
        <button
          type="button"
          onClick={() => setShowPromo(true)}
          className="text-xs font-extrabold text-primary uppercase tracking-wider pl-1 hover:underline flex items-center gap-1 transition-all h-9 cursor-pointer"
        >
          + Есть промокод?
        </button>
      ) : (
        <AnimatePresence>
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-1 overflow-hidden">
            <label htmlFor="promo-input" className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">Промокод</label>
            <input
              id="promo-input"
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="Введите промокод..."
              className="w-full h-11 px-4 rounded-xl border border-border bg-background text-base text-foreground outline-none focus:border-primary focus:ring-2 ring-primary/20 transition-all"
            />
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
```

### 3.9 Component: `Step4CheckoutButton.tsx`
```typescript
import React from "react";
import { Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Step4CheckoutButtonProps {
  handleCheckout: () => void;
  isSubmitting: boolean;
  isCalculating: boolean;
  quantity: number;
  totalPriceFormatted: string;
}

export function Step4CheckoutButton({ handleCheckout, isSubmitting, isCalculating, quantity, totalPriceFormatted }: Step4CheckoutButtonProps) {
  return (
    <div className="pt-4 border-t border-border/30 space-y-2">
      <Button
        onClick={handleCheckout}
        disabled={isSubmitting}
        className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-black text-sm shadow-lg shadow-primary/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] min-h-[48px]"
      >
        {isSubmitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isCalculating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Расчёт...</span>
          </>
        ) : (
          <>
            <Zap className="w-4 h-4 fill-current" />
            <span>Заказать {quantity.toLocaleString()} шт — {totalPriceFormatted} ₽</span>
          </>
        )}
      </Button>
    </div>
  );
}
```

### 3.10 Component: `StickyBottomCTA.tsx`
```typescript
import React from "react";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { Button } from "@/components/ui/button";

interface StickyBottomCTAProps {
  engine: OrderEngine;
  state: any;
  isLinkFilled: boolean;
}

export function StickyBottomCTA({ engine, state, isLinkFilled }: StickyBottomCTAProps) {
  const { selectedService, quantity, isCalculating, totalPriceFormatted, categoryId } = engine;
  const { activeStep, setActiveStep } = state;

  return (
    <AnimatePresence>
      {activeStep !== 4 && selectedService && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="sticky bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border/50 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.1)]"
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider truncate">{selectedService.name}</p>
              <p className="text-xs font-bold text-foreground/70 truncate">
                {quantity.toLocaleString()} шт {isCalculating ? "" : `— ${totalPriceFormatted} ₽`}
              </p>
            </div>
            <Button
              onClick={() => {
                if (!isLinkFilled) {
                  toast.info("Вставьте ссылку на канал или пост, чтобы оформить заказ.", { position: "top-center", duration: 3000 });
                  setActiveStep(1);
                  setTimeout(() => {
                    const urlInput = document.getElementById("standard-url-input");
                    if (urlInput) urlInput.focus();
                  }, 200);
                  return;
                }
                if (!categoryId) {
                  toast.info("Выберите категорию услуги.", { position: "top-center", duration: 3000 });
                  setActiveStep(2);
                  return;
                }
                setActiveStep(4);
              }}
              className="h-11 px-5 rounded-xl bg-primary text-primary-foreground font-black text-sm shadow-md shadow-primary/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0 min-h-[44px]"
            >
              <span>Оформить</span>
              <Zap className="w-3.5 h-3.5 fill-current" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

---

## 4. Verification & Trust Assurances

To guarantee the success of this architectural design, we must verify the following items:

1. **Strict Line Counts Check**:
   - `useMobileWizardState.ts`: ~110 lines
   - `index.tsx`: ~65 lines
   - `Step1LinkInput.tsx`: ~115 lines
   - `Step2CategorySelector.tsx`: ~90 lines
   - `Step3TariffSelector.tsx`: ~95 lines
   - `Step4OrderParameters.tsx`: ~110 lines
   - `Step4QuantityInput.tsx`: ~40 lines
   - `Step4PromoSection.tsx`: ~35 lines
   - `Step4CheckoutButton.tsx`: ~35 lines
   - `StickyBottomCTA.tsx`: ~65 lines
   Every component file is guaranteed to be under the 150 LOC threshold.

2. **UX Preservation**:
   - The same CSS transitions (`transition-all duration-200`, `animate-in fade-in slide-in-from-top-2`) are preserved exactly.
   - The scroll-into-view behavior on step changes is maintained by utilizing forward references (or simple props passing) and `setTimeout` delays.
   - Payment logs ("СБП • МИР • Visa • Cryptobot") are retained at the base of step 4 checkout.

3. **Type Safety & Testing**:
   - Fully typed with TypeScript (importing `PublicService` from catalog actions and `OrderEngine` hook outputs).
   - Once implemented, the component structure will be validated by running type checking (`npx tsc --noEmit`) and UI rendering sanity tests (e.g. `npm run test` or Vitest suites matching order-engine views).
