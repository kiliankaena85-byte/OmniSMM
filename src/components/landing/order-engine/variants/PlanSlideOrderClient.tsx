'use client';

import React, { useState, useRef, useActionState, useEffect, Suspense } from "react";
import { 
  LinkIcon, 
  ArrowRightIcon, 
  ArrowLeftIcon, 
  Box, 
  Sparkles, 
  ShieldCheck, 
  Clock, 
  HelpCircle, 
  CreditCard, 
  Wallet, 
  Coins, 
  AlertCircle,
  X
} from "lucide-react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { getServicesByCategoryAction, PublicNetwork, PublicCategory, PublicService } from "@/actions/order/catalog";
import { checkoutAction, getAvailableGatewaysAction } from "@/actions/order/checkout";
import { formatEtaSpeedBadge } from "@/utils/format-eta";
import { validateDripFeedDuration, DRIP_FEED_MAX_ERROR_MESSAGE, detectNetworkByUrl } from "@/hooks/useOrderWizard";
import { analyzeUrl } from "@/actions/order/analyze-url";
import { matchesSuggestedCategory } from "@/services/analyzer/category-matcher";
import { isLinkServiceCompatible } from "@/constants/link-service-compatibility";
import { inferTargetTypeFromName } from "@/utils/target-type";
import { CategoryIcon, cleanCategoryName } from "@/components/ui/CategoryIcon";
import { PlatformLinkGuideDrawer } from "@/components/landing/order-engine/PlatformLinkGuideDrawer";
import { CheckoutAuthModal } from "@/components/landing/order-engine/modals/CheckoutAuthModal";
import { toast } from "sonner";

type Step = 'link' | 'network' | 'category' | 'service' | 'checkout';

const slideVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 30 : -30,
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.22,
      ease: [0.16, 1, 0.3, 1]
    }
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 30 : -30,
    opacity: 0,
    transition: {
      duration: 0.15,
      ease: "easeIn"
    }
  })
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { 
    opacity: 1, 
    transition: { 
      staggerChildren: 0.03,
      delayChildren: 0.01
    } 
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.2,
      ease: "easeOut"
    }
  }
};

export interface PlanSlideOrderClientProps {
  initialCatalog?: PublicNetwork[];
  initialEmail?: string;
  tenantId?: string;
  userBalanceCents?: number;
}

export function PlanSlideOrderClient(props: PlanSlideOrderClientProps) {
  return (
    <Suspense fallback={<div className="min-h-[400px] flex items-center justify-center text-muted-foreground text-sm font-medium">Загрузка визарда...</div>}>
      <PlanSlideOrderClientInner {...props} />
    </Suspense>
  );
}

