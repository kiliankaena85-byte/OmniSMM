/**
 * (c) 2024-2026 SMMplan / OmniSMM 1.0. All rights reserved.
 * Unified Order Wizard Core Hook — TASK 6
 */

import { useState, useCallback, useMemo } from 'react';
import { OrderEngine } from '@/hooks/useOrderEngine';

export interface UseOrderWizardCoreOptions {
  engine: OrderEngine;
  initialStep?: 1 | 2 | 3 | 4;
}

export function useOrderWizardCore({ engine, initialStep = 1 }: UseOrderWizardCoreOptions) {
  const [currentStep, setCurrentStepRaw] = useState<1 | 2 | 3 | 4>(initialStep);

  const setActiveStep = useCallback((step: 1 | 2 | 3 | 4) => {
    setCurrentStepRaw(step);
  }, []);

  const proceedFromStep1 = useCallback(() => {
    if (engine.selectedService) {
      setActiveStep(4);
    } else {
      setActiveStep(2);
    }
  }, [engine.selectedService, setActiveStep]);

  const canAdvanceToStep2 = useMemo(() => {
    return Boolean(engine.url && engine.url.trim().length >= 5);
  }, [engine.url]);

  const canAdvanceToStep3 = useMemo(() => {
    return Boolean(engine.categoryId);
  }, [engine.categoryId]);

  const canAdvanceToStep4 = useMemo(() => {
    return Boolean(engine.selectedService);
  }, [engine.selectedService]);

  return {
    currentStep,
    setActiveStep,
    proceedFromStep1,
    canAdvanceToStep2,
    canAdvanceToStep3,
    canAdvanceToStep4,
    engine,
  };
}
