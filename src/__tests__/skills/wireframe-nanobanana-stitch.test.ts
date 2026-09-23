import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { routeSkillIntent } from '../../../scripts/skill-router';

const SKILL_NAME = 'wireframe-nanobanana-stitch';
const SKILL_DIR = path.resolve(__dirname, '../../../.agents/skills', SKILL_NAME);

describe('Wireframe -> Nano Banana -> Stitch Pipeline Skill (CDD-TDD)', () => {
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

  it('MUST have desktop and mobile wireframe templates', () => {
    const desktopTpl = path.join(SKILL_DIR, 'templates', 'wireframe-desktop.html');
    const mobileTpl = path.join(SKILL_DIR, 'templates', 'wireframe-mobile.html');

    expect(fs.existsSync(desktopTpl), 'Missing wireframe-desktop.html').toBe(true);
    expect(fs.existsSync(mobileTpl), 'Missing wireframe-mobile.html').toBe(true);

    const desktopHtml = fs.readFileSync(desktopTpl, 'utf-8');
    expect(desktopHtml).toContain('tailwindcss');

    const mobileHtml = fs.readFileSync(mobileTpl, 'utf-8');
    expect(mobileHtml).toContain('tailwindcss');
  });

  it('accurately routes wireframe, nanobanana and stitch queries to wireframe-nanobanana-stitch', () => {
    const queries = [
      'создай wireframe интерфейса по заданию',
      'отрисуй интерфейс через nanobanana и передай в stitch',
      'пайплайн идея -> вайрфрейм -> nanobanana -> stitch',
      'сделай low-fi скетч и макет экрана'
    ];

    for (const query of queries) {
      const result = routeSkillIntent(query);
      const skillNames = result.matchedSkills.map(s => s.name);
      expect(skillNames, `Failed to route query: "${query}"`).toContain(SKILL_NAME);
    }
  });
});
