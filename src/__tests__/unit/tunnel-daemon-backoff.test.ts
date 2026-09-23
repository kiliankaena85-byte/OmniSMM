import { describe, it, expect } from 'vitest';
import { getBackoffDelay } from '../../../scripts/tunnel-daemon.mjs';

describe('R6-04 / OPS-01: Tunnel Daemon Exponential Backoff & Resilience', () => {
  it('computes initial backoff delay around 3000ms for attempt 0', () => {
    const delay = getBackoffDelay(0);
    expect(delay).toBeGreaterThanOrEqual(3000);
    expect(delay).toBeLessThanOrEqual(4100);
  });

  it('increases delay with successive retry attempts', () => {
    const delay0 = getBackoffDelay(0);
    const delay3 = getBackoffDelay(3);
    const delay5 = getBackoffDelay(5);

    expect(delay3).toBeGreaterThan(delay0);
    expect(delay5).toBeGreaterThan(delay3);
  });

  it('caps backoff delay at 61000ms for high retry counts', () => {
    const delay10 = getBackoffDelay(10);
    const delay50 = getBackoffDelay(50);

    expect(delay10).toBeLessThanOrEqual(61000);
    expect(delay50).toBeLessThanOrEqual(61000);
  });
});
