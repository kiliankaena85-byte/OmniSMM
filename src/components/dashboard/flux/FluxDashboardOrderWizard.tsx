'use client';

import React, { useState, useRef, useEffect, Suspense } from "react";
import { Button } from "@heroui/react";
import { 
  LinkIcon, 
  SparklesIcon, 
  ArrowRightIcon, 
  Box, 
  ArrowLeftIcon, 
  AlertCircle, 
  HelpCircle,
  Wallet,
  CheckCircle2,
  Layers,
  ChevronRight,
  Ticket,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getPublicCatalogAction, getServicesByCategoryAction } from "@/actions/order/catalog";
import { checkoutAction, calculatePriceAction } from "@/actions/order/checkout";
import { formatEtaSpeedBadge } from "@/utils/format-eta";
import { formatPricePerUnit, formatRubles } from "@/utils/format-price";
import { validateDripFeedDuration, validateDripFeedLimits, getDripFeedFloor, DRIP_FEED_MAX_ERROR_MESSAGE, detectNetworkByUrl } from "@/hooks/useOrderWizard";
import { analyzeUrl } from "@/actions/order/analyze-url";
import { matchesSuggestedCategory } from "@/services/analyzer/category-matcher";
import { isLinkServiceCompatible } from "@/constants/link-service-compatibility";
import { inferTargetTypeFromName } from "@/utils/target-type";
import { FluxNetwork, FluxCategory, FluxService } from "@/types/flux";
import { FluxCyberLinkDrawer } from "@/components/orders/flux/FluxCyberLinkDrawer";
import { toast } from "sonner";
import { safeFocus } from "@/utils/scroll-helpers";

type Step = 'network' | 'category' | 'service' | 'checkout';

const slideVariants = {
  enter: (direction: number) => ({
    y: direction > 0 ? 25 : -25,
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    y: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    y: direction < 0 ? 25 : -25,
    opacity: 0,
  })
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 }
};

interface FluxDashboardOrderWizardProps {
  userEmail?: string;
  userBalanceCents?: number;
  initialReorderData?: { serviceId: string; categoryId: string; link: string; quantity: number } | null;
  tenantId?: string;
}

export function FluxDashboardOrderWizard(props: FluxDashboardOrderWizardProps) {
  return (
    <Suspense fallback={<div className="min-h-[400px] flex items-center justify-center text-muted-foreground text-sm">Загрузка мастера заказа...</div>}>
      <FluxDashboardOrderWizardInner {...props} />
    </Suspense>
  );
}

