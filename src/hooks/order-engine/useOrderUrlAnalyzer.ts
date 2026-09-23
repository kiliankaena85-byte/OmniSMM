'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { analyzeUrl } from '@/actions/order/analyze-url';
import { IntelligencePlatform } from '@/services/analyzer/link-rules';
import { matchesSuggestedCategory } from '@/services/analyzer/category-matcher';
import { resolveServiceTargetType } from '@/utils/target-type-mapper';
import {
  isLinkServiceCompatible,
  getCompatibilityError,
  normalizeServiceTargetType,
} from '@/constants/link-service-compatibility';
import type { PublicNetwork, PublicService } from '@/actions/order/catalog';

interface UseOrderUrlAnalyzerOptions {
  url: string;
  catalog: PublicNetwork[];
  selectedService: PublicService | null;
  selectedServiceRef: React.MutableRefObject<PublicService | null>;
  networkIdRef: React.MutableRefObject<string>;
  categoryIdRef: React.MutableRefObject<string>;
  setNetworkId: (id: string) => void;
  setCategoryId: (id: string) => void;
  isLinkOverridden: boolean;
  isImmediateRef: React.MutableRefObject<boolean>;
  categoryServicesCache: React.MutableRefObject<Record<string, PublicService[]>>;
  detectedType: string | null;
  setDetectedType: (t: string | null) => void;
}

