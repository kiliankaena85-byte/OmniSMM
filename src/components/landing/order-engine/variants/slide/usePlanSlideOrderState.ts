'use client';

import { useState, useRef, useActionState, useEffect } from "react";
import { getServicesByCategoryAction, PublicNetwork, PublicCategory, PublicService } from "@/actions/order/catalog";
import { checkoutAction, getAvailableGatewaysAction, calculatePriceAction } from "@/actions/order/checkout";
import type { PricingResult } from "@/services/marketing.service";
import { detectNetworkByUrl } from "@/hooks/useOrderWizard";
import { analyzeUrl } from "@/actions/order/analyze-url";
import { isLinkServiceCompatible } from "@/constants/link-service-compatibility";
import { resolveServiceTargetType } from "@/utils/target-type-mapper";
import { toast } from "sonner";
import type { Step } from "./types";

export interface UsePlanSlideOrderStateProps {
  initialCatalog?: PublicNetwork[];
  initialEmail?: string;
  tenantId?: string;
  userBalanceCents?: number;
}

export function usePlanSlideOrderState({
  initialCatalog = [],
  initialEmail = "",
  tenantId = "smmplan",
}: UsePlanSlideOrderStateProps) {
  const [step, setStep] = useState<Step>('link');
  const [direction, setDirection] = useState(1);
  const [enteredViaCatalog, setEnteredViaCatalog] = useState(false);

  const [link, setLink] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeNetwork, setActiveNetwork] = useState<PublicNetwork | null>(null);
  const [activeCategory, setActiveCategory] = useState<PublicCategory | null>(null);
  const [services, setServices] = useState<PublicService[]>([]);
  const [selectedService, setSelectedService] = useState<PublicService | null>(null);
  const [isLoadingServices, setIsLoadingServices] = useState(false);

  const categoryServicesCache = useRef<Record<string, PublicService[]>>({});
  const serviceRequestIdRef = useRef(0);

  const [quantity, setQuantity] = useState<number | string>("");
  const [email, setEmail] = useState(initialEmail || "");

  const quantityRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);

  const [isRequirementsConfirmed, setIsRequirementsConfirmed] = useState(false);
  const [isDripFeedEnabled, setIsDripFeedEnabled] = useState(false);
  const [dripRuns, setDripRuns] = useState(5);
  const [dripInterval, setDripInterval] = useState(60);
  const [customData, setCustomData] = useState("");
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const [detectedType, setDetectedType] = useState<string | null>(null);
  const [suggestedCategories, setSuggestedCategories] = useState<string[]>([]);

  const [selectedGateway, setSelectedGateway] = useState<string>("yookassa");
  const [availableGateways, setAvailableGateways] = useState<{ yookassa: boolean; robokassa: boolean; cryptobot: boolean } | null>(null);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalEmail, setAuthModalEmail] = useState("");

  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState("");
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [promoMessage, setPromoMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showPromo, setShowPromo] = useState(false);
  const [serverPricing, setServerPricing] = useState<PricingResult | null>(null);

  // Restore snapshot on Magic Link return
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const isAuthResume = window.location.search.includes("auth_resume=1");
      const rawSnapshot = sessionStorage.getItem("smmplan_pending_order_snapshot");
      if (isAuthResume && rawSnapshot) {
        const snapshot = JSON.parse(rawSnapshot);
        if (snapshot.serviceId) {
          if (snapshot.link) setLink(snapshot.link);
          if (snapshot.quantity) setQuantity(snapshot.quantity);
          if (snapshot.runs) {
            setIsDripFeedEnabled(true);
            setDripRuns(snapshot.runs);
          }
          if (snapshot.interval) setDripInterval(snapshot.interval);
          if (snapshot.customData) setCustomData(snapshot.customData);
          if (snapshot.networkId && initialCatalog.length > 0) {
            const foundNet = initialCatalog.find(n => n.id === snapshot.networkId);
            if (foundNet) {
              setActiveNetwork(foundNet);
              if (snapshot.categoryId && foundNet.categories) {
                const foundCat = foundNet.categories.find(c => c.id === snapshot.categoryId);
                if (foundCat) {
                  setActiveCategory(foundCat);
                  getServicesByCategoryAction(foundCat.id, tenantId).then(srvs => {
                    if (srvs) {
                      categoryServicesCache.current[foundCat.id] = srvs;
                      setServices(srvs);
                      const targetSrv = srvs.find(s => s.id === snapshot.serviceId);
                      if (targetSrv) {
                        setSelectedService(targetSrv);
                        setStep('checkout');
                      }
                    }
                  });
                }
              }
            }
          }
        }
        sessionStorage.removeItem("smmplan_pending_order_snapshot");
      }
    } catch {}
  }, [initialCatalog, tenantId]);

  useEffect(() => {
    getAvailableGatewaysAction().then(res => {
      if (res && typeof res === 'object') {
        setAvailableGateways({
          yookassa: (res as any).yookassa ?? true,
          robokassa: (res as any).robokassa ?? false,
          cryptobot: (res as any).cryptobot ?? false
        });
      }
    }).catch(() => {});
  }, []);

  const navigateTo = (newStep: Step) => {
    const order: Step[] = ['link', 'network', 'category', 'service', 'checkout'];
    const currentIdx = order.indexOf(step);
    const newIdx = order.indexOf(newStep);
    setDirection(newIdx > currentIdx ? 1 : -1);
    setStep(newStep);
  };

  const handleNavigateBack = () => {
    if (step === 'checkout') navigateTo('service');
    else if (step === 'service') navigateTo('category');
    else if (step === 'category') {
      if (enteredViaCatalog) navigateTo('network');
      else navigateTo('link');
    } else if (step === 'network') navigateTo('link');
  };

  const handleReset = () => {
    setLink("");
    setActiveNetwork(null);
    setActiveCategory(null);
    setSelectedService(null);
    setEnteredViaCatalog(false);
    setStep('link');
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setIsApplyingPromo(true);
    setPromoMessage(null);
    try {
      const srvId = selectedService?.id || "";
      const q = typeof quantity === "string" ? (parseInt(quantity) || 100) : quantity;
      const res = await calculatePriceAction(
        srvId, 
        q, 
        promoCode.trim().toUpperCase(),
        isDripFeedEnabled ? dripRuns : undefined
      );
      if (res.success && res.data) {
        if (res.data.discountPercent > 0) {
          setAppliedPromo(promoCode.trim().toUpperCase());
          setServerPricing(res.data);
          setPromoMessage({ type: "success", text: `Промокод применен: скидка ${res.data.discountPercent}%` });
          toast.success("Промокод активирован!", {
            description: `Ваша скидка: ${res.data.discountPercent}%`
          });
        } else {
          setPromoMessage({ type: "error", text: "Промокод не дает скидки на эту услугу" });
        }
      } else {
        setPromoMessage({ type: "error", text: res.error || "Неверный или просроченный промокод" });
      }
    } catch {
      setPromoMessage({ type: "error", text: "Ошибка при проверке промокода" });
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo("");
    setPromoCode("");
    setPromoMessage(null);
    setServerPricing(null);
  };

  const [formState, formAction, isPending] = useActionState(
    async (_prevState: any, _formData: FormData) => {
      if (!selectedService) return { error: "Выберите услугу" };
      const currentLink = link.trim();
      if (!currentLink || currentLink.length < 3) {
        setShakeKey(k => k + 1);
        return { error: "Укажите ссылку для продвижения" };
      }
      const numQty = typeof quantity === "string" ? (parseInt(quantity) || 0) : quantity;
      if (!numQty || numQty < selectedService.minQty || numQty > selectedService.maxQty) {
        setShakeKey(k => k + 1);
        return { error: `Укажите количество от ${selectedService.minQty} до ${selectedService.maxQty.toLocaleString('ru-RU')}` };
      }
      const currentEmail = email.trim();
      if (!currentEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentEmail)) {
        setShakeKey(k => k + 1);
        return { error: "Укажите корректный email для чека и статуса" };
      }
      if (
        (selectedService.clientRequirement || selectedService.clientConfirmation || selectedService.requireWarning) &&
        !isRequirementsConfirmed
      ) {
        setShakeKey(k => k + 1);
        return { error: "Подтвердите согласие с требованиями к заказу" };
      }

      try {
        const res = await checkoutAction({
          serviceId: selectedService.id,
          link: currentLink,
          quantity: numQty,
          email: currentEmail,
          gateway: selectedGateway,
          promoCodeStr: appliedPromo || undefined,
          runs: isDripFeedEnabled ? dripRuns : undefined,
          interval: isDripFeedEnabled ? dripInterval : undefined,
          customData: customData.trim() || undefined,
          isRequirementsConfirmed,
          tenantId
        });

        if (res.success && res.data) {
          const { paymentUrl, redirectUrl, guestOrderToken } = res.data;
          if (guestOrderToken && typeof window !== "undefined") {
            try {
              const tokens = JSON.parse(localStorage.getItem("smmplan_guest_tokens") || "[]");
              if (!tokens.includes(guestOrderToken)) {
                tokens.unshift(guestOrderToken);
                localStorage.setItem("smmplan_guest_tokens", JSON.stringify(tokens.slice(0, 30)));
              }
            } catch {}
          }
          if (paymentUrl) {
            window.location.href = paymentUrl;
            return { error: undefined };
          }
          if (redirectUrl) {
            window.location.href = redirectUrl;
            return { error: undefined };
          }
          window.location.href = `/order/${res.data.orderId}${guestOrderToken ? `?token=${guestOrderToken}` : ''}`;
          return { error: undefined };
        } else {
          setShakeKey(k => k + 1);
          const errorMsg = !res.success ? res.error : undefined;
          if (errorMsg?.includes("Войдите в аккаунт") || errorMsg?.includes("авторизован")) {
            setAuthModalEmail(currentEmail);
            setShowAuthModal(true);
            return { error: undefined };
          }
          return { error: errorMsg || "Не удалось создать заказ. Попробуйте снова." };
        }
      } catch (err: any) {
        setShakeKey(k => k + 1);
        return { error: err.message || "Сетевая ошибка при создании заказа" };
      }
    },
    { error: undefined }
  );

  const handleAnalyzeLink = async (rawInput: string) => {
    const trimmedInput = rawInput.trim();
    if (!trimmedInput) return;
    setIsAnalyzing(true);
    try {
      const analysis = await analyzeUrl(trimmedInput);
      if (analysis && analysis.success && analysis.data?.platform) {
        const net = initialCatalog.find(
          n => n.name.toLowerCase() === analysis.data!.platform.toLowerCase() ||
               (n.slug && n.slug.toLowerCase() === analysis.data!.platform.toLowerCase())
        );
        if (net) {
          setActiveNetwork(net);
          setDetectedType(analysis.data.type || null);
          setSuggestedCategories(analysis.data.suggestedCategories || []);
          setActiveCategory(null);
          setServices([]);
          setSelectedService(null);
          navigateTo('category');
          return;
        }
      }
      throw new Error("Fallback");
    } catch {
      let matchedNetwork = detectNetworkByUrl(trimmedInput, initialCatalog as any) as any;
      if (matchedNetwork) {
        setActiveNetwork(matchedNetwork);
        setActiveCategory(null);
        setServices([]);
        setSelectedService(null);
        navigateTo('category');
      } else {
        toast.info("Не удалось определить платформу по ссылке", {
          description: "Пожалуйста, выберите соцсеть из списка:"
        });
        navigateTo('network');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const selectCategory = async (cat: PublicCategory) => {
    setActiveCategory(cat);
    navigateTo('service');

    const cached = categoryServicesCache.current[cat.id];
    if (cached && cached.length > 0) {
      let srvList: PublicService[] = cached;
      if (detectedType) {
        const compatible = srvList.filter(s =>
          isLinkServiceCompatible(detectedType, resolveServiceTargetType(s))
        );
        if (compatible.length > 0) srvList = compatible;
      }
      setServices(srvList);
      setIsLoadingServices(false);
      return;
    }

    setIsLoadingServices(true);
    setServices([]);
    const currentRequestId = ++serviceRequestIdRef.current;

    try {
      const fetched = await getServicesByCategoryAction(cat.id, tenantId);
      if (currentRequestId !== serviceRequestIdRef.current) return;
      categoryServicesCache.current[cat.id] = fetched || [];

      let srvList: PublicService[] = fetched || [];
      if (detectedType) {
        const compatible = srvList.filter(s =>
          isLinkServiceCompatible(detectedType, resolveServiceTargetType(s))
        );
        if (compatible.length > 0) srvList = compatible;
      }
      setServices(srvList);
    } catch {
      if (currentRequestId !== serviceRequestIdRef.current) return;
      setServices([]);
    } finally {
      if (currentRequestId === serviceRequestIdRef.current) {
        setIsLoadingServices(false);
      }
    }
  };

  const selectService = (srv: PublicService) => {
    setSelectedService(srv);
    setQuantity(srv.minQty || 100);
    setIsRequirementsConfirmed(false);
    setIsDripFeedEnabled(false);
    setDripRuns(5);
    setDripInterval(60);
    setCustomData("");
    navigateTo('checkout');
  };

  const numericQuantity = typeof quantity === "string" ? (parseInt(quantity) || 0) : quantity;

  useEffect(() => {
    if (!selectedService || numericQuantity <= 0) {
      setServerPricing(null);
      return;
    }
    let cancelled = false;
    calculatePriceAction(
      selectedService.id,
      numericQuantity,
      appliedPromo || undefined,
      isDripFeedEnabled ? dripRuns : undefined
    )
      .then((res) => {
        if (!cancelled && res.success && res.data) {
          setServerPricing(res.data);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedService?.id, numericQuantity, appliedPromo, isDripFeedEnabled, dripRuns]);

  const rawTotalRub = selectedService ? selectedService.pricePerUnitRub * numericQuantity : 0;
  const totalPrice = serverPricing
    ? (serverPricing.totalCents / 100).toFixed(2)
    : rawTotalRub.toFixed(2);
  const originalPrice = serverPricing && serverPricing.discountCents > 0
    ? (serverPricing.originalTotalCents / 100).toFixed(2)
    : null;

  return {
    step,
    direction,
    enteredViaCatalog,
    setEnteredViaCatalog,
    link,
    setLink,
    isAnalyzing,
    activeNetwork,
    setActiveNetwork,
    activeCategory,
    setActiveCategory,
    services,
    setServices,
    selectedService,
    setSelectedService,
    isLoadingServices,
    quantity,
    setQuantity,
    numericQuantity,
    email,
    setEmail,
    quantityRef,
    emailRef,
    linkRef,
    isRequirementsConfirmed,
    setIsRequirementsConfirmed,
    isDripFeedEnabled,
    setIsDripFeedEnabled,
    dripRuns,
    setDripRuns,
    dripInterval,
    setDripInterval,
    customData,
    setCustomData,
    isGuideOpen,
    setIsGuideOpen,
    shakeKey,
    detectedType,
    setDetectedType,
    suggestedCategories,
    setSuggestedCategories,
    selectedGateway,
    setSelectedGateway,
    availableGateways,
    showAuthModal,
    setShowAuthModal,
    authModalEmail,
    promoCode,
    setPromoCode,
    appliedPromo,
    isApplyingPromo,
    promoMessage,
    showPromo,
    setShowPromo,
    serverPricing,
    totalPrice,
    originalPrice,
    formAction,
    isPending,
    formState,
    navigateTo,
    handleNavigateBack,
    handleReset,
    handleApplyPromo,
    handleRemovePromo,
    handleAnalyzeLink,
    selectCategory,
    selectService,
    categoryServicesCache,
  };
}
