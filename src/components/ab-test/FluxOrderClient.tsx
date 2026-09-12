'use client';

import React, { useState, useRef, useActionState, useEffect, Suspense } from "react";
import { Button } from "@heroui/react";
import { LinkIcon, SparklesIcon, ArrowRightIcon, Box, ArrowLeftIcon, ArrowDownIcon, AlertCircle, HelpCircle, CreditCard, Wallet, Coins, Check } from "lucide-react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { getServicesByCategoryAction } from "@/actions/order/catalog";
import { checkoutAction, getAvailableGatewaysAction } from "@/actions/order/checkout";
import { formatEtaSpeedBadge } from "@/utils/format-eta";
import { validateDripFeedDuration, DRIP_FEED_MAX_ERROR_MESSAGE, detectNetworkByUrl } from "@/hooks/useOrderWizard";
import { analyzeUrl } from "@/actions/order/analyze-url";
import { matchesSuggestedCategory } from "@/services/analyzer/category-matcher";
import { isLinkServiceCompatible } from "@/constants/link-service-compatibility";
import { inferTargetTypeFromName } from "@/utils/target-type";
import { FluxNetwork, FluxCategory, FluxService } from "@/types/flux";
import { FluxCyberLinkDrawer } from "@/components/orders/flux/FluxCyberLinkDrawer";
import { LinkGuideService } from "@/services/catalog/link-guide.service";
import { CategoryIcon, cleanCategoryName } from "@/components/ui/CategoryIcon";
import { toast } from "sonner";
import { CheckoutAuthModal } from "@/components/landing/order-engine/modals/CheckoutAuthModal";

type Step = 'link' | 'network' | 'category' | 'service' | 'checkout';

const slideVariants: Variants = {
  enter: (direction: number) => ({
    y: direction > 0 ? 15 : -15,
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.2,
      ease: "easeOut"
    }
  },
  exit: (direction: number) => ({
    zIndex: 0,
    y: direction < 0 ? 15 : -15,
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
      staggerChildren: 0.025,
      delayChildren: 0.01
    } 
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.18,
      ease: "easeOut"
    }
  }
};

interface FluxOrderClientProps {
  initialCatalog?: FluxNetwork[];
  initialEmail?: string;
  tenantId?: string;
  userBalanceCents?: number;
}

export function FluxOrderClient(props: FluxOrderClientProps) {
  return (
    <Suspense fallback={<div className="min-h-[400px] flex items-center justify-center text-muted-foreground text-sm">Загрузка визарда заказа...</div>}>
      <FluxOrderClientInner {...props} />
    </Suspense>
  );
}

