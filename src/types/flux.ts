export type FluxOrderStatus = 
  | 'PENDING'
  | 'PENDING_CHECK'
  | 'PROVISIONING'
  | 'AWAITING_PAYMENT'
  | 'IN_PROGRESS'
  | 'PARTIAL'
  | 'COMPLETED'
  | 'CANCELED'
  | 'ERROR';

export interface FluxNetwork {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  categories?: FluxCategory[];
}

export interface FluxCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  serviceCount?: number;
  services?: FluxService[];
}

export interface FluxService {
  id: string;
  numericId?: number;
  name: string;
  description?: string | null;
  pricePer1kRub: number;
  pricePerUnitRub: number;
  minQty: number;
  maxQty: number;
  targetType?: string | null;
  networkSlug?: string;
  categorySlug?: string;
  etaMinutes?: number | null;
  averageSpeed?: string | null;
  speed?: string | null;
  guaranteeDays?: number | null;
  customDataType?: string | null;
  customDataLabel?: string | null;
  clientRequirement?: string | null;
  warningMessage?: string | null;
  clientConfirmation?: boolean | string | null;
  requireWarning?: boolean | string | null;
  isDripFeedEnabled?: boolean;
}

export interface FluxOrder {
  id: string;
  numericId: number;
  status: FluxOrderStatus | string;
  charge: number;
  chargeCents?: number;
  discountCents?: number;
  usdToRubRate?: number | null;
  quantity: number;
  remains: number | null;
  startCount?: number | null;
  link: string;
  error?: string | null;
  createdAt: string;
  isDripFeed?: boolean;
  runs?: number | null;
  interval?: number | null;
  currentRun?: number;
  nextRunAt?: string | null;
  refills?: Array<{
    id: string;
    status: string;
    createdAt: string;
  }>;
  service: {
    id?: string;
    name: string;
    categoryId?: string;
    isRefillEnabled?: boolean;
    network: {
      slug: string;
      name?: string;
    };
  };
}

export interface StatusConfig {
  label: string;
  badgeClass: string;
  dotClass: string;
}

