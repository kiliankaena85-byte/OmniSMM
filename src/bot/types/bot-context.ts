import { Scenes, Context } from 'telegraf';

export interface OrderWizardData {
  service?: {
    id: string;
    numericId: number;
    name: string;
    pricePer1000Cents: number;
    minQty: number;
    maxQty: number;
    isDripFeedEnabled?: boolean;
    price?: number;
    min?: number;
    max?: number;
    features?: unknown;
    category?: { name: string } | string;
    targetType?: string;
    rate?: number;
    markup?: number;
    providerCurrency?: string;
  };
  qty?: number;
  isDripFeed?: boolean;
  runs?: number;
  interval?: number;
  link?: string;
  tempLink?: string;
  isLinkOverridden?: boolean;
  requirementsConfirmed?: boolean;
  totalCents?: number;
  providerCostCents?: number;
  totalQuantity?: number;
  minQty?: number;
  maxQty?: number;
}

export interface DepositWizardData {
  amount?: number;
  amountRub?: number;
  gateway?: string;
}

export interface BotWizardSession extends Scenes.WizardSessionData {
  orderData?: OrderWizardData;
  depositData?: DepositWizardData;
  preSelectedService?: unknown;
  amountRub?: number;
  gateway?: string;
  activeLink?: string;
  [key: string]: unknown;
}

export type BotContext = Scenes.WizardContext<BotWizardSession> & {
  payload?: string;
  match?: RegExpExecArray;
};
