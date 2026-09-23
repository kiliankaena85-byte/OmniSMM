// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('OrderSummaryCard Monolith Decomposition Standards (Wave 13)', () => {
  const rootDir = process.cwd();
  const coordinatorFile = path.resolve(rootDir, 'src/components/orders/sub/OrderSummaryCard.tsx');
  const summaryDir = path.resolve(rootDir, 'src/components/orders/sub/summary');

  it('MUST keep coordinator OrderSummaryCard.tsx <= 200 lines', () => {
    expect(fs.existsSync(coordinatorFile)).toBe(true);
    const content = fs.readFileSync(coordinatorFile, 'utf-8');
    const lines = content.split('\n').length;
    expect(lines, `Expected coordinator to be <= 200 lines, got ${lines}`).toBeLessThanOrEqual(200);
  });

  it('MUST contain all decomposed submodules in src/components/orders/sub/summary/', () => {
    expect(fs.existsSync(summaryDir), 'Expected summary/ directory to exist').toBe(true);

    const expectedFiles = [
      'types.ts',
      'order-summary-preflight.ts',
      'useOrderSummarySubmit.ts',
      'OrderSummaryEmptyState.tsx',
      'OrderSummaryCustomData.tsx',
      'OrderSummaryInputs.tsx',
      'OrderSummaryDripSection.tsx',
      'OrderSummaryPricingGateway.tsx',
      'OrderSummarySubmitBar.tsx',
      'OrderRequirementsModal.tsx',
    ];

    for (const file of expectedFiles) {
      const filePath = path.join(summaryDir, file);
      expect(fs.existsSync(filePath), `Expected ${file} to exist in summary/`).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').length;
      expect(lines, `Expected ${file} to be <= 200 lines, got ${lines}`).toBeLessThanOrEqual(200);
    }
  });

  it('MUST preserve all critical tokens and safety features in OrderSummaryCard and submodules', () => {
    const coordinatorContent = fs.readFileSync(coordinatorFile, 'utf-8');
    expect(coordinatorContent).toContain('OrderSummaryCard');
    expect(coordinatorContent).toContain('ActionForm');

    const emptyStateContent = fs.readFileSync(path.join(summaryDir, 'OrderSummaryEmptyState.tsx'), 'utf-8');
    expect(emptyStateContent).toContain('3D-Secure 2.0');
    expect(emptyStateContent).toContain('Защита Escrow');

    const submitContent = fs.readFileSync(path.join(summaryDir, 'OrderSummarySubmitBar.tsx'), 'utf-8');
    expect(submitContent).toContain('/legal/terms');
    expect(submitContent).toContain('/legal/privacy');

    const pricingContent = fs.readFileSync(path.join(summaryDir, 'OrderSummaryPricingGateway.tsx'), 'utf-8');
    expect(pricingContent).toContain('Минимальный платеж эквайринга — 10 ₽');
  });

  it('MUST export OrderSummaryCardProps from types.ts', async () => {
    const typesPath = path.join(summaryDir, 'types.ts');
    expect(fs.existsSync(typesPath)).toBe(true);
    const content = fs.readFileSync(typesPath, 'utf-8');
    expect(content).toContain('OrderSummaryCardProps');
    expect(content).toContain('inputCls');
  });
});
