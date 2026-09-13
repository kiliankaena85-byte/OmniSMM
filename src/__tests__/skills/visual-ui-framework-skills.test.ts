import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { routeSkillIntent } from '../../../scripts/skill-router';

const SKILLS_DIR = path.resolve(__dirname, '../../../.agents/skills');

describe('Visual, UI & Frameworks Architectural Skills Suite (CDD-TDD)', () => {
  const newVisualSkills = [
    'ui-design-system-steward',
    'viewport-responsive-density',
    'mobile-cro-interaction',
    'heroui-v3-compound-guard',
    'react-19-next-16-ui-engine',
    'client-hydration-perf-guard'
  ];

  describe('1. L1 Core Invariants Contract', () => {
    it('MUST have a valid CORE.md and SKILL.md file for all 6 visual and UI framework skills', () => {
      for (const skillName of newVisualSkills) {
        const corePath = path.join(SKILLS_DIR, skillName, 'CORE.md');
        const deepPath = path.join(SKILLS_DIR, skillName, 'SKILL.md');

        expect(fs.existsSync(corePath), `Missing CORE.md for ${skillName}`).toBe(true);
        expect(fs.existsSync(deepPath), `Missing SKILL.md for ${skillName}`).toBe(true);

        const coreContent = fs.readFileSync(corePath, 'utf-8');
        const lines = coreContent.split('\n');
        expect(lines.length).toBeLessThanOrEqual(65);
        expect(coreContent).toContain('HARD INVARIANTS');
      }
    });
  });

  describe('2. JIT Skill Router Intent Classification for Visual & UI', () => {
    it('accurately routes design tokens and semantic styling queries to ui-design-system-steward', () => {
      const result = routeSkillIntent('Стилизация карточки услуги через семантические токены Tailwind 4 без хардкода цветов');
      const names = result.matchedSkills.map(s => s.name);
      expect(names).toContain('ui-design-system-steward');
    });

    it('accurately routes dense tables and horizontal scroll issues to viewport-responsive-density and heroui-v3-compound-guard', () => {
      const result = routeSkillIntent('Большая таблица данных заказов HeroUI без горизонтального скролла с модальным окном');
      const names = result.matchedSkills.map(s => s.name);
      expect(names).toContain('viewport-responsive-density');
      expect(names).toContain('heroui-v3-compound-guard');
    });

    it('accurately routes mobile wizard and touch targets to mobile-cro-interaction', () => {
      const result = routeSkillIntent('Мобильный визард оформления заказа со степпером, тач-таргетами и плавающей кнопкой внизу');
      const names = result.matchedSkills.map(s => s.name);
      expect(names).toContain('mobile-cro-interaction');
    });

    it('accurately routes React 19 Actions and Suspense queries to react-19-next-16-ui-engine', () => {
      const result = routeSkillIntent('Форма отправки отзыва с хуком useActionState, Suspense скелетоном и оптимистичным обновлением');
      const names = result.matchedSkills.map(s => s.name);
      expect(names).toContain('react-19-next-16-ui-engine');
    });

    it('accurately routes hydration mismatch and heavy chart imports to client-hydration-perf-guard', () => {
      const result = routeSkillIntent('Ошибка Hydration Mismatch при форматировании даты и оптимизация графика через next dynamic');
      const names = result.matchedSkills.map(s => s.name);
      expect(names).toContain('client-hydration-perf-guard');
    });
  });
});
