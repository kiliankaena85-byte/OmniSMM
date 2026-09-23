// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import fs from 'fs';
import path from 'path';

vi.mock('@/actions/order/catalog', () => ({
  getPublicCatalogAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getServicesByCategoryAction: vi.fn().mockResolvedValue([]),
}));

describe('Wave 18: SMMflux Dashboard Order Wizard Decomposition (CDD-TDD)', () => {
  it('should ensure all created submodules obey the <= 200 lines rule', () => {
    const filesToCheck = [
      'src/components/dashboard/flux/sub/FluxWizardStepBar.tsx',
      'src/components/dashboard/flux/sub/FluxWizardSuccessCard.tsx',
      'src/components/dashboard/flux/FluxDashboardOrderWizard.tsx',
      'src/components/dashboard/flux/wizard-steps/checkout-sub/types.ts',
      'src/components/dashboard/flux/wizard-steps/checkout-sub/FluxCheckoutServiceHeader.tsx',
      'src/components/dashboard/flux/wizard-steps/checkout-sub/FluxCheckoutLinkAndQty.tsx',
      'src/components/dashboard/flux/wizard-steps/checkout-sub/FluxCheckoutDripFeed.tsx',
      'src/components/dashboard/flux/wizard-steps/checkout-sub/FluxCheckoutCustomDataAndRequirements.tsx',
      'src/components/dashboard/flux/wizard-steps/checkout-sub/FluxCheckoutPromoCard.tsx',
      'src/components/dashboard/flux/wizard-steps/checkout-sub/FluxCheckoutPaymentSelector.tsx',
      'src/components/dashboard/flux/wizard-steps/checkout-sub/FluxCheckoutSummaryBar.tsx',
      'src/components/dashboard/flux/wizard-steps/FluxDashboardStepCheckout.tsx',
    ];

    for (const relPath of filesToCheck) {
      const fullPath = path.resolve(process.cwd(), relPath);
      expect(fs.existsSync(fullPath), `File ${relPath} should exist`).toBe(true);
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n').length;
      expect(lines, `Component ${relPath} has ${lines} lines, expected <= 200`).toBeLessThanOrEqual(200);
    }
  });

  it('should render FluxDashboardOrderWizard without crashing', async () => {
    const { FluxDashboardOrderWizard } = await import('@/components/dashboard/flux/FluxDashboardOrderWizard');
    const { container } = render(<FluxDashboardOrderWizard userEmail="test@test.com" userBalanceCents={50000} />);
    expect(container).toBeDefined();
  });
});
