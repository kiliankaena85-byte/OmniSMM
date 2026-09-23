import { describe, it, expect } from 'vitest';
import { SUPPORT_SCENARIOS, SUPPORT_CHEAT_SHEETS } from '../support-training-scenarios';

describe('Support Training Scenarios & Knowledge Base', () => {
  it('should have valid scenarios with correct properties', () => {
    expect(SUPPORT_SCENARIOS.length).toBeGreaterThanOrEqual(6);

    SUPPORT_SCENARIOS.forEach(scenario => {
      expect(scenario.id).toBeTruthy();
      expect(scenario.title).toBeTruthy();
      expect(scenario.clientMessage).toBeTruthy();
      expect(scenario.options.length).toBeGreaterThanOrEqual(2);

      // Must have at least 1 correct option with score 100
      const correctOption = scenario.options.find(o => o.isCorrect);
      expect(correctOption).toBeDefined();
      expect(correctOption?.score).toBe(100);
      expect(correctOption?.analysis).toBeTruthy();

      // Ideal script and operator action steps must be populated
      expect(scenario.idealResponseScript).toBeTruthy();
      expect(scenario.operatorActionSteps.length).toBeGreaterThan(0);
      expect(scenario.relevantAdminLinks.length).toBeGreaterThan(0);
    });
  });

  it('should cover high-priority security scenarios (Lost Account & Takeover)', () => {
    const lostEmailSc = SUPPORT_SCENARIOS.find(s => s.id === 'sc-1-lost-email');
    const hackedEmailSc = SUPPORT_SCENARIOS.find(s => s.id === 'sc-2-hacked-email');

    expect(lostEmailSc).toBeDefined();
    expect(lostEmailSc?.category).toBe('SECURITY');
    expect(lostEmailSc?.difficulty).toBe('SENIOR');

    expect(hackedEmailSc).toBeDefined();
    expect(hackedEmailSc?.category).toBe('SECURITY');
    expect(hackedEmailSc?.difficulty).toBe('SENIOR');
  });

  it('should cover express recovery and password magic link scenarios (sc-14 and sc-15)', () => {
    const typoSc = SUPPORT_SCENARIOS.find(s => s.id === 'sc-14-typo-express-search');
    const magicLinkSc = SUPPORT_SCENARIOS.find(s => s.id === 'sc-15-forgot-password-magic-link');

    expect(typoSc).toBeDefined();
    expect(typoSc?.category).toBe('ORDERS');
    expect(typoSc?.idealResponseScript).toContain('Magic Link');

    expect(magicLinkSc).toBeDefined();
    expect(magicLinkSc?.category).toBe('SECURITY');
    expect(magicLinkSc?.idealResponseScript).toContain('152-ФЗ');
  });
});

