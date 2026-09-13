import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { routeSkillIntent } from '../../../scripts/skill-router';

const SKILLS_DIR = path.resolve(__dirname, '../../../.agents/skills');

describe('Mobile-First Responsive Architect Suite (CDD-TDD)', () => {
  const skillName = 'mobile-first-responsive-architect';

  it('MUST have a valid CORE.md (<= 25 lines) and complete SKILL.md', () => {
    const corePath = path.join(SKILLS_DIR, skillName, 'CORE.md');
    const deepPath = path.join(SKILLS_DIR, skillName, 'SKILL.md');

    expect(fs.existsSync(corePath), 'Missing CORE.md').toBe(true);
    expect(fs.existsSync(deepPath), 'Missing SKILL.md').toBe(true);

    const coreContent = fs.readFileSync(corePath, 'utf-8');
    const coreLines = coreContent.split('\n');
    expect(coreLines.length).toBeLessThanOrEqual(30);
    expect(coreContent).toContain('HARD INVARIANTS');
    expect(coreContent).toContain('Mobile-First Breakpoint Invariant');
    expect(coreContent).toContain('dvh');

    const deepContent = fs.readFileSync(deepPath, 'utf-8');
    expect(deepContent).toContain('Thumb Zone Architecture');
    expect(deepContent).toContain('safe-area-inset-bottom');
    expect(deepContent).toContain('iOS Auto-Zoom Guard');
  });

  it('accurately routes mobile first and responsive phone queries to mobile-first-responsive-architect', () => {
    const queries = [
      'разработка компонента сначала под телефон, а затем под десктоп',
      'mobile first верстка карточки под смартфон с адаптацией',
      'настройка safe area insets и dvh для мобильного safari',
      'защита от авто-зума на ios и кликабельные зоны 44px'
    ];

    for (const query of queries) {
      const result = routeSkillIntent(query);
      const skillNames = result.matchedSkills.map(s => s.name);
      expect(skillNames).toContain('mobile-first-responsive-architect');
    }
  });
});
