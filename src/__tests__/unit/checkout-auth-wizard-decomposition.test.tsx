// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import fs from 'fs';
import path from 'path';

describe('Wave 17: SMMplan Auth Modal & StepWizard Decomposition (CDD-TDD)', () => {
  it('should ensure all created submodules obey the <= 200 lines rule', () => {
    const filesToCheck = [
      'src/components/landing/order-engine/modals/auth/types.ts',
      'src/components/landing/order-engine/modals/auth/AuthPasswordTab.tsx',
      'src/components/landing/order-engine/modals/auth/AuthMagicLinkTab.tsx',
      'src/components/landing/order-engine/modals/CheckoutAuthModal.tsx',
      'src/components/landing/order-engine/variants/step-wizard/StepWizardHeader.tsx',
      'src/components/landing/order-engine/variants/step-wizard/StepWizardStepper.tsx',
      'src/components/landing/order-engine/variants/step-wizard/StepWizardParamsStep.tsx',
      'src/components/landing/order-engine/variants/step-wizard/StepWizardPaymentStep.tsx',
      'src/components/landing/order-engine/variants/step-wizard/StepWizardFooter.tsx',
      'src/components/landing/order-engine/variants/StepWizardCheckout.tsx',
    ];

    for (const relPath of filesToCheck) {
      const fullPath = path.resolve(process.cwd(), relPath);
      expect(fs.existsSync(fullPath), `File ${relPath} should exist`).toBe(true);
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n').length;
      expect(lines, `Component ${relPath} has ${lines} lines, expected <= 200`).toBeLessThanOrEqual(200);
    }
  });

  it('should render CheckoutAuthModal without crashing', async () => {
    const { CheckoutAuthModal } = await import('@/components/landing/order-engine/modals/CheckoutAuthModal');
    const { container } = render(
      <CheckoutAuthModal
        isOpen={true}
        onClose={() => {}}
        email="test@example.com"
        onAuthSuccess={() => {}}
      />
    );
    expect(container).toBeDefined();
    expect(container.textContent).toContain('Вход в аккаунт');
  });
});
