import { RefObject } from 'react';
import { PublicNetwork, PublicCategory, PublicService } from '@/actions/order/catalog';

export type WizardStep = 1 | 2 | 3 | 4;
export type PaymentGateway = 'balance' | 'yookassa' | 'cryptobot';
export type TariffSubtypeFilter = 'all' | 'channel' | 'post' | 'auto';

export interface FormErrors {
  link?: string;
  quantity?: string;
  customData?: string;
  requirement?: string;
  email?: string;
  general?: string;
}

export interface AvailableGateways {
  yookassa: boolean;
  robokassa: boolean;
  cryptobot: boolean;
}

export interface SmmplanOrderWizardProps {
  userEmail?: string;
  userBalanceCents?: number;
  initialReorderData?: {
    serviceId: string;
    categoryId: string;
    link: string;
    quantity: number;
  } | null;
  tenantId?: string;
}

export interface WizardStepCheckoutProps {
  selectedNetwork: PublicNetwork | null;
  selectedCategory: PublicCategory | null;
  selectedService: PublicService | null;
  isLoadingServices: boolean;
  formRef: RefObject<HTMLFormElement | null>;
  errorRef: RefObject<HTMLDivElement | null>;
  shakeKey: number;
  errors: FormErrors;
  link: string;
  setLink: (val: string) => void;
  handleBlurLink: () => void;
  isTgGuideOpen: boolean;
  setIsTgGuideOpen: (val: boolean) => void;
  customData: string;
  setCustomData: (val: string) => void;
  isDripFeedEnabled: boolean;
  setIsDripFeedEnabled: (val: boolean) => void;
  dripRuns: number;
  setDripRuns: (val: number) => void;
  dripInterval: number;
  setDripInterval: (val: number) => void;
  isRequirementsConfirmed: boolean;
  setIsRequirementsConfirmed: (val: boolean) => void;
  quantity: number;
  setQuantity: (val: number) => void;
  addQuantity: (delta: number) => void;
  totalQuantity: number;
  email: string;
  setEmail: (val: string) => void;
  showPromo: boolean;
  setShowPromo: (val: boolean) => void;
  promoCodeInput: string;
  setPromoCodeInput: (val: string) => void;
  appliedPromo: string;
  promoMessage: { type: 'success' | 'error'; text: string } | null;
  isApplyingPromo: boolean;
  handleApplyPromo: () => void;
  handleRemovePromo: () => void;
  gateway: PaymentGateway;
  setGateway: (g: PaymentGateway) => void;
  userBalanceCents: number;
  availableGateways: AvailableGateways | null;
  isCalculatingPrice: boolean;
  calculatedPriceRub: number | null;
  dripFloorWarning?: string | null;
  isSubmitting: boolean;
  onBackToServices: () => void;
  onSubmit: (e: React.FormEvent) => void;
  setErrors: React.Dispatch<React.SetStateAction<FormErrors>>;
}
