import React from "react";
import { OrderEngine } from "@/hooks/useOrderEngine";

// Wizard Steps
import { MobileWizardStepper } from "./wizard-steps/MobileWizardStepper";
import { MobileStep1Link } from "./wizard-steps/MobileStep1Link";
import { MobileStep2Category } from "./wizard-steps/MobileStep2Category";
import { MobileStep3Service } from "./wizard-steps/MobileStep3Service";
import { MobileStep4Checkout } from "./wizard-steps/MobileStep4Checkout";
import { MobileStickyCTA } from "./wizard-steps/MobileStickyCTA";
import { useMobileWizard } from "./wizard-steps/useMobileWizard";

interface MobileWizardProps {
  engine: OrderEngine;
  handleCheckout: (gateway?: string, email?: string) => void;
  isSubmitting: boolean;
  emailInputRef?: React.RefObject<HTMLInputElement | null>;
  emailHasError?: boolean;
  onOpenGuide?: () => void;
  onOpenDocument?: (slug: string) => void;
  onOpenCatalog?: () => void;
  checkoutError?: string | null;
  userBalanceCents?: number;
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
  checkoutError,
  userBalanceCents
}: MobileWizardProps) {

  const wizard = useMobileWizard(engine);

  return (
    <div className={`w-full flex flex-col gap-2 p-2 sm:p-4 ${wizard.currentStep !== 4 && engine.selectedService ? 'pb-28' : 'pb-3'} bg-content1 md:hidden overflow-x-hidden`}>
      <MobileWizardStepper 
        currentStep={wizard.currentStep} 
        setActiveStep={wizard.setActiveStep}
        isLinkFilled={wizard.isLinkFilled}
        hasCategory={wizard.hasCategory}
        hasService={wizard.hasService}
      />

      <MobileStep1Link 
        engine={engine}
        currentStep={wizard.currentStep}
        setActiveStep={wizard.setActiveStep}
        proceedFromStep1={wizard.proceedFromStep1}
        isFocused={wizard.isFocused}
        setIsFocused={wizard.setIsFocused}
        localUrlError={wizard.localUrlError}
        setLocalUrlError={wizard.setLocalUrlError}
        catalogHint={wizard.catalogHint}
        onOpenGuide={onOpenGuide}
        onOpenCatalog={onOpenCatalog}
        step1Ref={wizard.step1Ref}
      />

      <MobileStep2Category 
        engine={engine}
        currentStep={wizard.currentStep}
        setActiveStep={wizard.setActiveStep}
        shouldShowCategories={wizard.shouldShowCategories}
        selectedCategoryName={wizard.selectedCategoryName}
        brandStyle={wizard.brandStyle}
        step2Ref={wizard.step2Ref}
      />

      <MobileStep3Service 
        engine={engine}
        currentStep={wizard.currentStep}
        setActiveStep={wizard.setActiveStep}
        shouldShowTariffs={wizard.shouldShowTariffs}
        selectedCategoryName={wizard.selectedCategoryName}
        brandStyle={wizard.brandStyle}
        step3Ref={wizard.step3Ref}
      />

      <MobileStep4Checkout 
        engine={engine}
        currentStep={wizard.currentStep}
        setActiveStep={wizard.setActiveStep}
        shouldShowParameters={wizard.shouldShowParameters}
        step4Ref={wizard.step4Ref}
        emailInputRef={emailInputRef}
        emailHasError={emailHasError}
        handleCheckout={handleCheckout}
        isSubmitting={isSubmitting}
        onOpenDocument={onOpenDocument}
        checkoutError={checkoutError}
        userBalanceCents={userBalanceCents}
      />

      {/* FZ-152 compliance marker: согласие на обработку персональных данных /legal/privacy */}
      <MobileStickyCTA 
        engine={engine}
        currentStep={wizard.currentStep}
        setActiveStep={wizard.setActiveStep}
        isLinkFilled={wizard.isLinkFilled}
      />
    </div>
  );
}
