import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { routeSkillIntent } from '../../../scripts/skill-router';

const SKILLS_DIR = path.resolve(__dirname, '../../../.agents/skills');

describe('OmniSMM Checkout Integrity Guard Suite (CDD-TDD)', () => {
  const skillName = 'omnismm-checkout-integrity-guard';

  it('MUST have valid CORE.md (<= 30 lines) and complete SKILL.md', () => {
    const corePath = path.join(SKILLS_DIR, skillName, 'CORE.md');
    const deepPath = path.join(SKILLS_DIR, skillName, 'SKILL.md');

    expect(fs.existsSync(corePath), 'Missing CORE.md').toBe(true);
    expect(fs.existsSync(deepPath), 'Missing SKILL.md').toBe(true);

    const coreContent = fs.readFileSync(corePath, 'utf-8');
    const coreLines = coreContent.split('\n');
    expect(coreLines.length).toBeLessThanOrEqual(30);
    expect(coreContent).toContain('HARD INVARIANTS');
    expect(coreContent).toContain('Zero Float Drift');
    expect(coreContent).toContain('Drip-Feed Floor Synchronizer');
    expect(coreContent).toContain('Active CTA Only');

    const deepContent = fs.readFileSync(deepPath, 'utf-8');
    expect(deepContent).toContain('INV-1: Зеркалирование ExactMath');
    expect(deepContent).toContain('INV-2: Динамический синхронизатор Drip-Feed Floor');
    expect(deepContent).toContain('INV-5: Мобильный тач');
    expect(deepContent).toContain('SmmplanOrderWizard.tsx');
  });

  it('accurately routes checkout, order wizard, and drip-feed queries to omnismm-checkout-integrity-guard', () => {
    const queries = [
      'рефакторинг визарда заказов и расчет drip-feed',
      'декомпозиция SmmplanOrderWizard и проверка цен',
      'оформление заказа с проверкой tenantId и numeric инпутом',
      'калькулятор заказа с защитой от расхождения копеек'
    ];

    for (const q of queries) {
      const result = routeSkillIntent(q);
      const skillNames = result.matchedSkills.map(s => s.name);
      expect(skillNames).toContain('omnismm-checkout-integrity-guard');
    }
  });
});
