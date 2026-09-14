'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { analyzeUrl } from "@/actions/order/analyze-url";
import { getServicesByCategoryAction, PublicNetwork, PublicCategory, PublicService, getPublicCatalogAction, getFreshServiceAction } from "@/actions/order/catalog";
import { calculatePriceAction } from "@/actions/order/checkout";
import { PricingResult } from "@/services/marketing.service";
import { IntelligencePlatform } from "@/services/analyzer/link-rules";
import { mutateLink, getLinkValidator } from "@/validators/link-mutators";
import { formatCents } from "@/lib/utils";
import { orderFormSchema } from "@/validators/order.validators";
import { matchesSuggestedCategory } from "@/services/analyzer/category-matcher";
import {
  inferTargetTypeFromCategory,
  inferTargetTypeFromName,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  normalizeTargetType,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TargetTypeEnum
} from "@/utils/target-type";
import { resolveServiceTargetType } from "@/utils/target-type-mapper";
import {
  isLinkServiceCompatible,
  getCompatibilityError,
  normalizeServiceTargetType,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type LinkType,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type ServiceTargetType
} from "@/constants/link-service-compatibility";
import { toast } from "sonner";

export type OrderEngine = ReturnType<typeof useOrderEngine>;

function getCategoryDemandScore(name: string): number {
  const n = name.toLowerCase();
  
  if ((n.includes('подписчик') || n.includes('участник') || n.includes('follow') || n.includes('member')) && !n.includes('premium') && !n.includes('премиум') && !n.includes('бот')) {
    return 10;
  }
  if (n.includes('просмотр') || n.includes('охват') || n.includes('view') || n.includes('watch') || n.includes('stat') || n.includes('стат')) {
    return 20;
  }
  if (n.includes('лайк') || n.includes('like') || n.includes('нравится') || n.includes('heart')) {
    return 30;
  }
  if (n.includes('реакц') || n.includes('reaction') || n.includes('emoji') || n.includes('эмоци')) {
    return 40;
  }
  if (n.includes('premium') || n.includes('премиум')) {
    return 95;
  }
  if (n.includes('буст') || n.includes('boost') || n.includes('level')) {
    return 60;
  }
  if (n.includes('коммент') || n.includes('comment') || n.includes('отзыв') || n.includes('review')) {
    return 70;
  }
  if (n.includes('репост') || n.includes('repost') || n.includes('share') || n.includes('поделит')) {
    return 80;
  }
  if (n.includes('звезд') || n.includes('star') || n.includes('coin')) {
    return 90;
  }
  if (n.includes('бот') || n.includes('bot') || n.includes('инвайт') || n.includes('invite') || n.includes('referral') || n.includes('рефер')) {
    return 100;
  }
  return 999;
}

function sortCategories<T extends { name: string }>(categories: T[]): T[] {
  return [...categories].sort((a, b) => {
    const scoreA = getCategoryDemandScore(a.name);
    const scoreB = getCategoryDemandScore(b.name);
    
    if (scoreA !== scoreB) {
      return scoreA - scoreB;
    }
    return a.name.localeCompare(b.name);
  });
}

