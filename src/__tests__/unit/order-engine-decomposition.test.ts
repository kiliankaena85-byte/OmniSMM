// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOrderDripState } from '@/hooks/order-engine/useOrderDripState';

describe('useOrderDripState (SPEC-2026-WAVE-10)', () => {
  it('initializes with default drip-feed and smart drip values', () => {
    const { result } = renderHook(() => useOrderDripState());

    expect(result.current.dripFeedEnabled).toBe(false);
    expect(result.current.runs).toBe(2);
    expect(result.current.dripInterval).toBe(5);
    expect(result.current.isSmartDrip).toBe(false);
    expect(result.current.smartDripDays).toBe(7);
  });

  it('updates drip-feed and smart drip state', () => {
    const { result } = renderHook(() => useOrderDripState());

    act(() => {
      result.current.setDripFeedEnabled(true);
      result.current.setRuns(5);
      result.current.setDripInterval(15);
      result.current.setIsSmartDrip(true);
      result.current.setSmartDripDays(14);
    });

    expect(result.current.dripFeedEnabled).toBe(true);
    expect(result.current.runs).toBe(5);
    expect(result.current.dripInterval).toBe(15);
    expect(result.current.isSmartDrip).toBe(true);
    expect(result.current.smartDripDays).toBe(14);
  });

  it('resets drip state back to clean defaults via resetDripState()', () => {
    const { result } = renderHook(() => useOrderDripState());

    act(() => {
      result.current.setDripFeedEnabled(true);
      result.current.setRuns(10);
      result.current.setDripInterval(30);
      result.current.setIsSmartDrip(true);
      result.current.setSmartDripDays(30);
    });

    act(() => {
      result.current.resetDripState();
    });

    expect(result.current.dripFeedEnabled).toBe(false);
    expect(result.current.runs).toBe(2);
    expect(result.current.dripInterval).toBe(5);
    expect(result.current.isSmartDrip).toBe(false);
    expect(result.current.smartDripDays).toBe(7);
  });
});
