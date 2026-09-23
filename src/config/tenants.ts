export const TENANTS = [
  { id: 'smmplan', name: 'SMMplan', domain: 'smmplan.pro' },
  { id: 'flux', name: 'SMMflux', domain: 'smmflux.ru' },
] as const;

export type TenantId = typeof TENANTS[number]['id'];

export function isValidTenant(tenant: string | null | undefined): tenant is TenantId {
  if (!tenant) return false;
  return TENANTS.some(t => t.id === tenant);
}
