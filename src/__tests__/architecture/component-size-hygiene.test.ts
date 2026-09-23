import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Architectural Component Size & Code Hygiene Standards (Maker-Checker Gate)', () => {
  const rootDir = process.cwd();

  const filesToAudit = [
    {
      filePath: path.join(rootDir, 'src/components/landing/SmartLinkLanding.tsx'),
      maxLines: 200,
      name: 'SmartLinkLanding.tsx'
    },
    {
      filePath: path.join(rootDir, 'src/components/landing/LandingHeroArea.tsx'),
      maxLines: 200,
      name: 'LandingHeroArea.tsx'
    },
    {
      filePath: path.join(rootDir, 'src/components/landing/LandingCatalogContent.tsx'),
      maxLines: 200,
      name: 'LandingCatalogContent.tsx'
    },
    {
      filePath: path.join(rootDir, 'src/components/landing/LandingFooterSection.tsx'),
      maxLines: 200,
      name: 'LandingFooterSection.tsx'
    },
    {
      filePath: path.join(rootDir, 'src/components/landing/LandingModals.tsx'),
      maxLines: 200,
      name: 'LandingModals.tsx'
    },
    {
      filePath: path.join(rootDir, 'src/components/landing/order-engine/variants/PlanFullscreenCheckout.tsx'),
      maxLines: 200,
      name: 'PlanFullscreenCheckout.tsx'
    },
    {
      filePath: path.join(rootDir, 'src/components/landing/order-engine/variants/PlanCheckoutHeader.tsx'),
      maxLines: 200,
      name: 'PlanCheckoutHeader.tsx'
    },
    {
      filePath: path.join(rootDir, 'src/components/landing/order-engine/variants/PlanCheckoutInputs.tsx'),
      maxLines: 200,
      name: 'PlanCheckoutInputs.tsx'
    },
    {
      filePath: path.join(rootDir, 'src/components/landing/order-engine/variants/PlanCheckoutCustomData.tsx'),
      maxLines: 200,
      name: 'PlanCheckoutCustomData.tsx'
    },
    {
      filePath: path.join(rootDir, 'src/components/landing/order-engine/variants/PlanCheckoutQuantity.tsx'),
      maxLines: 200,
      name: 'PlanCheckoutQuantity.tsx'
    },
    {
      filePath: path.join(rootDir, 'src/components/landing/order-engine/variants/PlanCheckoutGateways.tsx'),
      maxLines: 200,
      name: 'PlanCheckoutGateways.tsx'
    },
    {
      filePath: path.join(rootDir, 'src/components/landing/order-engine/variants/PlanCheckoutSummary.tsx'),
      maxLines: 200,
      name: 'PlanCheckoutSummary.tsx'
    },
    {
      filePath: path.join(rootDir, 'src/components/landing/order-engine/variants/usePlanCheckoutValidation.ts'),
      maxLines: 200,
      name: 'usePlanCheckoutValidation.ts'
    },
    {
      filePath: path.join(rootDir, 'src/components/landing/order-engine/wizard-steps/MobileStep4Checkout.tsx'),
      maxLines: 200,
      name: 'MobileStep4Checkout.tsx'
    },
    {
      filePath: path.join(rootDir, 'src/components/landing/order-engine/wizard-steps/MobileCheckoutLinkField.tsx'),
      maxLines: 200,
      name: 'MobileCheckoutLinkField.tsx'
    },
    {
      filePath: path.join(rootDir, 'src/components/landing/order-engine/wizard-steps/MobileCheckoutQuantity.tsx'),
      maxLines: 200,
      name: 'MobileCheckoutQuantity.tsx'
    },
    {
      filePath: path.join(rootDir, 'src/components/landing/order-engine/wizard-steps/MobileCheckoutInputs.tsx'),
      maxLines: 200,
      name: 'MobileCheckoutInputs.tsx'
    },
    {
      filePath: path.join(rootDir, 'src/components/landing/order-engine/wizard-steps/MobileCheckoutGateways.tsx'),
      maxLines: 200,
      name: 'MobileCheckoutGateways.tsx'
    },
    {
      filePath: path.join(rootDir, 'src/components/landing/order-engine/wizard-steps/MobileCheckoutOrderSummary.tsx'),
      maxLines: 200,
      name: 'MobileCheckoutOrderSummary.tsx'
    },
    {
      filePath: path.join(rootDir, 'src/components/landing/order-engine/variants/PlanCheckoutPromo.tsx'),
      maxLines: 200,
      name: 'PlanCheckoutPromo.tsx'
    },
    {
      filePath: path.join(rootDir, 'src/components/landing/order-engine/variants/PlanCheckoutLink.tsx'),
      maxLines: 200,
      name: 'PlanCheckoutLink.tsx'
    },
    {
      filePath: path.join(rootDir, 'src/components/landing/order-engine/wizard-steps/MobileCheckoutPromo.tsx'),
      maxLines: 200,
      name: 'MobileCheckoutPromo.tsx'
    }
  ];

  it.each(filesToAudit)('should not exceed $maxLines lines for $name', ({ filePath, maxLines, name }) => {
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    expect(lines, `${name} has ${lines} lines, exceeding the limit of ${maxLines} lines`).toBeLessThanOrEqual(maxLines);
  });

  it('should not contain eslint-disable comments for unused variables in SmartLinkLanding', () => {
    const filePath = path.join(rootDir, 'src/components/landing/SmartLinkLanding.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).not.toContain('eslint-disable-next-line @typescript-eslint/no-unused-vars');
    expect(content).not.toContain('SocialIcon');
  });

  it('should not contain un-typed (res.data as any) casts in useCheckoutOrchestrator', () => {
    const filePath = path.join(rootDir, 'src/components/landing/order-engine/useCheckoutOrchestrator.ts');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).not.toContain('(res.data as any)');
    expect(content).not.toContain('eslint-disable-next-line @typescript-eslint/no-unused-vars');
  });

  it('should not use untyped srv: any in LandingModals', () => {
    const filePath = path.join(rootDir, 'src/components/landing/LandingModals.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).not.toContain('srv: any');
  });

  it('should not use hardcoded non-semantic text-white in MobileStep4Checkout', () => {
    const filePath = path.join(rootDir, 'src/components/landing/order-engine/wizard-steps/MobileStep4Checkout.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).not.toContain('bg-emerald-500 text-white');
  });
});
