import type React from "react";
import type { FluxService, FluxNetwork, FluxCategory } from "@/types/flux";

export interface FluxStepCheckoutProps {
  selectedService: FluxService;
  activeNetwork: FluxNetwork | null;
  activeCategory: FluxCategory | null;
  quantity: number | string;
  setQuantity: (val: number | string) => void;
  numericQuantity: number;
  effectiveQuantity: number;
  link: string;
  setLink: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  isRequirementsConfirmed: boolean;
  setIsRequirementsConfirmed: (val: boolean) => void;
  isDripFeedEnabled: boolean;
  setIsDripFeedEnabled: (val: boolean) => void;
  dripRuns: number;
  setDripRuns: (val: number) => void;
  dripInterval: number;
  setDripInterval: (val: number) => void;
  customData: string;
  setCustomData: (val: string) => void;
  selectedGateway: string;
  setSelectedGateway: (val: string) => void;
  availableGateways: { yookassa: boolean; robokassa: boolean; cryptobot: boolean } | null;
  userBalanceCents?: number;
  price: string;
  isTgGuideOpen: boolean;
  setIsTgGuideOpen: (val: boolean) => void;
  formAction: (payload: FormData) => void;
  isPending: boolean;
  formState: { error?: string; field?: string };
  showShakeError: boolean;
  shakeKey: number;
  quantityRef: React.RefObject<HTMLInputElement | null>;
  emailRef: React.RefObject<HTMLInputElement | null>;
  linkRef: React.RefObject<HTMLInputElement | null>;
}

export interface PaymentMethodItem {
  id: string;
  name: string;
  desc: string;
  icon: any;
  gradient: string;
  borderActive: string;
  iconColor: string;
  disabled: boolean;
}
