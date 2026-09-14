/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Centralized Multi-Tenant Configuration & Legal Single Source of Truth
 */

import { normalizeTenantId } from '@/lib/tenant-resolver-edge';

export interface TenantLegalConfig {
  name: string;
  inn: string;
  ogrn: string;
  email: string;
  address?: string;
  supportPhone?: string;
}

export interface TenantConfig {
  id: string;
  name: string;
  brandName: string;
  domain: string;
  url: string;
  legal: TenantLegalConfig;
}

export const TENANT_CONFIG: Record<string, TenantConfig> = {
  smmplan: {
    id: 'smmplan',
    name: 'SMMplan',
    brandName: 'SMMplan',
    domain: 'smmplan.pro',
    url: 'https://smmplan.pro',
    legal: {
      name: 'ИП Соколов Артём Андреевич',
      inn: '695006320024',
      ogrn: '310695218000138',
      email: 'support@smmplan.pro',
      address: 'г. Тверь'
    }
  },
  flux: {
    id: 'flux',
    name: 'SMMflux',
    brandName: 'SMMflux',
    domain: 'smmflux.ru',
    url: 'https://smmflux.ru',
    legal: {
      name: 'SMMflux',
      inn: '',
      ogrn: '',
      email: 'support@smmflux.ru'
    }
  }
};

export function getTenantConfig(tenantId?: string | null): TenantConfig {
  const norm = typeof tenantId === 'string' ? normalizeTenantId(tenantId) : 'smmplan';
  const key = norm || 'smmplan';
  return TENANT_CONFIG[key] || TENANT_CONFIG.smmplan;
}
