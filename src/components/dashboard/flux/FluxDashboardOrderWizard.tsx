'use client';

import React, { Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { FluxCyberLinkDrawer } from '@/components/orders/flux/FluxCyberLinkDrawer';
import { type FluxDashboardOrderWizardProps } from './wizard-steps/types';
import { FluxDashboardStepNetwork } from './wizard-steps/FluxDashboardStepNetwork';
import { FluxDashboardStepCategory } from './wizard-steps/FluxDashboardStepCategory';
import { FluxDashboardStepService } from './wizard-steps/FluxDashboardStepService';
import { FluxDashboardStepCheckout } from './wizard-steps/FluxDashboardStepCheckout';
import { FluxWizardStepBar } from './sub/FluxWizardStepBar';
import { FluxWizardSuccessCard } from './sub/FluxWizardSuccessCard';
import { useFluxDashboardWizardState } from './hooks/useFluxDashboardWizardState';

export function FluxDashboardOrderWizard(props: FluxDashboardOrderWizardProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-[400px] flex items-center justify-center text-muted-foreground text-sm">
          Загрузка мастера заказа...
        </div>
      }
    >
      <FluxDashboardOrderWizardInner {...props} />
    </Suspense>
  );
}

function FluxDashboardOrderWizardInner(props: FluxDashboardOrderWizardProps) {
  const wizard = useFluxDashboardWizardState(props);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <FluxWizardStepBar
        step={wizard.step}
        activeNetwork={wizard.activeNetwork}
        activeCategory={wizard.activeCategory}
        selectedService={wizard.selectedService}
        userBalanceCents={props.userBalanceCents}
        userBalanceRub={wizard.userBalanceRub}
        onNavigateTo={wizard.navigateTo}
      />

      {wizard.isOrderSuccess && (
        <FluxWizardSuccessCard onReset={() => wizard.setIsOrderSuccess(false)} />
      )}

      {!wizard.isOrderSuccess && (
        <AnimatePresence initial={false} custom={wizard.direction} mode="wait">
          {wizard.step === 'network' && (
            <FluxDashboardStepNetwork
              direction={wizard.direction}
              link={wizard.link}
              setLink={wizard.setLink}
              linkRef={wizard.linkRef}
              isAnalyzing={wizard.isAnalyzing}
              handleAnalyzeLink={wizard.handleAnalyzeLink}
              isLoadingCatalog={wizard.isLoadingCatalog}
              catalog={wizard.catalog}
              onSelectNetwork={wizard.selectNetwork}
            />
          )}

          {wizard.step === 'category' && wizard.activeNetwork && (
            <FluxDashboardStepCategory
              direction={wizard.direction}
              activeNetwork={wizard.activeNetwork}
              suggestedCategories={wizard.suggestedCategories}
              detectedType={wizard.detectedType}
              onNavigateBack={() => wizard.navigateTo('network')}
              onSelectCategory={wizard.selectCategory}
            />
          )}

          {wizard.step === 'service' && wizard.activeCategory && (
            <FluxDashboardStepService
              direction={wizard.direction}
              activeNetwork={wizard.activeNetwork}
              activeCategory={wizard.activeCategory}
              isLoadingServices={wizard.isLoadingServices}
              services={wizard.services}
              onNavigateBack={() => wizard.navigateTo('category')}
              onSelectService={wizard.selectService}
            />
          )}

          {wizard.step === 'checkout' && wizard.selectedService && (
            <FluxDashboardStepCheckout
              direction={wizard.direction}
              selectedService={wizard.selectedService}
              activeNetwork={wizard.activeNetwork}
              activeCategory={wizard.activeCategory}
              link={wizard.link}
              setLink={wizard.setLink}
              linkRef={wizard.linkRef}
              quantity={wizard.quantity}
              setQuantity={wizard.setQuantity}
              quantityRef={wizard.quantityRef}
              qtyNum={wizard.qtyNum}
              isDripFeedEnabled={wizard.isDripFeedEnabled}
              setIsDripFeedEnabled={wizard.setIsDripFeedEnabled}
              dripRuns={wizard.dripRuns}
              setDripRuns={wizard.setDripRuns}
              dripInterval={wizard.dripInterval}
              setDripInterval={wizard.setDripInterval}
              customData={wizard.customData}
              setCustomData={wizard.setCustomData}
              customDataRef={wizard.customDataRef}
              isRequirementsConfirmed={wizard.isRequirementsConfirmed}
              setIsRequirementsConfirmed={wizard.setIsRequirementsConfirmed}
              requirementRef={wizard.requirementRef}
              email={wizard.email}
              setEmail={wizard.setEmail}
              emailRef={wizard.emailRef}
              showPromo={wizard.showPromo}
              setShowPromo={wizard.setShowPromo}
              promoCode={wizard.promoCode}
              setPromoCode={wizard.setPromoCode}
              appliedPromo={wizard.appliedPromo}
              isApplyingPromo={wizard.isApplyingPromo}
              promoMessage={wizard.promoMessage}
              handleApplyPromo={wizard.handleApplyPromo}
              handleRemovePromo={wizard.handleRemovePromo}
              gateway={wizard.gateway}
              setGateway={wizard.setGateway}
              availableGateways={wizard.availableGateways}
              userBalanceRub={wizard.userBalanceRub}
              canPayFromBalance={wizard.canPayFromBalance}
              totalPriceRub={wizard.totalPriceRub}
              originalServerPriceRub={wizard.originalServerPriceRub}
              discountPercent={wizard.discountPercent}
              errorMessage={wizard.errorMessage}
              errorField={wizard.errorField}
              shakeKey={wizard.shakeKey}
              isSubmitting={wizard.isSubmitting}
              setIsTgGuideOpen={wizard.setIsTgGuideOpen}
              onSubmit={wizard.handleSubmit}
            />
          )}
        </AnimatePresence>
      )}

      <FluxCyberLinkDrawer
        isOpen={wizard.isTgGuideOpen}
        onClose={() => wizard.setIsTgGuideOpen(false)}
        onApplyLink={(newLink: string) => wizard.setLink(newLink)}
      />
    </div>
  );
}
