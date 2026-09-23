'use client';

import React, { Suspense } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import type { PublicNetwork } from "@/actions/order/catalog";
import { PlatformLinkGuideDrawer } from "@/components/landing/order-engine/PlatformLinkGuideDrawer";
import { CheckoutAuthModal } from "@/components/landing/order-engine/modals/CheckoutAuthModal";
import { toast } from "sonner";
import { StepLinkInput } from "./slide/StepLinkInput";
import { StepNetworkGrid } from "./slide/StepNetworkGrid";
import { StepCategoryGrid } from "./slide/StepCategoryGrid";
import { StepServiceList } from "./slide/StepServiceList";
import { StepCheckoutParams } from "./slide/StepCheckoutParams";
import { SlideNavHeader } from "./slide/SlideNavHeader";
import { usePlanSlideOrderState } from "./slide/usePlanSlideOrderState";

const slideVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 30 : -30,
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.22,
      ease: [0.16, 1, 0.3, 1]
    }
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 30 : -30,
    opacity: 0,
    transition: {
      duration: 0.15,
      ease: "easeIn"
    }
  })
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { 
    opacity: 1, 
    transition: { 
      staggerChildren: 0.03,
      delayChildren: 0.01
    } 
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.2,
      ease: "easeOut"
    }
  }
};

export interface PlanSlideOrderClientProps {
  initialCatalog?: PublicNetwork[];
  initialEmail?: string;
  tenantId?: string;
  userBalanceCents?: number;
}

export function PlanSlideOrderClient(props: PlanSlideOrderClientProps) {
  return (
    <Suspense fallback={<div className="min-h-[400px] flex items-center justify-center text-muted-foreground text-sm font-medium">Загрузка визарда...</div>}>
      <PlanSlideOrderClientInner {...props} />
    </Suspense>
  );
}

