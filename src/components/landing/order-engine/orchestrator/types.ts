/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Types and interfaces for checkout orchestrator.
 */
import type { OrderEngine } from '@/hooks/useOrderEngine';
import type { ABVariant } from '@/hooks/useABTest';

export interface OrchestratorCheckoutParams {
  email: string;
  expectedTotalRub?: number;
  serviceId: string;
  link: string;
  quantity: number;
  runs?: number;
  interval?: number;
  idempotencyKey?: string;
  isLinkOverridden?: boolean;
  isRequirementsConfirmed?: boolean;
  promoCodeStr?: string;
  customData?: string;
  mediaGroupUrl?: string;
  isSmartDrip?: boolean;
  smartDripDays?: number;
  abVariant?: 'A' | 'B' | 'C';
  [key: string]: unknown;
}

export interface OrderCheckoutResultData {
  orderId?: string;
  numericId?: string | number;
  paymentUrl?: string;
  paymentId?: string;
  redirectUrl?: string;
  guestOrderToken?: string;
}

export interface CheckoutOrchestratorOptions {
  engine: OrderEngine;
  desktopEmailInputRef?: React.RefObject<HTMLInputElement | null>;
  mobileEmailInputRef?: React.RefObject<HTMLInputElement | null>;
  abVariant?: ABVariant | null;
}
