'use client';

import { useState, useRef, useActionState, useEffect } from "react";
import { getServicesByCategoryAction } from "@/actions/order/catalog";
import { checkoutAction, getAvailableGatewaysAction } from "@/actions/order/checkout";
import { validateDripFeedDuration, DRIP_FEED_MAX_ERROR_MESSAGE, detectNetworkByUrl } from "@/hooks/useOrderWizard";
import { analyzeUrl } from "@/actions/order/analyze-url";
import { isLinkServiceCompatible } from "@/constants/link-service-compatibility";
import { inferTargetTypeFromName } from "@/utils/target-type";
import type { FluxNetwork, FluxCategory, FluxService } from "@/types/flux";
import type { FluxStep } from "../sub/FluxNavHeader";
import { toast } from "sonner";

interface UseFluxOrderClientStateProps {
  initialCatalog: FluxNetwork[];
  initialEmail?: string;
  tenantId?: string;
}

export function useFluxOrderClientState({
  initialCatalog = [],
  initialEmail = "",
  tenantId = "flux",
}: UseFluxOrderClientStateProps) {
  const [step, setStep] = useState<FluxStep>('link');
  const [direction, setDirection] = useState(1);
  const [link, setLink] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeNetwork, setActiveNetwork] = useState<FluxNetwork | null>(null);
  const [activeCategory, setActiveCategory] = useState<FluxCategory | null>(null);
  const [services, setServices] = useState<FluxService[]>([]);
  const [selectedService, setSelectedService] = useState<FluxService | null>(null);
  const [isLoadingServices, setIsLoadingServices] = useState(false);

  const [quantity, setQuantity] = useState<number | string>("");
  const [email, setEmail] = useState(initialEmail || "");
  const [isRequirementsConfirmed, setIsRequirementsConfirmed] = useState(false);
  const [showShakeError, setShowShakeError] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const [isDripFeedEnabled, setIsDripFeedEnabled] = useState(false);
  const [dripRuns, setDripRuns] = useState(5);
  const [dripInterval, setDripInterval] = useState(60);
  const [customData, setCustomData] = useState("");

  const quantityRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);

  const [detectedType, setDetectedType] = useState<string | null>(null);
  const [suggestedCategories, setSuggestedCategories] = useState<string[]>([]);
  const [selectedGateway, setSelectedGateway] = useState<string>("yookassa");
  const [availableGateways, setAvailableGateways] = useState<{ yookassa: boolean; robokassa: boolean; cryptobot: boolean } | null>(null);
  const [isTgGuideOpen, setIsTgGuideOpen] = useState(false);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalEmail, setAuthModalEmail] = useState("");

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

  const navigateTo = (newStep: FluxStep) => {
    const order: FluxStep[] = ['link', 'network', 'category', 'service', 'checkout'];
    const currentIdx = order.indexOf(step);
    const newIdx = order.indexOf(newStep);
    setDirection(newIdx > currentIdx ? 1 : -1);
    setStep(newStep);
  };

  const [formState, formAction, isPending] = useActionState(
    async (_prevState: any, _formData: FormData) => {
      if (!selectedService) return { error: "Выберите услугу", field: "general" };
      const currentLink = link.trim();
      if (!currentLink || currentLink.length < 3) {
        setShakeKey(k => k + 1);
        return { error: "Укажите ссылку для продвижения", field: "link" };
      }
      const numQty = typeof quantity === "string" ? (parseInt(quantity) || 0) : quantity;
      if (!numQty || numQty < selectedService.minQty || numQty > selectedService.maxQty) {
        setShakeKey(k => k + 1);
        return { error: `Укажите количество от ${selectedService.minQty} до ${selectedService.maxQty.toLocaleString('ru-RU')}`, field: "quantity" };
      }
      if (isDripFeedEnabled && !validateDripFeedDuration(dripRuns, dripInterval)) {
        setShakeKey(k => k + 1);
        return { error: DRIP_FEED_MAX_ERROR_MESSAGE, field: "general" };
      }
      const currentEmail = email.trim();
      if (!currentEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentEmail)) {
        setShakeKey(k => k + 1);
        return { error: "Укажите корректный email для чека", field: "email" };
      }
      if (
        (selectedService.clientRequirement || selectedService.clientConfirmation || selectedService.requireWarning) &&
        !isRequirementsConfirmed
      ) {
        setShowShakeError(true);
        setShakeKey(k => k + 1);
        return { error: "Подтвердите согласие с требованиями", field: "requirement" };
      }

      try {
        const res = await checkoutAction({
          serviceId: selectedService.id,
          link: currentLink,
          quantity: numQty,
          email: currentEmail,
          gateway: selectedGateway,
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
              const tokens = JSON.parse(localStorage.getItem("smmflux_guest_tokens") || "[]");
              if (!tokens.includes(guestOrderToken)) {
                tokens.unshift(guestOrderToken);
                localStorage.setItem("smmflux_guest_tokens", JSON.stringify(tokens.slice(0, 30)));
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
          return { error: errorMsg || "Не удалось создать заказ", field: "general" };
        }
      } catch (err: any) {
        setShakeKey(k => k + 1);
        return { error: err.message || "Сетевая ошибка при создании заказа", field: "general" };
      }
    },
    { error: undefined, field: undefined }
  );

  const handleAnalyzeLink = async (rawInput: string) => {
    const trimmedInput = rawInput.trim();
    if (!trimmedInput) return;
    setIsAnalyzing(true);
    try {
      const analysis = await analyzeUrl(trimmedInput);
      if (analysis?.success && analysis.data?.platform) {
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
      const matchedNetwork = detectNetworkByUrl(trimmedInput, initialCatalog as any) as any;
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

  const selectCategory = async (cat: FluxCategory) => {
    setActiveCategory(cat);
    setIsLoadingServices(true);
    setServices([]);
    navigateTo('service');
    try {
      const fetched = await getServicesByCategoryAction(cat.id, tenantId);
      let srvList: FluxService[] = (fetched as any) || [];
      if (detectedType) {
        const compatible = srvList.filter(s =>
          isLinkServiceCompatible(detectedType, s.targetType || inferTargetTypeFromName(s.name))
        );
        if (compatible.length > 0) srvList = compatible;
      }
      setServices(srvList);
    } catch {
      setServices([]);
    } finally {
      setIsLoadingServices(false);
    }
  };

  const selectService = (srv: FluxService) => {
    setSelectedService(srv);
    setQuantity(srv.minQty || 100);
    setIsRequirementsConfirmed(false);
    setShowShakeError(false);
    setIsDripFeedEnabled(false);
    setDripRuns(5);
    setDripInterval(60);
    setCustomData("");
    navigateTo('checkout');
  };

  const numericQuantity = typeof quantity === "string" ? (parseInt(quantity) || 0) : quantity;
  const effectiveQuantity = isDripFeedEnabled ? numericQuantity * dripRuns : numericQuantity;
  const price = selectedService ? (selectedService.pricePerUnitRub * effectiveQuantity).toFixed(2) : "0.00";

  return {
    step, direction, link, setLink, isAnalyzing, activeNetwork, setActiveNetwork,
    activeCategory, services, selectedService, isLoadingServices,
    quantity, setQuantity, numericQuantity, effectiveQuantity, price,
    email, setEmail, isRequirementsConfirmed, setIsRequirementsConfirmed,
    showShakeError, shakeKey, isDripFeedEnabled, setIsDripFeedEnabled,
    dripRuns, setDripRuns, dripInterval, setDripInterval,
    customData, setCustomData, selectedGateway, setSelectedGateway,
    availableGateways, isTgGuideOpen, setIsTgGuideOpen,
    showAuthModal, setShowAuthModal, authModalEmail,
    quantityRef, emailRef, linkRef,
    detectedType, setDetectedType, suggestedCategories, setSuggestedCategories,
    navigateTo, formState, formAction, isPending, handleAnalyzeLink,
    selectCategory, selectService
  };
}