function FluxDashboardOrderWizardInner({ 
  userEmail = "", 
  userBalanceCents = 0,
  initialReorderData = null,
  tenantId = "smmplan",
}: FluxDashboardOrderWizardProps) {
  const [step, setStep] = useState<Step>('network');
  const [direction, setDirection] = useState(1);
  const [catalog, setCatalog] = useState<FluxNetwork[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  
  const [link, setLink] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedType, setDetectedType] = useState<string | null>(null);
  const [suggestedCategories, setSuggestedCategories] = useState<string[]>([]);
  const [activeNetwork, setActiveNetwork] = useState<FluxNetwork | null>(null);
  const [activeCategory, setActiveCategory] = useState<FluxCategory | null>(null);
  const [services, setServices] = useState<FluxService[]>([]);
  const [selectedService, setSelectedService] = useState<FluxService | null>(null);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  
  const [quantity, setQuantity] = useState<number | string>("");
  const [email, setEmail] = useState(userEmail);
  const [gateway, setGateway] = useState<'balance' | 'yookassa' | 'cryptobot'>(
    userBalanceCents > 0 ? 'balance' : 'yookassa'
  );
  const [availableGateways, setAvailableGateways] = useState<{ yookassa: boolean; robokassa: boolean; cryptobot: boolean } | null>(null);

  // Promo code state
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState("");
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [promoMessage, setPromoMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showPromo, setShowPromo] = useState(false);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [originalServerPriceRub, setOriginalServerPriceRub] = useState<number | null>(null);

  useEffect(() => {
    import("@/actions/order/checkout").then(({ getAvailableGatewaysAction }) => {
      getAvailableGatewaysAction().then((res) => {
        if (res.success && res.data) {
          setAvailableGateways(res.data);
          if (gateway !== 'balance' && !res.data[gateway as keyof typeof res.data]) {
            setGateway(userBalanceCents > 0 ? 'balance' : 'yookassa');
          }
        }
      });
    });
  }, [gateway, userBalanceCents]);

  const [isRequirementsConfirmed, setIsRequirementsConfirmed] = useState(false);
  const [isDripFeedEnabled, setIsDripFeedEnabled] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [dripRuns, setDripRuns] = useState(5);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [dripInterval, setDripInterval] = useState(60);
  const [customData, setCustomData] = useState("");
  const [isTgGuideOpen, setIsTgGuideOpen] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorField, setErrorField] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [isOrderSuccess, setIsOrderSuccess] = useState(false);

  const linkRef = useRef<HTMLInputElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const customDataRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const requirementRef = useRef<HTMLDivElement>(null);

  const userBalanceRub = (userBalanceCents / 100).toFixed(2);

  // Load catalog on mount
  useEffect(() => {
    setIsLoadingCatalog(true);
    // FIX(BUG-B3): передаём tenantId — раньше каталог всегда грузился тенанта 'smmplan',
    // из-за чего пользователи других тенантов видели чужие категории и цены.
    getPublicCatalogAction(tenantId).then(res => {
      if (res.success && res.data) {
        // Map public networks to FluxNetwork format
                const mappedCatalog: FluxNetwork[] = res.data.map((net: { id: string; name: string; slug: string; icon?: string | null; categories?: { id: string; name: string; slug?: string; icon?: string | null }[] }) => ({
          id: net.id,
          name: net.name,
          slug: net.slug,
          icon: net.icon || `/icons/${net.slug}.svg`,
                    categories: (net.categories || []).map((cat: { id: string; name: string; slug?: string; icon?: string | null }) => ({
            id: cat.id,
            name: cat.name,
            slug: cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-'),
            networkId: net.id,
            icon: cat.icon || undefined
          }))
        }));
        setCatalog(mappedCatalog);
      }
      setIsLoadingCatalog(false);
    });
  }, []);

  // Handle reorder pre-fill
  useEffect(() => {
    if (initialReorderData && catalog.length > 0) {
      const { serviceId, categoryId, link: initialLink, quantity: initialQty } = initialReorderData;
      setLink(initialLink);
      setQuantity(initialQty);

      const targetNet = catalog.find(net => net.categories?.some(cat => cat.id === categoryId));
      if (targetNet) {
        setActiveNetwork(targetNet);
        const targetCat = targetNet.categories?.find(cat => cat.id === categoryId);
        if (targetCat) {
          setActiveCategory(targetCat);
          setIsLoadingServices(true);
          getServicesByCategoryAction(categoryId, tenantId).then(res => {
                        const srvList: FluxService[] = (res || []).map((s) => {
              const unitPrice = s.pricePerUnitRub || 0.1;
              return {
                id: s.id,
                name: s.name,
                pricePer1kRub: unitPrice * 1000,
                pricePerUnitRub: unitPrice,
                minQty: s.minQty || 10,
                maxQty: s.maxQty || 100000,
                speed: s.speed || 'Моментально',
                description: s.description || '',
                customDataType: s.customDataType || 'NONE',
                customDataLabel: s.customDataLabel || '',
                clientRequirement: s.clientRequirement || '',
                clientConfirmation: s.clientConfirmation || '',
                requireWarning: s.requireWarning || false,
                targetType: s.targetType || 'POST'
              };
            });
            setServices(srvList);
            const foundSrv = srvList.find(s => s.id === serviceId);
            if (foundSrv) {
              setSelectedService(foundSrv);
            }
            setIsLoadingServices(false);
            setStep('checkout');
          });
        }
      }
    }
  }, [initialReorderData, catalog]);

  const navigateTo = (newStep: Step) => {
    const order: Step[] = ['network', 'category', 'service', 'checkout'];
    const prevIdx = order.indexOf(step);
    const newIdx = order.indexOf(newStep);
    setDirection(newIdx > prevIdx ? 1 : -1);
    setStep(newStep);
    setErrorMessage("");
    setErrorField("");
  };

  const handleAnalyzeLink = async (targetLink: string) => {
    if (!targetLink || !targetLink.trim()) return;
    setIsAnalyzing(true);
    
    try {
      const res = await analyzeUrl(targetLink.trim());
      const analysis = res && res.success ? res.data : null;
      const activePlatformStr = analysis && analysis.platform !== 'OTHER' ? analysis.platform.toLowerCase() : null;
      let foundNet: FluxNetwork | null = null;

      if (activePlatformStr) {
        // FIX(B5-strict): только точное совпадение slug. Раньше здесь было
        // slug.includes(activePlatformStr) || activePlatformStr.includes(slug) —
        // из-за этого 'ok' (OK.ru) матчился в 'tiktok'.includes('ok') → TikTok.
        // Нечётное совпадение приводит к заказу не в той соцсети.
        foundNet = catalog.find(n => n.slug.toLowerCase() === activePlatformStr) || null;
      }
      if (!foundNet) {
        const detectedNet = detectNetworkByUrl(targetLink.trim(), catalog);
        if (detectedNet) {
          foundNet = catalog.find(n => n.id === detectedNet.id || n.slug.toLowerCase() === detectedNet.slug.toLowerCase()) || null;
        }
      }

      setDetectedType(analysis?.type || null);
      setSuggestedCategories(analysis?.suggestedCategories || []);

      if (foundNet) {
        setActiveNetwork(foundNet);
        setActiveCategory(null);
        setSelectedService(null);
        navigateTo('category');
        return;
      }

      // FIX(BUG-B5): раньше при неудаче определения платформа молча подставлялась
      // первая из каталога (catalog[0]) и визард уводился на шаг «Категория» —
      // пользователь мог оформить заказ не в той соцсети. Теперь остаёмся на
      // шаге 1 и просим выбрать сеть вручную.
      toast.info('Не удалось определить платформу по ссылке — выберите соцсеть вручную');
    } catch {
      const detectedNet = detectNetworkByUrl(targetLink.trim(), catalog);
      if (detectedNet) {
        const foundNet = catalog.find(n => n.id === detectedNet.id || n.slug.toLowerCase() === detectedNet.slug.toLowerCase());
        if (foundNet) {
          setActiveNetwork(foundNet);
          setActiveCategory(null);
          setSelectedService(null);
          navigateTo('category');
          return;
        }
      }
      toast.info('Не удалось определить платформу по ссылке — выберите соцсеть вручную');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const selectNetwork = (network: FluxNetwork) => {
    setDetectedType(null);
    setSuggestedCategories([]);
    setActiveNetwork(network);
    setActiveCategory(null);
    setSelectedService(null);
    setServices([]);
    navigateTo('category');
  };

  const selectCategory = async (cat: FluxCategory) => {
    setActiveCategory(cat);
    setSelectedService(null);
    setIsLoadingServices(true);
    navigateTo('service');

    try {
      const data = await getServicesByCategoryAction(cat.id, tenantId);
      let srvList: FluxService[] = (data || []).map((s) => {
        const unitPrice = s.pricePerUnitRub || 0.1;
        return {
          id: s.id,
          name: s.name,
          pricePer1kRub: unitPrice * 1000,
          pricePerUnitRub: unitPrice,
          minQty: s.minQty || 10,
          maxQty: s.maxQty || 100000,
          speed: s.speed || 'Моментально',
          description: s.description || '',
          customDataType: s.customDataType || 'NONE',
          customDataLabel: s.customDataLabel || '',
          clientRequirement: s.clientRequirement || '',
          clientConfirmation: s.clientConfirmation || '',
          requireWarning: s.requireWarning || false,
          targetType: s.targetType || 'POST',
          isDripFeedEnabled: Boolean(s.isDripFeedEnabled)
        };
      });

      if (detectedType) {
        const compatible = srvList.filter(s =>
          isLinkServiceCompatible(detectedType, s.targetType || inferTargetTypeFromName(s.name))
        );
        if (compatible.length > 0) {
          srvList = compatible;
        }
      }

      setServices(srvList);
    } catch {
      setServices([]);
    } finally {
      setIsLoadingServices(false);
    }
  };

  const selectService = (service: FluxService) => {
    setSelectedService(service);
    setQuantity(service.minQty || 100);
    setIsRequirementsConfirmed(false);
    setCustomData("");
    setIsDripFeedEnabled(false);
    navigateTo('checkout');
  };

  // Price Calculation
  const qtyNum = typeof quantity === 'number' ? quantity : parseInt(quantity) || 0;
  const rawPrice = selectedService ? (selectedService.pricePerUnitRub * qtyNum) : 0;
  const dripMultipliedPrice = isDripFeedEnabled ? rawPrice * dripRuns : rawPrice;

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
      const calcQty = isDripFeedEnabled ? qtyNum * dripRuns : qtyNum;
      const res = await calculatePriceAction(
        selectedService.id,
        calcQty > 0 ? calcQty : (selectedService.minQty || 10),
        clean,
        isDripFeedEnabled ? dripRuns : undefined
      );
      if (res.success && res.data) {
        if (res.data.discountCents > 0) {
          setAppliedPromo(clean);
          setServerPriceRub(res.data.totalCents / 100);
          setOriginalServerPriceRub(res.data.originalTotalCents / 100);
          const percent = res.data.discountPercent || Math.round((res.data.discountCents / (res.data.originalTotalCents || res.data.totalCents)) * 100);
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

  // FIX(BUG-B6): итоговая цена больше не считается только на клиенте —
  // сверяемся с серверным calculatePriceAction (промо, округления, серверная математика),
  // чтобы «Итого к оплате» не расходилось с фактическим списанием при чекауте.
  const [serverPriceRub, setServerPriceRub] = useState<number | null>(null);
  useEffect(() => {
    if (!selectedService || !qtyNum) {
      setServerPriceRub(null);
      setOriginalServerPriceRub(null);
      return;
    }
    let cancelled = false;
    calculatePriceAction(
      selectedService.id,
      isDripFeedEnabled ? qtyNum * dripRuns : qtyNum,
      appliedPromo || undefined,
      isDripFeedEnabled ? dripRuns : undefined
    )
      .then(res => {
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
      .catch(() => { if (!cancelled) { setServerPriceRub(null); setOriginalServerPriceRub(null); } });
    return () => { cancelled = true; };
  }, [selectedService?.id, qtyNum, isDripFeedEnabled, dripRuns, appliedPromo]);

  const totalPriceRub = formatRubles(serverPriceRub ?? dripMultipliedPrice);
  const canPayFromBalance = userBalanceCents >= ((serverPriceRub ?? dripMultipliedPrice) * 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedService) {
      setErrorMessage("Пожалуйста, выберите услугу");
      setErrorField("general");
      setShakeKey(Date.now());
      return;
    }

    if (!link.trim()) {
      setErrorMessage("Пожалуйста, укажите ссылку для продвижения");
      setErrorField("link");
      setShakeKey(Date.now());
      safeFocus(linkRef.current, true);
      return;
    }

    const minQty = selectedService.minQty || 10;
    const maxQty = selectedService.maxQty || 100000;
    if (qtyNum < minQty) {
      setErrorMessage(`Минимальное количество: ${minQty} шт.`);
      setErrorField("quantity");
      setShakeKey(Date.now());
      safeFocus(quantityRef.current, true);
      return;
    }

    if (qtyNum > maxQty) {
      setErrorMessage(`Максимальное количество: ${maxQty} шт.`);
      setErrorField("quantity");
      setShakeKey(Date.now());
      safeFocus(quantityRef.current, true);
      return;
    }

    if (selectedService.customDataType && selectedService.customDataType !== 'NONE') {
      if (!customData.trim()) {
        setErrorMessage(selectedService.customDataLabel || "Пожалуйста, заполните параметры заказа");
        setErrorField("customData");
        setShakeKey(Date.now());
        safeFocus(customDataRef.current, true);
        return;
      }
    }

    const hasReq = selectedService.clientRequirement || selectedService.clientConfirmation || selectedService.requireWarning;
    if (hasReq && !isRequirementsConfirmed) {
      setErrorMessage("Необходимо подтвердить требования к заказу");
      setErrorField("requirement");
      setShakeKey(Date.now());
      safeFocus(requirementRef.current, true);
      return;
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMessage("Укажите корректный адрес электронной почты");
      setErrorField("email");
      setShakeKey(Date.now());
      safeFocus(emailRef.current, true);
      return;
    }

    if (isDripFeedEnabled) {
      const dripCheck = validateDripFeedLimits(qtyNum, dripRuns, minQty, maxQty);
      if (!dripCheck.isValid) {
        setErrorMessage(dripCheck.error || "Ошибка параметров Drip-Feed");
        setErrorField("quantity");
        setShakeKey(Date.now());
        safeFocus(quantityRef.current, true);
        return;
      }
      if (!validateDripFeedDuration(dripRuns, dripInterval)) {
        setErrorMessage(DRIP_FEED_MAX_ERROR_MESSAGE);
        setErrorField("drip");
        setShakeKey(Date.now());
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setErrorField("");

    try {
      const promoValue = appliedPromo || (promoCode.trim() ? promoCode.trim().toUpperCase() : undefined);
      const res = await checkoutAction({
        serviceId: selectedService.id,
        link: link.trim(),
        quantity: isDripFeedEnabled ? qtyNum * dripRuns : qtyNum,
        email: email.trim(),
        promoCodeStr: promoValue || undefined,
        gateway: gateway,
        runs: isDripFeedEnabled ? dripRuns : undefined,
        interval: isDripFeedEnabled ? dripInterval : undefined,
        customData: selectedService.customDataType !== 'NONE' ? customData : undefined,
        isRequirementsConfirmed: isRequirementsConfirmed,
        tenantId: tenantId || 'flux'
      });

      if (res && res.success) {
        if (res.data?.paymentUrl) {
          window.location.href = res.data.paymentUrl;
        } else {
          setIsOrderSuccess(true);
          setLink("");
          setQuantity(selectedService.minQty || 100);
          setStep('network');
        }
      } else {
        setErrorMessage(res?.error || "Произошла ошибка при оформлении заказа");
        setErrorField("general");
        setShakeKey(Date.now());
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Не удалось отправить заказ";
      setErrorMessage(msg);
      setErrorField("general");
      setShakeKey(Date.now());
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      
      {/* ── TOP BREADCRUMB / STEP NAVIGATION BAR ── */}
      <div className="bg-card/85 backdrop-blur-md border border-border/40 rounded-[1.75rem] p-3 sm:p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => navigateTo('network')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${
              step === 'network' 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : activeNetwork 
                  ? 'bg-muted/70 text-foreground hover:bg-muted' 
                  : 'text-muted-foreground'
            }`}
          >
            1. {activeNetwork ? activeNetwork.name : 'Соцсеть'}
          </button>

          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />

          <button
            type="button"
            disabled={!activeNetwork}
            onClick={() => activeNetwork && navigateTo('category')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${
              step === 'category' 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : activeCategory 
                  ? 'bg-muted/70 text-foreground hover:bg-muted' 
                  : 'text-muted-foreground opacity-50'
            }`}
          >
            2. {activeCategory ? activeCategory.name : 'Категория'}
          </button>

          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />

          <button
            type="button"
            disabled={!activeCategory}
            onClick={() => activeCategory && navigateTo('service')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${
              step === 'service' 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : selectedService 
                  ? 'bg-muted/70 text-foreground hover:bg-muted' 
                  : 'text-muted-foreground opacity-50'
            }`}
          >
            3. {selectedService ? 'Тариф выбран' : 'Тариф'}
          </button>

          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />

          <button
            type="button"
            disabled={!selectedService}
            onClick={() => selectedService && navigateTo('checkout')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${
              step === 'checkout' 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'text-muted-foreground opacity-50'
            }`}
          >
            4. Оформление
          </button>
        </div>

        {/* User Balance Badge */}
        {userBalanceCents > 0 && (
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-600 dark:text-emerald-400 text-xs font-extrabold tabular-nums font-mono">
            <Wallet className="w-3.5 h-3.5" />
            <span>Баланс: {userBalanceRub} ₽</span>
          </div>
        )}
      </div>

      {/* ── SUCCESS NOTICE ── */}
      {isOrderSuccess && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card/90 border border-success/30 rounded-[2rem] p-8 text-center space-y-4 shadow-xl"
        >
          <div className="w-16 h-16 bg-success/15 text-success rounded-full flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-foreground tracking-tight">Заказ успешно оформлен!</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Средства списаны, запуск задачи произойдет в течение нескольких минут. Отслеживайте прогресс в разделе «Мои заказы».
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Button
              onPress={() => setIsOrderSuccess(false)}
              className="px-6 py-2.5 bg-primary text-primary-foreground font-black rounded-full shadow-md cursor-pointer"
            >
              Создать еще один заказ
            </Button>
            <a
              href="/dashboard/orders"
              className="px-6 py-2.5 bg-muted text-foreground hover:bg-muted/80 font-bold rounded-full transition-colors flex items-center cursor-pointer"
            >
              Перейти к заказам
            </a>
          </div>
        </motion.div>
      )}

      {/* ── ACTIVE WIZARD STEPS ── */}
      {!isOrderSuccess && (
        <AnimatePresence initial={false} custom={direction} mode="wait">
          
          {/* STEP 1: NETWORK SELECTION */}
          {step === 'network' && (
            <motion.div
              key="step-network"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="w-full space-y-6"
            >
              {/* Quick Link Input */}
              <div className="bg-card/85 backdrop-blur-md border border-border/40 rounded-[2rem] p-5 sm:p-6 shadow-sm">
                <h3 className="text-sm font-black text-foreground mb-3 flex items-center gap-2">
                  <SparklesIcon className="w-4 h-4 text-primary shrink-0" /> Вставьте ссылку для быстрого определения:
                </h3>
                <div className="relative flex items-center">
                  <LinkIcon className="text-muted-foreground w-5 h-5 absolute left-4 pointer-events-none" />
                  <input
                    ref={linkRef}
                    type="url"
                    className="w-full h-13 pl-12 pr-32 bg-background border border-border/60 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground transition-all"
                    placeholder="https://t.me/your_channel или https://vk.com/..."
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && link) handleAnalyzeLink(link);
                    }}
                  />
                  <Button
                    isPending={isAnalyzing}
                    onPress={() => handleAnalyzeLink(link)}
                    className="absolute right-2 rounded-xl bg-foreground text-background font-bold text-xs h-9 px-4 min-w-0 cursor-pointer"
                  >
                    Далее
                  </Button>
                </div>
              </div>

              {/* Network Grid */}
              <div className="space-y-4">
                <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">Выберите соцсеть</h2>
                {isLoadingCatalog ? (
                  <div className="py-16 flex justify-center">
                    <Box className="w-10 h-10 text-primary/50 animate-pulse" />
                  </div>
                ) : (
                  <motion.div 
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 w-full"
                  >
                    {catalog.map((net) => (
                      <motion.button
                        key={net.id}
                        variants={itemVariants}
                        whileHover={{ y: -3, scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28 }}
                        onClick={() => selectNetwork(net)}
                        className="flex flex-col items-center justify-center gap-2.5 p-4 sm:p-5 rounded-[1.5rem] border border-border/40 bg-card/85 backdrop-blur-md hover:bg-card hover:border-primary/50 hover:shadow-lg transition-colors duration-150 outline-none cursor-pointer group"
                      >
                        <img 
                          src={net.icon || undefined} 
                          alt={net.name} 
                          className="w-9 h-9 sm:w-10 sm:h-10 object-contain pointer-events-none group-hover:scale-105 transition-transform" 
                          loading="lazy"
                          decoding="async"
                        />
                        <span className="font-bold text-foreground text-xs sm:text-sm">{net.name}</span>
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 2: CATEGORY SELECTION */}
          {step === 'category' && activeNetwork && (
            <motion.div
              key="step-category"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="w-full space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img 
                    src={activeNetwork.icon || undefined} 
                    alt={activeNetwork.name} 
                    className="w-8 h-8 object-contain" 
                    loading="lazy"
                    decoding="async"
                  />
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">Выберите категорию</h2>
                    <p className="text-xs text-muted-foreground font-medium">Платформа: {activeNetwork.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigateTo('network')}
                  className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ArrowLeftIcon className="w-3.5 h-3.5" /> Сменить сеть
                </button>
              </div>

              {(() => {
                const availableCategories = activeNetwork.categories || [];
                const filteredCategories = (suggestedCategories.length > 0 || detectedType)
                  ? availableCategories.filter(c => matchesSuggestedCategory(c.name, suggestedCategories, undefined, detectedType))
                  : [];
                const displayCategories = filteredCategories.length > 0 ? filteredCategories : availableCategories;

                return (
                  <motion.div 
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
                  >
                    {displayCategories.map((cat) => (
                      <motion.div 
                        key={cat.id}
                        role="button"
                        tabIndex={0}
                        variants={itemVariants}
                        whileHover={{ y: -3, scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28 }}
                        onClick={() => selectCategory(cat)}
                        onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectCategory(cat); } }}
                        className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary p-4 sm:p-5 rounded-[1.5rem] border border-border/40 bg-card/85 backdrop-blur-md hover:bg-card hover:border-primary/50 hover:shadow-lg transition-colors duration-150 flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Layers className="w-4 h-4 shrink-0" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-foreground text-sm block truncate group-hover:text-primary transition-colors min-w-0">
                              {cat.name}
                            </span>
                            {typeof cat.serviceCount === 'number' && cat.serviceCount > 0 && (
                              <span className="text-[10px] font-medium text-muted-foreground block">
                                {cat.serviceCount} услуг
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/5 group-hover:bg-primary flex items-center justify-center transition-colors">
                          <ArrowRightIcon className="w-3.5 h-3.5 text-primary group-hover:text-primary-foreground" />
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                );
              })()}
            </motion.div>
          )}

          {/* STEP 3: SERVICE SELECTION */}
          {step === 'service' && activeCategory && (
            <motion.div
              key="step-service"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="w-full space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">{activeCategory.name}</h2>
                  <p className="text-xs text-muted-foreground font-medium">
                    {activeNetwork?.name} • Выберите подходящий тариф
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigateTo('category')}
                  className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ArrowLeftIcon className="w-3.5 h-3.5" /> Назад к категориям
                </button>
              </div>

              {isLoadingServices ? (
                <div className="py-20 flex justify-center">
                  <Box className="w-12 h-12 text-primary/50 animate-pulse" />
                </div>
              ) : services.length === 0 ? (
                <div className="p-8 text-center bg-card/50 rounded-2xl border border-border/40 text-muted-foreground text-sm">
                  В данной категории пока нет активных тарифов. Пожалуйста, выберите другую категорию.
                </div>
              ) : (
                <motion.div 
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4"
                >
                  {services.map((service) => (
                    <motion.div 
                      key={service.id}
                      role="button"
                      tabIndex={0}
                      variants={itemVariants}
                      whileHover={{ y: -3 }}
                      whileTap={{ scale: 0.99 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                      className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-[1.5rem] border border-border/40 bg-card/85 backdrop-blur-md hover:bg-card hover:border-primary/50 hover:shadow-lg transition-colors duration-150 flex flex-col justify-between group relative min-h-[140px]"
                      onClick={() => selectService(service)}
                      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectService(service); } }}
                    >
                      <div className="p-5 pb-14 sm:p-6 sm:pb-16">
                        <h4 className="font-bold text-foreground text-base sm:text-lg leading-snug mb-2">{service.name}</h4>
                        
                        <div className="space-y-1.5">
                          <p className="text-[12px] text-muted-foreground flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> 
                            Старт: <span className="font-medium text-foreground">{service.speed || 'Моментально'}</span>
                          </p>
                          <p className="text-[12px] text-muted-foreground flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> 
                            Лимиты: <span className="font-medium text-foreground tabular-nums font-mono">{service.minQty} - {service.maxQty} шт.</span>
                          </p>
                        </div>
                      </div>
                      
                      <div className="absolute bottom-4 left-4 sm:bottom-5 sm:left-5 bg-foreground text-background px-3 py-1.5 rounded-full font-bold text-xs sm:text-sm shadow-sm pointer-events-none tabular-nums font-mono">
                        {formatPricePerUnit(service.pricePerUnitRub)} ₽ <span className="font-normal opacity-80 font-sans">/ шт</span>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* STEP 4: CHECKOUT FORM */}
          {step === 'checkout' && selectedService && (
            <motion.div
              key="step-checkout"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="w-full space-y-6"
            >
              <div className="bg-card/90 backdrop-blur-md border border-border/40 shadow-xl rounded-[2rem] p-5 sm:p-7 space-y-6">
                
                {/* Selected Service Header */}
                <div className="flex justify-between items-start gap-4 pb-4 border-b border-border/40">
                  <div>
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider bg-primary/10 px-2.5 py-0.5 rounded-full">
                      {activeNetwork?.name} • {activeCategory?.name}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-tight tracking-tight mt-1">
                      {selectedService.name}
                    </h2>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-primary font-black text-xl tabular-nums font-mono">
                      {formatPricePerUnit(selectedService.pricePerUnitRub)} ₽
                    </span>
                    <span className="text-muted-foreground font-medium text-xs block">за 1 шт.</span>
                  </div>
                </div>

                {/* Service Specs Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-2xl bg-background/90 border border-border/40">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Мин. заказ</p>
                    <p className="font-bold text-sm sm:text-base tabular-nums font-mono">{selectedService.minQty} шт</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-background/90 border border-border/40">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Макс. заказ</p>
                    <p className="font-bold text-sm sm:text-base tabular-nums font-mono">{selectedService.maxQty} шт</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-background/90 border border-border/40 col-span-2 sm:col-span-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Скорость / ETA</p>
                    <p className="font-bold text-primary text-xs sm:text-sm">{formatEtaSpeedBadge(selectedService)}</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  
                  {/* Link Input Field */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-foreground">Ссылка для продвижения</label>
                      <button
                        type="button"
                        onClick={() => setIsTgGuideOpen(true)}
                        className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <HelpCircle className="w-3.5 h-3.5" /> Как правильно скопировать ссылку?
                      </button>
                    </div>
                    <div className="relative">
                      <LinkIcon className="text-muted-foreground w-4 h-4 absolute left-4 top-4" />
                      <input
                        ref={linkRef}
                        type="url"
                        value={link}
                        onChange={(e) => setLink(e.target.value)}
                        placeholder="https://t.me/... или https://vk.com/..."
                        className={`w-full h-12 pl-11 pr-4 bg-background border ${
                          errorField === 'link' ? 'border-destructive animate-shake' : 'border-border/60 focus:border-primary'
                        } rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground transition-all`}
                        key={errorField === 'link' ? `link-${shakeKey}` : 'link-ok'}
                      />
                    </div>
                  </div>

                  {/* Quantity Field */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-foreground">Количество</label>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {selectedService.minQty} — {selectedService.maxQty} шт
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        ref={quantityRef}
                        type="number"
                        min={selectedService.minQty}
                        max={selectedService.maxQty}
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                        className={`w-36 h-12 px-4 text-center font-mono font-black text-lg bg-background border ${
                          errorField === 'quantity' ? 'border-destructive animate-shake' : 'border-border/60 focus:border-primary'
                        } rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground transition-all`}
                        key={errorField === 'quantity' ? `qty-${shakeKey}` : 'qty-ok'}
                      />
                      <input
                        type="range"
                        min={selectedService.minQty}
                        max={Math.min(10000, selectedService.maxQty)}
                        step={10}
                        value={qtyNum}
                        onChange={(e) => setQuantity(parseInt(e.target.value))}
                        className="flex-1 accent-primary h-2 bg-muted rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Drip-Feed Controls */}
                  {selectedService.isDripFeedEnabled && (
                    <div className="p-4 bg-muted/40 rounded-2xl border border-border/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
                          <SparklesIcon className="w-4 h-4 text-primary shrink-0" />
                          Запускать частями (Drip-Feed)
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isDripFeedEnabled}
                            onChange={(e) => {
                              const enabled = e.target.checked;
                              setIsDripFeedEnabled(enabled);
                              if (enabled && qtyNum < selectedService.minQty) {
                                setQuantity(selectedService.minQty);
                              }
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>

                      {isDripFeedEnabled && (
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/30">
                          <div>
                            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                              Запусков
                            </label>
                            <input
                              type="number"
                              min={2}
                              max={100}
                              value={dripRuns}
                              onChange={(e) => setDripRuns(Math.max(2, parseInt(e.target.value) || 2))}
                              className="w-full h-10 px-3 bg-background border border-border/60 rounded-xl text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                              Интервал (мин)
                            </label>
                            <input
                              type="number"
                              min={5}
                              max={1440}
                              value={dripInterval}
                              onChange={(e) => setDripInterval(Math.max(1, parseInt(e.target.value) || 5))}
                              className="w-full h-10 px-3 bg-background border border-border/60 rounded-xl text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                          <p className="col-span-2 text-xs text-muted-foreground font-medium">
                            Заказ выполнится за {dripRuns} запусков по {qtyNum} шт. Всего: <strong className="text-foreground">{qtyNum * dripRuns} шт.</strong>
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Custom Data Field (Comments / usernames) */}
                  {selectedService.customDataType && selectedService.customDataType !== 'NONE' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-foreground">
                        {selectedService.customDataLabel || 'Параметры заказа (текст/комментарии)'}
                      </label>
                      <textarea
                        ref={customDataRef as React.RefObject<HTMLTextAreaElement>}
                        rows={3}
                        value={customData}
                        onChange={(e) => setCustomData(e.target.value)}
                        placeholder="Введите каждый комментарий с новой строки..."
                        className={`w-full bg-background border ${
                          errorField === 'customData' ? 'border-destructive animate-shake' : 'border-border/60 focus:border-primary'
                        } rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground`}
                        key={errorField === 'customData' ? `cd-${shakeKey}` : 'cd-ok'}
                      />
                    </div>
                  )}

                  {/* Requirement Checkbox */}
                  {(selectedService.clientRequirement || selectedService.clientConfirmation || selectedService.requireWarning) && (
                    <div 
                      ref={requirementRef}
                      className={`p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 ${
                        errorField === 'requirement' ? 'animate-shake' : ''
                      }`}
                      key={errorField === 'requirement' ? `req-${shakeKey}` : 'req-ok'}
                    >
                      <input
                        type="checkbox"
                        id="req-confirm"
                        checked={isRequirementsConfirmed}
                        onChange={(e) => setIsRequirementsConfirmed(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded accent-primary cursor-pointer"
                      />
                      <label htmlFor="req-confirm" className="text-xs text-amber-700 dark:text-amber-300 font-medium leading-tight cursor-pointer">
                        {selectedService.clientRequirement || selectedService.clientConfirmation || "Я подтверждаю, что мой аккаунт/канал открыт и соответствует правилам сервиса."}
                      </label>
                    </div>
                  )}

                  {/* Email Field */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">Email для чека и уведомлений</label>
                    <input
                      ref={emailRef}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className={`w-full h-12 px-4 bg-background border ${
                        errorField === 'email' ? 'border-destructive animate-shake' : 'border-border/60 focus:border-primary'
                      } rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground transition-all`}
                      key={errorField === 'email' ? `email-${shakeKey}` : 'email-ok'}
                    />
                  </div>

                  {/* Promo Code Field */}
                  <div className="space-y-2">
                    {!showPromo ? (
                      <button
                        type="button"
                        onClick={() => setShowPromo(true)}
                        className="text-xs font-bold text-primary hover:underline flex items-center gap-1.5 min-h-[44px] py-1 cursor-pointer transition-colors"
                      >
                        <Ticket className="w-4 h-4" />
                        <span>+ У меня есть промокод</span>
                      </button>
                    ) : (
                      <div className="space-y-2 p-3.5 rounded-2xl bg-muted/40 border border-border/70 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Ticket className="w-3.5 h-3.5 text-primary" />
                            <span>Промокод</span>
                          </label>
                          {appliedPromo && (
                            <button
                              type="button"
                              onClick={handleRemovePromo}
                              className="text-[11px] font-semibold text-muted-foreground hover:text-destructive cursor-pointer transition-colors"
                            >
                              Удалить
                            </button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleApplyPromo();
                              }
                            }}
                            placeholder="ВВЕДИТЕ КОД"
                            disabled={Boolean(appliedPromo) || isApplyingPromo}
                            className="flex-1 h-11 px-3.5 rounded-xl bg-background border border-border/80 focus:border-primary focus:ring-1 focus:ring-primary outline-none font-mono text-sm font-bold uppercase text-foreground disabled:opacity-60"
                          />
                          {!appliedPromo ? (
                            <button
                              type="button"
                              onClick={handleApplyPromo}
                              disabled={!promoCode.trim() || isApplyingPromo}
                              className="h-11 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center shrink-0"
                            >
                              {isApplyingPromo ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                "Применить"
                              )}
                            </button>
                          ) : (
                            <div className="h-11 px-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1.5 shrink-0 select-none">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Активен</span>
                            </div>
                          )}
                        </div>
                        {promoMessage && (
                          <p
                            className={`text-xs font-semibold flex items-center gap-1 mt-1 ${
                              promoMessage.type === "success"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-destructive"
                            }`}
                          >
                            {promoMessage.type === "success" ? (
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span>{promoMessage.text}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Payment Method Selector */}
                  <div className="space-y-2 pt-2">
                    <label className="text-xs font-bold text-foreground">Способ оплаты</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setGateway('balance')}
                        className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                          gateway === 'balance'
                            ? 'bg-primary/10 border-primary text-primary shadow-xs'
                            : 'bg-background border-border/40 hover:border-primary/40 text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Wallet className="w-4 h-4 text-emerald-500 shrink-0" />
                          <div>
                            <span className="font-bold text-xs block">С баланса</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{userBalanceRub} ₽</span>
                          </div>
                        </div>
                        {gateway === 'balance' && <CheckCircle2 className="w-4 h-4 text-primary" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setGateway('yookassa')}
                        className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                          gateway === 'yookassa'
                            ? 'bg-primary/10 border-primary text-primary shadow-xs'
                            : 'bg-background border-border/40 hover:border-primary/40 text-foreground'
                        }`}
                      >
                        <div>
                          <span className="font-bold text-xs block">ЮKassa / СБП</span>
                          <span className="text-[10px] text-muted-foreground">Карты РФ, QR-код</span>
                        </div>
                        {gateway === 'yookassa' && <CheckCircle2 className="w-4 h-4 text-primary" />}
                      </button>

                      {availableGateways?.cryptobot && (
                        <button
                          type="button"
                          onClick={() => setGateway('cryptobot')}
                          className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                            gateway === 'cryptobot'
                              ? 'bg-primary/10 border-primary text-primary shadow-xs'
                              : 'bg-background border-border/40 hover:border-primary/40 text-foreground'
                          }`}
                        >
                          <div>
                            <span className="font-bold text-xs block">CryptoBot</span>
                            <span className="text-[10px] text-muted-foreground">USDT, TON, BTC</span>
                          </div>
                          {gateway === 'cryptobot' && <CheckCircle2 className="w-4 h-4 text-primary" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Summary & Price */}
                  <div className="p-4 rounded-2xl bg-muted/50 border border-border/40 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-foreground block">Итого к оплате:</span>
                      <span className="text-xs text-muted-foreground font-semibold">
                        {isDripFeedEnabled
                          ? `(${qtyNum} шт × ${dripRuns} запусков × ${formatPricePerUnit(selectedService.pricePerUnitRub)} ₽/шт)`
                          : `(${qtyNum} шт × ${formatPricePerUnit(selectedService.pricePerUnitRub)} ₽/шт)`}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2 tabular-nums font-mono">
                      <span className="text-2xl font-black text-foreground">{totalPriceRub}</span>
                      {originalServerPriceRub && (
                        <span className="text-xs text-muted-foreground line-through">
                          {formatRubles(originalServerPriceRub)}
                        </span>
                      )}
                      {discountPercent > 0 && (
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          -{discountPercent}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Error banner */}
                  {errorMessage && (
                    <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-2.5 text-red-600 text-xs font-bold animate-shake">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    isPending={isSubmitting}
                    className="w-full h-13 rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-primary-foreground font-black text-base shadow-lg hover:scale-[1.01] active:scale-95 transition-all cursor-pointer border-0"
                  >
                    {gateway === 'balance' && canPayFromBalance ? 'Оплатить с баланса' : 'Оформить и оплатить'}
                  </Button>

                </form>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      )}

      {/* Cyber Link Drawer */}
      <FluxCyberLinkDrawer
        isOpen={isTgGuideOpen}
        onClose={() => setIsTgGuideOpen(false)}
        onApplyLink={(newLink: string) => setLink(newLink)}
      />

    </div>
  );
}
