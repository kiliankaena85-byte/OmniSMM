import { ReactNode } from 'react';
import { enforceAnySectionAccess } from '@/lib/server/rbac';

/**
 * AUD-09 (4.1): coarse gate — a staff member with EITHER 'providers' OR
 * 'catalog' access may enter this area. Each nested page enforces its own
 * specific section (providers management vs. catalog import).
 */
export default async function ProvidersLayout({ children }: { children: ReactNode }) {
  await enforceAnySectionAccess(['providers', 'catalog']);
  return children;
}
