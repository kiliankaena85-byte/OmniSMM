'use client';

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { CheckoutVariantProps } from './types';
import { EmailPromptModal } from '../modals/EmailPromptModal';
import { StepWizardHeader } from './step-wizard/StepWizardHeader';
import { StepWizardStepper } from './step-wizard/StepWizardStepper';
import { StepWizardParamsStep } from './step-wizard/StepWizardParamsStep';
import { StepWizardPaymentStep } from './step-wizard/StepWizardPaymentStep';
import { StepWizardFooter } from './step-wizard/StepWizardFooter';

export function StepWizardCheckout({
  selectedService,
  url,
  setShowLinkModal,
  quantity,
  setQuantity,
  pricing,
  email,
  setEmail,
  promoCode,
  setPromoCode,
  isCalculating,
  isSubmitting,
  handleCheckout,
  onClose,
  emailInputRef,
  emailHasError,
  termsHasError,
  engine,
  onOpenDocument,
  userBalanceCents,
}: CheckoutVariantProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [gateway, setGateway] = useState<'yookassa' | 'cryptobot' | 'balance'>('yookassa');
  const [isMobile, setIsMobile] = useState(false);
  const [isEmailPromptOpen, setIsEmailPromptOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    setStep(1);
  }, [selectedService?.id]);

  const formattedTotal = React.useMemo(() => {
    if (!pricing) return '0.00';
    return (pricing.totalCents / 100).toFixed(2);
  }, [pricing]);

  const handleNextStep = () => {
    if (step === 2 && (!url || url.trim().length < 3)) {
      toast.error('Пожалуйста, укажите ссылку для продолжения', { position: 'top-center' });
      return;
    }
    setStep((s) => (s + 1) as 1 | 2 | 3);
  };

  const handleFinalSubmit = () => {
    const trimmed = email?.trim();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      setIsEmailPromptOpen(true);
      return;
    }
    handleCheckout(gateway);
  };

  return (
    <AnimatePresence>
      {selectedService && (
        <div className="hidden md:flex fixed inset-0 z-[200] items-end sm:items-center justify-center p-0 sm:p-5 overflow-hidden">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/70 backdrop-blur-md cursor-pointer"
          />

          {/* Wizard Modal */}
          <motion.div
            drag={isMobile ? 'y' : false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) {
                onClose();
              }
            }}
            initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.96, y: 15 }}
            animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
            exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.96, y: 15 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative w-full sm:max-w-2xl bg-card border-t sm:border border-border shadow-2xl rounded-t-[32px] sm:rounded-3xl overflow-hidden flex flex-col max-h-[92vh] h-[92vh] sm:h-auto z-10"
          >
            <StepWizardHeader service={selectedService} onClose={onClose} />

            <StepWizardStepper step={step} setStep={setStep} quantity={quantity} url={url} />

            {/* Dynamic Content Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 scrollbar-thin">
              {step !== 3 ? (
                <StepWizardParamsStep
                  step={step}
                  selectedService={selectedService}
                  url={url}
                  setShowLinkModal={setShowLinkModal}
                  engine={engine}
                  quantity={quantity}
                  setQuantity={setQuantity}
                  pricing={pricing}
                  email={email}
                  setEmail={setEmail}
                  promoCode={promoCode}
                  setPromoCode={setPromoCode}
                  emailInputRef={emailInputRef}
                  emailHasError={emailHasError}
                />
              ) : (
                <StepWizardPaymentStep
                  gateway={gateway}
                  setGateway={setGateway}
                  userBalanceCents={userBalanceCents}
                  totalCents={pricing?.totalCents || 0}
                  email={email}
                  setEmail={setEmail}
                  emailHasError={emailHasError}
                  selectedService={selectedService}
                  quantity={quantity}
                  url={url}
                  termsHasError={termsHasError}
                  engine={engine}
                  onOpenDocument={onOpenDocument}
                />
              )}
            </div>

            <StepWizardFooter
              step={step}
              setStep={setStep}
              formattedTotal={formattedTotal}
              url={url}
              isSubmitting={isSubmitting}
              isCalculating={isCalculating}
              gateway={gateway}
              onNextStep={handleNextStep}
              onSubmit={handleFinalSubmit}
            />

            <EmailPromptModal
              isOpen={isEmailPromptOpen}
              onClose={() => setIsEmailPromptOpen(false)}
              onConfirm={(confirmedEmail) => {
                setEmail(confirmedEmail);
                setIsEmailPromptOpen(false);
                handleCheckout(gateway, confirmedEmail);
              }}
              initialEmail={email}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
