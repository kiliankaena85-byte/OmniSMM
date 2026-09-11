'use client';

import React from "react";
import { PublicNetwork, PublicService } from "@/actions/order/catalog";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { useCheckoutOrchestrator } from "./order-engine/useCheckoutOrchestrator";
import { LinkModal } from "./order-engine/LinkModal";
import { MassConfirmEmailModal } from "./order-engine/MassConfirmEmailModal";
import { PlatformLinkGuideDrawer } from "./order-engine/PlatformLinkGuideDrawer";
import { PaymentGatewaySelectionModal } from "./order-engine/PaymentGatewaySelectionModal";
import { CheckoutAuthModal } from "./order-engine/modals/CheckoutAuthModal";
import { LegalDocumentModal } from "./order-engine/LegalDocumentModal";
import { MobileCatalogModal } from "./order-engine/MobileCatalogModal";

export interface LandingModalsProps {
  engine: OrderEngine;
  orchestrator: ReturnType<typeof useCheckoutOrchestrator>;
  unfilteredCatalog: PublicNetwork[];
  isGuideOpen: boolean;
  setIsGuideOpen: (open: boolean) => void;
  activeLegalSlug: string | null;
  setActiveLegalSlug: (slug: string | null) => void;
  showCatalogModal: boolean;
  setShowCatalogModal: (show: boolean) => void;
  showSmartCart: boolean;
  userBalanceCents: number;
}

export function LandingModals({
  engine,
  orchestrator,
  unfilteredCatalog,
  isGuideOpen,
  setIsGuideOpen,
  activeLegalSlug,
  setActiveLegalSlug,
  showCatalogModal,
  setShowCatalogModal,
  showSmartCart,
  userBalanceCents,
}: LandingModalsProps) {
  const { url, setUrl, email, setEmail, selectedService, setSelectedService, massCalculation, pricing } = engine;
  const {
    showLinkModal, setShowLinkModal,
    showMassConfirmModal, setShowMassConfirmModal,
    showPaymentModal, setShowPaymentModal,
    showAuthModal, setShowAuthModal,
    authModalEmail, handleAuthSuccess,
    orderSnapshot, confirmAndPay, isSubmitting,
    handleCheckout, handleMassCheckoutConfirm,
  } = orchestrator;

  const handleSelectServiceFromCatalog = (srv: PublicService, catId: string, netId: string) => {
    engine.setNetworkId(netId);
    engine.setCategoryId(catId);
    engine.setSelectedService(srv);
    setShowCatalogModal(false);
  };

  return (
    <>
      <LinkModal
        showLinkModal={showLinkModal}
        setShowLinkModal={setShowLinkModal}
        url={url}
        setUrl={setUrl}
        handleCheckout={handleCheckout}
        networkSlug={unfilteredCatalog.find(n => n.id === engine.networkId)?.slug || engine.networkId}
        categorySlug={unfilteredCatalog.find(n => n.id === engine.networkId)?.categories.find(c => c.id === engine.categoryId)?.slug || engine.categoryId}
        serviceName={selectedService?.name}
        serviceTargetType={selectedService?.targetType}
        servicePlaceholder={selectedService?.linkPlaceholder}
        serviceHint={selectedService?.linkHint}
        onSwitchToDetectedNetwork={(networkKey) => {
          const matchedNet = unfilteredCatalog.find(
            n => n.slug.toLowerCase().includes(networkKey.toLowerCase()) || networkKey.toLowerCase().includes(n.slug.toLowerCase())
          );
          if (matchedNet) {
            engine.setNetworkId(matchedNet.id);
            if (matchedNet.categories.length > 0) {
              engine.setCategoryId(matchedNet.categories[0].id);
            }
            setSelectedService(null);
            const catalogEl = document.getElementById("catalog-section");
            if (catalogEl) {
              catalogEl.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }
        }}
      />

      <MassConfirmEmailModal
        showMassConfirmModal={showMassConfirmModal}
        setShowMassConfirmModal={setShowMassConfirmModal}
        email={email}
        setEmail={setEmail}
        totalPriceFormatted={massCalculation ? massCalculation.totalRub.toFixed(2) : "0.00"}
        isSubmitting={isSubmitting}
        handleMassCheckoutConfirm={handleMassCheckoutConfirm}
        validCount={massCalculation ? massCalculation.validCount : 0}
      />

      <PlatformLinkGuideDrawer
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        initialPlatform={engine.catalog.find(n => n.id === engine.networkId)?.slug || "telegram"}
      />

      <PaymentGatewaySelectionModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        totalPriceFormatted={
          showSmartCart
            ? (massCalculation ? massCalculation.totalRub.toFixed(2) : "0.00")
            : (pricing ? (pricing.totalCents / 100).toFixed(2) : "0.00")
        }
        isSubmitting={isSubmitting}
        onSelectGateway={confirmAndPay}
        userBalanceCents={userBalanceCents}
      />

      <CheckoutAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        email={authModalEmail || email}
        onAuthSuccess={handleAuthSuccess}
        orderSnapshot={orderSnapshot}
      />

      <LegalDocumentModal
        slug={activeLegalSlug}
        onClose={() => setActiveLegalSlug(null)}
      />

      {showCatalogModal && (
        <MobileCatalogModal
          catalog={engine.catalog}
          selectedService={selectedService}
          onSelect={handleSelectServiceFromCatalog}
          onClose={() => setShowCatalogModal(false)}
        />
      )}
    </>
  );
}
