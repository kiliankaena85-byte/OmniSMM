'use client';

import React from "react";
import { Box } from "lucide-react";
import { PublicNetwork } from "@/actions/order/catalog";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { UniversalOrderForm } from "@/components/orders/UniversalOrderForm";
import { PlatformSelectorFallback } from "@/components/orders/PlatformSelectorFallback";
import { MobileWizard } from "./order-engine/MobileWizard";
import { NetworkSelector } from "./order-engine/NetworkSelector";
import { CategorySidebar } from "./order-engine/CategorySidebar";
import { ServiceGrid } from "./order-engine/ServiceGrid";
import { DynamicPayloadWarnings } from "./order-engine/DynamicPayloadWarnings";
import { IntelligencePlatform } from "@/services/analyzer/link-rules";
import { useCheckoutOrchestrator } from "./order-engine/useCheckoutOrchestrator";

export interface LandingCatalogContentProps {
  engine: OrderEngine;
  orchestrator: ReturnType<typeof useCheckoutOrchestrator>;
  initialEmail?: string;
  unfilteredCatalog: PublicNetwork[];
  showSmartCart: boolean;
  setShowSmartCart: (val: boolean) => void;
  desktopEmailInputRef: React.RefObject<HTMLInputElement | null>;
  mobileEmailInputRef: React.RefObject<HTMLInputElement | null>;
  setIsGuideOpen: (val: boolean) => void;
  setActiveLegalSlug: (slug: string | null) => void;
  setShowCatalogModal: (val: boolean) => void;
  userBalanceCents: number;
}

