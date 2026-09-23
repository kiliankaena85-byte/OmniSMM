'use client';

import React from "react";
import type { PublicService } from "@/actions/order/catalog";
import type { PricingResult } from "@/services/marketing.service";
import { RecapAndLinkSection } from "./sub/RecapAndLinkSection";
import { DripAndCustomDataSection } from "./sub/DripAndCustomDataSection";
import { PromoAndGatewaySection } from "./sub/PromoAndGatewaySection";
import { SubmitPriceBar } from "./sub/SubmitPriceBar";

export interface StepCheckoutParamsProps {
  selectedService: PublicService;
  link: string;
  setLink: (val: string) => void;
  quantity: number | string;
  setQuantity: (val: number | string) => void;
  email: string;
  setEmail: (val: string) => void;
  isDripFeedEnabled: boolean;
  setIsDripFeedEnabled: (val: boolean) => void;
  dripRuns: number;
  setDripRuns: (val: number) => void;
  dripInterval: number;
  setDripInterval: (val: number) => void;
  customData: string;
  setCustomData: (val: string) => void;
  isRequirementsConfirmed: boolean;
  setIsRequirementsConfirmed: (val: boolean) => void;
  selectedGateway: string;
  setSelectedGateway: (val: string) => void;
  availableGateways: { yookassa: boolean; robokassa: boolean; cryptobot: boolean } | null;
  userBalanceCents: number;
  showPromo: boolean;
  setShowPromo: (val: boolean) => void;
  promoCode: string;
  setPromoCode: (val: string) => void;
  appliedPromo: string;
  isApplyingPromo: boolean;
  promoMessage: { type: "success" | "error"; text: string } | null;
  onApplyPromo: () => void;
  onRemovePromo: () => void;
  serverPricing: PricingResult | null;
  totalPrice: string;
  originalPrice: string | null;
  formAction: (payload: FormData) => void;
  isPending: boolean;
  formState: { error?: string };
  shakeKey: number;
  quantityRef: React.RefObject<HTMLInputElement | null>;
  emailRef: React.RefObject<HTMLInputElement | null>;
  linkRef: React.RefObject<HTMLInputElement | null>;
}

export function StepCheckoutParams(props: StepCheckoutParamsProps) {
  const numericQuantity = typeof props.quantity === "string" ? (parseInt(props.quantity) || 0) : props.quantity;

  return (
    <div className="bg-card border border-border/80 shadow-lg rounded-3xl p-4 sm:p-6 w-full">
      <RecapAndLinkSection
        selectedService={props.selectedService}
        link={props.link}
        setLink={props.setLink}
        quantity={props.quantity}
        setQuantity={props.setQuantity}
        linkRef={props.linkRef}
        quantityRef={props.quantityRef}
      />

      <form action={props.formAction} noValidate>
        <DripAndCustomDataSection
          selectedService={props.selectedService}
          numericQuantity={numericQuantity}
          isDripFeedEnabled={props.isDripFeedEnabled}
          setIsDripFeedEnabled={props.setIsDripFeedEnabled}
          dripRuns={props.dripRuns}
          setDripRuns={props.setDripRuns}
          dripInterval={props.dripInterval}
          setDripInterval={props.setDripInterval}
          customData={props.customData}
          setCustomData={props.setCustomData}
          isRequirementsConfirmed={props.isRequirementsConfirmed}
          setIsRequirementsConfirmed={props.setIsRequirementsConfirmed}
        />

        <PromoAndGatewaySection
          email={props.email}
          setEmail={props.setEmail}
          emailRef={props.emailRef}
          showPromo={props.showPromo}
          setShowPromo={props.setShowPromo}
          promoCode={props.promoCode}
          setPromoCode={props.setPromoCode}
          appliedPromo={props.appliedPromo}
          isApplyingPromo={props.isApplyingPromo}
          promoMessage={props.promoMessage}
          onApplyPromo={props.onApplyPromo}
          onRemovePromo={props.onRemovePromo}
          selectedGateway={props.selectedGateway}
          setSelectedGateway={props.setSelectedGateway}
          availableGateways={props.availableGateways}
          userBalanceCents={props.userBalanceCents}
        />

        <SubmitPriceBar
          totalPrice={props.totalPrice}
          originalPrice={props.originalPrice}
          serverPricing={props.serverPricing}
          selectedGateway={props.selectedGateway}
          isPending={props.isPending}
          formState={props.formState}
          shakeKey={props.shakeKey}
        />
      </form>
    </div>
  );
}
