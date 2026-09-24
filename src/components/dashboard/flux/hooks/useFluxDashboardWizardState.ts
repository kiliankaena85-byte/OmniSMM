'use client';

import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { getPublicCatalogAction, getServicesByCategoryAction } from '@/actions/order/catalog';
import { checkoutAction, calculatePriceAction } from '@/actions/order/checkout';
import { formatRubles } from '@/utils/format-price';
import { detectNetworkByUrl } from '@/hooks/useOrderWizard';
import { analyzeUrl } from '@/actions/order/analyze-url';
import { isLinkServiceCompatible } from '@/constants/link-service-compatibility';
import { resolveServiceTargetType } from '@/utils/target-type-mapper';
import { safeFocus } from '@/utils/scroll-helpers';
import type { FluxNetwork, FluxCategory, FluxService } from '@/types/flux';
import type { Step, FluxDashboardOrderWizardProps } from '../wizard-steps/types';

export function useFluxDashboardWizardState({
  userEmail = '',
  userBalanceCents = 0,
  initialReorderData = null,
  tenantId = 'smmplan',
}: FluxDashboardOrderWizardProps) {
  const [step, setStep] = useState<Step>('network');
  const [direction, setDirection] = useState(1);
  const [catalog, setCatalog] = useState<FluxNetwork[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);

  const [link, setLink] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedType, setDetectedType] = useState<string | null>(null);
  const [suggestedCategories, setSuggestedCategories] = useState<string[]>([]);
  const [activeNetwork, setActiveNetwork] = useState<FluxNetwork | null>(null);
  const [activeCategory, setActiveCategory] = useState<FluxCategory | null>(null);
  const [services, setServices] = useState<FluxService[]>([]);
  const [selectedService, setSelectedService] = useState<FluxService | null>(null);
  const [isLoadingServices, setIsLoadingServices] = useState(false);

  const [quantity, setQuantity] = useState<number | string>('');
  const [customData, setCustomData] = useState('');
  const [isDripFeedEnabled, setIsDripFeedEnabled] = useState(false);
  const [dripRuns, setDripRuns] = useState(5);
  const [dripInterval, setDripInterval] = useState(60);
  const [email, setEmail] = useState(userEmail);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [promoMessage, setPromoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPromo, setShowPromo] = useState(false);
  const [originalServerPriceRub, setOriginalServerPriceRub] = useState<number | null>(null);
  const [isRequirementsConfirmed, setIsRequirementsConfirmed] = useState(false);
  const [gateway, setGateway] = useState<'balance' | 'yookassa' | 'cryptobot'>('balance');
  const [availableGateways] = useState({ yookassa: true, robokassa: false, cryptobot: true });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOrderSuccess, setIsOrderSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState<number>(0);
  const [isTgGuideOpen, setIsTgGuideOpen] = useState(false);
  const [serverPriceRub, setServerPriceRub] = useState<number | null>(null);

  const linkRef = useRef<HTMLInputElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const customDataRef = useRef<HTMLTextAreaElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const requirementRef = useRef<HTMLDivElement>(null);

  const navigateTo = (newStep: Step) => {
    const order: Step[] = ['network', 'category', 'service', 'checkout'];
    const currentIdx = order.indexOf(step);
    const newIdx = order.indexOf(newStep);
    setDirection(newIdx > currentIdx ? 1 : -1);
    setStep(newStep);
    setErrorMessage(null);
    setErrorField(null);
  };

  useEffect(() => {
    async function loadCatalog() {
      setIsLoadingCatalog(true);
      try {
        const res = await getPublicCatalogAction(tenantId);
        if (res.success && res.data) {
          const mappedCatalog: FluxNetwork[] = res.data.map((net: any) => ({
            id: net.id,
            name: net.name,
            slug: net.slug,
            icon: net.icon,
            categories: (net.categories || []).map((cat: any) => ({
              id: cat.id,
              name: cat.name,
              slug: cat.slug || '',
              icon: cat.icon,
            })),
          }));
          setCatalog(mappedCatalog);
        }
      } catch (e) {
        console.error('Failed to load catalog:', e);
      } finally {
        setIsLoadingCatalog(false);
      }
    }
    loadCatalog();
  }, [tenantId]);

  useEffect(() => {
    if (!initialReorderData || catalog.length === 0) return;
    for (const net of catalog) {
      const cat = net.categories?.find((c) => c.id === initialReorderData.categoryId);
      if (cat) {
        setActiveNetwork(net);
        setActiveCategory(cat);
        setLink(initialReorderData.link);
        setQuantity(initialReorderData.quantity);
        setIsLoadingServices(true);
        getServicesByCategoryAction(cat.id, tenantId)
          .then((data) => {
            if (data) {
              const srvList: FluxService[] = (data || []).map((s) => ({
                id: s.id,
                name: s.name,
                pricePer1kRub: (s.pricePerUnitRub || 0.1) * 1000,
                pricePerUnitRub: s.pricePerUnitRub || 0.1,
                minQty: s.minQty || 10,
                maxQty: s.maxQty || 100000,
                speed: s.speed || 'Моментально',
                customDataType: s.customDataType || 'NONE',
                customDataLabel: s.customDataLabel,
                clientRequirement: s.clientRequirement,
                clientConfirmation: s.clientConfirmation,
                requireWarning: s.requireWarning,
                warningMessage: s.warningMessage,
                targetType: s.targetType || 'POST',
                isDripFeedEnabled: Boolean(s.isDripFeedEnabled),
              }));
              setServices(srvList);
              const foundService = srvList.find((s) => s.id === initialReorderData.serviceId);
              if (foundService) {
                setSelectedService(foundService);
                setStep('checkout');
              }
            }
          })
          .finally(() => setIsLoadingServices(false));
        break;
      }
    }
  }, [initialReorderData, catalog, tenantId]);

  const handleAnalyzeLink = async (url: string) => {
    if (!url.trim()) return;
    setIsAnalyzing(true);
    try {
      const detected = detectNetworkByUrl(url, catalog);
      if (detected) {
        const matched = catalog.find(
          (n) => n.id === detected.id || n.slug.toLowerCase() === detected.slug.toLowerCase()
        );
        if (matched) {
          selectNetwork(matched);
          return;
        }
      }
      const res = await analyzeUrl(url);
      if (res.success && res.data) {
        setDetectedType(res.data.type);
        setSuggestedCategories(res.data.suggestedCategories || []);
      }
    } catch {
      // ignore
    } finally {
      setIsAnalyzing(false);
    }
  };

  const selectNetwork = (net: FluxNetwork) => {
    setActiveNetwork(net);
    setActiveCategory(null);
    setSelectedService(null);
    navigateTo('category');
  };

  const selectCategory = async (cat: FluxCategory) => {
    setActiveCategory(cat);
    setSelectedService(null);
    setIsLoadingServices(true);
    navigateTo('service');
    try {
      const data = await getServicesByCategoryAction(cat.id, tenantId);
      let srvList: FluxService[] = (data || []).map((s) => ({
        id: s.id,
        name: s.name,
        pricePer1kRub: (s.pricePerUnitRub || 0.1) * 1000,
        pricePerUnitRub: s.pricePerUnitRub || 0.1,
        minQty: s.minQty || 10,
        maxQty: s.maxQty || 100000,
        speed: s.speed || 'Моментально',
        customDataType: s.customDataType || 'NONE',
        customDataLabel: s.customDataLabel,
        clientRequirement: s.clientRequirement,
        clientConfirmation: s.clientConfirmation,
        requireWarning: s.requireWarning,
        warningMessage: s.warningMessage,
        targetType: s.targetType || 'POST',
        isDripFeedEnabled: Boolean(s.isDripFeedEnabled),
      }));

      if (detectedType) {
        const compatible = srvList.filter((s) =>
          isLinkServiceCompatible(detectedType, resolveServiceTargetType(s))
        );
        if (compatible.length > 0) {
          srvList = compatible;
        }
      }

      setServices(srvList);
    } catch (e) {
      console.error('Failed to load services:', e);
    } finally {
      setIsLoadingServices(false);
    }
  };

  const selectService = (service: FluxService) => {
    setSelectedService(service);
    setQuantity(service.minQty || 100);
    setIsRequirementsConfirmed(false);
    setCustomData('');
    setIsDripFeedEnabled(false);
    navigateTo('checkout');
  };

  const qtyNum = typeof quantity === 'number' ? quantity : parseInt(quantity) || 0;
  const rawPrice = selectedService ? selectedService.pricePerUnitRub * qtyNum : 0;
  const dripMultipliedPrice = rawPrice;

  const handleApplyPromo = async () => {
    const clean = promoCode.trim().toUpperCase();
    if (!clean) {
      setPromoMessage({ type: 'error', text: 'Введите промокод' });
      return;
    }
    if (clean.length < 3 || clean.length > 32 || !/^[A-Z0-9_-]+$/.test(clean)) {
      setPromoMessage({ type: 'error', text: 'Некорректный формат промокода' });
      return;
    }
    if (!selectedService) return;

    setIsApplyingPromo(true);
    setPromoMessage(null);
    try {
      const calcQty = qtyNum;
      const res = await calculatePriceAction(
        selectedService.id,
        calcQty > 0 ? calcQty : selectedService.minQty || 10,
        clean,
        isDripFeedEnabled ? dripRuns : undefined
      );
      if (res.success && res.data) {
        if (res.data.discountCents > 0) {
          setAppliedPromo(clean);
          setServerPriceRub(res.data.totalCents / 100);
          setOriginalServerPriceRub(res.data.originalTotalCents / 100);
          const percent =
            res.data.discountPercent ||
            Math.round(
              (res.data.discountCents / (res.data.originalTotalCents || res.data.totalCents)) * 100
            );
          setDiscountPercent(percent);
          const msg = `Промокод «${clean}» применен: скидка ${percent}%`;
          setPromoMessage({ type: 'success', text: msg });
          toast.success(msg);
        } else {
          setAppliedPromo('');
          setPromoMessage({ type: 'error', text: 'Промокод не найден или скидка недоступна' });
        }
      } else {
        setAppliedPromo('');
        setPromoMessage({ type: 'error', text: res.error || 'Промокод не найден' });
      }
    } catch {
      setAppliedPromo('');
      setPromoMessage({ type: 'error', text: 'Не удалось проверить промокод' });
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo('');
    setPromoCode('');
    setPromoMessage(null);
    setDiscountPercent(0);
    setOriginalServerPriceRub(null);
  };

  useEffect(() => {
    if (!selectedService || !qtyNum) {
      setServerPriceRub(null);
      setOriginalServerPriceRub(null);
      return;
    }
    let cancelled = false;
    calculatePriceAction(
      selectedService.id,
      qtyNum,
      appliedPromo || undefined,
      isDripFeedEnabled ? dripRuns : undefined
    )
      .then((res) => {
        if (!cancelled && res.success && res.data) {
          setServerPriceRub(res.data.totalCents / 100);
          if (res.data.discountCents > 0) {
            setOriginalServerPriceRub(res.data.originalTotalCents / 100);
            setDiscountPercent(res.data.discountPercent);
          } else {
            setOriginalServerPriceRub(null);
            setDiscountPercent(0);
          }
        } else if (!cancelled) {
          setServerPriceRub(null);
          setOriginalServerPriceRub(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setServerPriceRub(null);
          setOriginalServerPriceRub(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedService?.id, qtyNum, isDripFeedEnabled, dripRuns, appliedPromo]);

  const totalPriceRub = formatRubles(serverPriceRub ?? dripMultipliedPrice);
  const canPayFromBalance = userBalanceCents >= (serverPriceRub ?? dripMultipliedPrice) * 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedService) {
      setErrorMessage('Пожалуйста, выберите услугу');
      setErrorField('general');
      setShakeKey(Date.now());
      return;
    }

    if (!link.trim()) {
      setErrorMessage('Пожалуйста, укажите ссылку для продвижения');
      setErrorField('link');
      setShakeKey(Date.now());
      safeFocus(linkRef.current, true);
      return;
    }

    const minQty = selectedService.minQty || 10;
    const maxQty = selectedService.maxQty || 100000;
    if (qtyNum < minQty) {
      setErrorMessage(`Минимальное количество: ${minQty} шт.`);
      setErrorField('quantity');
      setShakeKey(Date.now());
      safeFocus(quantityRef.current, true);
      return;
    }

    if (qtyNum > maxQty) {
      setErrorMessage(`Максимальное количество: ${maxQty} шт.`);
      setErrorField('quantity');
      setShakeKey(Date.now());
      safeFocus(quantityRef.current, true);
      return;
    }

    if (selectedService.customDataType && selectedService.customDataType !== 'NONE') {
      if (!customData.trim()) {
        setErrorMessage(selectedService.customDataLabel || 'Пожалуйста, заполните параметры заказа');
        setErrorField('customData');
        setShakeKey(Date.now());
        safeFocus(customDataRef.current, true);
        return;
      }
    }

    if (
      (selectedService.clientRequirement ||
        selectedService.clientConfirmation ||
        selectedService.requireWarning) &&
      !isRequirementsConfirmed
    ) {
      setErrorMessage('Пожалуйста, подтвердите соответствие правилам сервиса');
      setErrorField('requirement');
      setShakeKey(Date.now());
      safeFocus(requirementRef.current, true);
      return;
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMessage('Пожалуйста, укажите корректный email');
      setErrorField('email');
      setShakeKey(Date.now());
      safeFocus(emailRef.current, true);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setErrorField(null);

    try {
      const promoValue =
        appliedPromo || (promoCode.trim() ? promoCode.trim().toUpperCase() : undefined);
      const res = await checkoutAction({
        serviceId: selectedService.id,
        link: link.trim(),
        quantity: qtyNum,
        email: email.trim(),
        promoCodeStr: promoValue || undefined,
        gateway:
          gateway === 'balance' && canPayFromBalance
            ? 'balance'
            : (gateway as 'yookassa' | 'cryptobot'),
        runs: isDripFeedEnabled ? dripRuns : undefined,
        interval: isDripFeedEnabled ? dripInterval : undefined,
        customData: selectedService.customDataType !== 'NONE' ? customData : undefined,
        isRequirementsConfirmed: isRequirementsConfirmed,
        tenantId: tenantId || 'flux',
      });

      if (res && res.success) {
        if (gateway === 'balance' && canPayFromBalance) {
          setIsOrderSuccess(true);
          toast.success('Заказ успешно создан и оплачен с баланса!');
        } else if (res.data?.paymentUrl) {
          window.location.href = res.data.paymentUrl;
        } else {
          setIsOrderSuccess(true);
        }
      } else {
        setErrorMessage(res?.error || 'Ошибка создания заказа');
        setShakeKey(Date.now());
      }
    } catch {
      setErrorMessage('Произошла непредвиденная ошибка при отправке заказа');
      setShakeKey(Date.now());
    } finally {
      setIsSubmitting(false);
    }
  };

  const userBalanceRub = formatRubles(userBalanceCents / 100);

  return {
    step,
    direction,
    catalog,
    isLoadingCatalog,
    link,
    setLink,
    linkRef,
    isAnalyzing,
    detectedType,
    suggestedCategories,
    activeNetwork,
    activeCategory,
    services,
    selectedService,
    isLoadingServices,
    quantity,
    setQuantity,
    quantityRef,
    qtyNum,
    customData,
    setCustomData,
    customDataRef,
    isDripFeedEnabled,
    setIsDripFeedEnabled,
    dripRuns,
    setDripRuns,
    dripInterval,
    setDripInterval,
    email,
    setEmail,
    emailRef,
    showPromo,
    setShowPromo,
    promoCode,
    setPromoCode,
    appliedPromo,
    isApplyingPromo,
    discountPercent,
    promoMessage,
    handleApplyPromo,
    handleRemovePromo,
    originalServerPriceRub,
    isRequirementsConfirmed,
    setIsRequirementsConfirmed,
    requirementRef,
    gateway,
    setGateway,
    availableGateways,
    isSubmitting,
    isOrderSuccess,
    setIsOrderSuccess,
    errorMessage,
    errorField,
    shakeKey,
    isTgGuideOpen,
    setIsTgGuideOpen,
    totalPriceRub,
    canPayFromBalance,
    userBalanceRub,
    navigateTo,
    selectNetwork,
    selectCategory,
    selectService,
    handleAnalyzeLink,
    handleSubmit,
  };
}
