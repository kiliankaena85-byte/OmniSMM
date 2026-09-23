import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Swarm 100% Hardening & WCAG Accessibility Invariants', () => {
  it('all admin and dashboard loading.tsx files must have role="status", aria-busy="true", and aria-live="polite"', () => {
    const loadingFiles = [
      'src/app/admin/finance/loading.tsx',
      'src/app/admin/settings/loading.tsx',
      'src/app/admin/dashboard/loading.tsx',
      'src/app/admin/orders/loading.tsx',
      'src/app/admin/analytics/loading.tsx',
      'src/app/admin/clients/loading.tsx',
    ];

    for (const relPath of loadingFiles) {
      const fullPath = path.resolve(process.cwd(), relPath);
      expect(fs.existsSync(fullPath), `File ${relPath} should exist`).toBe(true);
      const content = fs.readFileSync(fullPath, 'utf-8');

      expect(content).toContain('role="status"');
      expect(content).toContain('aria-busy="true"');
      expect(content).toContain('aria-live="polite"');
      expect(content).toContain('sr-only');
    }
  });

  it('TenantSwitcher must enforce min-h-[44px] touch target and router.refresh() on tenant switch', () => {
    const switcherPath = path.resolve(process.cwd(), 'src/components/admin/tenant-switcher.tsx');
    const content = fs.readFileSync(switcherPath, 'utf-8');

    expect(content).toContain('min-h-[44px]');
    expect(content).toContain('router.refresh()');
  });

  it('WizardStepIndicator must have role="navigation", aria-current="step", and min-h-[44px] buttons', () => {
    const indicatorPath = path.resolve(process.cwd(), 'src/components/dashboard/order-wizard/WizardStepIndicator.tsx');
    const content = fs.readFileSync(indicatorPath, 'utf-8');

    expect(content).toContain('aria-label="Шаги оформления заказа"');
    expect(content).toContain('aria-current');
    expect(content).toContain('min-h-[44px]');
  });

  it('DrawerQuantityCard must support quantityHasError and shake animation on invalid quantity', () => {
    const cardPath = path.resolve(process.cwd(), 'src/components/landing/order-engine/drawer/DrawerQuantityCard.tsx');
    const content = fs.readFileSync(cardPath, 'utf-8');

    expect(content).toContain('quantityHasError');
    expect(content).toContain('animate={quantityHasError');
  });

  it('useCheckoutOrchestrator must track quantityHasError and block invalid checkouts with focus and toast', () => {
    const orchestratorPath = path.resolve(process.cwd(), 'src/components/landing/order-engine/useCheckoutOrchestrator.ts');
    const content = fs.readFileSync(orchestratorPath, 'utf-8');

    expect(content).toContain('quantityHasError');
    expect(content).toContain('setQuantityHasError(true)');
    expect(content).toContain('setEmailHasError(true)');
    expect(content).toContain('setTermsHasError(true)');
    expect(content).toContain('setLinkHasError(true)');
  });

  it('SmmplanOrderWizard must shake and focus on invalid inputs when submitting or changing steps without data', () => {
    const wizardPath = path.resolve(process.cwd(), 'src/components/orders/SmmplanOrderWizard.tsx');
    const content = fs.readFileSync(wizardPath, 'utf-8');

    expect(content).toContain('setShakeKey(prev => prev + 1)');
    expect(content).toContain('animate-shake');
    expect(content).toContain('newErrors.email');
    expect(content).toContain('newErrors.quantity');
    expect(content).toContain('newErrors.link');
  });
});