export function useOrderEngine(
  initialCatalog: PublicNetwork[] = [], 
  initialEmail: string = "", 
  initialServiceId: string = "",
  initialCategoryId: string = "",
  initialNetworkId: string = "",
  initialServices: PublicService[] = []
) {
  const sortedInitialCatalog: PublicNetwork[] = useMemo(() => {
    return initialCatalog.map(net => ({
      ...net,
      categories: sortCategories(net.categories)
    }));
  }, [initialCatalog]);

  // Clean initialization: preselect from props or fallback to deterministic default network/category
  const defaultNet = initialNetworkId 
    ? (sortedInitialCatalog.find(n => n.id === initialNetworkId) || null)
    : (sortedInitialCatalog.find(n => n.slug === 'telegram') || sortedInitialCatalog[0] || null);
  const defaultCat = defaultNet && initialCategoryId 
    ? (defaultNet.categories.find(c => c.id === initialCategoryId) || null)
    : (defaultNet?.categories.find(c => c.name.toLowerCase().includes('подписчики')) || defaultNet?.categories[0] || null);

  const [url, setUrl] = useState("");
  const [networkId, setNetworkId] = useState(defaultNet?.id || "");
  const [categoryId, setCategoryId] = useState(defaultCat?.id || "");
  const [selectedService, setSelectedService] = useState<PublicService | null>(null);
  const [quantity, setQuantity] = useState(100);
  const [email, setEmail] = useState(initialEmail);
  const [customData, setCustomData] = useState("");
  const [mediaGroupUrl, setMediaGroupUrl] = useState("");
  const [promoCode, setPromoCode] = useState("");
  // BUG-03: Default to false — per ст. 438 ГК РФ & 152-FZ, user must actively agree.
  // The text "Нажимая «Оплатить», вы соглашаетесь..." is replaced by active checkbox.
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLinkOverridden, setIsLinkOverridden] = useState(false);
  const [isWarningConfirmed, setIsWarningConfirmed] = useState(false);
  const [warningHasError, setWarningHasError] = useState(false);
  const [termsHasError, setTermsHasError] = useState(false);

  // BUG-10: Restore session state on mount (url, networkId, categoryId only — no email/promo per PCI DSS)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('smmplan_draft');
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.url && typeof draft.url === 'string' && draft.url !== 'https://' && draft.url !== 'http://') {
          setUrl(draft.url);
        }
        if (draft.networkId && sortedInitialCatalog.some((n: PublicNetwork) => n.id === draft.networkId)) {
          setNetworkId(draft.networkId);
        }
        if (draft.categoryId) setCategoryId(draft.categoryId);
        if (draft.quantity && typeof draft.quantity === 'number' && draft.quantity > 0) {
          setQuantity(draft.quantity);
        }
      }
    } catch { /* sessionStorage unavailable (SSR/incognito) */ }
  }, []);

  // SPEC-2026-14: Restore pending order snapshot if returning via Magic Link (?auth_resume=1)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const isAuthResume = window.location.search.includes('auth_resume=1');
      const rawSnapshot = 
        sessionStorage.getItem('smmplan_pending_order') ||
        localStorage.getItem('smmplan_pending_order') ||
        sessionStorage.getItem('omni_pending_order_v1') ||
        localStorage.getItem('omni_pending_order_v1');

      if (!rawSnapshot) return;
      const snapshot = JSON.parse(rawSnapshot);
      if (!snapshot || typeof snapshot !== 'object') return;

      const savedTime = snapshot.savedAt || snapshot.timestamp || 0;
      const isExpired = Date.now() - savedTime > 30 * 60 * 1000; // 30 min TTL

      if (isExpired) {
        sessionStorage.removeItem('smmplan_pending_order');
        localStorage.removeItem('smmplan_pending_order');
        sessionStorage.removeItem('omni_pending_order_v1');
        localStorage.removeItem('omni_pending_order_v1');
        return;
      }

      if (isAuthResume) {
        // Restore order fields
        const targetUrl = snapshot.link || snapshot.url;
        if (targetUrl && typeof targetUrl === 'string') {
          setUrl(targetUrl);
        }
        if (snapshot.networkId) {
          setNetworkId(snapshot.networkId);
        }
        if (snapshot.categoryId) {
          setCategoryId(snapshot.categoryId);
        }
        if (snapshot.quantity && typeof snapshot.quantity === 'number' && snapshot.quantity > 0) {
          setQuantity(snapshot.quantity);
        }
        if (snapshot.email && typeof snapshot.email === 'string') {
          setEmail(snapshot.email);
        }
        if (snapshot.promoCode && typeof snapshot.promoCode === 'string') {
          setPromoCode(snapshot.promoCode);
        }
        if (snapshot.customData && typeof snapshot.customData === 'string') {
          setCustomData(snapshot.customData);
        }
        if (snapshot.runs || snapshot.dripRuns) {
          setRuns(snapshot.runs || snapshot.dripRuns);
          setDripFeedEnabled(true);
        }
        if (snapshot.interval || snapshot.dripInterval) {
          setDripInterval(snapshot.interval || snapshot.dripInterval);
        }
        if (snapshot.isSmartDrip) {
          setIsSmartDrip(true);
          setSmartDripDays(snapshot.smartDripDays || 7);
        }

        // Restore service
        if (snapshot.serviceId) {
          getFreshServiceAction(snapshot.serviceId)
            .then((fresh) => {
              if (fresh) {
                setSelectedService(fresh);
              }
            })
            .catch(() => {});
        }

        // User feedback
        toast.success('Вы успешно вошли в аккаунт!', {
          description: 'Параметры вашего заказа восстановлены и готовы к оплате.'
        });

        // Clean up storage
        sessionStorage.removeItem('smmplan_pending_order');
        localStorage.removeItem('smmplan_pending_order');
        sessionStorage.removeItem('omni_pending_order_v1');
        localStorage.removeItem('omni_pending_order_v1');

        // Clean URL query param and ensure hash points to step 4
        try {
          const urlObj = new URL(window.location.href);
          urlObj.searchParams.delete('auth_resume');
          window.history.replaceState({}, '', urlObj.pathname + (urlObj.search ? urlObj.search : '') + '#step-4');
        } catch {}
      }
    } catch (e) {
      console.warn('[useOrderEngine] Failed to restore pending order snapshot:', e);
    }
  }, []);

  // BUG-10: Save draft progress to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem('smmplan_draft', JSON.stringify({
        url, networkId, categoryId, quantity
      }));
    } catch { /* sessionStorage unavailable */ }
  }, [url, networkId, categoryId, quantity]);

  // Reset category when URL transitions to filled state (length >= 5) and no service is selected yet
  const prevUrlRef = useRef("");
  useEffect(() => {
    const prevUrl = prevUrlRef.current;
    if (url.trim().length >= 5 && prevUrl.trim().length < 5 && !selectedServiceRef.current) {
      setCategoryId("");
    }
    prevUrlRef.current = url;
  }, [url]);
  
  // Drip-feed states
  const [dripFeedEnabled, setDripFeedEnabled] = useState(false);
  const [runs, setRuns] = useState(2);
  const [dripInterval, setDripInterval] = useState(5);

  // Smart Drip states
  const [isSmartDrip, setIsSmartDrip] = useState(false);
  const [smartDripDays, setSmartDripDays] = useState(7);

  // Data states - initialized with SSR pre-fetched services to prevent client waterfall
  const [catalog, setCatalog] = useState<PublicNetwork[]>(sortedInitialCatalog);
  const [services, setServices] = useState<PublicService[]>(initialServices);
  const isInitialServicesMount = useRef(initialServices.length > 0);
  const [platform, setPlatform] = useState<IntelligencePlatform | null>(null);
  const [manualPlatform, setManualPlatform] = useState<IntelligencePlatform | null>(null);
  const [promoPricing, setPromoPricing] = useState<PricingResult | null>(null);
  const [pricingError, setPricingError] = useState<'voucher' | null>(null);
  const [suggestedCategories, setSuggestedCategories] = useState<string[]>([]);
  const [detectedType, setDetectedType] = useState<string | null>(null);
  
  // Mass Order states
  const [massCalculation, setMassCalculation] = useState<{
    totalRub: number;
    totalCents: number;
    validCount: number;
    errors: { line: number; text: string; error: string }[];
        validOrders: Array<{ priceRub?: number; serviceId: string; numericId?: number; link: string; quantity: number; providerId?: string | null; providerServiceId?: string | null; costRub?: number }>;
  } | null>(null);
  const [isMassCalculating, setIsMassCalculating] = useState(false);
  const isMassMode = url.includes("\n") || url.split(/\s+/).filter(Boolean).length > 1;

  // Status states
  const [isLoading, setIsLoading] = useState(false);
  const [isServicesLoading, setIsServicesLoading] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [urlMutatedTrigger, setUrlMutatedTrigger] = useState(false);


  const isImmediateRef = useRef(false);

  const handleSetUrl = useCallback((newUrl: string, immediate = false) => {
    if (immediate) isImmediateRef.current = true;
    setUrl(newUrl);
    setIsLinkOverridden(false);
    setIsWarningConfirmed(false);
    setWarningHasError(false);
    if (!newUrl) {
      setValidationErrors(prev => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { link, ...rest } = prev;
        return rest;
      });
    }
  }, []);

  const handleSetManualPlatform = useCallback((p: IntelligencePlatform | null) => {
    setManualPlatform(p);
    if (p !== null) {
      setSuggestedCategories([]);
    }
  }, []);

  const hasFetchedCatalog = useRef(false);
  const lastPlatformRef = useRef<IntelligencePlatform | null>(null);
  const lastManualPlatformRef = useRef<IntelligencePlatform | null>(null);

  // Keep refs of selectedService, networkId and categoryId to prevent race conditions during URL analysis
  const selectedServiceRef = useRef<PublicService | null>(null);
  const networkIdRef = useRef(networkId);
  const categoryIdRef = useRef(categoryId);
  const serviceRequestIdRef = useRef(0);
  const categoryServicesCache = useRef<Record<string, PublicService[]>>({});
  
  useEffect(() => {
    selectedServiceRef.current = selectedService;
    networkIdRef.current = networkId;
    categoryIdRef.current = categoryId;
  }, [selectedService, networkId, categoryId]);

  // 1. Initial Catalog Load (if not provided)
  useEffect(() => {
    if (catalog.length === 0 && !hasFetchedCatalog.current) {
      hasFetchedCatalog.current = true;
      getPublicCatalogAction().then(res => {
        if (res.success && res.data) {
          const sortedData = res.data.map(net => ({
            ...net,
            categories: sortCategories(net.categories)
          }));
          setCatalog(sortedData);
          // Set defaults if they are still empty
          setNetworkId((current: string) => {
            if (!current && sortedData.length > 0) {
              if (initialNetworkId) {
                if (initialCategoryId) setCategoryId(initialCategoryId);
                return initialNetworkId;
              }

              const defNet = sortedData.find((n: PublicNetwork) => n.slug === 'telegram') || sortedData[0];
              if (defNet) {
                const defCat = defNet.categories.find((c: PublicCategory) => c.name.toLowerCase().includes('подписчики')) || defNet.categories[0];
                if (defCat) {
                  setCategoryId(defCat.id);
                }
                return defNet.id;
              }
            }
            return current;
          });
        }
      });
    } else if (catalog.length > 0 && initialNetworkId && !hasFetchedCatalog.current) {
       hasFetchedCatalog.current = true;
       // We already have the catalog, try to auto-select from initial properties
       setNetworkId(initialNetworkId);
       if (initialCategoryId) setCategoryId(initialCategoryId);
    }
  }, [catalog.length, initialNetworkId, initialCategoryId]);

  // 2. Analyze URL (Debounced)
  useEffect(() => {
    if (!url || url.length < 5) {
      setPlatform(null);
      setManualPlatform(null);
      setSuggestedCategories([]);
      setDetectedType(null);
      setIsLoading(false);
      return;
    }

    // BUG-FIX: Do NOT set isLoading here — if the timer is cleaned up before firing,
    // isLoading would stay `true` forever (the finally block never runs).
    // Instead, set it inside the timer callback.
    let stale = false;
    const delay = isImmediateRef.current ? 0 : 350;
    isImmediateRef.current = false;

    const handler = setTimeout(async () => {
      if (stale) return;
      setIsLoading(true);
      setError(null);
      try {
        const res = await analyzeUrl(url.trim());
        if (stale) return; // effect was cleaned up during fetch
        if (res.success && res.data) {
          const analysisData = res.data;
          setPlatform(analysisData.platform !== IntelligencePlatform.OTHER ? analysisData.platform : null);
          setManualPlatform(null); // Reset manual platform on new analysis
          setSuggestedCategories(analysisData.suggestedCategories || []);
          setDetectedType(analysisData.type || null);
          
          const activePlatformStr = analysisData.platform !== IntelligencePlatform.OTHER ? analysisData.platform.toLowerCase() : null;
          
          // Auto-select network
          if (activePlatformStr) {
            const matchedNet = catalog.find(n => n.slug.toLowerCase().includes(activePlatformStr) || activePlatformStr.includes(n.slug.toLowerCase()));
            if (matchedNet) {
               if (matchedNet.id !== networkIdRef.current || !selectedServiceRef.current) {
                  setNetworkId(matchedNet.id);
                  const catsForNet = matchedNet.categories;
                  let filteredCats = catsForNet;
                  if (analysisData.suggestedCategories && analysisData.suggestedCategories.length > 0) {
                      const f = catsForNet.filter(c => matchesSuggestedCategory(c.name, analysisData.suggestedCategories, c.analyzerTags, analysisData.type));
                      if (f.length > 0) filteredCats = f;
                  }
                  if (filteredCats.length > 0) {
                     // Smart Adaptive Flow: If link is entered and no service selected
                     if (url.trim().length >= 5 && !selectedServiceRef.current) {
                        // SRS Rule 1.3: Smart Auto-Select when N=1
                        if (filteredCats.length === 1) {
                           setCategoryId(filteredCats[0].id);
                        } else {
                           setCategoryId("");
                        }
                      } else if (selectedServiceRef.current) {
                         const currentSvc = selectedServiceRef.current;
                         const svcTargetType = resolveServiceTargetType(currentSvc);
                         const isSvcCompatible = !analysisData.type || isLinkServiceCompatible(analysisData.type, svcTargetType);
                         
                         const isCurrentCatCompatible = filteredCats.some(c => c.id === categoryIdRef.current);
                         if (!isCurrentCatCompatible && !isSvcCompatible) {
                            setCategoryId(filteredCats[0].id);
                            setSelectedService(null);
                         }
                      } else {
                         const isCurrentCompatible = filteredCats.some(c => c.id === categoryIdRef.current);
                         if (!isCurrentCompatible) {
                            setCategoryId(filteredCats[0].id);
                            setSelectedService(null);
                         }
                      }
                  }
               }
            }
          }
        }
      } catch (err) {
        console.error("URL analysis failed:", err);
      } finally {
        if (!stale) setIsLoading(false);
      }
    }, 350);

    return () => { stale = true; clearTimeout(handler); };
     
    // selectedService and networkId intentionally omitted — tracked via refs
    // to prevent URL re-analysis on manual service/network selection
  }, [url, catalog]);

  // 2.5 Auto-select network on platform or manual platform changes/catalog loads
  useEffect(() => {
    const activePlatform = platform || manualPlatform;
    const platformChanged = platform !== lastPlatformRef.current || manualPlatform !== lastManualPlatformRef.current;
    const catalogJustLoaded = catalog.length > 0 && lastPlatformRef.current === null && lastManualPlatformRef.current === null;
    
    lastPlatformRef.current = platform;
    lastManualPlatformRef.current = manualPlatform;

    if ((platformChanged || catalogJustLoaded) && activePlatform && activePlatform !== IntelligencePlatform.OTHER && catalog.length > 0) {
      const activePlatformStr = activePlatform.toLowerCase();
      const matchedNet = catalog.find(n => n.slug.toLowerCase().includes(activePlatformStr) || activePlatformStr.includes(n.slug.toLowerCase()));
      if (matchedNet) {
        setNetworkId(matchedNet.id);
        const catsForNet = matchedNet.categories;
        let filteredCats = catsForNet;
        if (suggestedCategories.length > 0 || detectedType) {
          const f = catsForNet.filter(c => matchesSuggestedCategory(c.name, suggestedCategories, c.analyzerTags, detectedType));
          if (f.length > 0) filteredCats = f;
        }
        if (filteredCats.length > 0) {
          if (url.trim().length >= 5) {
            if (!selectedServiceRef.current) {
              setCategoryId("");
            } else if (!categoryId || !catsForNet.some(c => c.id === categoryId)) {
              setCategoryId("");
            }
          } else {
            if (!categoryId || !catsForNet.some(c => c.id === categoryId)) {
              setCategoryId(filteredCats[0].id);
            }
          }
        }
      }
    }
  }, [platform, manualPlatform, catalog, suggestedCategories, categoryId, url]);

  // Handle cascaded selections (Network -> Category) manually
  useEffect(() => {
     if (networkId && catalog.length > 0) {
        // Reset media group URL when switching networks
        setMediaGroupUrl("");
        const net = catalog.find(n => n.id === networkId);
        if (net) {
           const catsForNet = net.categories.filter(c => (c.serviceCount ?? 0) > 0);
           const matchedCats = suggestedCategories.length > 0 || detectedType
              ? catsForNet.filter(c => matchesSuggestedCategory(c.name, suggestedCategories, c.analyzerTags, detectedType))
              : [];
           const availableCats = matchedCats.length > 0 ? matchedCats : catsForNet;
           if (availableCats.length > 0 && !availableCats.some(c => c.id === categoryId)) {
              if (url.trim().length >= 5 && !selectedServiceRef.current) {
                 setCategoryId("");
              } else if (selectedServiceRef.current) {
                 const currentSvc = selectedServiceRef.current;
                 const svcTargetType = resolveServiceTargetType(currentSvc);
                 const isSvcCompatible = !detectedType || isLinkServiceCompatible(detectedType, svcTargetType);
                 if (!isSvcCompatible) {
                    setCategoryId(availableCats[0].id);
                    setSelectedService(null);
                 }
              } else {
                 setCategoryId(availableCats[0].id);
                 setSelectedService(null);
              }
           }
        }
     }
  }, [networkId, catalog, categoryId, suggestedCategories, detectedType, url]);

  // 3. Load Services when Category changes
  useEffect(() => {
    // If we already pre-fetched services during SSR for the initial default category, reuse them instantly
    if (isInitialServicesMount.current && categoryId === defaultCat?.id && initialServices.length > 0) {
      isInitialServicesMount.current = false;
      if (initialServiceId && !selectedServiceRef.current) {
        const found = initialServices.find(s => s.id === initialServiceId);
        if (found) setSelectedService(found);
      }
      return;
    }
    isInitialServicesMount.current = false;

    if (!categoryId) {
      setServices([]);
      setSelectedService(null);
      setIsLoading(false);
      setIsServicesLoading(false);
      setDripFeedEnabled(false);
      setRuns(2);
      setDripInterval(5);
      return;
    }

    const isLinkFilled = Boolean(url && url.trim().length >= 5);

    // Instant cache hit: zero latency, zero flicker when switching categories
    const cachedSvcs = categoryServicesCache.current[categoryId];
    if (cachedSvcs && cachedSvcs.length > 0) {
      let finalSvcs = cachedSvcs;
      if (detectedType && isLinkFilled) {
        finalSvcs = cachedSvcs.filter(s =>
          // FIX: s.targetType is always "POST" by default (Prisma schema),
          // so the || operator would never invoke inferTargetTypeFromName.
          // resolveServiceTargetType() correctly overrides "POST" with name-inferred type.
          isLinkServiceCompatible(detectedType, resolveServiceTargetType(s))
        );
      }
      setServices(finalSvcs);
      setIsServicesLoading(false);
      setIsLoading(false);
      if (initialServiceId && !selectedServiceRef.current) {
        const found = finalSvcs.find(s => s.id === initialServiceId);
        if (found) setSelectedService(found);
      }
      return;
    }

    // Clear and set loading state for fresh category fetch
    setServices([]);
    setSelectedService(null);

    const currentRequestId = ++serviceRequestIdRef.current;

    const loadServices = async () => {
      setIsLoading(true);
      setIsServicesLoading(true);
      try {
        const svcs = await getServicesByCategoryAction(categoryId);
        if (currentRequestId !== serviceRequestIdRef.current) return;
        
        // WAVE 4.1: Marketing UX Sorting & TargetType Compatibility Prioritization
        const sortedSvcs = [...svcs].sort((a, b) => {
            const aQuarantined = a.cooldownUntil && new Date(a.cooldownUntil) > new Date();
            const bQuarantined = b.cooldownUntil && new Date(b.cooldownUntil) > new Date();
            if (aQuarantined && !bQuarantined) return 1;
            if (!aQuarantined && bQuarantined) return -1;
            return 0;
        });

        categoryServicesCache.current[categoryId] = sortedSvcs;

        // ZERO-DEAD-END INVARIANT: If detectedType is active, strictly filter compatible services
        let finalSvcs = sortedSvcs;
        if (detectedType && isLinkFilled) {
          const compatibleSvcs = sortedSvcs.filter(s =>
            // FIX: resolveServiceTargetType() overrides Prisma's default "POST" with
            // name-inferred type (e.g., "Подписчики Telegram" → CHANNEL).
            isLinkServiceCompatible(detectedType, resolveServiceTargetType(s))
          );
          finalSvcs = compatibleSvcs;
        }

        setServices(finalSvcs);
        
        if (initialServiceId && !selectedServiceRef.current) {
           const found = finalSvcs.find(s => s.id === initialServiceId);
           if (found) {
              setSelectedService(found);
           } else {
              setSelectedService(null);
           }
        } else {
           setSelectedService(null);
        }
      } catch (err) {
        if (currentRequestId !== serviceRequestIdRef.current) return;
        console.error("Failed to load services:", err);
        setServices([]);
        setSelectedService(null);
        toast.error("Не удалось загрузить услуги. Проверьте подключение к сети.");
      } finally {
        if (currentRequestId === serviceRequestIdRef.current) {
          setIsLoading(false);
          setIsServicesLoading(false);
        }
      }
    };

    loadServices();
  }, [categoryId, initialServiceId, detectedType, url.trim().length >= 5]);

  // 4. Update quantity limits when Service changes or initializes
  useEffect(() => {
    if (selectedService) {
      setQuantity(selectedService.minQty);
      setDripFeedEnabled(false);
      setRuns(2);
      setDripInterval(5);
      setIsSmartDrip(false);
      setSmartDripDays(7);
      setIsLinkOverridden(false);
      setIsWarningConfirmed(false);
      setWarningHasError(false);
    }
  }, [selectedService]);

  // 5. Calculate Price (Synchronous useMemo for standard, state-based for promo codes)
  const pricing = useMemo(() => {
    if (!selectedService || quantity < 1) return null;

    if (promoCode && promoCode.trim().length > 0) {
      return promoPricing;
    }

    const totalQty = quantity;
    const originalTotalCents = Math.max(1, Math.ceil(selectedService.pricePerUnitRub * 100 * totalQty));

    let totalCents = originalTotalCents;
    if (isSmartDrip && selectedService.smartConfig?.isEnabled) {
      totalCents = Math.round(totalCents * (1 + selectedService.smartConfig.markup));
    }

    return {
      totalCents,
      originalTotalCents,
      discountCents: 0,
      discountPercent: 0,
      providerCostCents: 0,
      safetyFloorCents: 0,
      tier: 'REGULAR'
    };
  }, [selectedService, quantity, promoCode, promoPricing, dripFeedEnabled, runs, isSmartDrip]);

  // 5.2 Server-side calculation only if a promo code needs validation
  useEffect(() => {
    if (!selectedService || quantity < 1 || !promoCode || promoCode.trim().length === 0) {
      setPromoPricing(null);
      setPricingError(null);
      setIsCalculating(false);
      return;
    }

    // BUG-FIX: Same race condition pattern as URL analysis.
    // Move setIsCalculating(true) inside the timer to prevent stuck state.
    let stale = false;

    const handler = setTimeout(async () => {
      if (stale) return;
      setIsCalculating(true);
      try {
        const res = await calculatePriceAction(
          selectedService.id, 
          quantity, 
          promoCode, 
          dripFeedEnabled ? runs : undefined
        );
        if (stale) return;
        if (res.success && res.data) {
          setPromoPricing(res.data);
          setPricingError(null);
        } else if (res.error?.startsWith('VOUCHER_USE_BALANCE:')) {
          setPromoPricing(null);
          setPricingError('voucher');
        } else {
          setPromoPricing(null);
          setPricingError(null);
        }
      } catch (err) {
        if (!stale) {
          console.error("Price calculation failed:", err);
          setPromoPricing(null);
          setPricingError(null);
        }
      } finally {
        if (!stale) setIsCalculating(false);
      }
    }, 150);

    return () => { stale = true; clearTimeout(handler); };
  }, [selectedService, quantity, promoCode, dripFeedEnabled, runs]);

  // 5.5 Calculate Mass Order Price (Debounced)
  useEffect(() => {
    if (!isMassMode || !url.trim()) {
      setMassCalculation(null);
      return;
    }

    const handler = setTimeout(async () => {
      setIsMassCalculating(true);
      try {
        const { massOrderCalculateAction } = await import("@/actions/order/mass");
        const res = await massOrderCalculateAction({ text: url });
        if (res.success) {
          setMassCalculation(res.data);
        } else {
          setMassCalculation({
            totalRub: 0,
            totalCents: 0,
            validCount: 0,
            errors: [{ line: 0, text: "", error: res.error || "Ошибка парсинга" }],
            validOrders: []
          });
        }
            } catch (e: unknown) {
        const err = e as Error;
        setMassCalculation({
          totalRub: 0,
          totalCents: 0,
          validCount: 0,
          errors: [{ line: 0, text: "", error: err.message || "Неизвестная ошибка" }],
          validOrders: []
        });
      } finally {
        setIsMassCalculating(false);
      }
    }, 250);

    return () => clearTimeout(handler);
  }, [url, isMassMode]);

  // Form Validation
  const validate = useCallback((shouldMutate = false) => {
    let currentUrl = url;

    // Advanced Link Validation & Mutation
    const currentNetwork = catalog.find(n => n.id === networkId);
    const activePlatform = currentNetwork?.slug || platform || manualPlatform || '';
    if (shouldMutate && selectedService && activePlatform) {
       const activeCat = catalog.flatMap(n => n.categories).find(c => c.id === selectedService.categoryId);
       const targetType = selectedService.targetType === 'POST'
         ? inferTargetTypeFromCategory(activeCat?.name)
         : (selectedService.targetType || inferTargetTypeFromCategory(activeCat?.name));
       const cleanUrl = mutateLink(currentUrl, activePlatform, targetType);
       if (cleanUrl !== currentUrl) {
           currentUrl = cleanUrl;
           setUrl(cleanUrl);
           toast.success('Ссылка автоматически скорректирована под выбранный тип услуги!');
           setUrlMutatedTrigger(true);
           setTimeout(() => setUrlMutatedTrigger(false), 2000);
       }
    }

    const result = orderFormSchema.safeParse({
      link: currentUrl,
      quantity,
      email,
      serviceId: selectedService?.id || "",
      customData: customData ? customData : undefined,
      agreedToTerms
    });

    const errors: Record<string, string> = {};
    if (!result.success) {
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          const fieldName = err.path[0].toString();
          // Filter initial blank errors to prevent visual noise on mount
          if (fieldName === 'link' && !currentUrl) return;
          if (fieldName === 'email' && !email) return;
          errors[fieldName] = err.message;
        }
      });
    }

    // Strict Domain TargetType Compatibility Guard (Frontend Defense)
    if (selectedService && detectedType && !isLinkOverridden) {
      const activeCat2 = catalog.flatMap(n => n.categories).find(c => c.id === selectedService.categoryId);
      const serviceTargetType = normalizeServiceTargetType(
        // FIX: use resolveServiceTargetType to avoid false errors when targetType = "POST" (default)
        resolveServiceTargetType(selectedService) || inferTargetTypeFromCategory(activeCat2?.name)
      );
      if (!isLinkServiceCompatible(detectedType, serviceTargetType)) {
        errors['link'] = getCompatibilityError(detectedType, serviceTargetType, selectedService.name);
      }
    }

    // Advanced Link Format Regex Validator
    if (selectedService && activePlatform && currentUrl && !isLinkOverridden && !errors['link']) {
       const activeCat2 = catalog.flatMap(n => n.categories).find(c => c.id === selectedService.categoryId);
       const targetType = selectedService.targetType || inferTargetTypeFromCategory(activeCat2?.name);
       const cleanUrl = mutateLink(currentUrl, activePlatform, targetType);
       const validator = getLinkValidator(activePlatform, targetType);
       const linkResult = validator.safeParse(cleanUrl);
       
       if (!linkResult.success) {
           errors['link'] = linkResult.error.errors[0].message;
       }
    }

    if (selectedService) {
      if (dripFeedEnabled && runs > 0) {
        const chunk = Math.floor(quantity / runs);
        if (chunk < selectedService.minQty) {
          errors['dripfeed'] = `Для ${runs} запусков общее количество должно быть минимум ${selectedService.minQty * runs} шт. (мин. ${selectedService.minQty} шт. на запуск)`;
        }
      } else if (isSmartDrip && smartDripDays > 0) {
        const chunk = Math.floor(quantity / smartDripDays);
        if (chunk < selectedService.minQty) {
          errors['dripfeed'] = `Для Умного Drip на ${smartDripDays} дней общее количество должно быть минимум ${selectedService.minQty * smartDripDays} шт. (мин. ${selectedService.minQty} шт./день)`;
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return false;
    }
    
    setValidationErrors({});
    return true;
  }, [url, quantity, email, selectedService, customData, agreedToTerms, platform, networkId, categoryId, catalog, manualPlatform, dripFeedEnabled, runs, isSmartDrip, smartDripDays]);

  // Real-time validation reaction
  useEffect(() => {
    validate(false); // Only run layout checking on typing, do NOT mutate URL
  }, [url, selectedService, email, quantity, customData, agreedToTerms, networkId, categoryId, dripFeedEnabled, runs, isSmartDrip, smartDripDays, validate]);

  // Helper getters
  const mediaGroupMultiplier = mediaGroupUrl.trim().length > 5 ? 2 : 1;
  
  let finalCents = pricing ? pricing.totalCents * mediaGroupMultiplier : 0;
  if (pricing && isSmartDrip && selectedService?.smartConfig?.isEnabled) {
    finalCents = Math.round(finalCents * (1 + selectedService.smartConfig.markup));
  }
  
  const totalPriceFormatted = finalCents > 0 
    ? formatCents(finalCents) 
    : formatCents(0); // REQUIRED BY PROTOCOL: Draw 0.00 RUB if empty

  const activeNetwork = catalog.find(n => n.id === networkId) || catalog[0] || null;
  let availableCategories = activeNetwork 
    ? activeNetwork.categories.filter(c => (c.serviceCount ?? 0) > 0)
    : [];
  
  // Restore aggressive filtering to prevent users from ordering Post services (like Reactions) for a Profile link.
  // Apply suggestedCategories filter ONLY when the selected networkId matches the auto-detected platform to prevent empty panels when switching.
  const activePlatform = manualPlatform || platform;
  const isMatchingAutodetected = activeNetwork && activePlatform && activePlatform !== IntelligencePlatform.OTHER && activeNetwork.slug.toLowerCase().includes(activePlatform.toLowerCase());

  if (isMatchingAutodetected && (suggestedCategories.length > 0 || detectedType) && url.trim().length >= 5) {
    const filteredCats = availableCategories.filter(c => {
      if (!matchesSuggestedCategory(c.name, suggestedCategories, c.analyzerTags, detectedType)) {
        return false;
      }
      // Zero Dead-End Invariant: If category services are in cache, verify >= 1 is compatible with detectedType
      if (detectedType && categoryServicesCache.current[c.id]) {
        const cached = categoryServicesCache.current[c.id];
        if (cached.length > 0) {
          return cached.some(s => isLinkServiceCompatible(detectedType, resolveServiceTargetType(s)));
        }
      }
      return true;
    });
    availableCategories = filteredCats;
  }
  
  const displayCatalog = catalog;

  const compatibilityWarning = useMemo(() => {
    if (!selectedService || !detectedType || isLinkOverridden) return null;
    const activeCat = catalog.flatMap(n => n.categories).find(c => c.id === selectedService.categoryId);
    const serviceTargetType = normalizeServiceTargetType(
      // FIX: resolveServiceTargetType corrects Prisma's default "POST" using name inference
      resolveServiceTargetType(selectedService) || inferTargetTypeFromCategory(activeCat?.name)
    );
    if (!isLinkServiceCompatible(detectedType, serviceTargetType)) {
      return getCompatibilityError(detectedType, serviceTargetType, selectedService.name);
    }
    return null;
  }, [selectedService, detectedType, isLinkOverridden, catalog]);

  // Live Sync: on window focus or visibility change, re-check selected service for real-time prices and limits
  useEffect(() => {
    const handleSync = () => {
      if (selectedServiceRef.current?.id) {
        getFreshServiceAction(selectedServiceRef.current.id).then((fresh) => {
          if (fresh) {
            setSelectedService(prev => {
              if (!prev || prev.id !== fresh.id) return prev;
              if (
                prev.pricePerUnitRub !== fresh.pricePerUnitRub ||
                prev.minQty !== fresh.minQty ||
                prev.maxQty !== fresh.maxQty ||
                prev.description !== fresh.description ||
                prev.name !== fresh.name ||
                prev.isActive !== fresh.isActive
              ) {
                return fresh;
              }
              return prev;
            });
          }
        }).catch(() => {});
      }
    };

    window.addEventListener('focus', handleSync);
    document.addEventListener('visibilitychange', handleSync);
    return () => {
      window.removeEventListener('focus', handleSync);
      document.removeEventListener('visibilitychange', handleSync);
    };
  }, []);

  return {
    // State
    url, setUrl: handleSetUrl,
    networkId, setNetworkId,
    categoryId, setCategoryId,
    selectedService, setSelectedService,
    quantity, setQuantity,
    email, setEmail,
    customData, setCustomData,
    mediaGroupUrl, setMediaGroupUrl,
    promoCode, setPromoCode,
    agreedToTerms, setAgreedToTerms,
    isLinkOverridden, setIsLinkOverridden,
    isWarningConfirmed, setIsWarningConfirmed,
    warningHasError, setWarningHasError,
    termsHasError, setTermsHasError,
    
    // Drip-feed
    dripFeedEnabled, setDripFeedEnabled,
    runs, setRuns,
    dripInterval, setDripInterval,

    // Smart Drip
    isSmartDrip, setIsSmartDrip,
    smartDripDays, setSmartDripDays,
    
    platform,
    detectedType,
    suggestedCategories,
    manualPlatform,
    setManualPlatform: handleSetManualPlatform,
    activeNetwork,
    catalog: displayCatalog,
    unfilteredCatalog: catalog,
    availableCategories,
    services,
    pricing,
    pricingError,
    totalPriceFormatted,
    mediaGroupMultiplier,
    
    // Status
    isLoading: isLoading || isServicesLoading,
    isServicesLoading,
    isAnalyzingUrl: isLoading,
    isCalculating,
    error,
    validationErrors,
    compatibilityWarning,
    urlMutatedTrigger,
    
    // Mass Mode
    isMassMode,
    massCalculation,
    isMassCalculating,
    
    // Methods
    validate,
    resetOrder: useCallback(() => {
      setUrl("");
      setSelectedService(null);
      setPromoCode("");
      setIsLinkOverridden(false);
      setIsWarningConfirmed(false);
      setWarningHasError(false);
      setTermsHasError(false);
      setValidationErrors({});
      try {
        sessionStorage.removeItem('smmplan_draft');
      } catch { /* SSR or storage disabled */ }
    }, [])
  };
}