function FluxOrderClientInner({ initialCatalog, initialEmail, tenantId = 'flux', userBalanceCents = 0 }: FluxOrderClientProps) {
  const [step, setStep] = useState<Step>('link');
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

  const quantityRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  
  const [isRequirementsConfirmed, setIsRequirementsConfirmed] = useState(false);
  const [isDripFeedEnabled, setIsDripFeedEnabled] = useState(false);
  const [dripRuns, setDripRuns] = useState(5);
  const [dripInterval, setDripInterval] = useState(60);
  const [customData, setCustomData] = useState("");
  const [isTgGuideOpen, setIsTgGuideOpen] = useState(false);
  const [showShakeError, setShowShakeError] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const [detectedType, setDetectedType] = useState<string | null>(null);
  const [suggestedCategories, setSuggestedCategories] = useState<string[]>([]);

  const [selectedGateway, setSelectedGateway] = useState<string>("yookassa");
  const [availableGateways, setAvailableGateways] = useState<{ yookassa: boolean; robokassa: boolean; cryptobot: boolean } | null>(null);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalEmail, setAuthModalEmail] = useState('');

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
        
        // Navigate to checkout step
        setStep('checkout');

        toast.success('Вы успешно вошли в аккаунт!', {
          description: 'Параметры вашего заказа восстановлены и готовы к оплате.'
        });

        sessionStorage.removeItem('smmplan_pending_order');
        localStorage.removeItem('smmplan_pending_order');
        sessionStorage.removeItem('omni_pending_order_v1');
        localStorage.removeItem('omni_pending_order_v1');

        try {
          const urlObj = new URL(window.location.href);
          urlObj.searchParams.delete('auth_resume');
          window.history.replaceState({}, '', urlObj.pathname + (urlObj.search ? urlObj.search : ''));
        } catch {}
      }
    } catch {}
  }, []);

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

  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) {
      linkRef.current?.focus();
    }
  }, []);
  
  interface OrderFormState { error: string; field: string; timestamp: number }
  const [formState, formAction, isPending] = useActionState(async (prevState: OrderFormState, formData: FormData) => {
    const linkValue = formData.get("link") as string || link;
    const emailValue = formData.get("email") as string || email;
    const quantityValue = formData.get("quantity") as string || quantity.toString();
    const ts = Date.now();
    
    if (!selectedService) return { error: "Пожалуйста, выберите услугу", field: "general", timestamp: ts };
    if (!linkValue) return { error: "Пожалуйста, укажите ссылку", field: "link", timestamp: ts };
    
    if (selectedService.customDataType && selectedService.customDataType !== 'NONE') {
      if (!customData.trim()) {
        return { error: selectedService.customDataLabel || "Пожалуйста, заполните пользовательские данные", field: "customData", timestamp: ts };
      }
    }

    const hasReq = selectedService.clientRequirement || selectedService.clientConfirmation || selectedService.requireWarning;
    if (hasReq && !isRequirementsConfirmed) {
      setShowShakeError(true);
      setTimeout(() => setShowShakeError(false), 800);
      return { error: "Пожалуйста, подтвердите требования к заказу", field: "requirement", timestamp: ts };
    }
    
    let qtyNum = parseInt(quantityValue);
    if (isNaN(qtyNum)) qtyNum = 0;

    const minQty = selectedService.minQty || 100;
    const maxQty = selectedService.maxQty || 10000;
    if (qtyNum < minQty) return { error: `Минимальное количество: ${minQty}`, field: "quantity", timestamp: ts };
    if (qtyNum > maxQty) return { error: `Максимальное количество: ${maxQty}`, field: "quantity", timestamp: ts };
    
    // Email validation
    if (!emailValue || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      return { error: "Введите корректный email адрес", field: "email", timestamp: ts };
    }

    if (isDripFeedEnabled && !validateDripFeedDuration(dripRuns, dripInterval)) {
      return { error: DRIP_FEED_MAX_ERROR_MESSAGE, field: "drip", timestamp: ts };
    }

    const totalQuantity = isDripFeedEnabled ? qtyNum * dripRuns : qtyNum;

    try {
      const res = await checkoutAction({
        serviceId: selectedService.id,
        link: linkValue,
        quantity: totalQuantity,
        email: emailValue,
        gateway: selectedGateway,
        runs: isDripFeedEnabled ? dripRuns : undefined,
        interval: isDripFeedEnabled ? dripInterval : undefined,
        customData: (selectedService.customDataType && selectedService.customDataType !== 'NONE') ? customData : undefined,
        isRequirementsConfirmed: isRequirementsConfirmed,
        tenantId: tenantId || 'flux'
      });

      if (res && res.success) {
        if (res.data?.paymentUrl) {
          // external gateway redirect (server-validated)
          window.location.href = res.data.paymentUrl;
          return { error: "", field: "", timestamp: ts };
        } else if (selectedGateway === 'balance' || (res.data as any)?.redirectUrl) {
          window.location.href = (res.data as any)?.redirectUrl || `/dashboard/orders?success=1&orderId=${res.data?.orderId}&payment=balance`;
          return { error: "", field: "", timestamp: ts };
        } else if (res.data?.orderId) {
          const tokenQuery = res.data.guestOrderToken ? `&token=${res.data.guestOrderToken}` : '';
          window.location.href = `/success?orderId=${res.data.orderId}${tokenQuery}`;
          return { error: "", field: "", timestamp: ts };
        }
      } else if (res && !res.success) {
        const errCode = (res as { code?: string })?.code;
        if (errCode === 'ACCOUNT_EXISTS' || res.error?.includes('уже зарегистрирован')) {
          setAuthModalEmail(emailValue);
          setShowAuthModal(true);
          return { error: "", field: "", timestamp: ts };
        }
        return { error: res.error || "Ошибка валидации данных", field: "general", timestamp: ts };
      }
      return { error: "Неизвестная ошибка", field: "general", timestamp: ts };
    } catch (err: unknown) {
      const errCode = (err as { code?: string })?.code;
      const errorMsg = err instanceof Error ? err.message : "Ошибка при создании заказа";
      if (errCode === 'ACCOUNT_EXISTS' || errorMsg.includes('уже зарегистрирован')) {
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
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [formState.timestamp, formState.error, formState.field]);

  const navigateTo = (newStep: Step) => {
    const order = { 'link': 0, 'network': 1, 'category': 2, 'service': 3, 'checkout': 4 };
    setDirection(order[newStep] > order[step] ? 1 : -1);
    setStep(newStep);
  };

  const handleAnalyzeLink = async (url: string) => {
    const trimmedInput = (url || "").trim();
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
    
    try {
      const res = await analyzeUrl(trimmedInput);
      const analysis = res && res.success ? res.data : null;
      const activePlatformStr = analysis && analysis.platform !== 'OTHER' ? analysis.platform.toLowerCase() : null;
      let matchedNetwork = null;
      if (activePlatformStr && initialCatalog) {
        matchedNetwork = initialCatalog.find(n => n.slug.toLowerCase().includes(activePlatformStr) || activePlatformStr.includes(n.slug.toLowerCase()));
      }
      if (!matchedNetwork) {
        matchedNetwork = detectNetworkByUrl(trimmedInput, initialCatalog || []);
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
      let matchedNetwork = detectNetworkByUrl(trimmedInput, initialCatalog || []);
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

    if (activeNetwork && cat.slug && typeof window !== 'undefined') {
      window.history.replaceState(null, '', `/services/${activeNetwork.slug}/${cat.slug}`);
    }

    try {
      const fetched = await getServicesByCategoryAction(cat.id, tenantId);
      let srvList: FluxService[] = fetched || [];
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
      // error is intentionally ignored here since we just set services to empty
    } finally {
      setIsLoadingServices(false);
    }
  };

  const selectService = (srv: FluxService) => {
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
      setTimeout(() => quantityRef.current?.focus(), 300);
    }
  }, [step]);

  const numericQuantity = typeof quantity === 'string' ? (parseInt(quantity) || 0) : quantity;
  const effectiveQuantity = isDripFeedEnabled ? numericQuantity * dripRuns : numericQuantity;
  const price = selectedService ? (selectedService.pricePerUnitRub * effectiveQuantity).toFixed(2) : "0.00";

  return (
    <div className={`w-full max-w-5xl mx-auto flex flex-col items-center justify-center font-sans px-4 relative overflow-visible ${step === 'link' ? 'pt-4 md:pt-8 pb-2' : 'min-h-[50vh] pt-4 pb-8'}`}>
      {step !== 'link' && (
        <div 
          className="w-full max-w-3xl mb-6 flex items-center bg-card border border-border/80 shadow-sm h-14 rounded-2xl px-2 z-10 transform-gpu"
        >
          <button
            onClick={() => {
              if (step === 'checkout') navigateTo('service');
              else if (step === 'service') navigateTo('category');
              else if (step === 'category') navigateTo('network');
              else if (step === 'network') navigateTo('link');
            }}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-colors mr-2 flex-shrink-0 cursor-pointer"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <LinkIcon className="text-muted-foreground w-4 h-4 mr-2 flex-shrink-0" />
          <div className="flex-1 text-sm font-medium text-foreground truncate mr-2">
            {link || "Без ссылки"}
          </div>
          <button 
            onClick={() => { setLink(''); setStep('link'); }}
            className="w-8 h-8 mr-1 flex-shrink-0 flex items-center justify-center rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors font-bold cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}
      <AnimatePresence initial={false} custom={direction} mode="wait">
        
        {/* STEP 1: LINK INPUT */}
        {step === 'link' && (
          <motion.div
            key="step-link"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="w-full max-w-3xl flex flex-col items-center transform-gpu"
          >
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tighter text-foreground mb-6 md:mb-8 text-center leading-tight px-2">
              Что хотите <span className="inline-block px-2 sm:px-3 py-1 bg-foreground text-background rounded-[1rem] sm:rounded-2xl rotate-[-2deg] mx-1 shadow-md">продвигать</span> сегодня?
            </h1>
            <div className="relative group w-full max-w-2xl px-2 sm:px-0">
              <div 
                className={`relative w-full group rounded-[2rem] transition-all duration-300 select-text ${isAnalyzing ? 'p-1 scale-[1.01]' : 'p-0.5 scale-100'}`}
              >
                {/* Shimmer Border */}
                <div
                  className="absolute inset-0 rounded-[2rem] transition-opacity duration-300 pointer-events-none google-border-shimmer opacity-100 blur-[1px]"
                />
                
                {/* Soft backdrop blur glow */}
                <div
                  className={`absolute inset-0 rounded-[2rem] transition-all duration-300 pointer-events-none blur-md ${
                    isAnalyzing
                      ? "google-border-shimmer opacity-60 scale-[1.02]"
                      : "google-border-shimmer opacity-30 group-hover:opacity-50 scale-[1.01]"
                  }`}
                />
                
                <div
                  className="relative flex items-center w-full bg-card rounded-[calc(2rem-1.5px)] p-1.5 sm:p-2 h-14 sm:h-16 md:h-[68px] z-10 shadow-inner border border-border/40"
                >
                  <LinkIcon className="text-muted-foreground w-5 h-5 sm:w-6 sm:h-6 ml-2 sm:ml-3 flex-shrink-0 group-focus-within:text-foreground transition-colors" />
                  <input
                    ref={linkRef}
                    className="flex-1 text-base sm:text-lg py-2 sm:py-3 px-3 sm:px-4 bg-transparent outline-none w-full font-medium text-foreground placeholder:text-muted-foreground/50"
                    placeholder="Вставьте ссылку..."
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && link) handleAnalyzeLink(link);
                    }}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData("text");
                      setTimeout(() => handleAnalyzeLink(text), 100);
                    }}
                  />
                  <Button 
                    className="rounded-[1rem] sm:rounded-[1.2rem] bg-foreground text-background shadow-md mr-0.5 sm:mr-1 w-10 h-10 sm:w-11 sm:h-11 flex-shrink-0 flex items-center justify-center p-0 min-w-0 hover:bg-foreground/90 transition-all hover:-translate-y-0.5"
                    isPending={isAnalyzing}
                    onPress={() => handleAnalyzeLink(link)}
                  >
                    <ArrowRightIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-center w-full">
              <button
                type="button"
                data-testid="flux-open-catalog-btn"
                onClick={() => navigateTo('network')}
                className="group inline-flex items-center gap-2 px-6 py-3 rounded-full bg-card text-foreground border border-border/80 hover:border-purple-500/50 shadow-md text-xs sm:text-sm font-black transition-all hover:scale-105 active:scale-95 cursor-pointer transform-gpu"
              >
                <span>Или выберите платформу из каталога</span>
                <ArrowRightIcon className="w-4 h-4 text-purple-500 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 1: NETWORK SELECTION */}
        {step === 'network' && (
          <motion.div
            key="step-network"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="w-full transform-gpu"
          >
            <div className="mb-6 w-full">
              <h2 className="text-2xl font-bold text-foreground mb-6 tracking-tight">Выберите соцсеть</h2>
              
              <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 w-full"
              >
                {(initialCatalog || []).map((network: FluxNetwork) => (
                  <motion.button
                    variants={itemVariants}
                    key={network.id}
                    onClick={() => {
                      setDetectedType(null);
                      setSuggestedCategories([]);
                      setActiveNetwork(network);
                      navigateTo('category');
                    }}
                    className="flex flex-col items-center justify-center gap-2 sm:gap-3 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-white/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-md hover:shadow-xl hover:border-primary/50 transition-all duration-150 outline-none cursor-pointer transform-gpu hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <img 
                      src={network.icon || undefined} 
                      alt={network.name} 
                      className="w-8 h-8 sm:w-10 sm:h-10 object-contain pointer-events-none" 
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm">{network.name}</span>
                  </motion.button>
                ))}
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* STEP 2: CATEGORY SELECTION */}
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
              className="w-full transform-gpu"
            >
              <div className="mb-6 w-full">
                <div className="flex items-center gap-3 mb-6">
                  <img 
                    src={activeNetwork.icon || undefined} 
                    alt={activeNetwork.name} 
                    className="w-8 h-8 object-contain" 
                    loading="lazy"
                    decoding="async"
                  />
                  <h2 className="text-2xl font-bold text-foreground tracking-tight">Выберите категорию</h2>
                </div>
              </div>

              <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5"
              >
                {displayCategories.map((cat: FluxCategory) => (
                  <motion.div 
                    key={cat.id}
                    role="button"
                    tabIndex={0}
                    variants={itemVariants}
                    onClick={() => selectCategory(cat)}
                    onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectCategory(cat); } }}
                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] border border-white/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-md hover:shadow-xl hover:border-primary/50 transition-all duration-150 flex items-center justify-between group transform-gpu hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <CategoryIcon name={cat.name} icon={cat.icon} size={18} />
                      </div>
                      <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-base sm:text-lg truncate">{cleanCategoryName(cat.name)}</h4>
                    </div>
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/5 group-hover:bg-primary flex items-center justify-center transition-colors shrink-0">
                      <ArrowRightIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary group-hover:text-primary-foreground" />
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          );
        })()}

        {/* STEP 3: SERVICE SELECTION */}
        {step === 'service' && activeCategory && (
          <motion.div
            key="step-service"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="w-full transform-gpu"
          >
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">{activeCategory.name}</h2>
            </div>

            {isLoadingServices ? (
              <div className="py-20 flex justify-center">
                <Box className="w-12 h-12 text-primary/50 animate-pulse" />
              </div>
            ) : (
              <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-5"
              >
                {services.map((service) => (
                  <motion.div 
                    key={service.id}
                    role="button"
                    tabIndex={0}
                    variants={itemVariants}
                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-[1.5rem] sm:rounded-[2rem] border border-white/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-md hover:shadow-xl hover:border-primary/50 transition-all duration-150 flex flex-col justify-between group relative min-h-[140px] sm:min-h-[160px] transform-gpu hover:scale-[1.01] active:scale-[0.99]"
                    onClick={() => selectService(service)}
                    onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectService(service); } }}
                  >
                    <div className="p-5 pb-14 sm:p-6 sm:pb-16">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <h4 className="font-bold text-foreground text-lg sm:text-xl leading-snug">{service.name}</h4>
                      </div>
                      
                      <div className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2">
                        <p className="text-[12px] sm:text-[13px] text-muted-foreground flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> 
                          Старт: <span className="font-medium text-foreground">{service.speed || 'Моментально'}</span>
                        </p>
                        <p className="text-[12px] sm:text-[13px] text-muted-foreground flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> 
                          Лимиты: <span className="font-medium text-foreground tabular-nums font-mono">{service.minQty} - {service.maxQty} шт.</span>
                        </p>
                      </div>
                    </div>
                    
                    <div className="absolute bottom-4 left-4 sm:bottom-5 sm:left-5 bg-foreground text-background px-3 py-1.5 sm:px-4 sm:py-2 rounded-full font-bold text-[13px] sm:text-[14px] shadow-sm pointer-events-none tabular-nums font-mono">
                      {service.pricePerUnitRub.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ₽ <span className="font-normal opacity-80 font-sans">/ шт</span>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* STEP 4: CHECKOUT NATIVE WIZARD */}
        {step === 'checkout' && selectedService && (
          <motion.div
            key="step-checkout"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="w-full max-w-2xl transform-gpu"
          >
            <div 
              className="bg-card border border-border/80 shadow-xl rounded-[2rem] sm:rounded-[2.5rem] p-4 sm:p-5 md:p-6 w-full mx-auto overflow-hidden relative transform-gpu"
            >
              <div className="mb-4 sm:mb-5 flex justify-between items-start gap-3 sm:gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-tight tracking-tight">{selectedService.name}</h2>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className="text-primary font-black text-lg sm:text-xl tabular-nums font-mono">{selectedService.pricePerUnitRub.toFixed(2)} ₽</span>
                  <span className="text-muted-foreground font-medium text-[10px] sm:text-xs block">за 1 шт.</span>
                </div>
              </div>

              {/* Плавное появление деталей услуги */}
              <div className="animate-in fade-in duration-200">
                {selectedService.description && (
                  <div className="mb-4 sm:mb-5 p-3 sm:p-4 rounded-[1.25rem] sm:rounded-2xl bg-muted/70 border border-border/50 text-[13px] sm:text-sm text-foreground leading-relaxed whitespace-pre-wrap shadow-inner max-h-[30vh] overflow-y-auto">
                    {selectedService.description}
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-5">
                  <div className="p-2.5 sm:p-3 rounded-[1.25rem] sm:rounded-2xl bg-muted/40 shadow-sm border border-border/40">
                    <p className="text-[10px] sm:text-xs text-muted-foreground mb-1 uppercase tracking-wide font-semibold">Мин. заказ</p>
                    <p className="font-bold text-base sm:text-lg">{selectedService.minQty}</p>
                  </div>
                  <div className="p-2.5 sm:p-3 rounded-[1.25rem] sm:rounded-2xl bg-muted/40 shadow-sm border border-border/40">
                    <p className="text-[10px] sm:text-xs text-muted-foreground mb-1 uppercase tracking-wide font-semibold">Макс. заказ</p>
                    <p className="font-bold text-base sm:text-lg">{selectedService.maxQty}</p>
                  </div>
                  <div className="p-2.5 sm:p-3 rounded-[1.25rem] sm:rounded-2xl bg-muted/40 shadow-sm border border-border/40 col-span-2 sm:col-span-1 flex flex-col justify-center">
                    <p className="text-[10px] sm:text-xs text-muted-foreground mb-1 uppercase tracking-wide font-semibold">Скорость / ETA</p>
                    <p className="font-bold text-primary text-xs sm:text-sm">{formatEtaSpeedBadge(selectedService)}</p>
                  </div>
                </div>
              </div>

              <hr className="border-border/10 mb-4 sm:mb-5" />

              {/* Плавное появление формы */}
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                <form action={formAction} noValidate>
                  {/* 1. Количество */}
                <div id="field-quantity" className="mb-3">
                  <label className="block text-xs font-bold text-foreground/80 uppercase tracking-wider mb-1 ml-1">Количество</label>
                  <input
                    ref={quantityRef}
                    name="quantity"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ''))}
                    onFocus={(e) => {
                      const target = e.currentTarget;
                      setTimeout(() => target.select(), 10);
                    }}
                    onClick={(e) => {
                      const target = e.currentTarget;
                      setTimeout(() => target.select(), 10);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (!link) {
                           linkRef.current?.focus();
                        } else {
                           emailRef.current?.focus();
                        }
                      }
                    }}
                    className={`w-full bg-background backdrop-blur-md text-foreground placeholder:text-muted-foreground px-3 py-2.5 sm:px-4 sm:py-3 rounded-[1.25rem] sm:rounded-[1.5rem] border border-border/80 ${formState.field === 'quantity' ? '!border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-shake' : 'focus:ring-4 focus:ring-primary/10 focus:border-primary/40'} transition-all duration-300 text-base sm:text-lg font-bold outline-none shadow-sm`}
                    placeholder={`${selectedService.minQty || 100} — ${selectedService.maxQty || 10000}`}
                  />
                  <AnimatePresence mode="popLayout">
                    {formState.error && formState.field === "quantity" && (
                      <motion.div 
                        key={`err-qty-${shakeKey}`} 
                        initial={{ opacity: 0, height: 0, marginTop: 0 }} 
                        animate={{ opacity: 1, height: "auto", marginTop: 8 }} 
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-bold shadow-sm overflow-hidden"
                      >
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span role="alert">{formState.error}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Custom Data Field */}
                {selectedService.customDataType && selectedService.customDataType !== 'NONE' && (
                  <div id="field-customData" className="mb-3">
                    <label className="block text-xs font-bold text-foreground/80 uppercase tracking-wider mb-1 ml-1">
                      {selectedService.customDataLabel || (selectedService.customDataType === 'TEXTAREA' ? 'Ваши комментарии / текст (по 1 строке)' : 'Вариант ответа / параметры')} <span className="text-red-500">*</span>
                    </label>
                    {selectedService.customDataType === 'TEXTAREA' ? (
                      <textarea
                        name="customData"
                        rows={3}
                        value={customData}
                        onChange={(e) => setCustomData(e.target.value)}
                        placeholder="Введите каждый комментарий с новой строки..."
                        className={`w-full bg-background backdrop-blur-md text-foreground placeholder:text-muted-foreground px-3 py-2.5 sm:px-4 sm:py-3 rounded-[1.25rem] sm:rounded-[1.5rem] border border-border/80 ${formState.field === 'customData' ? '!border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-shake' : 'focus:ring-4 focus:ring-primary/10 focus:border-primary/40'} transition-all duration-300 text-sm font-medium outline-none shadow-sm`}
                      />
                    ) : (
                      <input
                        name="customData"
                        type="text"
                        value={customData}
                        onChange={(e) => setCustomData(e.target.value)}
                        placeholder="Введите номер варианта ответа..."
                        className={`w-full bg-background backdrop-blur-md text-foreground placeholder:text-muted-foreground px-3 py-2.5 sm:px-4 sm:py-3 rounded-[1.25rem] sm:rounded-[1.5rem] border border-border/80 ${formState.field === 'customData' ? '!border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-shake' : 'focus:ring-4 focus:ring-primary/10 focus:border-primary/40'} transition-all duration-300 text-sm font-medium outline-none shadow-sm`}
                      />
                    )}
                    <AnimatePresence mode="popLayout">
                      {formState.error && formState.field === "customData" && (
                        <motion.div 
                          key={`err-customData-${shakeKey}`} 
                          initial={{ opacity: 0, height: 0, marginTop: 0 }} 
                          animate={{ opacity: 1, height: "auto", marginTop: 8 }} 
                          exit={{ opacity: 0, height: 0, marginTop: 0 }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-bold shadow-sm overflow-hidden"
                        >
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span role="alert">{formState.error}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Drip-Feed Controls */}
                {Boolean(selectedService.isDripFeedEnabled) && (
                  <div className="mb-3 p-3.5 rounded-[1.25rem] sm:rounded-[1.5rem] bg-muted/40 border border-border/60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <SparklesIcon className="w-4 h-4 text-primary" />
                        <span className="text-xs font-bold text-foreground uppercase tracking-wider">Запускать частями (Drip-Feed)</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={isDripFeedEnabled} 
                          onChange={(e) => setIsDripFeedEnabled(e.target.checked)} 
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-primary-foreground after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-card after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>

                    {isDripFeedEnabled && (
                      <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border/30">
                        <div>
                          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Количество запусков (runs)</label>
                          <input
                            type="number"
                            min={2}
                            max={100}
                            value={dripRuns}
                            onChange={(e) => setDripRuns(Math.max(2, parseInt(e.target.value) || 2))}
                            className="w-full bg-background text-foreground px-3 py-2 rounded-xl border border-border/80 text-sm font-bold outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Интервал (мин)</label>
                          <input
                            type="number"
                            min={5}
                            max={1440}
                            value={dripInterval}
                            onChange={(e) => setDripInterval(Math.max(1, parseInt(e.target.value) || 5))}
                            className="w-full bg-background text-foreground px-3 py-2 rounded-xl border border-border/80 text-sm font-bold outline-none"
                          />
                        </div>
                        <p className="col-span-2 text-[11px] text-muted-foreground">
                          Заказ выполнится за {dripRuns} запусков по {numericQuantity} шт. Всего: <strong className="text-foreground">{effectiveQuantity} шт.</strong>
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Ссылка */}
                <div id="field-link" className="mb-3 space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-1 px-1">
                    <label className="block text-xs font-bold text-foreground/80 uppercase tracking-wider">
                      Ссылка на {selectedService.targetType === 'CHANNEL' ? 'канал/профиль' : selectedService.targetType === 'POST' ? 'пост' : 'объект'}
                    </label>
                    {LinkGuideService.isTelegramViewsService(activeNetwork?.slug || 'telegram', activeCategory?.slug, selectedService.name) && (
                      <button
                        type="button"
                        onClick={() => setIsTgGuideOpen(true)}
                        className="text-[11px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1.5 cursor-pointer bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 min-h-[36px] rounded-full transition-all"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Как скопировать ссылку на фото?</span>
                      </button>
                    )}
                  </div>

                  <FluxCyberLinkDrawer
                    isOpen={isTgGuideOpen}
                    onClose={() => setIsTgGuideOpen(false)}
                    onApplyLink={l => setLink(l)}
                  />
                  <input 
                    ref={linkRef}
                    name="link"
                    type="text" 
                    inputMode="url"
                    placeholder="https://..."
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        emailRef.current?.focus();
                      }
                    }}
                    className={`w-full bg-background backdrop-blur-md text-foreground placeholder:text-muted-foreground px-3 py-2.5 sm:px-4 sm:py-3 rounded-[1.25rem] sm:rounded-[1.5rem] border border-border/80 ${formState.field === 'link' ? '!border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-shake' : 'focus:ring-4 focus:ring-primary/10 focus:border-primary/40'} transition-all duration-300 text-sm sm:text-base font-medium outline-none shadow-sm`}
                  />
                  <AnimatePresence mode="popLayout">
                    {formState.error && formState.field === "link" && (
                      <motion.div 
                        key={`err-link-${shakeKey}`} 
                        initial={{ opacity: 0, height: 0, marginTop: 0 }} 
                        animate={{ opacity: 1, height: "auto", marginTop: 8 }} 
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-bold shadow-sm overflow-hidden"
                      >
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span role="alert">{formState.error}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Telegram Album & MediaGroup Advice Tip (Radiant Aurora) */}
                  {LinkGuideService.isTelegramViewsService(activeNetwork?.slug || 'telegram', activeCategory?.slug, selectedService.name) && (
                    <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-xs text-foreground flex items-start gap-2.5 mt-2">
                      <SparklesIcon className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <div className="space-y-0.5 min-w-0">
                        <span className="font-bold text-purple-400 block text-[11px]">Совет для альбомов и медиагрупп:</span>
                        <p className="text-muted-foreground text-[10px] leading-relaxed">
                          {LinkGuideService.getTelegramAlbumAdvice(link)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Email */}
                <div id="field-email" className="mb-3">
                  <label className="block text-xs font-bold text-foreground/80 uppercase tracking-wider mb-1 ml-1">Email (для чека)</label>
                  <input 
                    ref={emailRef}
                    name="email"
                    type="email" 
                    placeholder="example@mail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full bg-background backdrop-blur-md text-foreground placeholder:text-muted-foreground px-3 py-2.5 sm:px-4 sm:py-3 rounded-[1.25rem] sm:rounded-[1.5rem] border border-border/80 ${formState.field === 'email' ? '!border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-shake' : 'focus:ring-4 focus:ring-primary/10 focus:border-primary/40'} transition-all duration-300 text-sm sm:text-base font-medium outline-none shadow-sm`}
                  />
                  <AnimatePresence mode="popLayout">
                    {formState.error && formState.field === "email" && (
                      <motion.div 
                        key={`err-email-${shakeKey}`} 
                        initial={{ opacity: 0, height: 0, marginTop: 0 }} 
                        animate={{ opacity: 1, height: "auto", marginTop: 8 }} 
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-bold shadow-sm overflow-hidden"
                      >
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span role="alert">{formState.error}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Чек-лист для старта (JIT Validation) */}
                {(selectedService.clientRequirement || selectedService.clientConfirmation || selectedService.requireWarning) && (
                  <div id="field-requirement" className={`mb-4 p-3 rounded-[1.25rem] sm:rounded-[1.5rem] border transition-all duration-300 ${isRequirementsConfirmed ? 'bg-green-50/50 border-green-200' : (showShakeError || formState.field === 'requirement') ? 'bg-red-50 border-red-300 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-shake' : 'bg-amber-50/30 border-amber-200/50'}`}>
                    <h4 className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider mb-1 text-foreground flex items-center gap-2">
                      <SparklesIcon className="w-4 h-4 text-amber-500" />
                      Чек-лист для старта
                    </h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      {selectedService.clientRequirement || selectedService.warningMessage || "Перед оформлением убедитесь, что объект продвижения доступен."}
                    </p>
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center mt-0.5">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={isRequirementsConfirmed}
                          onChange={(e) => setIsRequirementsConfirmed(e.target.checked)}
                        />
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isRequirementsConfirmed ? 'bg-green-500 border-green-500 text-foreground' : showShakeError ? 'border-red-500 bg-red-50' : 'border-muted-foreground/30 bg-background group-hover:border-primary/50'}`}>
                          <svg className={`w-3.5 h-3.5 pointer-events-none transition-transform duration-200 ${isRequirementsConfirmed ? 'scale-100' : 'scale-0'}`} viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 5L5 9L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>
                      <span className={`text-sm font-medium transition-colors ${isRequirementsConfirmed ? 'text-green-700' : showShakeError ? 'text-red-600' : 'text-foreground'}`}>
                        {selectedService.clientConfirmation || "Я всё проверил, можно запускать"}
                      </span>
                    </label>
                  </div>
                )}

                {/* 4. Способ оплаты (Dynamic Radiant Aurora Gateway Selector) */}
                {(() => {
                  const totalCents = Math.round(parseFloat(price || "0") * 100);
                  const hasBalance = userBalanceCents !== undefined && userBalanceCents > 0;
                  const isBalanceSufficient = hasBalance && userBalanceCents >= totalCents;

                  const methods = [
                    ...(hasBalance ? [{
                      id: "balance",
                      name: "Личный баланс",
                      desc: isBalanceSufficient
                        ? `Доступно: ${(userBalanceCents / 100).toFixed(2)} ₽`
                        : `Недостаточно: ${(userBalanceCents / 100).toFixed(2)} ₽ (нужно ${price} ₽)`,
                      icon: Wallet,
                      gradient: "from-emerald-500/15 via-teal-500/10 to-transparent",
                      borderActive: "border-emerald-500 ring-2 ring-emerald-500/30",
                      iconColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                      disabled: !isBalanceSufficient
                    }] : []),
                    {
                      id: "yookassa",
                      name: "Карты РФ и СБП",
                      desc: "Мгновенное зачисление, 0% комиссии",
                      icon: CreditCard,
                      gradient: "from-purple-500/15 via-fuchsia-500/10 to-transparent",
                      borderActive: "border-purple-500 ring-2 ring-purple-500/30",
                      iconColor: "text-purple-400 bg-purple-500/10 border-purple-500/20",
                      disabled: false
                    },
                    {
                      id: "robokassa",
                      name: "Зарубежные карты и кошельки",
                      desc: "Карты СНГ и международные платежи",
                      icon: Coins,
                      gradient: "from-blue-500/15 via-cyan-500/10 to-transparent",
                      borderActive: "border-blue-500 ring-2 ring-blue-500/30",
                      iconColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
                      disabled: false
                    },
                    {
                      id: "cryptobot",
                      name: "Криптовалюта (CryptoBot)",
                      desc: "USDT, TON, BTC, ETH. Анонимно",
                      icon: Wallet,
                      gradient: "from-amber-500/15 via-orange-500/10 to-transparent",
                      borderActive: "border-amber-500 ring-2 ring-amber-500/30",
                      iconColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
                      disabled: false
                    }
                  ];

                  const activeMethods = methods.filter((m) => {
                    if (m.id === "balance") return true;
                    if (!availableGateways) return m.id === "yookassa";
                    return availableGateways[m.id as keyof typeof availableGateways] === true;
                  });

                  if (activeMethods.length === 0) {
                    return (
                      <div className="w-full mb-4 p-3.5 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-center">
                        <p className="text-xs text-amber-500 font-bold">
                          ⚠️ Платежные шлюзы временно на техническом обслуживании.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="w-full mb-4 space-y-2">
                      <label className="block text-xs font-bold text-foreground/80 uppercase tracking-wider ml-1">
                        Способ оплаты
                      </label>
                      <div className="grid grid-cols-1 gap-2">
                        {activeMethods.map((m) => {
                          const isSelected = selectedGateway === m.id;
                          const IconComponent = m.icon;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                if (m.disabled) return;
                                setSelectedGateway(m.id);
                              }}
                              className={`w-full min-h-[52px] p-3 rounded-2xl border text-left flex items-center gap-3 transition-all duration-200 ${
                                m.disabled
                                  ? "opacity-50 cursor-not-allowed border-border/40 bg-background/20"
                                  : isSelected
                                  ? `${m.borderActive} bg-gradient-to-r ${m.gradient} bg-background/80 shadow-md cursor-pointer active:scale-[0.99]`
                                  : "border-border/60 bg-background/40 hover:border-border hover:bg-background/60 cursor-pointer active:scale-[0.99]"
                              }`}
                            >
                              <div className={`p-2 rounded-xl shrink-0 border ${m.iconColor}`}>
                                <IconComponent className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-foreground leading-tight">
                                  {m.name}
                                </p>
                                <p className="text-[11px] text-muted-foreground font-medium mt-0.5 truncate">
                                  {m.desc}
                                </p>
                              </div>
                              {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Оплата */}
                <div className="flex flex-col items-center mt-4">
                  <AnimatePresence mode="popLayout">
                    {formState.error && formState.field === "general" && (
                      <motion.div 
                        key={`err-gen-${shakeKey}`} 
                        initial={{ opacity: 0, height: 0, marginBottom: 0 }} 
                        animate={{ opacity: 1, height: "auto", marginBottom: 24 }} 
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        className="w-full p-4 bg-red-50 border border-red-200 rounded-[1.5rem] flex items-center gap-3 shadow-[0_0_15px_rgba(239,68,68,0.2)] overflow-hidden"
                      >
                        <div className="bg-red-100 p-2 rounded-full text-red-600 flex-shrink-0">
                          <AlertCircle className="w-5 h-5" />
                        </div>
                        <span role="alert" className="text-red-700 font-bold text-sm">
                          {formState.error}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="w-full flex items-center justify-between mb-4 px-2">
                    <span className="text-muted-foreground font-semibold">К оплате:</span>
                    <div className="flex items-baseline gap-1.5 tabular-nums font-mono">
                      <span className="text-2xl font-black text-foreground tracking-tight">
                        {parseFloat(price) < 10 ? "10.00" : price}
                      </span>
                      <span className="text-lg font-bold text-muted-foreground font-sans">₽</span>
                    </div>
                  </div>
                  
                  {parseFloat(price) < 10 && parseFloat(price) > 0 && (
                     <div className="w-full mb-4 p-3 bg-amber-500/10 rounded-[1.5rem] border border-amber-500/20">
                       <p className="text-xs text-amber-600 dark:text-amber-400 font-medium text-center">
                         Минимальное пополнение — 10 ₽. Остаток зачислится на баланс.
                       </p>
                     </div>
                  )}

                  <Button
                    id="form-submit-btn"
                    type="submit"
                    isPending={isPending}
                    className="w-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-full text-primary-foreground font-black text-lg h-14 shadow-[0_8px_30px_rgba(168,85,247,0.35)] hover:shadow-[0_12px_40px_rgba(236,72,153,0.45)] hover:scale-[1.02] active:scale-95 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer border-0"
                  >
                    Оплатить заказ
                  </Button>
                  
                  {/* 152-ФЗ Implicit Consent */}
                  <div className="mt-4 text-center">
                  <p className="text-[10px] text-muted-foreground">
                    Нажимая кнопку, вы соглашаетесь с <a href="/legal/privacy" className="underline hover:text-foreground transition-colors" target="_blank">Политикой конфиденциальности</a> и <a href="/legal/terms" className="underline hover:text-foreground transition-colors" target="_blank">Публичной офертой</a>
                  </p>
                  </div>
                </div>
              </form>
              </motion.div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      <CheckoutAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        email={authModalEmail || email}
        onAuthSuccess={async () => {
          setShowAuthModal(false);
          try {
            const { refreshBalanceAction } = await import('@/actions/auth/refresh-balance');
            await refreshBalanceAction();
          } catch {}
          toast.success("Вы успешно вошли в аккаунт!", {
            description: "Теперь вы можете завершить оформление заказа."
          });
        }}
        orderSnapshot={{
          serviceId: selectedService?.id,
          link: link,
          quantity: typeof quantity === 'number' ? quantity : parseInt(quantity) || 100,
          runs: isDripFeedEnabled ? dripRuns : undefined,
          interval: isDripFeedEnabled ? dripInterval : undefined,
          customData: customData || undefined,
        }}
      />
    </div>
  );
}

