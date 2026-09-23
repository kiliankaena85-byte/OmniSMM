'use client';

import React from "react";
import { PromoCodeSection, PromoCodeSectionProps } from "./PromoCodeSection";
import { PaymentGatewaySection, PaymentGatewaySectionProps } from "./PaymentGatewaySection";

export type PromoAndGatewaySectionProps = PromoCodeSectionProps & PaymentGatewaySectionProps;

export function PromoAndGatewaySection(props: PromoAndGatewaySectionProps) {
  return (
    <>
      <PromoCodeSection
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
      />
      <PaymentGatewaySection
        selectedGateway={props.selectedGateway}
        setSelectedGateway={props.setSelectedGateway}
        availableGateways={props.availableGateways}
        userBalanceCents={props.userBalanceCents}
      />
    </>
  );
}
