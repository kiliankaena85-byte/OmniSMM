import { describe, it, expect } from 'vitest';
import { TenantIsolationLinter } from '../../../scripts/lint-tenant-isolation';
import { registerValidTenant, normalizeTenantId, VALID_TENANTS } from '@/lib/tenant-resolver-edge';

describe('Tenant Isolation Architecture & AST Guardrails (SDD-TDD 2026)', () => {
  const linter = new TenantIsolationLinter();

  describe('Rule 1: tenant-where-clause-required (BOLA/IDOR Defense)', () => {
    it('should detect a missing tenantId in Prisma findMany query', () => {
      const snippet = `
        export async function getOrders() {
          return await db.order.findMany({
            where: { status: 'PENDING' }
          });
        }
      `;
      const violations = linter.analyzeSnippet('src/actions/test-orders.ts', snippet);
      const blocker = violations.find((v) => v.ruleId === 'tenant-where-clause-required');
      expect(blocker).toBeDefined();
      expect(blocker?.severity).toBe('BLOCKER');
      expect(blocker?.message).toContain('tenantId');
    });

    it('should pass when tenantId is present in where clause', () => {
      const snippet = `
        export async function getOrders(tenantId: string) {
          return await db.order.findMany({
            where: { status: 'PENDING', tenantId }
          });
        }
      `;
      const violations = linter.analyzeSnippet('src/actions/test-orders.ts', snippet);
      const blocker = violations.find((v) => v.ruleId === 'tenant-where-clause-required');
      expect(blocker).toBeUndefined();
    });

    it('should respect // tenant-isolation-ignore comment with clear rationale', () => {
      const snippet = `
        export async function globalOutboxWorker() {
          // tenant-isolation-ignore: Provider queue worker handles cross-tenant outbox events
          return await db.order.findMany({
            where: { status: 'QUEUED' }
          });
        }
      `;
      const violations = linter.analyzeSnippet('src/workers/outbox.ts', snippet);
      const blocker = violations.find((v) => v.ruleId === 'tenant-where-clause-required');
      expect(blocker).toBeUndefined();
    });
  });

  describe('Rule 2: tenant-cache-key-required (Zero Brand Bleeding)', () => {
    it('should flag unstable_cache calls that lack tenantId in cache key', () => {
      const snippet = `
        export const getCatalog = unstable_cache(
          async () => db.service.findMany({ where: { isActive: true } }),
          ['global-catalog-cache'],
          { revalidate: 3600 }
        );
      `;
      const violations = linter.analyzeSnippet('src/services/catalog.service.ts', snippet);
      const cacheViolation = violations.find((v) => v.ruleId === 'tenant-cache-key-required');
      expect(cacheViolation).toBeDefined();
      expect(cacheViolation?.severity).toBe('MAJOR');
    });

    it('should pass unstable_cache calls that include tenantId in cache key and tag', () => {
      const snippet = `
        export const getCatalog = (tenantId: string) => unstable_cache(
          async () => db.service.findMany({ where: { isActive: true, tenantId } }),
          ['catalog-services', tenantId],
          { revalidate: 3600, tags: [\`catalog-\${tenantId}\`] }
        )();
      `;
      const violations = linter.analyzeSnippet('src/services/catalog.service.ts', snippet);
      const cacheViolation = violations.find((v) => v.ruleId === 'tenant-cache-key-required');
      expect(cacheViolation).toBeUndefined();
    });
  });

  describe('Rule 3: no-phantom-brand-ghosting (Zero Ghosting)', () => {
    it('should flag usage of phantom brand "lovable" in UI components', () => {
      const snippet = `
        export function BadBrandBanner() {
          return <div className="brand-lovable">Lovable SMM Platform</div>;
        }
      `;
      const violations = linter.analyzeSnippet('src/components/BadBanner.tsx', snippet);
      const ghostViolation = violations.find((v) => v.ruleId === 'no-phantom-brand-ghosting');
      expect(ghostViolation).toBeDefined();
      expect(ghostViolation?.severity).toBe('BLOCKER');
    });

    it('should allow legacy fallback in tenant-resolver-edge.ts', () => {
      const snippet = `
        export function normalizeTenantId(val: string) {
          return val === 'lovable' ? 'flux' : val;
        }
      `;
      const violations = linter.analyzeSnippet('src/lib/tenant-resolver-edge.ts', snippet);
      const ghostViolation = violations.find((v) => v.ruleId === 'no-phantom-brand-ghosting');
      expect(ghostViolation).toBeUndefined();
    });
  });

  describe('Dynamic N-Tenants Scaling & Investor Headless Support', () => {
    it('should dynamically register a new investor tenant without modifying hardcoded sets', () => {
      const investorSlug = 'investor_alpha_99';
      expect(VALID_TENANTS.has(investorSlug)).toBe(false);

      registerValidTenant(investorSlug);
      expect(VALID_TENANTS.has(investorSlug)).toBe(true);

      const resolved = normalizeTenantId(investorSlug);
      expect(resolved).toBe(investorSlug);
    });
  });
});
