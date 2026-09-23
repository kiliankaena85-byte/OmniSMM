import { describe, it, expect } from 'vitest';
import { CleanArchitectureGuard } from '../../scripts/check-clean-architecture';

describe('Clean Architecture Boundary Guard (Uncle Bob Pattern)', () => {
  it('should enforce 0 Clean Architecture dependency violations across the entire codebase', () => {
    const guard = new CleanArchitectureGuard();
    const { passed, ir } = guard.run();

    if (!passed) {
      console.error('Architecture Violations:', JSON.stringify(ir.violations, null, 2));
      console.error('Cycles:', JSON.stringify(ir.cycles, null, 2));
    }

    expect(ir.metrics.violationsCount).toBe(0);
    expect(ir.metrics.cyclesCount).toBe(0);
    expect(ir.metrics.blockersCount).toBe(0);
    expect(passed).toBe(true);
  });

  it('should verify that topology IR contains all 4 architectural layers', () => {
    const guard = new CleanArchitectureGuard();
    const { ir } = guard.run();

    expect(ir.layers).toHaveLength(4);
    const layerNames = ir.layers.map((l) => l.name);
    expect(layerNames).toContain('Domain');
    expect(layerNames).toContain('Services');
    expect(layerNames).toContain('Application');
    expect(layerNames).toContain('Presentation');
    expect(ir.nodes.length).toBeGreaterThan(1000);
    expect(ir.edges.length).toBeGreaterThan(3000);
  });

  it('should calculate McCabe Cyclomatic Complexity, CRAP score and Bounded Contexts', () => {
    const guard = new CleanArchitectureGuard();
    const { ir } = guard.run();

    expect(ir.metrics.totalFunctions).toBeGreaterThan(5000);
    expect(ir.metrics.highestCrapModule).not.toBeNull();
    expect(ir.metrics.highestCrapModule?.maxCC).toBeGreaterThan(10);

    const boundedContexts = new Set(ir.nodes.map((n) => n.boundedContext));
    expect(boundedContexts.has('FINTECH_LEDGER')).toBe(true);
    expect(boundedContexts.has('ORDERS_CHECKOUT')).toBe(true);
    expect(boundedContexts.has('CATALOG_INGESTION')).toBe(true);
    expect(boundedContexts.has('MULTI_TENANT_CORE')).toBe(true);
    expect(boundedContexts.has('ASYNC_DAEMONS')).toBe(true);
  });
});
