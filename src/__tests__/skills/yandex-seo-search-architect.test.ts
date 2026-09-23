import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { routeSkillIntent } from '../../../scripts/skill-router';

const SKILLS_DIR = path.resolve(__dirname, '../../../.agents/skills');

describe('Yandex SEO Search Architect Suite (CDD-TDD)', () => {
  const skillName = 'yandex-seo-search-architect';

  it('MUST have valid CORE.md (<= 30 lines) and complete SKILL.md', () => {
    const corePath = path.join(SKILLS_DIR, skillName, 'CORE.md');
    const deepPath = path.join(SKILLS_DIR, skillName, 'SKILL.md');

    expect(fs.existsSync(corePath), 'Missing CORE.md').toBe(true);
    expect(fs.existsSync(deepPath), 'Missing SKILL.md').toBe(true);

    const coreContent = fs.readFileSync(corePath, 'utf-8');
    const coreLines = coreContent.split('\n');
    expect(coreLines.length).toBeLessThanOrEqual(30);
    expect(coreContent).toContain('HARD INVARIANTS');
    expect(coreContent).toContain('SSR-First Invariant');
    expect(coreContent).toContain('Clean-param');

    const deepContent = fs.readFileSync(deepPath, 'utf-8');
    expect(deepContent).toContain('Schema.org');
    expect(deepContent).toContain('Баден-Баден');
    expect(deepContent).toContain('YandexBot');
  });

  it('accurately routes user queries for Yandex SEO and CEO to yandex-seo-search-architect', () => {
    const queries = [
      'Скиллы от яндекса по ceo',
      'оптимизация сайта под поисковую систему яндекс и вебмастер',
      'настройка robots.txt с clean-param и canonical для yandexbot',
      'микроразметка schema.org json-ld для яндекс сниппетов'
    ];

    for (const q of queries) {
      const result = routeSkillIntent(q);
      const skillNames = result.matchedSkills.map(s => s.name);
      expect(skillNames).toContain('yandex-seo-search-architect');
    }
  });
});
