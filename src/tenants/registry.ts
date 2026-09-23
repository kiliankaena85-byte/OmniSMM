import { ITenantDashboardStrategy } from './types';

// Map of registered tenant loaders for Dynamic Lazy Loading (Code-Splitting F4 protection)
const registry = new Map<string, () => Promise<{ default: ITenantDashboardStrategy }>>();

export function registerTenant(id: string, loader: () => Promise<{ default: ITenantDashboardStrategy }>) {
  if (registry.has(id)) {
    return;
  }
  registry.set(id, loader);
}

export function getTenantLoader(id: string) {
  return registry.get(id);
}

// Initial registrations (Open-Closed Self-Registration)
registerTenant('smmplan', () => import('./smmplan/strategy'));
registerTenant('flux', () => import('./flux/strategy'));
registerTenant('lovable', () => import('./flux/strategy')); // Legacy alias for backward compatibility