function PlanSlideOrderClientInner({ 
  initialCatalog = [], 
  initialEmail = "", 
  tenantId = "smmplan", 
  userBalanceCents = 0 
}: PlanSlideOrderClientProps) {
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [availableGateways, setAvailableGateways] = useState<{ yookassa: boolean; robokassa: boolean; cryptobot: boolean } | null>(null);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalEmail, setAuthModalEmail] = useState("");

  // Restore pending order snapshot if returning via Magic Link (?auth_resume=1)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const isAuthResume = window.location.search.includes("auth_resume=1");
      const rawSnapshot =
        sessionStorage.getItem("smmplan_pending_order") ||
        localStorage.getItem("smmplan_pending_order") ||
        sessionStorage.getItem("omni_pending_order_v1") ||
        localStorage.getItem("omni_pending_order_v1");

      if (!rawSnapshot) return;
      const snapshot = JSON.parse(rawSnapshot);
      if (!snapshot || typeof snapshot !== "object") return;

      const savedTime = snapshot.savedAt || snapshot.timestamp || 0;
      const isExpired = Date.now() - savedTime > 30 * 60 * 1000;
      if (isExpired) return;

      if (isAuthResume) {
        if (snapshot.link || snapshot.url) setLink(snapshot.link || snapshot.url);
        if (snapshot.quantity) setQuantity(snapshot.quantity);
        if (snapshot.email) setEmail(snapshot.email);
        if (snapshot.customData) setCustomData(snapshot.customData);
        if (snapshot.runs) {
          setDripRuns(snapshot.runs);
          setIsDripFeedEnabled(true);
        }
        if (snapshot.interval) setDripInterval(snapshot.interval);

        setStep('checkout');
        toast.success("Вы успешно вошли в аккаунт!", {
          description: "Параметры вашего заказа восстановлены."
        });

        sessionStorage.removeItem("smmplan_pending_order");
        localStorage.removeItem("smmplan_pending_order");
        sessionStorage.removeItem("omni_pending_order_v1");
        localStorage.removeItem("omni_pending_order_v1");

        try {
          const urlObj = new URL(window.location.href);
          urlObj.searchParams.delete("auth_resume");
          window.history.replaceState({}, "", urlObj.pathname + (urlObj.search ? urlObj.search : ""));
        } catch {}
      }
    } catch {}
  }, []);

  // Fetch available gateways
  useEffect(() => {
    getAvailableGatewaysAction().then((res) => {
      if (res.success && res.data) {
        setAvailableGateways(res.data);
        const active = res.data;
        setSelectedGateway((prev) => {
          if (active[prev as keyof typeof active]) return prev;
          const firstAvailable = (["yookassa", "robokassa", "cryptobot"] as const).find(
            (id) => active[id]
          );
          return firstAvailable || prev;
        });
      }
    });
  }, []);

  // Focus link input on desktop mount
  useEffect(() => {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: fine)").matches) {
      linkRef.current?.focus();
    }
  }, []);

  interface OrderFormState { error: string; field: string; timestamp: number }
  const [formState, formAction, isPending] = useActionState(async (_prevState: OrderFormState, formData: FormData) => {
    const linkValue = (formData.get("link") as string) || link;
    const emailValue = (formData.get("email") as string) || email;
    const quantityValue = (formData.get("quantity") as string) || quantity.toString();
    const ts = Date.now();

    if (!selectedService) return { error: "Пожалуйста, выберите услугу", field: "general", timestamp: ts };
    if (!linkValue) return { error: "Пожалуйста, укажите ссылку", field: "link", timestamp: ts };

    if (selectedService.customDataType && selectedService.customDataType !== "NONE") {
      if (!customData.trim()) {
        return { 
          error: selectedService.customDataLabel || "Пожалуйста, заполните необходимые данные для услуги", 
          field: "customData", 
          timestamp: ts 
        };
      }
    }

    const hasReq = selectedService.clientRequirement || selectedService.clientConfirmation || selectedService.requireWarning;
    if (hasReq && !isRequirementsConfirmed) {
      return { error: "Пожалуйста, подтвердите требования к заказу", field: "requirement", timestamp: ts };
    }

    let qtyNum = parseInt(quantityValue);
    if (isNaN(qtyNum)) qtyNum = 0;

    const baseMinQty = selectedService.minQty || 100;
    const maxQty = selectedService.maxQty || 1000000;

    // CRITICAL: Drip-Feed Floor Invariant
    const effectiveMinQty = isDripFeedEnabled ? baseMinQty * dripRuns : baseMinQty;
    if (qtyNum < effectiveMinQty) {
      return { 
        error: isDripFeedEnabled 
          ? `Для Drip-Feed на ${dripRuns} запусков минимальный заказ: ${effectiveMinQty} шт. (по ${baseMinQty} на запуск)`
          : `Минимальное количество: ${baseMinQty}`, 
        field: "quantity", 
        timestamp: ts 
      };
    }
    if (qtyNum > maxQty) {
      return { error: `Максимальное количество: ${maxQty}`, field: "quantity", timestamp: ts };
    }

    if (!emailValue || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      return { error: "Введите корректный email адрес для чека и статуса заказа", field: "email", timestamp: ts };
    }

    if (isDripFeedEnabled && !validateDripFeedDuration(dripRuns, dripInterval)) {
      return { error: DRIP_FEED_MAX_ERROR_MESSAGE, field: "drip", timestamp: ts };
    }

    try {
      const res = await checkoutAction({
        serviceId: selectedService.id,
        link: linkValue,
        quantity: qtyNum,
        email: emailValue,
        gateway: selectedGateway,
        runs: isDripFeedEnabled ? dripRuns : undefined,
        interval: isDripFeedEnabled ? dripInterval : undefined,
        customData: (selectedService.customDataType && selectedService.customDataType !== "NONE") ? customData : undefined,
        isRequirementsConfirmed: isRequirementsConfirmed,
        tenantId: tenantId || "smmplan"
      });

      if (res && res.success) {
        if (res.data?.paymentUrl) {
          window.location.href = res.data.paymentUrl;
          return { error: "", field: "", timestamp: ts };
        } else if (selectedGateway === "balance" || (res.data as Record<string, unknown>)?.redirectUrl) {
          window.location.href = ((res.data as Record<string, unknown>)?.redirectUrl as string) || `/dashboard/orders?success=1&orderId=${res.data?.orderId}&payment=balance`;
          return { error: "", field: "", timestamp: ts };
        } else if (res.data?.orderId) {
          const tokenQuery = res.data.guestOrderToken ? `&token=${res.data.guestOrderToken}` : "";
          window.location.href = `/success?orderId=${res.data.orderId}${tokenQuery}`;
          return { error: "", field: "", timestamp: ts };
        }
      } else if (res && !res.success) {
        const errCode = (res as { code?: string })?.code;
        if (errCode === "ACCOUNT_EXISTS" || res.error?.includes("уже зарегистрирован")) {
          setAuthModalEmail(emailValue);
          setShowAuthModal(true);
          return { error: "", field: "", timestamp: ts };
        }
        return { error: res.error || "Ошибка при оформлении заказа", field: "general", timestamp: ts };
      }
      return { error: "Неизвестная ошибка", field: "general", timestamp: ts };
    } catch (err: unknown) {
      const errCode = (err as { code?: string })?.code;
      const errorMsg = err instanceof Error ? err.message : "Ошибка при создании заказа";
      if (errCode === "ACCOUNT_EXISTS" || errorMsg.includes("уже зарегистрирован")) {
        setAuthModalEmail(emailValue);
        setShowAuthModal(true);
        return { error: "", field: "", timestamp: ts };
      }
      return { error: errorMsg, field: "general", timestamp: ts };
    }
  }, { error: "", field: "", timestamp: 0 });

  useEffect(() => {
    if (formState.timestamp && formState.timestamp > 0 && formState.error) {
      setShakeKey(formState.timestamp);
      const fieldId = formState.field === "general" ? "form-submit-btn" : `field-${formState.field}`;
      const el = document.getElementById(fieldId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [formState.timestamp, formState.error, formState.field]);

  const navigateTo = (newStep: Step) => {
    const order = { 'link': 0, 'network': 1, 'category': 2, 'service': 3, 'checkout': 4 };
    setDirection(order[newStep] > order[step] ? 1 : -1);
    setStep(newStep);
  };

  const handleAnalyzeLink = async (urlToAnalyze: string) => {
    const trimmedInput = urlToAnalyze.trim();
    if (!trimmedInput) return;

    // 1. Detect email entered instead of promotion link
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedInput);
    if (isEmail) {
      setEmail(trimmedInput);
      setLink("");
      toast.success("Email сохранен для чекаута!", {
        description: "Теперь вставьте ссылку на ваш канал, группу или пост."
      });
      return;
    }

    setIsAnalyzing(true);
    setEnteredViaCatalog(false);

    try {
      const res = await analyzeUrl(trimmedInput);
      const analysis = res && res.success ? res.data : null;
      const activePlatformStr = analysis && analysis.platform !== "OTHER" ? analysis.platform.toLowerCase() : null;
      let matchedNetwork: PublicNetwork | null = null;

      if (activePlatformStr && initialCatalog) {
        matchedNetwork = initialCatalog.find(
          n => n.slug.toLowerCase().includes(activePlatformStr) || activePlatformStr.includes(n.slug.toLowerCase())
        ) || null;
      }
      if (!matchedNetwork) {
        matchedNetwork = detectNetworkByUrl(trimmedInput, initialCatalog as any) as any;
      }

      setDetectedType(analysis?.type || null);
      setSuggestedCategories(analysis?.suggestedCategories || []);

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
    setIsLoadingServices(true);
    setServices([]);
    navigateTo('service');

    try {
      const fetched = await getServicesByCategoryAction(cat.id, tenantId);
      let srvList: PublicService[] = fetched || [];
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

  useEffect(() => {
    if (step === 'checkout' && quantityRef.current) {
      if (typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: fine)").matches) {
        quantityRef.current?.focus({ preventScroll: true });
      }
    }
  }, [step]);

  const numericQuantity = typeof quantity === "string" ? (parseInt(quantity) || 0) : quantity;
  const effectiveQuantity = isDripFeedEnabled ? numericQuantity * dripRuns : numericQuantity;
  const totalPrice = selectedService ? (selectedService.pricePerUnitRub * effectiveQuantity).toFixed(2) : "0.00";

  return (
    <div className={`w-full max-w-4xl mx-auto flex flex-col items-center justify-center font-sans px-2 sm:px-4 relative overflow-visible ${step === 'link' ? 'pt-4 md:pt-8 pb-4' : 'min-h-[50vh] pt-2 pb-10'}`}>
      
      {/* ── BREADCRUMB / TOP NAVIGATION BAR (Steps 2-4) ── */}
      {step !== 'link' && (
        <div 
          className="w-full max-w-3xl mb-5 flex items-center bg-card/90 backdrop-blur-md border border-border/80 shadow-sm h-12 sm:h-14 rounded-2xl px-2 z-10 animate-in fade-in duration-200"
        >
          <button
            type="button"
            onClick={() => {
              if (step === 'checkout') navigateTo('service');
              else if (step === 'service') navigateTo('category');
              else if (step === 'category') {
                if (enteredViaCatalog) {
                  navigateTo('network');
                } else {
                  navigateTo('link');
                }
              }
              else if (step === 'network') navigateTo('link');
            }}
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors mr-1.5 flex-shrink-0 cursor-pointer"
            title="Назад"
          >
            <ArrowLeftIcon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          </button>

          <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
            {activeNetwork?.icon && (
              <img 
                src={activeNetwork.icon} 
                alt="" 
                className="w-4 h-4 object-contain flex-shrink-0"
              />
            )}
            <LinkIcon className="text-muted-foreground w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-xs sm:text-sm font-semibold text-foreground truncate min-w-0">
              {link || (activeNetwork?.name ? `${activeNetwork.name} (из каталога)` : "Без ссылки")}
            </span>
          </div>

          <button 
            type="button"
            onClick={() => { 
              setLink(""); 
              setActiveNetwork(null);
              setActiveCategory(null);
              setSelectedService(null);
              setEnteredViaCatalog(false);
              setStep('link'); 
            }}
            className="h-8 px-2.5 flex items-center gap-1 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors cursor-pointer flex-shrink-0"
            title="Сбросить и ввести новую ссылку"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Сброс</span>
          </button>
        </div>
      )}

      <AnimatePresence initial={false} custom={direction} mode="wait">
        
        {/* ── STEP 1: LINK INPUT (HERO SCREEN) ── */}
        {step === 'link' && (
          <motion.div
            key="step-link"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="w-full max-w-2xl flex flex-col items-center"
          >
            {/* Header Badge Removed */}

            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground mb-3 text-center leading-tight px-2 text-balance">
              Что хотите <span className="text-primary underline decoration-primary/30 decoration-wavy underline-offset-4">продвигать</span> сегодня?
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground text-center mb-6 max-w-lg">
              Вставьте ссылку на канал, группу, профиль или публикацию — алгоритм моментально определит соцсеть и совместимые услуги.
            </p>

            {/* Main Input Box */}
            <div className="w-full relative">
              <div 
                className={`relative w-full rounded-2xl sm:rounded-3xl transition-all duration-200 bg-card border ${
                  isAnalyzing 
                    ? "border-primary shadow-lg ring-2 ring-primary/20" 
                    : "border-border/80 hover:border-primary/50 shadow-md"
                } p-1.5 sm:p-2 flex items-center gap-2`}
              >
                <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center flex-shrink-0 ml-1">
                  <LinkIcon className="text-muted-foreground w-5 h-5 shrink-0" />
                </div>
                
                <input
                  ref={linkRef}
                  type="url"
                  className="flex-1 text-sm sm:text-base py-2 px-1 bg-transparent outline-none w-full font-medium text-foreground placeholder:text-muted-foreground/60"
                  placeholder="Например: https://t.me/channel или @channel"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && link) handleAnalyzeLink(link);
                  }}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData("text");
                    if (text) {
                      setTimeout(() => handleAnalyzeLink(text), 80);
                    }
                  }}
                />

                {link && (
                  <button
                    type="button"
                    onClick={() => setLink("")}
                    className="w-7 h-7 rounded-lg hover:bg-muted text-muted-foreground flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  disabled={isAnalyzing || !link.trim()}
                  onClick={() => handleAnalyzeLink(link)}
                  className={`h-10 sm:h-11 px-4 sm:px-5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
                    link.trim() 
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md" 
                      : "bg-muted text-muted-foreground opacity-60 cursor-not-allowed"
                  }`}
                >
                  {isAnalyzing ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      <span>Анализ...</span>
                    </>
                  ) : (
                    <>
                      <span>Далее</span>
                      <ArrowRightIcon className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* Secondary Helpers */}
              <div className="flex items-center justify-between mt-3 px-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsGuideOpen(true)}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Где взять ссылку?</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEnteredViaCatalog(true);
                    navigateTo('network');
                  }}
                  className="text-primary hover:text-primary/80 font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Выбрать из каталога →</span>
                </button>
              </div>
            </div>

            {/* Quick Network Pills */}
            <div className="mt-8 w-full">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider text-center mb-3">
                Популярные платформы
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
                {initialCatalog.slice(0, 7).map((net) => (
                  <button
                    key={net.id}
                    type="button"
                    onClick={() => {
                      setEnteredViaCatalog(false);
                      setDetectedType(null);
                      setSuggestedCategories([]);
                      setActiveNetwork(net);
                      navigateTo('category');
                    }}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card border border-border/70 hover:border-primary/50 hover:bg-muted/40 text-foreground font-semibold text-xs transition-all shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    {net.icon && (
                      <img src={net.icon} alt="" className="w-4 h-4 object-contain" />
                    )}
                    <span>{net.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── STEP 2: NETWORK SELECTION (FROM CATALOG) ── */}
        {step === 'network' && (
          <motion.div
            key="step-network"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="w-full max-w-3xl"
          >
            <div className="text-center mb-6">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
                Выберите соцсеть
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Выберите платформу, для которой требуется продвижение
              </p>
            </div>

            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3.5"
            >
              {initialCatalog.map((net) => (
                <motion.button
                  variants={itemVariants}
                  key={net.id}
                  type="button"
                  onClick={() => {
                    setDetectedType(null);
                    setSuggestedCategories([]);
                    setActiveNetwork(net);
                    navigateTo('category');
                  }}
                  className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-2xl bg-card border border-border/80 hover:border-primary/60 hover:bg-primary/5 shadow-sm hover:shadow-md transition-all duration-150 cursor-pointer group"
                >
                  {net.icon ? (
                    <img 
                      src={net.icon} 
                      alt="" 
                      className="w-10 h-10 object-contain group-hover:scale-110 transition-transform" 
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                      {net.name[0]}
                    </div>
                  )}
                  <span className="font-bold text-foreground text-xs sm:text-sm text-center">
                    {net.name}
                  </span>
                  {net.categories && net.categories.length > 0 && (
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {net.categories.length} категорий
                    </span>
                  )}
                </motion.button>
              ))}
            </motion.div>
          </motion.div>
        )}

        {/* ── STEP 3: CATEGORY SELECTION ── */}
        {step === 'category' && activeNetwork && (() => {
          const availableCategories = activeNetwork.categories || [];
          const filteredCategories = (suggestedCategories.length > 0 || detectedType)
            ? availableCategories.filter(c => matchesSuggestedCategory(c.name, suggestedCategories, undefined, detectedType))
            : [];
          const displayCategories = filteredCategories.length > 0 ? filteredCategories : availableCategories;

          return (
            <motion.div
              key="step-category"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="w-full max-w-3xl"
            >
              <div className="flex items-center justify-between mb-5 px-1">
                <div>
                  <div className="flex items-center gap-2">
                    {activeNetwork.icon && (
                      <img src={activeNetwork.icon} alt="" className="w-5 h-5 object-contain" />
                    )}
                    <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                      {activeNetwork.name}: выберите категорию
                    </h2>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    {filteredCategories.length > 0 
                      ? "Показаны категории, подходящие к вашей ссылке" 
                      : "Выберите нужный тип активности"}
                  </p>
                </div>

                {filteredCategories.length > 0 && filteredCategories.length < availableCategories.length && (
                  <button
                    type="button"
                    onClick={() => {
                      setDetectedType(null);
                      setSuggestedCategories([]);
                    }}
                    className="text-xs text-primary font-semibold hover:underline cursor-pointer"
                  >
                    Все {availableCategories.length} категорий
                  </button>
                )}
              </div>

              <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3"
              >
                {displayCategories.map((cat) => (
                  <motion.div
                    key={cat.id}
                    variants={itemVariants}
                    role="button"
                    tabIndex={0}
                    onClick={() => selectCategory(cat)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        selectCategory(cat);
                      }
                    }}
                    className="p-3.5 sm:p-4 rounded-2xl bg-card border border-border/80 hover:border-primary/60 hover:bg-primary/5 shadow-sm hover:shadow-md transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <CategoryIcon name={cat.name} size={20} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-foreground text-sm sm:text-base truncate min-w-0">
                          {cleanCategoryName(cat.name)}
                        </h4>
                        {cat.serviceCount !== undefined && cat.serviceCount > 0 && (
                          <span className="text-[11px] text-muted-foreground">
                            {cat.serviceCount} тарифов
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                      <ArrowRightIcon className="w-3.5 h-3.5" />
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          );
        })()}

        {/* ── STEP 4: SERVICE / TARIFF SELECTION ── */}
        {step === 'service' && activeCategory && (
          <motion.div
            key="step-service"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="w-full max-w-3xl"
          >
            <div className="mb-5 px-1">
              <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                {activeCategory.name}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Выберите подходящий тариф по скорости, гарантии и стоимости
              </p>
            </div>

            {isLoadingServices ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <Box className="w-10 h-10 text-primary animate-pulse" />
                <span className="text-xs text-muted-foreground font-medium">Загрузка тарифов...</span>
              </div>
            ) : services.length === 0 ? (
              <div className="py-14 text-center bg-card border border-border/80 rounded-2xl p-6">
                <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-60" />
                <p className="font-bold text-foreground">В этой категории пока нет доступных тарифов</p>
                <p className="text-xs text-muted-foreground mt-1">Пожалуйста, выберите другую категорию</p>
                <button
                  type="button"
                  onClick={() => navigateTo('category')}
                  className="mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 cursor-pointer"
                >
                  Вернуться к категориям
                </button>
              </div>
            ) : (
              <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-2 gap-3"
              >
                {services.map((service) => (
                  <motion.div
                    key={service.id}
                    variants={itemVariants}
                    role="button"
                    tabIndex={0}
                    onClick={() => selectService(service)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        selectService(service);
                      }
                    }}
                    className="p-4 rounded-2xl bg-card border border-border/80 hover:border-primary/60 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer relative"
                  >
                    <div>
                      <h4 className="font-bold text-foreground text-base leading-snug mb-2 group-hover:text-primary transition-colors">
                        {service.name}
                      </h4>

                      <div className="space-y-1 text-xs text-muted-foreground mb-4">
                        <p className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Старт: <strong className="text-foreground font-semibold">{service.speed || 'Моментально'}</strong></span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-primary/60 inline-block" />
                          <span>Лимиты: <strong className="text-foreground font-semibold font-mono">{service.minQty} – {service.maxQty} шт.</strong></span>
                        </p>
                        {service.warrantyDays ? (
                          <p className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Гарантия: {service.warrantyDays} дн.</span>
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border/60 flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        <span className="text-base sm:text-lg font-black text-foreground font-mono">
                          {service.pricePerUnitRub.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ₽
                        </span>
                        <span className="ml-1 text-[11px]">/ шт</span>
                      </div>

                      <button
                        type="button"
                        className="h-8 px-3.5 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer pointer-events-none"
                      >
                        <span>Выбрать</span>
                        <ArrowRightIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ── STEP 5: CHECKOUT SCREEN ── */}
        {step === 'checkout' && selectedService && (
          <motion.div
            key="step-checkout"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="w-full max-w-2xl"
          >
            <div className="bg-card border border-border/80 shadow-lg rounded-3xl p-4 sm:p-6 w-full">
              
              {/* Selected Tariff Recap */}
              <div className="mb-4 pb-4 border-b border-border/60 flex justify-between items-start gap-3">
                <div>
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider block mb-0.5">
                    Выбранный тариф
                  </span>
                  <h3 className="text-lg sm:text-xl font-extrabold text-foreground leading-snug">
                    {selectedService.name}
                  </h3>
                </div>

                <div className="text-right flex-shrink-0">
                  <span className="text-lg sm:text-xl font-black text-primary font-mono block">
                    {selectedService.pricePerUnitRub.toFixed(2)} ₽
                  </span>
                  <span className="text-[10px] text-muted-foreground">за 1 шт</span>
                </div>
              </div>

              {/* Service description if present */}
              {selectedService.description && (
                <div className="mb-4 p-3 rounded-xl bg-muted/50 border border-border/50 text-xs text-muted-foreground leading-relaxed max-h-24 overflow-y-auto whitespace-pre-wrap">
                  {selectedService.description}
                </div>
              )}

              {/* Form starts */}
              <form action={formAction} noValidate>
                
                {/* 0. Ссылка для заказа */}
                <div id="field-link" className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <LinkIcon className="w-3.5 h-3.5 text-primary" />
                      <span>Ссылка для заказа</span>
                      <span className="text-destructive font-bold">*</span>
                    </label>
                    {activeNetwork && (
                      <span className="text-[11px] font-bold text-primary">
                        {activeNetwork.name}
                      </span>
                    )}
                  </div>

                  <input
                    ref={linkRef}
                    name="link"
                    type="text"
                    value={link}
                    onChange={(e) => {
                      setLink(e.target.value);
                    }}
                    className={`w-full h-11 px-3.5 rounded-xl bg-background border ${
                      formState.field === "link" && formState.error
                        ? "border-destructive ring-1 ring-destructive"
                        : "border-border/80 focus:border-primary focus:ring-1 focus:ring-primary"
                    } outline-none font-bold text-sm text-foreground font-mono`}
                    placeholder={
                      activeNetwork?.slug === "telegram"
                        ? "https://t.me/channel или @channel"
                        : activeNetwork?.slug === "vk"
                        ? "https://vk.com/..."
                        : "Вставьте ссылку на канал, группу или публикацию"
                    }
                  />
                  {formState.field === "link" && formState.error && (
                    <p className="text-[11px] font-bold text-destructive mt-1">{formState.error}</p>
                  )}
                </div>

                {/* 1. Количество */}
                <div id="field-quantity" className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Количество
                    </label>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      от {selectedService.minQty || 100} до {selectedService.maxQty || 1000000} шт
                    </span>
                  </div>

                  <input
                    ref={quantityRef}
                    name="quantity"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={quantity}
                    onFocus={(e) => {
                      if (typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches) {
                        e.currentTarget.select();
                      }
                    }}
                    onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ''))}
                    className="w-full h-11 px-3.5 rounded-xl bg-background border border-border/80 focus:border-primary focus:ring-1 focus:ring-primary outline-none font-bold text-base text-foreground font-mono"
                    placeholder={`Минимум ${selectedService.minQty || 100}`}
                  />

                  {/* Quick Pill Steppers */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {[100, 500, 1000, 2500, 5000].map((stepVal) => (
                      <button
                        key={stepVal}
                        type="button"
                        onClick={() => setQuantity(stepVal)}
                        className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-xs font-bold font-mono transition-colors cursor-pointer"
                      >
                        {stepVal}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Drip-Feed (if available) */}
                {selectedService.isDripFeedEnabled && (
                  <div className="mb-4 p-3 rounded-xl bg-muted/30 border border-border/60">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-foreground cursor-pointer flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isDripFeedEnabled}
                          onChange={(e) => setIsDripFeedEnabled(e.target.checked)}
                          className="w-4 h-4 rounded text-primary focus:ring-primary"
                        />
                        <span>Постепенная накрутка (Drip-Feed)</span>
                      </label>
                    </div>

                    {isDripFeedEnabled && (
                      <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border/40 text-xs">
                        <div>
                          <label className="block text-muted-foreground mb-1">Количество запусков</label>
                          <input
                            type="number"
                            min={2}
                            max={100}
                            value={dripRuns}
                            onChange={(e) => setDripRuns(parseInt(e.target.value) || 2)}
                            className="w-full h-9 px-2 rounded-lg bg-background border border-border font-mono text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-muted-foreground mb-1">Интервал (мин)</label>
                          <input
                            type="number"
                            min={10}
                            max={1440}
                            value={dripInterval}
                            onChange={(e) => setDripInterval(parseInt(e.target.value) || 60)}
                            className="w-full h-9 px-2 rounded-lg bg-background border border-border font-mono text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Custom Data Input (if required) */}
                {selectedService.customDataType && selectedService.customDataType !== "NONE" && (
                  <div id="field-customData" className="mb-4">
                    <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
                      {selectedService.customDataLabel || "Дополнительные данные"}
                    </label>
                    <textarea
                      value={customData}
                      onChange={(e) => setCustomData(e.target.value)}
                      placeholder="Укажите комментарии, текст или параметры услуги"
                      className="w-full h-20 p-3 rounded-xl bg-background border border-border/80 focus:border-primary outline-none text-xs text-foreground resize-none"
                    />
                  </div>
                )}

                {/* 4. Client Requirement Confirmation */}
                {(selectedService.clientRequirement || selectedService.clientConfirmation || selectedService.requireWarning) && (
                  <div id="field-requirement" className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isRequirementsConfirmed}
                        onChange={(e) => setIsRequirementsConfirmed(e.target.checked)}
                        className="w-4 h-4 rounded text-primary focus:ring-primary mt-0.5"
                      />
                      <span className="text-foreground leading-relaxed">
                        {selectedService.warningMessage || selectedService.clientRequirement || "Подтверждаю, что мой канал/профиль открыт и ссылка верна"}
                      </span>
                    </label>
                  </div>
                )}

                {/* 5. Email */}
                <div id="field-email" className="mb-5">
                  <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
                    Email для чека и статуса
                  </label>
                  <input
                    ref={emailRef}
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-background border border-border/80 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm text-foreground"
                    placeholder="example@mail.ru"
                  />
                </div>

                {/* 6. Payment Gateways */}
                <div className="mb-5">
                  <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                    Способ оплаты
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {/* YooKassa (Карты/СБП) */}
                    {(availableGateways?.yookassa ?? true) && (
                      <button
                        type="button"
                        onClick={() => setSelectedGateway("yookassa")}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                          selectedGateway === "yookassa" 
                            ? "border-primary bg-primary/10 shadow-sm" 
                            : "border-border/70 hover:border-border bg-background"
                        }`}
                      >
                        <CreditCard className="w-5 h-5 text-primary mb-1.5" />
                        <div>
                          <p className="font-bold text-xs text-foreground">Банковская карта</p>
                          <p className="text-[10px] text-muted-foreground">РФ, СБП, Mir</p>
                        </div>
                      </button>
                    )}

                    {/* Мой баланс */}
                    {userBalanceCents > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedGateway("balance")}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                          selectedGateway === "balance" 
                            ? "border-primary bg-primary/10 shadow-sm" 
                            : "border-border/70 hover:border-border bg-background"
                        }`}
                      >
                        <Wallet className="w-5 h-5 text-emerald-500 mb-1.5" />
                        <div>
                          <p className="font-bold text-xs text-foreground">Мой баланс</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{(userBalanceCents / 100).toFixed(0)} ₽</p>
                        </div>
                      </button>
                    )}

                    {/* Robokassa (Only when configured) */}
                    {availableGateways?.robokassa && (
                      <button
                        type="button"
                        onClick={() => setSelectedGateway("robokassa")}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                          selectedGateway === "robokassa" 
                            ? "border-primary bg-primary/10 shadow-sm" 
                            : "border-border/70 hover:border-border bg-background"
                        }`}
                      >
                        <CreditCard className="w-5 h-5 text-indigo-500 mb-1.5" />
                        <div>
                          <p className="font-bold text-xs text-foreground">Robokassa</p>
                          <p className="text-[10px] text-muted-foreground">СБП, Карты</p>
                        </div>
                      </button>
                    )}

                    {/* Crypto (Only when configured) */}
                    {availableGateways?.cryptobot && (
                      <button
                        type="button"
                        onClick={() => setSelectedGateway("cryptobot")}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                          selectedGateway === "cryptobot" 
                            ? "border-primary bg-primary/10 shadow-sm" 
                            : "border-border/70 hover:border-border bg-background"
                        }`}
                      >
                        <Coins className="w-5 h-5 text-amber-500 mb-1.5" />
                        <div>
                          <p className="font-bold text-xs text-foreground">Криптовалюта</p>
                          <p className="text-[10px] text-muted-foreground">USDT, TON, BTC</p>
                        </div>
                      </button>
                    )}
                  </div>
                </div>

                {/* Server Error Warning */}
                {formState.error && (
                  <div 
                    key={shakeKey}
                    className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold flex items-center gap-2 animate-shake"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{formState.error}</span>
                  </div>
                )}

                {/* Submit Action Block */}
                <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Итого к оплате:</span>
                    <span className="text-2xl font-black text-foreground font-mono">
                      {totalPrice} ₽
                    </span>
                  </div>

                  <button
                    id="form-submit-btn"
                    type="submit"
                    disabled={isPending}
                    className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isPending ? (
                      <>
                        <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        <span>Создание заказа...</span>
                      </>
                    ) : (
                      <>
                        <span>{selectedGateway === "balance" ? "Оплатить с баланса" : "Перейти к оплате"}</span>
                        <ArrowRightIcon className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

                <p className="text-[11px] text-muted-foreground text-center mt-3">
                  Нажимая кнопку, вы соглашаетесь с условиями сервиса и политикой обработки данных (152-ФЗ)
                </p>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Telegram Link Guide Drawer */}
      <PlatformLinkGuideDrawer
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        initialPlatform={activeNetwork?.slug || "telegram"}
      />

      {/* Seamless In-Modal Checkout Auth (SPEC-2026-14) */}
      <CheckoutAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        email={authModalEmail}
        orderSnapshot={{
          serviceId: selectedService?.id,
          link,
          quantity: numericQuantity,
          runs: isDripFeedEnabled ? dripRuns : undefined,
          interval: isDripFeedEnabled ? dripInterval : undefined,
          customData,
          networkId: activeNetwork?.id,
          categoryId: activeCategory?.id
        }}
        onAuthSuccess={() => {
          setShowAuthModal(false);
          toast.success("Вы успешно авторизовались!", {
            description: "Теперь вы можете оплатить заказ с баланса или картой."
          });
        }}
      />
    </div>
  );
}
