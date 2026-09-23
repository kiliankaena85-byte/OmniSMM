/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Provider Form Types & Shared UI Contracts
 */
import type { ApiMappingDTO, ProviderDetailDTO } from '@/services/admin/provider.service';
import type { ProviderProbeResult } from '@/services/admin/provider-diagnostic.service';

export type HttpMethod = 'POST' | 'GET';
export type ContentType = 'form' | 'json';
export type AuthType = 'body' | 'query' | 'header';
export type IntegrationMode = 'standard' | 'visual' | 'json';

export interface MappingState {
  httpMethod: 'POST' | 'GET';
  contentType: 'form' | 'json';
  authType: 'body' | 'query' | 'header';
  authField: string;
  authPrefix: string;
  serviceField: string;
  linkField: string;
  quantityField: string;
  orderIdField: string;
  errorField: string;
  itemsPath: string;
  serviceIdField: string;
  nameField: string;
  priceField: string;
  minField: string;
  maxField: string;
  typeField: string;
  descField: string;
  balancePath: string;
  currencyPath: string;
}

export interface InferredSchema {
  catalogKeys: string[];
  balanceKeys: string[];
  itemsPath: string;
}

export interface PreviewService {
  service: string | number;
  name: string;
  rate: number | string;
  min?: number | string;
  max?: number | string;
  category?: string;
  description?: string;
  type?: string;
  [key: string]: unknown;
}

export interface ProviderFormData {
  name: string;
  apiUrl: string;
  apiKey: string;
  isActive: boolean;
  balanceCurrency: string;
  ticketUrl: string;
}

export interface ProviderFormProps {
  /** If provided — edit mode. DTO-safe: never includes raw apiKey. */
  initialData?: ProviderDetailDTO;
}

// Input classes reused across all form controls
export const inputCls =
  'block w-full rounded-lg border border-border bg-background text-foreground ' +
  'text-base md:text-sm p-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ' +
  'placeholder:text-muted-foreground transition-all duration-200';

export const labelCls = 'block text-sm font-medium text-foreground mb-1';
