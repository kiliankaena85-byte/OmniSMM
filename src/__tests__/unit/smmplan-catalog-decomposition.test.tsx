// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import fs from 'fs';
import path from 'path';

describe('Wave 16: SMMplan Catalog Decomposition (CDD-TDD)', () => {
  it('should ensure all created submodules obey the <= 200 lines rule', () => {
    const filesToCheck = [
      'src/components/landing/catalog/catalog-data.ts',
      'src/components/landing/catalog/sub/PlatformRibbon.tsx',
      'src/components/landing/catalog/sub/CategoryRibbon.tsx',
      'src/components/landing/catalog/sub/CatalogServiceCard.tsx',
      'src/components/landing/catalog/FullscreenMasterCatalog.tsx',
      'src/components/landing/catalog/wizard/WizardProgress.tsx',
      'src/components/landing/catalog/wizard/WizardStepPlatform.tsx',
      'src/components/landing/catalog/wizard/WizardStepCategory.tsx',
      'src/components/landing/catalog/wizard/WizardStepService.tsx',
      'src/components/landing/catalog/wizard/WizardPaymentGateways.tsx',
      'src/components/landing/catalog/wizard/WizardStepCheckout.tsx',
      'src/components/landing/catalog/StepByStepWizard.tsx',
    ];

    for (const relPath of filesToCheck) {
      const fullPath = path.resolve(process.cwd(), relPath);
      expect(fs.existsSync(fullPath), `File ${relPath} should exist`).toBe(true);
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n').length;
      // Allow catalog-data to be slightly larger if data list is long, but UI components strictly <= 200
      if (!relPath.endsWith('catalog-data.ts')) {
        expect(lines, `Component ${relPath} has ${lines} lines, expected <= 200`).toBeLessThanOrEqual(200);
      }
    }
  });

  it('should render FullscreenMasterCatalog without crashing', async () => {
    const { FullscreenMasterCatalog } = await import('@/components/landing/catalog/FullscreenMasterCatalog');
    const { container } = render(<FullscreenMasterCatalog />);
    expect(container).toBeDefined();
    expect(container.textContent).toContain('Выберите социальную сеть');
  });

  it('should render StepByStepWizard without crashing', async () => {
    const { StepByStepWizard } = await import('@/components/landing/catalog/StepByStepWizard');
    const { container } = render(<StepByStepWizard />);
    expect(container).toBeDefined();
    expect(container.textContent).toContain('Шаг 1: Выберите социальную сеть');
  });
});