export function useOrderUrlAnalyzer({
  url,
  catalog,
  selectedService,
  selectedServiceRef,
  networkIdRef,
  categoryIdRef,
  setNetworkId,
  setCategoryId,
  isLinkOverridden,
  isImmediateRef,
  categoryServicesCache,
  detectedType,
  setDetectedType,
}: UseOrderUrlAnalyzerOptions) {
  const [platform, setPlatform] = useState<IntelligencePlatform | null>(null);
  const [manualPlatform, setManualPlatform] = useState<IntelligencePlatform | null>(null);
  const [suggestedCategories, setSuggestedCategories] = useState<string[]>([]);
  const [urlHint, setUrlHint] = useState<string | null>(null);
  const [isAnalyzingUrl, setIsAnalyzingUrl] = useState(false);

  const currentRequestIdRef = useRef(0);

  const handleSetManualPlatform = useCallback((p: IntelligencePlatform | null) => {
    setManualPlatform(p);
    if (p !== null) {
      setSuggestedCategories([]);
    }
  }, []);

  // Analyze URL (Debounced)
  useEffect(() => {
    if (!url || url.length < 5) {
      currentRequestIdRef.current++;
      setPlatform(null);
      setManualPlatform(null);
      setSuggestedCategories([]);
      setDetectedType(null);
      setUrlHint(null);
      setIsAnalyzingUrl(false);
      return;
    }

    let stale = false;
    const delay = isImmediateRef.current ? 0 : 350;
    isImmediateRef.current = false;
    const requestId = ++currentRequestIdRef.current;

    const handler = setTimeout(async () => {
      if (stale || requestId !== currentRequestIdRef.current) return;
      setIsAnalyzingUrl(true);
      try {
        const res = await analyzeUrl(url.trim());
        if (stale || requestId !== currentRequestIdRef.current) return;
        setUrlHint(res.userHint || null);
        if (res.success && res.data) {
          const analysisData = res.data;
          setPlatform(analysisData.platform !== IntelligencePlatform.OTHER ? analysisData.platform : null);
          setManualPlatform(null);
          setSuggestedCategories(analysisData.suggestedCategories || []);
          setDetectedType(analysisData.type || null);

          const activePlatformStr =
            analysisData.platform !== IntelligencePlatform.OTHER ? analysisData.platform.toLowerCase() : null;
          if (!selectedServiceRef.current && activePlatformStr) {
            const matchedNet = catalog.find(
              (n) => n.slug.toLowerCase().includes(activePlatformStr) || activePlatformStr.includes(n.slug.toLowerCase())
            );
            if (matchedNet) {
              if (matchedNet.id !== networkIdRef.current) setNetworkId(matchedNet.id);
              const catsForNet = matchedNet.categories;
              let filteredCats = catsForNet;
              if (analysisData.suggestedCategories && analysisData.suggestedCategories.length > 0) {
                const f = catsForNet.filter((c) =>
                  matchesSuggestedCategory(c.name, analysisData.suggestedCategories, c.analyzerTags, analysisData.type)
                );
                if (f.length > 0) filteredCats = f;
              }
              if (filteredCats.length > 0) {
                if (url.trim().length >= 5) {
                  setCategoryId(filteredCats.length === 1 ? filteredCats[0].id : '');
                } else if (!filteredCats.some((c) => c.id === categoryIdRef.current)) {
                  setCategoryId(filteredCats[0].id);
                }
              }
            }
          }
        } else if (res.errorCode === 'MISSING_DOMAIN') {
          setPlatform(null);
          setSuggestedCategories([]);
          setDetectedType(null);
        }
      } catch (err) {
        console.error('URL analysis failed:', err);
      } finally {
        if (!stale && requestId === currentRequestIdRef.current) setIsAnalyzingUrl(false);
      }
    }, delay);

    return () => {
      stale = true;
      clearTimeout(handler);
    };
  }, [url, catalog, isImmediateRef, selectedServiceRef, networkIdRef, categoryIdRef, setNetworkId, setCategoryId]);

  // Compute available categories with semantic filters
  const computeAvailableCategories = useCallback(
    (activeNetwork: PublicNetwork | null) => {
      let available = activeNetwork ? activeNetwork.categories.filter((c) => (c.serviceCount ?? 0) > 0) : [];
      const activePlatform = manualPlatform || platform;
      const isMatching =
        activeNetwork &&
        activePlatform &&
        activePlatform !== IntelligencePlatform.OTHER &&
        activeNetwork.slug.toLowerCase().includes(activePlatform.toLowerCase());

      if (isMatching && (suggestedCategories.length > 0 || detectedType) && url.trim().length >= 5) {
        available = available.filter((c) => {
          if (detectedType && c.targetTypes && c.targetTypes.length > 0) {
            if (!c.targetTypes.some((tt) => isLinkServiceCompatible(detectedType, tt))) return false;
          }
          if (!matchesSuggestedCategory(c.name, suggestedCategories, c.analyzerTags, detectedType)) return false;
          if (detectedType && categoryServicesCache.current[c.id]) {
            const cached = categoryServicesCache.current[c.id];
            if (cached.length > 0) {
              return cached.some((s) => isLinkServiceCompatible(detectedType, resolveServiceTargetType(s)));
            }
          }
          return true;
        });
      }
      return available;
    },
    [manualPlatform, platform, suggestedCategories, detectedType, url, categoryServicesCache]
  );

  // Compute compatibility warning
  const compatibilityWarning = useMemo(() => {
    if (!selectedService || isLinkOverridden) return null;
    if (platform && platform !== IntelligencePlatform.OTHER) {
      const serviceNetwork = catalog.find((n) => n.categories.some((c) => c.id === selectedService.categoryId));
      if (serviceNetwork) {
        const detectedPlat = platform.toLowerCase();
        const servicePlat = serviceNetwork.slug.toLowerCase();
        if (!servicePlat.includes(detectedPlat) && !detectedPlat.includes(servicePlat)) {
          return `Ссылка относится к ${platform}, а услуга выбрана для ${serviceNetwork.name}.`;
        }
      }
    }
    if (detectedType) {
      const activeCat = catalog.flatMap((n) => n.categories).find((c) => c.id === selectedService.categoryId);
      const serviceTargetType = normalizeServiceTargetType(
        resolveServiceTargetType({ ...selectedService, category: activeCat })
      );
      if (!isLinkServiceCompatible(detectedType, serviceTargetType)) {
        return getCompatibilityError(detectedType, serviceTargetType, selectedService.name);
      }
    }
    return null;
  }, [selectedService, platform, detectedType, isLinkOverridden, catalog]);

  return {
    platform,
    manualPlatform,
    setManualPlatform: handleSetManualPlatform,
    suggestedCategories,
    detectedType,
    urlHint,
    isAnalyzingUrl,
    computeAvailableCategories,
    compatibilityWarning,
  };
}
