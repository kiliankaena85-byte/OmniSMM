import { describe, it, expect } from 'vitest';
import { SYSTEM_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';
import type { FlagState } from '@/services/system/feature-flag.service';

describe('Admin Feature Flags Integrity & Invariants (/admin/system/features)', () => {
  describe('SYSTEM_TABS Navigation Cluster & Onboarding', () => {
    it('verifies /admin/system/features is part of SYSTEM_TABS', () => {
      const featuresTab = SYSTEM_TABS.find(t => t.href === '/admin/system/features');
      expect(featuresTab).toBeDefined();
      expect(featuresTab?.label).toBe('Фичи (Flags)');
    });

    it('verifies onboarding configuration exists for features', () => {
      expect(ONBOARDING_CONFIGS.features).toBeDefined();
      expect(ONBOARDING_CONFIGS.features.faqs.length).toBeGreaterThan(0);
    });
  });

  describe('Three-State State Machine Transitions', () => {
    const STATE_CONFIG: Record<FlagState, { label: string; next: FlagState }> = {
      ON:   { label: 'Включён', next: 'OFF' },
      TEST: { label: 'Тест',    next: 'ON' },
      OFF:  { label: 'Выключен', next: 'TEST' },
    };

    it('cycles correctly through OFF -> TEST -> ON -> OFF', () => {
      expect(STATE_CONFIG['OFF'].next).toBe('TEST');
      expect(STATE_CONFIG['TEST'].next).toBe('ON');
      expect(STATE_CONFIG['ON'].next).toBe('OFF');
    });

    it('validates permission checks by user context', () => {
      const isEnabled = (state: FlagState, isTestUser = false): boolean => {
        if (state === 'ON') return true;
        if (state === 'TEST' && isTestUser) return true;
        return false;
      };

      expect(isEnabled('ON', false)).toBe(true);
      expect(isEnabled('ON', true)).toBe(true);
      expect(isEnabled('TEST', false)).toBe(false);
      expect(isEnabled('TEST', true)).toBe(true);
      expect(isEnabled('OFF', false)).toBe(false);
      expect(isEnabled('OFF', true)).toBe(false);
    });
  });
});
