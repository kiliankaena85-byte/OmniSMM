import type { AdminRunbook } from '@/types/admin-ai-manual';
import { CATALOG_RUNBOOKS } from './catalog-runbooks';
import { FINANCE_RUNBOOKS } from './finance-runbooks';
import { ORDERS_RUNBOOKS } from './orders-runbooks';
import { SECURITY_RUNBOOKS } from './security-runbooks';
import { INFRA_RUNBOOKS } from './infra-runbooks';

export const CURATED_ADMIN_RUNBOOKS: AdminRunbook[] = [
  ...CATALOG_RUNBOOKS,
  ...FINANCE_RUNBOOKS,
  ...ORDERS_RUNBOOKS,
  ...SECURITY_RUNBOOKS,
  ...INFRA_RUNBOOKS,
];

export {
  CATALOG_RUNBOOKS,
  FINANCE_RUNBOOKS,
  ORDERS_RUNBOOKS,
  SECURITY_RUNBOOKS,
  INFRA_RUNBOOKS,
};