function PlanSlideOrderClientInner(props: PlanSlideOrderClientProps) {
  const state = usePlanSlideOrderState(props);

  return (
    <div className={`w-full max-w-4xl mx-auto flex flex-col items-center justify-center font-sans px-2 sm:px-4 relative overflow-visible ${state.step === 'link' ? 'pt-4 md:pt-8 pb-4' : 'min-h-[50vh] pt-2 pb-10'}`}>
      
      {/* Navigation Header */}
      <SlideNavHeader
        step={state.step}
        activeNetwork={state.activeNetwork}
        link={state.link}
        enteredViaCatalog={state.enteredViaCatalog}
        onNavigateBack={state.handleNavigateBack}
        onReset={state.handleReset}
      />

      <AnimatePresence initial={false} custom={state.direction} mode="wait">
        {state.step === 'link' && (
          <motion.div
            key="step-link"
            custom={state.direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="w-full flex flex-col items-center"
          >
            <StepLinkInput
              link={state.link}
              setLink={state.setLink}
              isAnalyzing={state.isAnalyzing}
              onAnalyzeLink={state.handleAnalyzeLink}
              onOpenGuide={() => state.setIsGuideOpen(true)}
              onSelectFromCatalog={() => {
                state.setEnteredViaCatalog(true);
                state.navigateTo('network');
              }}
              onQuickSelectNetwork={(net) => {
                state.setEnteredViaCatalog(false);
                state.setDetectedType(null);
                state.setSuggestedCategories([]);
                state.setActiveNetwork(net);
                state.navigateTo('category');
              }}
              popularNetworks={props.initialCatalog || []}
              linkInputRef={state.linkRef}
            />
          </motion.div>
        )}

        {state.step === 'network' && (
          <motion.div
            key="step-network"
            custom={state.direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="w-full max-w-3xl"
          >
            <StepNetworkGrid
              networks={props.initialCatalog || []}
              onSelectNetwork={(net) => {
                state.setDetectedType(null);
                state.setSuggestedCategories([]);
                state.setActiveNetwork(net);
                state.navigateTo('category');
              }}
              containerVariants={containerVariants}
              itemVariants={itemVariants}
            />
          </motion.div>
        )}

        {state.step === 'category' && state.activeNetwork && (
          <motion.div
            key="step-category"
            custom={state.direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="w-full max-w-3xl"
          >
            <StepCategoryGrid
              activeNetwork={state.activeNetwork}
              suggestedCategories={state.suggestedCategories}
              detectedType={state.detectedType}
              onSelectCategory={state.selectCategory}
              onResetCategoryFilter={() => {
                state.setDetectedType(null);
                state.setSuggestedCategories([]);
              }}
              containerVariants={containerVariants}
              itemVariants={itemVariants}
            />
          </motion.div>
        )}

        {state.step === 'service' && state.activeCategory && (
          <motion.div
            key="step-service"
            custom={state.direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="w-full max-w-3xl"
          >
            <StepServiceList
              activeCategory={state.activeCategory}
              services={state.services}
              isLoadingServices={state.isLoadingServices}
              onSelectService={state.selectService}
              onBackToCategories={() => state.navigateTo('category')}
              containerVariants={containerVariants}
              itemVariants={itemVariants}
            />
          </motion.div>
        )}

        {state.step === 'checkout' && state.selectedService && (
          <motion.div
            key="step-checkout"
            custom={state.direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="w-full max-w-2xl"
          >
            <StepCheckoutParams
              selectedService={state.selectedService}
              link={state.link}
              setLink={state.setLink}
              quantity={state.quantity}
              setQuantity={state.setQuantity}
              email={state.email}
              setEmail={state.setEmail}
              isDripFeedEnabled={state.isDripFeedEnabled}
              setIsDripFeedEnabled={state.setIsDripFeedEnabled}
              dripRuns={state.dripRuns}
              setDripRuns={state.setDripRuns}
              dripInterval={state.dripInterval}
              setDripInterval={state.setDripInterval}
              customData={state.customData}
              setCustomData={state.setCustomData}
              isRequirementsConfirmed={state.isRequirementsConfirmed}
              setIsRequirementsConfirmed={state.setIsRequirementsConfirmed}
              selectedGateway={state.selectedGateway}
              setSelectedGateway={state.setSelectedGateway}
              availableGateways={state.availableGateways}
              userBalanceCents={props.userBalanceCents || 0}
              showPromo={state.showPromo}
              setShowPromo={state.setShowPromo}
              promoCode={state.promoCode}
              setPromoCode={state.setPromoCode}
              appliedPromo={state.appliedPromo}
              isApplyingPromo={state.isApplyingPromo}
              promoMessage={state.promoMessage}
              onApplyPromo={state.handleApplyPromo}
              onRemovePromo={state.handleRemovePromo}
              serverPricing={state.serverPricing}
              totalPrice={state.totalPrice}
              originalPrice={state.originalPrice}
              formAction={state.formAction}
              isPending={state.isPending}
              formState={state.formState}
              shakeKey={state.shakeKey}
              quantityRef={state.quantityRef}
              emailRef={state.emailRef}
              linkRef={state.linkRef}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <PlatformLinkGuideDrawer
        isOpen={state.isGuideOpen}
        onClose={() => state.setIsGuideOpen(false)}
        initialPlatform={state.activeNetwork?.slug || "telegram"}
      />

      <CheckoutAuthModal
        isOpen={state.showAuthModal}
        onClose={() => state.setShowAuthModal(false)}
        email={state.authModalEmail}
        orderSnapshot={{
          serviceId: state.selectedService?.id,
          link: state.link,
          quantity: state.numericQuantity,
          runs: state.isDripFeedEnabled ? state.dripRuns : undefined,
          interval: state.isDripFeedEnabled ? state.dripInterval : undefined,
          customData: state.customData,
          networkId: state.activeNetwork?.id,
          categoryId: state.activeCategory?.id
        }}
        onAuthSuccess={() => {
          state.setShowAuthModal(false);
          toast.success("Вы успешно авторизовались!", {
            description: "Теперь вы можете оплатить заказ с баланса или картой."
          });
        }}
      />
    </div>
  );
}
