import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import { SkillArchitectureAuditor, ARCH_TIER_SKILLS } from '../../../scripts/audit-skills-architecture';

describe('OmniSMM Skill Architecture Guard & Standards Validator (Anthropic/Claude Canon)', () => {
  const projectRoot = path.resolve(__dirname, '../../../');
  const skillsDir = path.resolve(projectRoot, '.agents', 'skills');
  const auditor = new SkillArchitectureAuditor(projectRoot, skillsDir);

  it('validates skill-architecture-guard with 100% Health Score (Grade A)', () => {
    const targetDir = path.join(skillsDir, 'skill-architecture-guard');
    const result = auditor.auditSkill(targetDir);

    expect(result.skillName).toBe('skill-architecture-guard');
    expect(result.hasCoreMd).toBe(true);
    expect(result.score).toBe(100);
    expect(result.grade).toBe('A');
    expect(result.issues.filter(i => i.severity === 'CRITICAL' || i.severity === 'ERROR')).toHaveLength(0);
  });

  it('detects missing SKILL.md and returns score 0 (Grade F)', () => {
    const nonExistentDir = path.join(skillsDir, 'non-existent-dummy-skill');
    const result = auditor.auditSkill(nonExistentDir);

    expect(result.score).toBe(0);
    expect(result.grade).toBe('F');
    expect(result.issues.some(i => i.ruleId === 'FM-001')).toBe(true);
  });

  it('validates that key architectural skills pass frontmatter and name matching rules', () => {
    const keyArchSkills = [
      'arch-boundary-guard',
      'concurrency-acid-guard',
      'multi-tenant-isolation-arch',
      'ddd-aggregate-invariants',
      'skill-architecture-guard'
    ];

    for (const skillName of keyArchSkills) {
      const skillPath = path.join(skillsDir, skillName);
      if (fs.existsSync(skillPath)) {
        const result = auditor.auditSkill(skillPath);
        expect(result.skillName).toBe(skillName);
        expect(result.score).toBeGreaterThanOrEqual(85);
        expect(result.issues.filter(i => i.severity === 'CRITICAL')).toHaveLength(0);
      }
    }
  });

  it('verifies that L1 CORE.md files are under 65 lines limit for Tier 1 architectural skills', () => {
    const skillsWithCore = [
      'arch-boundary-guard',
      'concurrency-acid-guard',
      'multi-tenant-isolation-arch',
      'ddd-aggregate-invariants',
      'docker-lean-build-ops',
      'owasp-asvs-sentinel',
      'compliance-54fz-auditor',
      'skill-architecture-guard'
    ];

    for (const skillName of skillsWithCore) {
      const corePath = path.join(skillsDir, skillName, 'CORE.md');
      if (fs.existsSync(corePath)) {
        const content = fs.readFileSync(corePath, 'utf-8');
        const lines = content.split('\n');
        expect(lines.length).toBeLessThanOrEqual(65);
        expect(content).toMatch(/HARD INVARIANTS|КЛЮЧЕВЫЕ ИНВАРИАНТЫ/);
      }
    }
  });
});
