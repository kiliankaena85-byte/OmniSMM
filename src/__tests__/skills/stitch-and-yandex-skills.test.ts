import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { routeSkillIntent } from '../../../scripts/skill-router';

const SKILLS_DIR = path.resolve(__dirname, '../../../.agents/skills');

describe('Google Stitch & Yandex Skills Suite (CDD-TDD)', () => {
  const skills = [
    'google-stitch-architect',
    'yandex-gravity-ui-steward',
    'yandex-services-integrator'
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

  it('accurately routes Google Stitch and Zero-Slop queries to google-stitch-architect', () => {
    const result = routeSkillIntent('генерация UI экрана через stitch без клише и шаблонного кода');
    const skillNames = result.matchedSkills.map(s => s.name);
    expect(skillNames).toContain('google-stitch-architect');
  });

  it('accurately routes Yandex Gravity UI queries to yandex-gravity-ui-steward', () => {
    const result = routeSkillIntent('разработка enterprise интерфейса на yandex gravity ui с плотной таблицей');
    const skillNames = result.matchedSkills.map(s => s.name);
    expect(skillNames).toContain('yandex-gravity-ui-steward');
  });

  it('accurately routes SmartCaptcha, Metrika and Yandex Pay queries to yandex-services-integrator', () => {
    const result = routeSkillIntent('подключение yandex smartcaptcha для защиты формы и метрики с вебвизором');
    const skillNames = result.matchedSkills.map(s => s.name);
    expect(skillNames).toContain('yandex-services-integrator');
  });
});
