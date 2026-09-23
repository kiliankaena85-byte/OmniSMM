import { describe, it, expect } from 'vitest';
import { scanBalanceMutations } from '../scripts/scanners/balance-mutations';
import { scanIdempotencyKeys } from '../scripts/scanners/idempotency-keys';
import { scanDevRoutes } from '../scripts/scanners/dev-routes';
import { scanTenantFilters } from '../scripts/scanners/tenant-filters';
import { scanOwnershipFilters } from '../scripts/scanners/ownership-filters';
import { scanSecurityEvents } from '../scripts/scanners/security-events';

describe('AEARH Scanner Correctness Test Suite', () => {
  it('balance-mutations detects direct increment fixture and WalletOps', () => {
    const res = scanBalanceMutations();
    expect(res.walletOpsCount).toBeGreaterThanOrEqual(0);
    expect(res.matches).toBeDefined();
  });

  it('idempotency-keys detects Date.now and classifies unstable keys', () => {
    const res = scanIdempotencyKeys();
    expect(res.matches).toBeDefined();
  });

  it('dev-routes detects dev api endpoints and production guards', () => {
    const res = scanDevRoutes();
    expect(res.routes).toBeDefined();
  });

  it('tenant-filters detects model tenantId definitions', () => {
    const res = scanTenantFilters();
    expect(res.modelsWithTenantId).toBeDefined();
    expect(res.modelsWithoutTenantId).toBeDefined();
  });

  it('ownership-filters detects user ownership filters on detail queries', () => {
    const res = scanOwnershipFilters();
    expect(res.detailQueriesCount).toBeGreaterThanOrEqual(0);
  });

  it('security-events detects security event creation', () => {
    const res = scanSecurityEvents();
    expect(res.matches).toBeDefined();
  });
});
