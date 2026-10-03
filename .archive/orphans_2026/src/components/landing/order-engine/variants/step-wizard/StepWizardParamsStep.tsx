'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { DrawerOrderSummary } from '../../drawer/DrawerOrderSummary';
import { DrawerQuantityCard } from '../../drawer/DrawerQuantityCard';
import { DrawerFormInputs } from '../../drawer/DrawerFormInputs';
import { DripFeedConfigurator } from '../../DripFeedConfigurator';
import { PublicService } from '@/actions/order/catalog';
import { OrderEngine } from '@/hooks/useOrderEngine';

interface StepWizardParamsStepProps {
  step: 1 | 2;
  selectedService: PublicService;
  url: string;
  setShowLinkModal: (show: boolean) => void;
  engine: OrderEngine;
  quantity: number;
  setQuantity: (qty: number) => void;
  pricing: OrderEngine['pricing'];
  email: string;
  setEmail: (email: string) => void;
  promoCode: string;
  setPromoCode: (promo: string) => void;
  emailInputRef?: React.RefObject<HTMLInputElement | null>;
  emailHasError?: boolean;
}

export function StepWizardParamsStep({
  step,
  selectedService,
  url,
  setShowLinkModal,
  engine,
  quantity,
  setQuantity,
  pricing,
  email,
  setEmail,
  promoCode,
  setPromoCode,
  emailInputRef,
  emailHasError,
}: StepWizardParamsStepProps) {
  if (step === 1) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 10 }}
        className="space-y-3"
      >
        <DrawerOrderSummary
          selectedService={selectedService}
          url={url}
          setShowLinkModal={setShowLinkModal}
          engine={engine}
        />
        <DrawerQuantityCard
          selectedService={selectedService}
          quantity={quantity}
          setQuantity={setQuantity}
          pricing={pricing}
          engine={engine}
        />
        <DripFeedConfigurator engine={engine} />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className="space-y-3"
    >
      <DrawerOrderSummary
        selectedService={selectedService}
        url={url}
        setShowLinkModal={setShowLinkModal}
        engine={engine}
      />
      <DrawerFormInputs
        email={email}
        setEmail={setEmail}
        promoCode={promoCode}
        setPromoCode={setPromoCode}
        emailInputRef={emailInputRef}
        emailHasError={emailHasError}
        engine={engine}
      />
    </motion.div>
  );
}
