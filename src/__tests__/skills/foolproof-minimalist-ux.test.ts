import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { routeSkillIntent } from '../../../scripts/skill-router';

const SKILL_NAME = 'foolproof-minimalist-ux';
const SKILL_DIR = path.resolve(__dirname, '../../../.agents/skills', SKILL_NAME);

describe('Foolproof Minimalist UX & Auto-Folding Viewport Density Skill (CDD-TDD)', () => {
  it('MUST have valid CORE.md (<= 30 lines) and complete SKILL.md', () => {
    const corePath = path.join(SKILL_DIR, 'CORE.md');
    const deepPath = path.join(SKILL_DIR, 'SKILL.md');

    expect(fs.existsSync(corePath), `Missing CORE.md for ${SKILL_NAME}`).toBe(true);
    expect(fs.existsSync(deepPath), `Missing SKILL.md for ${SKILL_NAME}`).toBe(true);

    const coreContent = fs.readFileSync(corePath, 'utf-8');
    const coreLines = coreContent.split('\n');
    expect(coreLines.length).toBeLessThanOrEqual(30);
    expect(coreContent).toContain('HARD INVARIANTS');
  });

  it('MUST have auto-folding category bars in wireframe templates', () => {
    const desktopTpl = path.resolve(__dirname, '../../../.agents/skills/wireframe-nanobanana-stitch/templates/wireframe-desktop.html');
    const mobileTpl = path.resolve(__dirname, '../../../.agents/skills/wireframe-nanobanana-stitch/templates/wireframe-mobile.html');

    expect(fs.existsSync(desktopTpl), 'Missing wireframe-desktop.html').toBe(true);
    expect(fs.existsSync(mobileTpl), 'Missing wireframe-mobile.html').toBe(true);

    const desktopHtml = fs.readFileSync(desktopTpl, 'utf-8');
    expect(desktopHtml).toContain('id="category-collapsed-bar"');
    expect(desktopHtml).toContain('reopenCategories');

    const mobileHtml = fs.readFileSync(mobileTpl, 'utf-8');
    expect(mobileHtml).toContain('id="m-category-collapsed-bar"');
    expect(mobileHtml).toContain('mReopenCategories');
  });

  it('accurately routes foolproof, minimalism and auto-folding queries to foolproof-minimalist-ux', () => {
    const queries = [
      'нужно сделать интерфейс для дураков',
      'максимальная экономия места на первом экране',
      'реализуй прогрессивное схлопывание категорий',
      'сделай минимализм и компактный ui виджета',
      'auto-folding форма заказа'
    ];

    for (const query of queries) {
      const result = routeSkillIntent(query);
      const skillNames = result.matchedSkills.map(s => s.name);
      expect(skillNames, `Failed to route query: "${query}"`).toContain(SKILL_NAME);
    }
  });
});
