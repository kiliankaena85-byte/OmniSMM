import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { routeSkillIntent } from '../../../scripts/skill-router';
import { evolveSkillWithLesson } from '../../../scripts/skill-evolve';
import { SkillEvolutionLessonSchema } from '../../types/skills-contract';

const SKILLS_DIR = path.resolve(__dirname, '../../../.agents/skills');

describe('OmniSMM Skills Architecture v2 Suite (CDD-TDD)', () => {
  const coreTargetSkills = [
    'concurrency-acid-guard',
    'ddd-aggregate-invariants',
    'compliance-54fz-auditor',
    'arch-boundary-guard',
    'docker-lean-build-ops',
    'owasp-asvs-sentinel',
    'multi-tenant-isolation-arch'
  ];

  describe('1. L1 Core Invariants Contract', () => {
    it('MUST have a valid CORE.md file for all core architectural skills', () => {
      for (const skillName of coreTargetSkills) {
        const corePath = path.join(SKILLS_DIR, skillName, 'CORE.md');
        expect(fs.existsSync(corePath), `Missing CORE.md for ${skillName}`).toBe(true);

        const content = fs.readFileSync(corePath, 'utf-8');
        const lines = content.split('\n');
        expect(lines.length).toBeLessThanOrEqual(65);
        expect(content).toContain('HARD INVARIANTS');
      }
    });
  });

  describe('2. JIT Skill Router Intent Classification', () => {
    it('accurately routes financial and balance mutations to concurrency-acid-guard and ddd-aggregate-invariants', () => {
      const result = routeSkillIntent('Списание и возврат средств при отмене заказа пользователя с фискальным чеком');
      expect(result.matchedSkills.length).toBeGreaterThanOrEqual(2);

      const skillNames = result.matchedSkills.map(s => s.name);
      expect(skillNames).toContain('concurrency-acid-guard');
      expect(skillNames).toContain('ddd-aggregate-invariants');
      expect(result.totalTokensEstimated).toBeLessThan(2000);
      expect(result.bundledCorePrompt).toContain('concurrency-acid-guard');
    });

    it('accurately routes Docker build freezing to docker-lean-build-ops', () => {
      const result = routeSkillIntent('Зависание ПК и фризы Windows при сборке Docker контейнеров Next.js');
      const skillNames = result.matchedSkills.map(s => s.name);
      expect(skillNames).toContain('docker-lean-build-ops');
    });

    it('accurately routes OWASP and Nonce issues to owasp-asvs-sentinel', () => {
      const result = routeSkillIntent('Настройка Content Security Policy Strict Dynamic и криптографический Nonce в proxy');
      const skillNames = result.matchedSkills.map(s => s.name);
      expect(skillNames).toContain('owasp-asvs-sentinel');
    });
  });

  describe('3. Skill Evolve Engine Contract', () => {
    it('validates lesson input using SkillEvolutionLessonSchema and applies lesson idempotently', () => {
      const testLesson = {
        skillName: 'concurrency-acid-guard',
        incidentSlug: 'test-toctou-atomic-ledger',
        triggerCondition: 'Concurrent double payment race condition on slow DB pool',
        solutionPattern: 'Enforce tx.ledgerEntry.create before tx.user.update with idempotencyKey unique constraint',
        verifiedDate: '2026-09-13'
      };

      const validated = SkillEvolutionLessonSchema.parse(testLesson);
      expect(validated.skillName).toBe('concurrency-acid-guard');

      const evolveResult = evolveSkillWithLesson(validated, { dryRun: true });
      expect(evolveResult.success).toBe(true);
      expect(evolveResult.updatedContent).toContain('test-toctou-atomic-ledger');
    });
  });
});
