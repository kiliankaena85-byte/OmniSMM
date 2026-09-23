import type { PublicNetwork, PublicCategory, PublicService } from "@/actions/order/catalog";
import type { PricingResult } from "@/services/marketing.service";

export type Step = 'link' | 'network' | 'category' | 'service' | 'checkout';

export interface SlideWizardState {
  step: Step;
  direction: number;
  enteredViaCatalog: boolean;
  link: string;
  isAnalyzing: boolean;
  activeNetwork: PublicNetwork | null;
  activeCategory: PublicCategory | null;
  services: PublicService[];
  selectedService: PublicService | null;
  isLoadingServices: boolean;
  quantity: number | string;
  email: string;
  isRequirementsConfirmed: boolean;
  isDripFeedEnabled: boolean;
  dripRuns: number;
  dripInterval: number;
  customData: string;
  isGuideOpen: boolean;
  detectedType: string | null;
  suggestedCategories: string[];
  selectedGateway: string;
  availableGateways: { yookassa: boolean; robokassa: boolean; cryptobot: boolean } | null;
  promoCode: string;
  appliedPromo: string;
  isApplyingPromo: boolean;
  promoMessage: { type: "success" | "error"; text: string } | null;
  showPromo: boolean;
  serverPricing: PricingResult | null;
}
