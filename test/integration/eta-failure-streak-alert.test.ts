import { describe, it, expect, beforeEach, vi } from 'vitest';
import { trackEtaFailure, resetEtaFailureStreak, getEtaFailureStreak, ETA_ALERT_THRESHOLD } from '../../src/workers/eta-alerts';
import * as notifications from '../../src/lib/notifications';

describe('Integration: ETA Worker Failure Streak Alert (E2.5 / WRK-04)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetEtaFailureStreak();
  });

  it('triggers WARNING admin alert when ETA worker hits threshold (5 consecutive failures)', () => {
    const alertSpy = vi.spyOn(notifications, 'sendAdminAlert');

    // 1..4 failures: no alert yet
    for (let i = 1; i < ETA_ALERT_THRESHOLD; i++) {
      trackEtaFailure({ id: `job-${i}`, name: 'eta-recalc' }, new Error(`Simulated ETA failure ${i}`));
      expect(alertSpy).not.toHaveBeenCalled();
      expect(getEtaFailureStreak()).toBe(i);
    }

    // 5th failure: triggers alert
    trackEtaFailure({ id: 'job-5', name: 'eta-recalc' }, new Error('Simulated ETA failure 5'));

    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining('ETA Worker'),
      'WARNING'
    );
    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining(`${ETA_ALERT_THRESHOLD} подряд проваленных джоб`),
      'WARNING'
    );
    // Streak reset to prevent alert flood
    expect(getEtaFailureStreak()).toBe(0);
  });

  it('regression guard: successful job resets the failure streak counter', () => {
    const alertSpy = vi.spyOn(notifications, 'sendAdminAlert');

    // 4 failures
    for (let i = 1; i <= 4; i++) {
      trackEtaFailure({ id: `job-${i}`, name: 'eta-recalc' }, new Error(`Error ${i}`));
    }
    expect(getEtaFailureStreak()).toBe(4);
    expect(alertSpy).not.toHaveBeenCalled();

    // 1 successful job completed
    resetEtaFailureStreak();
    expect(getEtaFailureStreak()).toBe(0);

    // 4 more failures: still no alert because streak was reset
    for (let i = 1; i <= 4; i++) {
      trackEtaFailure({ id: `job-new-${i}`, name: 'eta-recalc' }, new Error(`New Error ${i}`));
    }
    expect(getEtaFailureStreak()).toBe(4);
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
