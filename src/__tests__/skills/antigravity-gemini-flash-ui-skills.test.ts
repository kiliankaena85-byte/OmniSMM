import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { routeSkillIntent } from '../../../scripts/skill-router';

const SKILLS_DIR = path.resolve(__dirname, '../../../.agents/skills');

describe('Antigravity & Gemini Flash UI Skills Suite (CDD-TDD)', () => {
  const skills = [
    'antigravity-flash-ui-refactor',
    'antigravity-widget-studio',
    'flash-component-decomposer'
  ];

  it('MUST have valid CORE.md (<= 30 lines) and complete SKILL.md for all 3 skills', () => {
    for (const name of skills) {
      const corePath = path.join(SKILLS_DIR, name, 'CORE.md');
      const deepPath = path.join(SKILLS_DIR, name, 'SKILL.md');

      expect(fs.existsSync(corePath), `Missing CORE.md for ${name}`).toBe(true);
      expect(fs.existsSync(deepPath), `Missing SKILL.md for ${name}`).toBe(true);

      const coreContent = fs.readFileSync(corePath, 'utf-8');
      const coreLines = coreContent.split('\n');
      expect(coreLines.length).toBeLessThanOrEqual(30);
      expect(coreContent).toContain('HARD INVARIANTS');
    }
  });

  it('accurately routes UI refactoring and chunked diff queries to antigravity-flash-ui-refactor', () => {
    const result = routeSkillIntent('рефакторинг интерфейса в Antigravity на gemini flash через chunked diff');
    const skillNames = result.matchedSkills.map(s => s.name);
    expect(skillNames).toContain('antigravity-flash-ui-refactor');
  });

  it('accurately routes widget studio and generative ui queries to antigravity-widget-studio', () => {
    const result = routeSkillIntent('создание интерактивного виджета калькулятора в чате antigravity через agent-embed');
    const skillNames = result.matchedSkills.map(s => s.name);
    expect(skillNames).toContain('antigravity-widget-studio');
  });

  it('accurately routes component decomposition and view-logic decoupling to flash-component-decomposer', () => {
    const result = routeSkillIntent('декомпозиция монолитного компонента и разделение view и logic для gemini flash');
    const skillNames = result.matchedSkills.map(s => s.name);
    expect(skillNames).toContain('flash-component-decomposer');
  });
});
