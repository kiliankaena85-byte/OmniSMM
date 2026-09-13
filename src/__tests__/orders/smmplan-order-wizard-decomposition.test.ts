import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('SmmplanOrderWizard Monolith Decomposition Standards', () => {
  const wizardFile = path.resolve(process.cwd(), 'src/components/orders/SmmplanOrderWizard.tsx');
  const wizardDir = path.resolve(process.cwd(), 'src/components/orders/wizard');

  it('MUST decompose SmmplanOrderWizard.tsx to <= 200 lines', () => {
    expect(fs.existsSync(wizardFile)).toBe(true);
    const content = fs.readFileSync(wizardFile, 'utf-8');
    const lines = content.split('\n').length;
    expect(lines).toBeLessThanOrEqual(200);
  });

  it('MUST preserve all security and hardening tokens in SmmplanOrderWizard.tsx', () => {
    const content = fs.readFileSync(wizardFile, 'utf-8');
    expect(content).toContain('setShakeKey(prev => prev + 1)');
    expect(content).toContain('animate-shake');
    expect(content).toContain('newErrors.email');
    expect(content).toContain('newErrors.quantity');
    expect(content).toContain('newErrors.link');
  });

  it('MUST contain decomposed subcomponents under src/components/orders/wizard each <= 200 lines', () => {
    expect(fs.existsSync(wizardDir)).toBe(true);
    const files = [
      'types.ts',
      'helpers.ts',
      'useSmmplanOrderWizard.ts',
      'WizardHeader.tsx',
      'WizardStepIndicator.tsx',
      'WizardStepNetwork.tsx',
      'WizardStepCategory.tsx',
      'WizardStepService.tsx',
      'WizardStepCheckout.tsx'
    ];

    for (const file of files) {
      const filePath = path.join(wizardDir, file);
      expect(fs.existsSync(filePath), 'Expected ' + file + ' to exist in wizard/').toBe(true);
      const lines = fs.readFileSync(filePath, 'utf-8').split('\n').length;
      expect(lines, 'Expected ' + file + ' to be <= 200 lines (got ' + lines + ')').toBeLessThanOrEqual(200);
    }
  });
});
