'use client';

import { useState, useCallback } from 'react';

export function useOrderDripState() {
  const [dripFeedEnabled, setDripFeedEnabled] = useState(false);
  const [runs, setRuns] = useState(2);
  const [dripInterval, setDripInterval] = useState(5);
  const [isSmartDrip, setIsSmartDrip] = useState(false);
  const [smartDripDays, setSmartDripDays] = useState(7);

  const resetDripState = useCallback(() => {
    setDripFeedEnabled(false);
    setRuns(2);
    setDripInterval(5);
    setIsSmartDrip(false);
    setSmartDripDays(7);
  }, []);

  return {
    dripFeedEnabled,
    setDripFeedEnabled,
    runs,
    setRuns,
    dripInterval,
    setDripInterval,
    isSmartDrip,
    setIsSmartDrip,
    smartDripDays,
    setSmartDripDays,
    resetDripState,
  };
}
