// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import fs from 'fs';
import path from 'path';

vi.mock('@/actions/order/catalog', () => ({
  getServicesByCategoryAction: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/actions/order/checkout', () => ({
  getAvailableGatewaysAction: vi.fn().mockResolvedValue({ yookassa: true, robokassa: false, cryptobot: false }),
  checkoutAction: vi.fn().mockResolvedValue({ success: true }),
}));

describe('Wave 19: SMMflux A/B Test Order Client Decomposition (CDD-TDD)', () => {
  it('should ensure all created submodules obey the <= 200 lines rule', () => {
    const filesToCheck = [
      'src/components/ab-test/animations.ts',
      'src/components/ab-test/sub/FluxNavHeader.tsx',
      'src/components/ab-test/FluxOrderClient.tsx',
      'src/components/ab-test/flux-steps/sub/types.ts',
      'src/components/ab-test/flux-steps/sub/FluxStepCheckoutHeader.tsx',
      'src/components/ab-test/flux-steps/sub/FluxStepCheckoutInputs.tsx',
      'src/components/ab-test/flux-steps/sub/FluxStepCheckoutPaymentMethods.tsx',
      'src/components/ab-test/flux-steps/sub/FluxStepCheckoutDripAndCustom.tsx',
      'src/components/ab-test/flux-steps/FluxStepCheckout.tsx',
    ];

    for (const relPath of filesToCheck) {
      const fullPath = path.resolve(process.cwd(), relPath);
      expect(fs.existsSync(fullPath), `File ${relPath} should exist`).toBe(true);
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n').length;
      expect(lines, `Component ${relPath} has ${lines} lines, expected <= 200`).toBeLessThanOrEqual(200);
    }
  });

  it('should render FluxOrderClient without crashing', async () => {
    const { FluxOrderClient } = await import('@/components/ab-test/FluxOrderClient');
    const { container } = render(<FluxOrderClient initialCatalog={[]} initialEmail="test@test.com" />);
    expect(container).toBeDefined();
  });
});