export function LandingCatalogContent({
  engine,
  orchestrator,
  initialEmail,
  unfilteredCatalog,
  showSmartCart,
  setShowSmartCart,
  desktopEmailInputRef,
  mobileEmailInputRef,
  setIsGuideOpen,
  setActiveLegalSlug,
  setShowCatalogModal,
  userBalanceCents,
}: LandingCatalogContentProps) {
  const { url, selectedService, setSelectedService, quantity, setQuantity, pricing, email, setEmail, networkId, services, isLoading } = engine;
  const {
    isSubmitting, handleCheckout, emailHasError, quantityHasError, termsHasError, setShowLinkModal, checkoutError
  } = orchestrator;

  const checkoutVariantProps = React.useMemo(() => ({
    selectedService, url, setShowLinkModal, quantity, setQuantity, pricing,
    email, setEmail, promoCode: engine.promoCode, setPromoCode: engine.setPromoCode,
    isCalculating: engine.isCalculating, isSubmitting, handleCheckout,
    onClose: () => setSelectedService(null),
    emailInputRef: desktopEmailInputRef,
    emailHasError, quantityHasError, termsHasError, engine,
    onOpenDocument: setActiveLegalSlug, userBalanceCents
  }), [
    selectedService, url, setShowLinkModal, quantity, setQuantity, pricing,
    email, setEmail, engine, isSubmitting, handleCheckout,
    setSelectedService, desktopEmailInputRef, emailHasError, quantityHasError, termsHasError,
    setActiveLegalSlug, userBalanceCents
  ]);

  const availablePlatforms = React.useMemo(() => unfilteredCatalog.map(net => {
    let platformEnum = IntelligencePlatform.OTHER;
    const slugUpper = net.slug.toUpperCase();
    if (slugUpper.includes('TELEGRAM')) platformEnum = IntelligencePlatform.TELEGRAM;
    else if (slugUpper.includes('YOUTUBE')) platformEnum = IntelligencePlatform.YOUTUBE;
    else if (slugUpper.includes('INSTAGRAM')) platformEnum = IntelligencePlatform.INSTAGRAM;
    else if (slugUpper.includes('TIKTOK')) platformEnum = IntelligencePlatform.TIKTOK;
    else if (slugUpper.includes('VK')) platformEnum = IntelligencePlatform.VK;
    else if (slugUpper.includes('TWITCH')) platformEnum = IntelligencePlatform.TWITCH;
    else if (slugUpper.includes('TWITTER') || slugUpper === 'X') platformEnum = IntelligencePlatform.TWITTER;
    else if (slugUpper.includes('LIKEE')) platformEnum = IntelligencePlatform.LIKEE;
    return { id: net.id, name: platformEnum };
  }).filter(p => p.name !== IntelligencePlatform.OTHER), [unfilteredCatalog]);

  if (unfilteredCatalog.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 border-2 border-dashed border-border/50 bg-gradient-to-b from-content2/80 to-content1 rounded-2xl min-h-[360px] p-8 m-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center animate-bounce">
          <Box className="w-8 h-8 text-primary/60" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-lg font-extrabold text-foreground">Каталог временно недоступен</p>
          <p className="text-sm text-muted-foreground max-w-md leading-relaxed mx-auto text-pretty">
            В настоящий момент мы обновляем список услуг и проводим техническое обслуживание. Пожалуйста, зайдите немного позже или обратитесь в поддержку.
          </p>
        </div>
      </div>
    );
  }

  if (showSmartCart || engine.isMassMode) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <UniversalOrderForm 
          userEmail={initialEmail} 
          initialText={engine.url}
          onEmpty={() => {
            setShowSmartCart(false);
            engine.setUrl("");
          }}
        />
      </div>
    );
  }

  return (
    <>
      {url.trim().length >= 5 && !isLoading && (!engine.platform || !networkId) && !engine.manualPlatform && (
        <div className="mb-4 animate-in fade-in duration-300 w-full max-w-4xl mx-auto relative z-20">
          <PlatformSelectorFallback
            onSelect={engine.setManualPlatform}
            availablePlatforms={availablePlatforms}
          />
        </div>
      )}

      <div id="catalog-section" className="w-full bg-content1 rounded-3xl overflow-x-hidden overflow-y-visible md:overflow-hidden mt-2 md:mt-6">
        <div className="w-full flex flex-col">
          <MobileWizard 
            engine={engine} 
            handleCheckout={handleCheckout} 
            isSubmitting={isSubmitting} 
            emailInputRef={mobileEmailInputRef}
            emailHasError={emailHasError}
            onOpenGuide={() => setIsGuideOpen(true)}
            onOpenDocument={setActiveLegalSlug}
            onOpenCatalog={() => setShowCatalogModal(true)}
            checkoutError={checkoutError}
            userBalanceCents={userBalanceCents}
          />

          <NetworkSelector engine={engine} />

          <div className="hidden md:flex flex-col lg:flex-row min-h-[400px] border-b border-border/50 relative items-start">
            <CategorySidebar engine={engine} />

            <div className="flex flex-col flex-1 min-w-0 border-r border-border/50 pb-12 lg:pb-0">
              <div className="p-4 md:p-6 lg:p-8 bg-content1 relative flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-4 md:mb-6 shrink-0">
                  <h3 className="font-extrabold text-foreground text-xl md:text-2xl tracking-tight flex items-center gap-3">
                    Выберите тариф {services.length > 0 && <span className="text-sm font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">{services.length}</span>}
                  </h3>
                </div>

                {services.length === 0 && isLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-8 pt-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="w-full flex flex-col p-5 md:p-6 min-h-[400px] bg-content2 border border-border/50 shadow-sm animate-pulse rounded-[2rem]" />
                    ))}
                  </div>
                ) : services.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 border-2 border-dashed border-border/50 bg-gradient-to-b from-content2/80 to-content1 rounded-2xl min-h-[320px] p-8">
                    <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center">
                      <Box className="w-5 h-5 text-primary/60 shrink-0" />
                    </div>
                    <div className="text-center space-y-1.5">
                      <p className="text-base font-bold text-foreground">
                        {!networkId ? 'Выберите платформу' : !engine.categoryId ? 'Выберите категорию' : 'Услуги не найдены'}
                      </p>
                      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed text-pretty">
                        {!networkId
                          ? 'Вставьте ссылку на профиль/пост выше, или выберите нужную соцсеть из списка.'
                          : !engine.categoryId
                          ? 'Выберите нужную категорию услуг в меню слева.'
                          : 'В этой категории пока нет доступных услуг. Попробуйте выбрать другую.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className={`pb-8 pt-4 transition-opacity duration-300 hidden md:block ${isLoading && services.length === 0 ? 'opacity-50' : 'opacity-100'}`}>
                    <ServiceGrid 
                      engine={engine} 
                      checkoutProps={checkoutVariantProps}
                    />
                  </div>
                )}
              </div>

              <DynamicPayloadWarnings engine={engine} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
