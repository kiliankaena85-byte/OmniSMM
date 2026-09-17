'use client';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getPublicCatalogAction, getServicesByCategoryAction, PublicNetwork, PublicCategory, PublicService } from '@/actions/order/catalog';
import { getAvailableGatewaysAction } from '@/actions/order/checkout';
import { trackEvent } from '@/lib/analytics';
import { matchesSuggestedCategory } from '@/services/analyzer/category-matcher';
import { isLinkServiceCompatible } from '@/constants/link-service-compatibility';
import { resolveServiceTargetType } from '@/utils/target-type-mapper';
import { mutateLink } from '@/validators/link-mutators';
import { validateDripFeedFloor, generateStableIdempotencyKey } from '@/hooks/useBaseOrderValidation';
import { WizardStep, PaymentGateway, AvailableGateways, FormErrors, SmmplanOrderWizardProps, TariffSubtypeFilter } from './types';
import { isChannelSrv, isPostSrv, normalizeUrl } from './helpers';
import { useWizardPricing } from './useWizardPricing';
import { useWizardLinkAnalyzer } from './useWizardLinkAnalyzer';

export function useSmmplanOrderWizard({ userEmail = '', initialReorderData, tenantId = 'smmplan' }: SmmplanOrderWizardProps) {
  const router = useRouter(); const searchParams = useSearchParams();
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => generateStableIdempotencyKey());
  const resetIdempotencyKey = () => setIdempotencyKey(generateStableIdempotencyKey());
  const [networks, setNetworks] = useState<PublicNetwork[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true); const [step, setStep] = useState<WizardStep>(1);
  const [selectedNetwork, setSelectedNetwork] = useState<PublicNetwork | null>(null); const [selectedCategory, setSelectedCategory] = useState<PublicCategory | null>(null);
  const [services, setServices] = useState<PublicService[]>([]); const [isLoadingServices, setIsLoadingServices] = useState(false); const [selectedService, setSelectedService] = useState<PublicService | null>(null);
  const [link, setLink] = useState(''); const [quantity, setQuantity] = useState<number>(100);
  const [email, setEmail] = useState(userEmail);
  const [gateway, setGateway] = useState<PaymentGateway>('balance'); const [availableGateways, setAvailableGateways] = useState<AvailableGateways | null>(null);
  const [isDripFeedEnabled, setIsDripFeedEnabled] = useState(false); const [dripRuns, setDripRuns] = useState(5); const [dripInterval, setDripInterval] = useState(60);
  const [isSmartDrip, setIsSmartDrip] = useState(false);
  const [customData, setCustomData] = useState(''); const [isRequirementsConfirmed, setIsRequirementsConfirmed] = useState(false);
  const [isTgGuideOpen, setIsTgGuideOpen] = useState(false); const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false); const [shakeKey, setShakeKey] = useState(0);
  const [searchNetwork, setSearchNetwork] = useState(''); const [searchCategory, setSearchCategory] = useState('');
  const [tariffSubtypeFilter, setTariffSubtypeFilter] = useState<TariffSubtypeFilter>('auto');
  const serviceRequestIdRef = useRef(0);
  const formRef = useRef<HTMLFormElement>(null); const errorRef = useRef<HTMLDivElement>(null); const hasRestoredUrlRef = useRef(false);

  const linkAnalyzer = useWizardLinkAnalyzer({
    link, setLink, quantity, setQuantity, networks,
    selectedNetwork, setSelectedNetwork, selectedCategory, selectedService,
  });

  useEffect(() => {
    getAvailableGatewaysAction().then((res) => {
      if (res.success && res.data) {
        setAvailableGateways(res.data);
        if (gateway !== 'balance' && !res.data[gateway as keyof typeof res.data]) setGateway('balance');
      }
    }).catch(() => {});
  }, [gateway]);

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
      if (linkAnalyzer.detectedType && link.trim().length >= 5) {
        const comp = servs.filter(s => isLinkServiceCompatible(linkAnalyzer.detectedType, resolveServiceTargetType(s)));
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
  }, [selectedCategory, initialReorderData, searchParams, linkAnalyzer.detectedType, link, tenantId]);

  const totalQuantity = isDripFeedEnabled ? quantity * dripRuns : quantity;

  const pricing = useWizardPricing({
    selectedService,
    quantity,
    setQuantity,
    totalQuantity,
    isDripFeedEnabled,
    dripRuns,
    isSmartDrip,
  });

  // [T1-7] Drip-Feed Floor Invariant warning via shared validation engine
  const dripFloorWarning = (!isDripFeedEnabled || !selectedService) ? null :
    validateDripFeedFloor({ isDripFeedEnabled, quantity: totalQuantity, runs: dripRuns, minQty: selectedService.minQty }).warningMessage;

  const handleSelectService = (srv: PublicService) => {
    setSelectedService(srv); setQuantity(srv.minQty || 100); setIsDripFeedEnabled(false); setIsSmartDrip(false);
    setDripRuns(5); setDripInterval(60); setCustomData(''); setIsRequirementsConfirmed(false); setErrors({});
    trackEvent('service_selected', { serviceId: srv.id, serviceName: srv.name, price: srv.pricePerUnitRub });
    changeStep(4, srv.id, selectedCategory?.id, selectedNetwork?.id);
  };

  const filteredNetworks = networks.filter(n => n.name.toLowerCase().includes(searchNetwork.toLowerCase()));
  const isLinkActive = link.trim().length >= 5;
  const hasSmartFilter = isLinkActive && Boolean(linkAnalyzer.detectedType || (linkAnalyzer.suggestedCategories && linkAnalyzer.suggestedCategories.length > 0));
  const matchedCategories = selectedNetwork ? selectedNetwork.categories.filter(c => !hasSmartFilter || matchesSuggestedCategory(c.name, linkAnalyzer.suggestedCategories, (c as { analyzerTags?: string }).analyzerTags ?? null, linkAnalyzer.detectedType)) : [];
  const effectiveCategories = (!hasSmartFilter || linkAnalyzer.showAllCategories || matchedCategories.length === 0) ? (selectedNetwork?.categories || []) : matchedCategories;
  const filteredCategories = effectiveCategories.filter(c => c.name.toLowerCase().includes(searchCategory.toLowerCase()));
  const channelServicesCount = services.filter(isChannelSrv).length; const postServicesCount = services.filter(isPostSrv).length;
  const hasMultipleSubtypes = channelServicesCount > 0 && postServicesCount > 0;
  const effectiveSubtype: 'all' | 'channel' | 'post' = tariffSubtypeFilter !== 'auto' ? tariffSubtypeFilter : (['channel', 'group', 'chat'].includes(linkAnalyzer.detectedType || '') ? 'channel' : (['post', 'private_post', 'photo'].includes(linkAnalyzer.detectedType || '') ? 'post' : 'all'));
  const displayedServices = services.filter(s => (!hasMultipleSubtypes || effectiveSubtype === 'all') ? true : (effectiveSubtype === 'channel' ? isChannelSrv(s) : isPostSrv(s)));

  return {
    router, networks, filteredNetworks, isLoadingCatalog, step, setStep, changeStep,
    selectedNetwork, setSelectedNetwork, selectedCategory, setSelectedCategory,
    services, isLoadingServices, selectedService, setSelectedService, handleSelectService,
    link, setLink, handleBlurLink: linkAnalyzer.handleBlurLink, validateLinkFormat: linkAnalyzer.validateLinkFormat,
    quantity, setQuantity, addQuantity: pricing.addQuantity, totalQuantity,
    email, setEmail,
    promoCodeInput: pricing.promoCodeInput, setPromoCodeInput: pricing.setPromoCodeInput,
    appliedPromo: pricing.appliedPromo, promoMessage: pricing.promoMessage, isApplyingPromo: pricing.isApplyingPromo,
    showPromo: pricing.showPromo, setShowPromo: pricing.setShowPromo,
    handleApplyPromo: pricing.handleApplyPromo, handleRemovePromo: pricing.handleRemovePromo,
    gateway, setGateway, availableGateways,
    isDripFeedEnabled, setIsDripFeedEnabled, dripRuns, setDripRuns, dripInterval, setDripInterval,
    isSmartDrip, setIsSmartDrip, dripFloorWarning,
    customData, setCustomData, isRequirementsConfirmed, setIsRequirementsConfirmed,
    isTgGuideOpen, setIsTgGuideOpen,
    idempotencyKey, resetIdempotencyKey,
    errors, setErrors, isSubmitting, setIsSubmitting, shakeKey, setShakeKey,
    calculatedPriceRub: pricing.calculatedPriceRub, isCalculatingPrice: pricing.isCalculatingPrice,
    searchNetwork, setSearchNetwork, searchCategory, setSearchCategory,
    detectedType: linkAnalyzer.detectedType, showAllCategories: linkAnalyzer.showAllCategories, setShowAllCategories: linkAnalyzer.setShowAllCategories, tariffSubtypeFilter, setTariffSubtypeFilter,
    formRef, errorRef,
    hasSmartFilter, matchedCategories, filteredCategories,
    channelServicesCount, postServicesCount, hasMultipleSubtypes, effectiveSubtype, displayedServices
  };
}