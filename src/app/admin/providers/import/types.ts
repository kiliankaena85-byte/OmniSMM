export interface ExternalServiceMetrics {
  platform?: string | null;
  category?: string | null;
  targetCategory?: string | null;
  confidence?: number;
  priceAnomaly?: boolean;
  pricePerUnit?: number;
  marginPercent?: number;
  geo?: string | null;
  warranty?: number;
  anomalyScore?: number;
}

export interface ExternalServiceItem {
  service: string | number;
  name: string;
  type?: string;
  category?: string;
  rate?: number;
  min?: string | number;
  max?: string | number;
  dripfeed?: boolean;
  refill?: boolean;
  cancel?: boolean;
  isImported?: boolean;
  alreadyImported?: boolean;
  cleanName?: string | null;
  pricePerUnitProcurementRub?: number;
  metrics?: ExternalServiceMetrics;
  [key: string]: unknown;
}

export interface CategoryItem {
  id: string;
  name: string;
  slug?: string;
  networkId?: string | null;
  network?: {
    id?: string;
    name: string;
    slug?: string;
  } | null;
}

export interface ProviderItem {
  id: string;
  name: string;
  url?: string;
  status?: string;
}

export interface FilterState {
  page: number;
  pageSize: number;
  platform: string;
  geo: string;
  velocity: string;
  hasRefill: boolean;
  hasAnomaly: boolean;
  importStatus: string;
  search: string;
  sortBy: string;
  category: string;
  retailReady: boolean;
  providerCategory: string;
  minPrice: string;
  maxPrice: string;
}
