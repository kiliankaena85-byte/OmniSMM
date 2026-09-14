import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { cleanCategoryName } from "@/components/ui/CategoryIcon";
import { getBrandStyles } from "@/utils/brand-styles";

export function useMobileWizard(engine: OrderEngine) {
  const [isFocused, setIsFocused] = useState(false);
  const [localUrlError, setLocalUrlError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [activeStepRaw, setActiveStepRaw] = useState<1 | 2 | 3 | 4>(1);
  const [lastResolvedUrl, setLastResolvedUrl] = useState<string>("");
  const [catalogHint, setCatalogHint] = useState(false);
  const userManuallyBrowsingRef = useRef(false);

  // Refs for scroll-into-view on step transitions
  const step1Ref = useRef<HTMLDivElement>(null);
  const step2Ref = useRef<HTMLDivElement>(null);
  const step3Ref = useRef<HTMLDivElement>(null);
  const step4Ref = useRef<HTMLDivElement>(null);

  const prevStepRef = useRef<1 | 2 | 3 | 4>(activeStepRaw);

  const scrollToStep = useCallback((step: 1 | 2 | 3 | 4) => {
    if (typeof window === 'undefined') return;
    // CRITICAL: Mobile only guard! On desktop (>768px) MobileWizard must NEVER hijack page scroll
    if (window.innerWidth >= 768) return;

    // Typing Guard: Do not scroll if user is actively interacting with an input, textarea or button in wizard
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      return;
    }
    if (activeEl && activeEl.closest('#catalog-section') && (activeEl.tagName === 'BUTTON' || activeEl.tagName === 'INPUT')) {
      return;
    }

    const refMap: Record<number, React.RefObject<HTMLDivElement | null>> = {
      1: step1Ref,
      2: step2Ref,
      3: step3Ref,
      4: step4Ref,
    };
    const ref = refMap[step];
    if (ref?.current) {
      // Offset for sticky header (64px) + comfortable breathing room (16px) = 80px
      const headerOffset = 80;
      const elementTop = ref.current.getBoundingClientRect().top;
      // Only scroll if element is not already visible in viewport
      if (elementTop < 0 || elementTop > window.innerHeight - 100) {
        const targetScrollY = window.pageYOffset + elementTop - headerOffset;
        window.scrollTo({
          top: Math.max(0, targetScrollY),
          behavior: 'smooth',
        });
      }
    }
  }, []);

  const setActiveStep = useCallback((step: 1 | 2 | 3 | 4) => {
    // Idempotent Step Guard: Never re-trigger step update if already on the target step
    if (step === prevStepRef.current) return;

    userManuallyBrowsingRef.current = true;
    setActiveStepRaw(step);
    // Note: Targeted validation scroll is used for missing inputs; regular browsing does not hijack scroll.
  }, []);


  // Single effect to synchronize browser history outside of React render/setState updaters (B3)
  // CRITICAL: On desktop (>=768px) we must NEVER push/replace hash anchors like #step-4
  // because the browser will auto-scroll to that element ID, causing parasitic page jumps.
  useEffect(() => {
    if (typeof window === 'undefined' || !mounted) return;
    // Desktop guard: MobileWizard history navigation is mobile-only
    if (window.innerWidth >= 768) return;

    const prevStep = prevStepRef.current;
    if (prevStep === activeStepRaw) return;
    prevStepRef.current = activeStepRaw;

    if (activeStepRaw > prevStep) {
      window.history.pushState({ wizardStep: activeStepRaw }, '', '#step-' + activeStepRaw);
    } else if (activeStepRaw === 1) {
      if (window.location.hash.startsWith('#step-')) {
        window.history.replaceState({ wizardStep: 1 }, '', window.location.pathname + window.location.search);
      }
    } else {
      window.history.replaceState({ wizardStep: activeStepRaw }, '', '#step-' + activeStepRaw);
    }
  }, [activeStepRaw, mounted]);

  // Listen to browser Back button / gesture (popstate)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = (event: PopStateEvent) => {
      const hash = window.location.hash;
      let targetStep: 1 | 2 | 3 | 4 = 1;
      if (event.state?.wizardStep && typeof event.state.wizardStep === 'number') {
        targetStep = event.state.wizardStep as 1 | 2 | 3 | 4;
      } else if (hash.startsWith('#step-')) {
        const parsed = parseInt(hash.replace('#step-', ''), 10);
        if (parsed >= 1 && parsed <= 4) targetStep = parsed as 1 | 2 | 3 | 4;
      }

      userManuallyBrowsingRef.current = true;
      setActiveStepRaw(targetStep);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const {
    url,
    networkId,
    categoryId,
    selectedService,
    catalog,
    services,
    isLoading,
    validationErrors,
  } = engine;

  // CRITICAL INVARIANT:
  // 1. If auth_resume=1 or hash is #step-4 or selectedService is already set -> Step 4
  // 2. If valid url is already set -> Step 2
  // 3. DEFAULT: Always Step 1 (Вставьте ссылку) — never skip to Step 3 just because categoryId has default value!
  useEffect(() => {
    setMounted(true);
    const isResume = typeof window !== 'undefined' && (
      window.location.search.includes('auth_resume=1') ||
      window.location.hash === '#step-4'
    );
    if (isResume || selectedService) {
      setActiveStepRaw(4);
    } else if (url && url.trim().length >= 5) {
      setLastResolvedUrl(url);
      setActiveStepRaw(2);
    } else {
      setActiveStepRaw(1);
    }
  }, []);

  const proceedFromStep1 = () => {
    userManuallyBrowsingRef.current = true;
    if (selectedService) setActiveStep(4);
    else setActiveStep(2);
  };

  // URL auto-detection sync: when user pastes a valid link in Step 1, advance to next logical step
  useEffect(() => {
    if (!isLoading && url && url.trim().length >= 5) {
      const isUrlValid = !validationErrors?.link && !localUrlError;
      if (isUrlValid && url !== lastResolvedUrl) {
        setLastResolvedUrl(url);
        if (activeStepRaw === 1) {
          // Typing Guard: do NOT auto-advance or scroll while user is actively typing in input/textarea
          const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
          const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
          if (!isTyping) {
            userManuallyBrowsingRef.current = true;
            if (selectedService) setActiveStep(4);
            else setActiveStep(2);
          }
        }
      }
    }
  }, [isLoading, url, validationErrors?.link, localUrlError, lastResolvedUrl, selectedService, categoryId, activeStepRaw, setActiveStep]);

  const prevSelectedServiceIdRef = useRef<string | null>(selectedService?.id || null);
  const prevCategoryIdRef = useRef<string | null>(categoryId || null);

  // Reactive selection auto-advance: ONLY advance to Step 4 when the user actually picks a service.
  // Never auto-advance to Step 3 on category change (Step 3 advance is triggered explicitly by user clicking a category chip).
  useEffect(() => {
    if (!userManuallyBrowsingRef.current && activeStepRaw === 1 && !selectedService) {
      return;
    }

    if (selectedService && selectedService.id !== prevSelectedServiceIdRef.current) {
      prevSelectedServiceIdRef.current = selectedService.id;
      // On mobile viewports (<768px), scroll to step 4; on desktop, do NOT change wizard step
      // (the fullscreen checkout overlay handles service selection display on desktop,
      // and calling setActiveStepRaw(4) causes DOM layout shifts that make the browser
      // auto-scroll to #step-4 element, producing a parasitic scroll-down effect)
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        setActiveStep(4);
      }
      // Desktop: no step change needed — PlanFullscreenCheckout renders as an overlay
    } else if (!selectedService) {
      prevSelectedServiceIdRef.current = null;
    }

    if (categoryId && categoryId !== prevCategoryIdRef.current) {
      prevCategoryIdRef.current = categoryId;
    } else if (!categoryId) {
      prevCategoryIdRef.current = null;
    }
  }, [selectedService, categoryId, activeStepRaw, setActiveStep]);

  const selectedCategoryName = useMemo(() => {
    if (!catalog || !networkId || !categoryId) return "Тарифы";
    const net = catalog.find(n => n.id === networkId);
    if (!net) return "Тарифы";
    const cat = net.categories.find(c => c.id === categoryId);
    return cat ? cleanCategoryName(cat.name) : "Тарифы";
  }, [catalog, networkId, categoryId]);

  const brandStyle = useMemo(() => {
    if (!catalog || !networkId) return undefined;
    const net = catalog.find(n => n.id === networkId);
    return net ? getBrandStyles(net.slug) : undefined;
  }, [catalog, networkId]);

  const isLinkFilled = Boolean(url && url.trim().length >= 5);
  const hasCategory = Boolean(categoryId && activeStepRaw >= 2);
  const hasService = Boolean(selectedService && activeStepRaw >= 3);
  const shouldShowCategories = true;
  const shouldShowTariffs = true;
  const shouldShowParameters = true;
  const currentStep = activeStepRaw as 1 | 2 | 3 | 4;

  return {
    isFocused, setIsFocused,
    localUrlError, setLocalUrlError,
    mounted,
    currentStep, setActiveStep, scrollToStep,
    step1Ref, step2Ref, step3Ref, step4Ref,
    catalogHint, setCatalogHint,
    proceedFromStep1,
    selectedCategoryName,
    brandStyle,
    isLinkFilled,
    hasCategory,
    hasService,
    shouldShowCategories,
    shouldShowTariffs,
    shouldShowParameters,
  };
}
