'use client';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getPublicCatalogAction, getServicesByCategoryAction, PublicNetwork, PublicCategory, PublicService } from '@/actions/order/catalog';
import { calculatePriceAction, getAvailableGatewaysAction } from '@/actions/order/checkout';
import { trackEvent } from '@/lib/analytics';
import { analyzeUrl } from '@/actions/order/analyze-url';
import { matchesSuggestedCategory } from '@/services/analyzer/category-matcher';
import { isLinkServiceCompatible } from '@/constants/link-service-compatibility';
import { resolveServiceTargetType } from '@/utils/target-type-mapper';
import { mutateLink } from '@/validators/link-mutators';
import { validateDripFeedFloor, validateBaseOrderLink, saveOrderDraftToStorage, loadOrderDraftFromStorage } from '@/hooks/useBaseOrderValidation';
import { WizardStep, PaymentGateway, AvailableGateways, FormErrors, SmmplanOrderWizardProps, TariffSubtypeFilter } from './types';
import { isChannelSrv, isPostSrv, normalizeUrl } from './helpers';

export function useSmmplanOrderWizard({ userEmail = '', initialReorderData, tenantId = 'smmplan' }: SmmplanOrderWizardProps) {
  const router = useRouter(); const searchParams = useSearchParams();
  const [networks, setNetworks] = useState<PublicNetwork[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true); const [step, setStep] = useState<WizardStep>(1);
  const [selectedNetwork, setSelectedNetwork] = useState<PublicNetwork | null>(null); const [selectedCategory, setSelectedCategory] = useState<PublicCategory | null>(null);
  const [services, setServices] = useState<PublicService[]>([]); const [isLoadingServices, setIsLoadingServices] = useState(false); const [selectedService, setSelectedService] = useState<PublicService | null>(null);
  const [link, setLink] = useState(''); const [quantity, setQuantity] = useState<number>(100);
  const [email, setEmail] = useState(userEmail); const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(''); const [showPromo, setShowPromo] = useState(false);
  const [promoMessage, setPromoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null); const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [gateway, setGateway] = useState<PaymentGateway>('balance'); const [availableGateways, setAvailableGateways] = useState<AvailableGateways | null>(null);
  const [isDripFeedEnabled, setIsDripFeedEnabled] = useState(false); const [dripRuns, setDripRuns] = useState(5); const [dripInterval, setDripInterval] = useState(60);
  const [isSmartDrip, setIsSmartDrip] = useState(false);
  const [customData, setCustomData] = useState(''); const [isRequirementsConfirmed, setIsRequirementsConfirmed] = useState(false);
  const [isTgGuideOpen, setIsTgGuideOpen] = useState(false); const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false); const [shakeKey, setShakeKey] = useState(0);
  const [calculatedPriceRub, setCalculatedPriceRub] = useState<number | null>(null); const [isCalculatingPrice, setIsCalculatingPrice] = useState(false);
  const [searchNetwork, setSearchNetwork] = useState(''); const [searchCategory, setSearchCategory] = useState('');
  const [detectedType, setDetectedType] = useState<string | null>(null); const [suggestedCategories, setSuggestedCategories] = useState<string[]>([]);
  const [showAllCategories, setShowAllCategories] = useState(false); const [tariffSubtypeFilter, setTariffSubtypeFilter] = useState<TariffSubtypeFilter>('auto');
  const analyzeRequestIdRef = useRef(0);
  const serviceRequestIdRef = useRef(0);
  const priceRequestIdRef = useRef(0);
  const formRef = useRef<HTMLFormElement>(null); const errorRef = useRef<HTMLDivElement>(null); const hasRestoredUrlRef = useRef(false);

  // [T2-1] Restore sessionStorage draft on mount (no email/promo per PCI DSS)
  useEffect(() => {
    const draft = loadOrderDraftFromStorage<{ link?: string; quantity?: number }>('smmplan_draft');
    if (draft) {
      if (draft.link && typeof draft.link === 'string' && draft.link.length >= 5) setLink(draft.link);
      if (draft.quantity && typeof draft.quantity === 'number' && draft.quantity > 0) setQuantity(draft.quantity);
    }
  }, []);

  // [T2-1] Persist draft to sessionStorage on changes
  useEffect(() => {
    saveOrderDraftToStorage('smmplan_draft', { link, networkId: selectedNetwork?.id, categoryId: selectedCategory?.id, quantity });
  }, [link, selectedNetwork?.id, selectedCategory?.id, quantity]);

  useEffect(() => {
    getAvailableGatewaysAction().then((res) => {
      if (res.success && res.data) {
        setAvailableGateways(res.data);
        if (gateway !== 'balance' && !res.data[gateway as keyof typeof res.data]) setGateway('balance');
      }
    }).catch(() => {});
  }, [gateway]);

  useEffect(() => {
    const trimmed = link.trim();
    if (trimmed.length < 5) { setDetectedType(null); setSuggestedCategories([]); setShowAllCategories(false); return; }
    const currentRequestId = ++analyzeRequestIdRef.current;
    const timer = setTimeout(async () => {
      try {
        const res = await analyzeUrl(trimmed);
        if (currentRequestId !== analyzeRequestIdRef.current) return;
        if (res.success && res.data) {
          setDetectedType(res.data.type || null); setSuggestedCategories(res.data.suggestedCategories || []);
          const platformStr = res.data.platform !== 'OTHER' ? res.data.platform.toLowerCase() : null;
          if (platformStr && networks.length > 0) {
            const m = networks.find(n => n.slug.toLowerCase() === platformStr);
            if (m && (!selectedNetwork || selectedNetwork.id !== m.id)) setSelectedNetwork(m);
          }
        } else { setDetectedType(null); setSuggestedCategories([]); }
      } catch { if (currentRequestId === analyzeRequestIdRef.current) { setDetectedType(null); setSuggestedCategories([]); } }
    }, 300);
    return () => clearTimeout(timer);
  }, [link, networks, selectedNetwork]);

  const changeStep = (newStep: WizardStep, srvId?: string, catId?: string, netId?: string) => {
    setStep(newStep);
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (newStep === 1) { p.delete('step'); p.delete('serviceId'); p.delete('categoryId'); p.delete('networkId'); }
      else {
        p.set('step', String(newStep));
        const s = srvId ?? selectedService?.id; const c = catId ?? selectedCategory?.id; const n = netId ?? selectedNetwork?.id;
        if (s && newStep === 4) p.set('serviceId', s); else p.delete('serviceId');
        if (c && newStep >= 3) p.set('categoryId', c); else p.delete('categoryId');
        if (n && newStep >= 2) p.set('networkId', n); else p.delete('networkId');
      }
      const q = p.toString();
      router.replace(q ? window.location.pathname + '?' + q : window.location.pathname, { scroll: false });
    }
  };

  useEffect(() => {
    if (hasRestoredUrlRef.current || isLoadingCatalog || networks.length === 0 || initialReorderData) return;
    hasRestoredUrlRef.current = true;
    const p = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : searchParams; const pStep = p.get('step');
    if (pStep) {
      const parsed = parseInt(pStep, 10);
      if (parsed >= 1 && parsed <= 4) {
        const netId = p.get('networkId'); const catId = p.get('categoryId'); const srvId = p.get('serviceId');
        const foundNet = netId ? networks.find(n => n.id === netId) || null : (catId ? networks.find(n => n.categories.some(c => c.id === catId)) || null : selectedNetwork);
        if (foundNet) {
          setSelectedNetwork(foundNet);
          if (catId) { const foundCat = foundNet.categories.find(c => c.id === catId) || null; if (foundCat) setSelectedCategory(foundCat); }
        }
        if (srvId && catId) {
          getServicesByCategoryAction(catId, tenantId).then(servs => {
            const s = servs.find(srv => srv.id === srvId); if (s) { setSelectedService(s); setQuantity(s.minQty || 100); }
          }).catch(() => {});
        }
        setStep(parsed as WizardStep);
      }
    }
  }, [isLoadingCatalog, networks, searchParams, initialReorderData, tenantId, selectedNetwork]);

  useEffect(() => {
    trackEvent('order_started'); setIsLoadingCatalog(true);
    getPublicCatalogAction(tenantId).then(res => {
      if (res.success && res.data) {
        setNetworks(res.data);
        if (initialReorderData) {
          const net = res.data.find(n => n.categories.some(c => c.id === initialReorderData.categoryId));
          if (net) {
            setSelectedNetwork(net); const cat = net.categories.find(c => c.id === initialReorderData.categoryId);
            if (cat) { setSelectedCategory(cat); setStep(3); }
          }
        }
      }
    }).catch(console.error).finally(() => setIsLoadingCatalog(false));
  }, [initialReorderData, tenantId]);

  // [T1-2 + T1-6] resolveServiceTargetType in filter + requestId race-condition guard
  useEffect(() => {
    if (!selectedCategory) { setServices([]); return; }
    const currentRequestId = ++serviceRequestIdRef.current;
    setIsLoadingServices(true);
    getServicesByCategoryAction(selectedCategory.id, tenantId).then(servs => {
      if (currentRequestId !== serviceRequestIdRef.current) return;
      let finalServs = servs;
      if (detectedType && link.trim().length >= 5) {
        const comp = servs.filter(s => isLinkServiceCompatible(detectedType, resolveServiceTargetType(s)));
        if (comp.length > 0) finalServs = comp;
      }
      setServices(finalServs);
      const targetId = initialReorderData?.serviceId || searchParams.get('serviceId');
      if (targetId) {
        const s = finalServs.find(srv => srv.id === targetId);
        if (s) {
          setSelectedService(s);
          if (initialReorderData) { setQuantity(initialReorderData.quantity); setLink(initialReorderData.link); } else setQuantity(s.minQty || 100);
          if (searchParams.get('step') === '4' || initialReorderData) setStep(4);
        }
      }
    }).catch(console.error).finally(() => {
      if (currentRequestId === serviceRequestIdRef.current) setIsLoadingServices(false);
    });
  }, [selectedCategory, initialReorderData, searchParams, detectedType, link, tenantId]);

  const totalQuantity = isDripFeedEnabled ? quantity * dripRuns : quantity;

  // [T1-7] Drip-Feed Floor Invariant warning via shared validation engine
  const dripFloorWarning: string | null = (() => {
    if (!isDripFeedEnabled || !selectedService) return null;
    const res = validateDripFeedFloor({
      isDripFeedEnabled,
      quantity,
      runs: dripRuns,
      minQty: selectedService.minQty,
    });
    return res.warningMessage;
  })();

  const handleSelectService = (srv: PublicService) => {
    setSelectedService(srv); setQuantity(srv.minQty || 100); setIsDripFeedEnabled(false); setIsSmartDrip(false);
    setDripRuns(5); setDripInterval(60); setCustomData(''); setIsRequirementsConfirmed(false); setErrors({});
    trackEvent('service_selected', { serviceId: srv.id, serviceName: srv.name, price: srv.pricePerUnitRub });
    changeStep(4, srv.id, selectedCategory?.id, selectedNetwork?.id);
  };

  // [T1-4] Pass isSmartDrip to calculatePriceAction
  const handleApplyPromo = async () => {
    const code = promoCodeInput.trim().toUpperCase(); if (!code || !selectedService) return;
    setIsApplyingPromo(true); setPromoMessage(null);
    try {
      const res = await calculatePriceAction(selectedService.id, totalQuantity, code, isDripFeedEnabled ? dripRuns : undefined, isSmartDrip);
      if (res.success && res.data && res.data.discountCents > 0) {
        const base = res.data.originalTotalCents || res.data.totalCents; const disc = Math.round((res.data.discountCents / base) * 100);
        setAppliedPromo(code); setCalculatedPriceRub(res.data.totalCents / 100);
        setPromoMessage({ type: 'success', text: 'Промокод «' + code + '» применен: скидка ' + disc + '%' });
        toast.success('Промокод применен: скидка ' + disc + '%');
      } else { setAppliedPromo(''); setPromoMessage({ type: 'error', text: res.error || 'Промокод не найден' }); }
    } catch { setPromoMessage({ type: 'error', text: 'Не удалось проверить промокод' }); }
    finally { setIsApplyingPromo(false); }
  };

  const handleRemovePromo = () => { setAppliedPromo(''); setPromoCodeInput(''); setPromoMessage(null); };

  // [T1-4 + T1-5] isSmartDrip in price calc + requestId stale guard
  useEffect(() => {
    if (!selectedService || !quantity) { setCalculatedPriceRub(null); return; }
    const currentRequestId = ++priceRequestIdRef.current;
    setIsCalculatingPrice(true);
    calculatePriceAction(selectedService.id, totalQuantity, appliedPromo || undefined, isDripFeedEnabled ? dripRuns : undefined, isSmartDrip)
      .then(res => {
        if (currentRequestId !== priceRequestIdRef.current) return;
        if (res.success && res.data) setCalculatedPriceRub(res.data.totalCents / 100);
        else setCalculatedPriceRub(selectedService.pricePerUnitRub * totalQuantity);
      })
      .catch(() => { if (currentRequestId === priceRequestIdRef.current) setCalculatedPriceRub(selectedService.pricePerUnitRub * totalQuantity); })
      .finally(() => { if (currentRequestId === priceRequestIdRef.current) setIsCalculatingPrice(false); });
  }, [selectedService, quantity, totalQuantity, appliedPromo, isSmartDrip, dripRuns, isDripFeedEnabled]);

  const addQuantity = (delta: number) => { if (!selectedService) return; setQuantity(Math.min(selectedService.maxQty, Math.max(selectedService.minQty, (quantity || 0) + delta))); };

  // [T1-3] Apply mutateLink on blur for auto-correction
  const handleBlurLink = () => {
    if (!link) return;
    const normalized = normalizeUrl(link);
    if (!selectedService || !selectedNetwork) { setLink(normalized); return; }
    const targetType = resolveServiceTargetType(selectedService);
    const platformSlug = selectedNetwork.slug.toUpperCase();
    try {
      const mutated = mutateLink(normalized, platformSlug, targetType);
      if (mutated !== link) { setLink(mutated); toast.info('Ссылка скорректирована автоматически'); }
    } catch { setLink(normalized); }
  };

  // [T1-3 + T2-3] Validator exposed for submit guard via shared validation engine
  const validateLinkFormat = (): string | null => {
    if (!selectedService || !selectedNetwork || !link) return null;
    const targetType = resolveServiceTargetType(selectedService);
    const platformSlug = selectedNetwork.slug.toUpperCase();
    return validateBaseOrderLink(link, platformSlug, targetType);
  };

  const filteredNetworks = networks.filter(n => n.name.toLowerCase().includes(searchNetwork.toLowerCase()));
  const isLinkActive = link.trim().length >= 5;
  const hasSmartFilter = isLinkActive && Boolean(detectedType || (suggestedCategories && suggestedCategories.length > 0));
  const matchedCategories = selectedNetwork ? selectedNetwork.categories.filter(c => !hasSmartFilter || matchesSuggestedCategory(c.name, suggestedCategories, (c as { analyzerTags?: string }).analyzerTags ?? null, detectedType)) : [];
  const effectiveCategories = (!hasSmartFilter || showAllCategories || matchedCategories.length === 0) ? (selectedNetwork?.categories || []) : matchedCategories;
  const filteredCategories = effectiveCategories.filter(c => c.name.toLowerCase().includes(searchCategory.toLowerCase()));
  const channelServicesCount = services.filter(isChannelSrv).length; const postServicesCount = services.filter(isPostSrv).length;
  const hasMultipleSubtypes = channelServicesCount > 0 && postServicesCount > 0;
  const effectiveSubtype: 'all' | 'channel' | 'post' = tariffSubtypeFilter !== 'auto' ? tariffSubtypeFilter : (['channel', 'group', 'chat'].includes(detectedType || '') ? 'channel' : (['post', 'private_post', 'photo'].includes(detectedType || '') ? 'post' : 'all'));
  const displayedServices = services.filter(s => (!hasMultipleSubtypes || effectiveSubtype === 'all') ? true : (effectiveSubtype === 'channel' ? isChannelSrv(s) : isPostSrv(s)));

  return {
    router, networks, filteredNetworks, isLoadingCatalog, step, setStep, changeStep,
    selectedNetwork, setSelectedNetwork, selectedCategory, setSelectedCategory,
    services, isLoadingServices, selectedService, setSelectedService, handleSelectService,
    link, setLink, handleBlurLink, validateLinkFormat,
    quantity, setQuantity, addQuantity, totalQuantity,
    email, setEmail,
    promoCodeInput, setPromoCodeInput, appliedPromo, promoMessage, isApplyingPromo,
    showPromo, setShowPromo, handleApplyPromo, handleRemovePromo,
    gateway, setGateway, availableGateways,
    isDripFeedEnabled, setIsDripFeedEnabled, dripRuns, setDripRuns, dripInterval, setDripInterval,
    isSmartDrip, setIsSmartDrip, dripFloorWarning,
    customData, setCustomData, isRequirementsConfirmed, setIsRequirementsConfirmed,
    isTgGuideOpen, setIsTgGuideOpen,
    errors, setErrors, isSubmitting, setIsSubmitting, shakeKey, setShakeKey,
    calculatedPriceRub, isCalculatingPrice,
    searchNetwork, setSearchNetwork, searchCategory, setSearchCategory,
    detectedType, showAllCategories, setShowAllCategories, tariffSubtypeFilter, setTariffSubtypeFilter,
    formRef, errorRef,
    hasSmartFilter, matchedCategories, filteredCategories,
    channelServicesCount, postServicesCount, hasMultipleSubtypes, effectiveSubtype, displayedServices
  };
}