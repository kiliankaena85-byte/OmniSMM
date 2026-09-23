'use client';

import React, { Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { FluxNetwork } from "@/types/flux";
import { toast } from "sonner";
import { CheckoutAuthModal } from "@/components/landing/order-engine/modals/CheckoutAuthModal";
import { FluxStepLink } from "./flux-steps/FluxStepLink";
import { FluxStepNetwork } from "./flux-steps/FluxStepNetwork";
import { FluxStepCategory } from "./flux-steps/FluxStepCategory";
import { FluxStepService } from "./flux-steps/FluxStepService";
import { FluxStepCheckout } from "./flux-steps/FluxStepCheckout";
import { FluxNavHeader } from "./sub/FluxNavHeader";
import { slideVariants, containerVariants, itemVariants } from "./animations";
import { useFluxOrderClientState } from "./hooks/useFluxOrderClientState";

export interface FluxOrderClientProps {
  initialCatalog: FluxNetwork[];
  initialEmail?: string;
  tenantId?: string;
  userBalanceCents?: number;
}

export function FluxOrderClient(props: FluxOrderClientProps) {
  return (
    <Suspense fallback={<div className="min-h-[400px] flex items-center justify-center text-muted-foreground text-sm font-medium">Загрузка визарда...</div>}>
      <FluxOrderClientInner {...props} />
    </Suspense>
  );
}

function FluxOrderClientInner(props: FluxOrderClientProps) {
  const { initialCatalog = [], userBalanceCents = 0 } = props;
  const s = useFluxOrderClientState(props);

  return (
    <div className={`w-full max-w-4xl mx-auto flex flex-col items-center justify-center font-sans px-2 sm:px-4 relative overflow-visible ${s.step === 'link' ? 'pt-4 md:pt-8 pb-4' : 'min-h-[50vh] pt-2 pb-10'}`}>
      <FluxNavHeader step={s.step} link={s.link} activeNetwork={s.activeNetwork} onNavigate={s.navigateTo} />

      <AnimatePresence initial={false} custom={s.direction} mode="wait">
        {s.step === 'link' && (
          <motion.div key="step-link" custom={s.direction} variants={slideVariants} initial="enter" animate="center" exit="exit" className="w-full flex flex-col items-center">
            <FluxStepLink
              link={s.link} setLink={s.setLink} isAnalyzing={s.isAnalyzing}
              onAnalyzeLink={s.handleAnalyzeLink} onOpenCatalog={() => s.navigateTo('network')} linkRef={s.linkRef}
            />
          </motion.div>
        )}

        {s.step === 'network' && (
          <motion.div key="step-network" custom={s.direction} variants={slideVariants} initial="enter" animate="center" exit="exit" className="w-full transform-gpu">
            <FluxStepNetwork
              networks={initialCatalog}
              onSelectNetwork={(net) => {
                s.setDetectedType(null); s.setSuggestedCategories([]); s.setActiveNetwork(net); s.navigateTo('category');
              }}
              containerVariants={containerVariants} itemVariants={itemVariants}
            />
          </motion.div>
        )}

        {s.step === 'category' && s.activeNetwork && (
          <motion.div key="step-category" custom={s.direction} variants={slideVariants} initial="enter" animate="center" exit="exit" className="w-full transform-gpu">
            <FluxStepCategory
              activeNetwork={s.activeNetwork} suggestedCategories={s.suggestedCategories} detectedType={s.detectedType}
              onSelectCategory={s.selectCategory} containerVariants={containerVariants} itemVariants={itemVariants}
            />
          </motion.div>
        )}

        {s.step === 'service' && s.activeCategory && (
          <motion.div key="step-service" custom={s.direction} variants={slideVariants} initial="enter" animate="center" exit="exit" className="w-full transform-gpu">
            <FluxStepService
              activeCategory={s.activeCategory} services={s.services} isLoadingServices={s.isLoadingServices}
              onSelectService={s.selectService} containerVariants={containerVariants} itemVariants={itemVariants}
            />
          </motion.div>
        )}

        {s.step === 'checkout' && s.selectedService && (
          <motion.div key="step-checkout" custom={s.direction} variants={slideVariants} initial="enter" animate="center" exit="exit" className="w-full max-w-2xl transform-gpu">
            <FluxStepCheckout
              selectedService={s.selectedService} activeNetwork={s.activeNetwork} activeCategory={s.activeCategory}
              quantity={s.quantity} setQuantity={s.setQuantity} numericQuantity={s.numericQuantity} effectiveQuantity={s.effectiveQuantity}
              link={s.link} setLink={s.setLink} email={s.email} setEmail={s.setEmail}
              isRequirementsConfirmed={s.isRequirementsConfirmed} setIsRequirementsConfirmed={s.setIsRequirementsConfirmed}
              isDripFeedEnabled={s.isDripFeedEnabled} setIsDripFeedEnabled={s.setIsDripFeedEnabled}
              dripRuns={s.dripRuns} setDripRuns={s.setDripRuns} dripInterval={s.dripInterval} setDripInterval={s.setDripInterval}
              customData={s.customData} setCustomData={s.setCustomData} selectedGateway={s.selectedGateway} setSelectedGateway={s.setSelectedGateway}
              availableGateways={s.availableGateways} userBalanceCents={userBalanceCents} price={s.price}
              isTgGuideOpen={s.isTgGuideOpen} setIsTgGuideOpen={s.setIsTgGuideOpen} formAction={s.formAction} isPending={s.isPending}
              formState={s.formState} showShakeError={s.showShakeError} shakeKey={s.shakeKey}
              quantityRef={s.quantityRef} emailRef={s.emailRef} linkRef={s.linkRef}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <CheckoutAuthModal
        isOpen={s.showAuthModal}
        onClose={() => s.setShowAuthModal(false)}
        email={s.authModalEmail}
        orderSnapshot={{
          serviceId: s.selectedService?.id,
          link: s.link,
          quantity: s.numericQuantity,
          runs: s.isDripFeedEnabled ? s.dripRuns : undefined,
          interval: s.isDripFeedEnabled ? s.dripInterval : undefined,
          customData: s.customData,
          networkId: s.activeNetwork?.id,
          categoryId: s.activeCategory?.id
        }}
        onAuthSuccess={() => {
          s.setShowAuthModal(false);
          toast.success("Вы успешно авторизовались!", {
            description: "Теперь вы можете оплатить заказ с баланса или картой."
          });
        }}
      />
    </div>
  );
}
