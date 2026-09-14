'use client';

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { PublicService, getFreshServiceAction } from "@/actions/order/catalog";
import { DrawerOrderSummary } from "./DrawerOrderSummary";
import { DrawerQuantityCard } from "./DrawerQuantityCard";
import { DrawerFormInputs } from "./DrawerFormInputs";
import { DrawerPaymentSelector } from "./DrawerPaymentSelector";
import { DrawerFooter } from "./DrawerFooter";
import { DripFeedConfigurator } from "../DripFeedConfigurator";

interface CheckoutDrawerProps {
  selectedService: PublicService | null;
  url: string;
  setShowLinkModal: (show: boolean) => void;
  quantity: number;
  setQuantity: (q: number) => void;
  pricing: OrderEngine["pricing"];
  email: string;
  setEmail: (e: string) => void;
  promoCode: string;
  setPromoCode: (p: string) => void;
  isCalculating: boolean;
  isSubmitting: boolean;
  handleCheckout: (gateway?: string) => void;
  onClearSelection: () => void;
  emailInputRef?: React.RefObject<HTMLInputElement | null>;
  emailHasError?: boolean;
  termsHasError?: boolean;
  engine: OrderEngine;
  onOpenDocument?: (slug: string) => void;
  userBalanceCents?: number;
}

export function CheckoutDrawer({
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
  onClearSelection,
  emailInputRef,
  emailHasError,
  termsHasError,
  engine,
  onOpenDocument,
  userBalanceCents = 0
}: CheckoutDrawerProps) {
  const [gateway, setGateway] = React.useState<"yookassa" | "cryptobot" | "balance">("yookassa");

  // Live JIT Service Sync: update service parameters immediately when drawer is shown
  useEffect(() => {
    if (!selectedService?.id) return;
    let isMounted = true;

    getFreshServiceAction(selectedService.id).then((fresh) => {
      if (!isMounted || !fresh) return;
      if (
        fresh.pricePerUnitRub !== selectedService.pricePerUnitRub ||
        fresh.minQty !== selectedService.minQty ||
        fresh.maxQty !== selectedService.maxQty ||
        fresh.description !== selectedService.description ||
        fresh.name !== selectedService.name ||
        fresh.isActive !== selectedService.isActive
      ) {
        engine.setSelectedService(fresh);
        if (quantity < fresh.minQty) {
          setQuantity(fresh.minQty);
        } else if (quantity > fresh.maxQty) {
          setQuantity(fresh.maxQty);
        }
      }
    }).catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [selectedService?.id]);

  // Handle ESC key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClearSelection();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClearSelection]);

  const handlePayClick = () => {
    handleCheckout(gateway);
  };

  return (
    <AnimatePresence>
      {selectedService && (
        <>
          {/* Backdrop Blur overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClearSelection}
            className="fixed inset-0 bg-background/40 dark:bg-background/60 backdrop-blur-sm z-[190] cursor-pointer"
          />

          {/* Checkout Drawer Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 bottom-0 right-0 w-full sm:w-[480px] lg:w-[520px] bg-background border-l border-border shadow-2xl z-[200] flex flex-col overflow-hidden pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:pb-0"
          >
            {/* Mobile Drag Indicator Handle */}
            <div className="sm:hidden w-12 h-1 bg-border rounded-full mx-auto my-3 shrink-0" />

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 shrink-0">
              <h3 className="text-base font-black text-foreground uppercase tracking-wider">
                Оформление заказа
              </h3>
              <button
                type="button"
                onClick={onClearSelection}
                className="w-9 h-9 rounded-full bg-content2 hover:bg-content3 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                title="Закрыть (Esc)"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Scrollable Body containing Bento Cards */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3.5 scrollbar-thin">
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

              {/* Drip-Feed settings if supported by the service */}
              <DripFeedConfigurator engine={engine} />

              <DrawerFormInputs
                email={email}
                setEmail={setEmail}
                promoCode={promoCode}
                setPromoCode={setPromoCode}
                emailInputRef={emailInputRef}
                emailHasError={emailHasError}
                engine={engine}
              />

              <DrawerPaymentSelector
                gateway={gateway}
                setGateway={setGateway}
                userBalanceCents={userBalanceCents}
                totalCents={pricing?.totalCents || 0}
              />
            </div>

            {/* Sticky Footer */}
            <DrawerFooter
              pricing={pricing}
              gateway={gateway}
              isCalculating={isCalculating}
              isSubmitting={isSubmitting}
              handleCheckout={handlePayClick}
              termsHasError={termsHasError}
              engine={engine}
              onOpenDocument={onOpenDocument}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
