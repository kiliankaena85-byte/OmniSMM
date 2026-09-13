'use client';

import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ArrowLeft, ArrowRight, CheckCircle2, Loader2, ShieldCheck, Mail, Edit3 } from "lucide-react";
import { CheckoutVariantProps } from "./types";
import { DrawerOrderSummary } from "../drawer/DrawerOrderSummary";
import { DrawerQuantityCard } from "../drawer/DrawerQuantityCard";
import { DrawerFormInputs } from "../drawer/DrawerFormInputs";
import { DrawerPaymentSelector } from "../drawer/DrawerPaymentSelector";
import { DripFeedConfigurator } from "../DripFeedConfigurator";
import { LegalCheckbox } from "../LegalCheckbox";
import { EmailPromptModal } from "../modals/EmailPromptModal";
import { toast } from "sonner";

export function StepWizardCheckout({
  selectedService,
  url,
  setShowLinkModal,
  quantity,
  setQuantity,
  pricing,
  email,
  setEmail,
  promoCode,
  setPromoCode,
  isCalculating,
  isSubmitting,
  handleCheckout,
  onClose,
  emailInputRef,
  emailHasError,
  termsHasError,
  engine,
  onOpenDocument,
  userBalanceCents
}: CheckoutVariantProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [gateway, setGateway] = useState<"yookassa" | "cryptobot" | "balance">("yookassa");
  const [isMobile, setIsMobile] = useState(false);
  const [isEmailPromptOpen, setIsEmailPromptOpen] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Reset to step 1 when new service is selected
  useEffect(() => {
    setStep(1);
  }, [selectedService?.id]);

  const formattedTotal = React.useMemo(() => {
    if (!pricing) return "0.00";
    return (pricing.totalCents / 100).toFixed(2);
  }, [pricing]);

  const getButtonText = () => {
    if (isSubmitting) return "Секунду...";
    if (gateway === "cryptobot") return "Оплатить CryptoBot";
    if (gateway === "balance") return "Оплатить балансом";
    return "Оплатить картой РФ / СБП";
  };

  const steps = [
    { num: 1, title: "Количество", desc: "Объем заказа" },
    { num: 2, title: "Данные", desc: "Ссылка и Email" },
    { num: 3, title: "Оплата", desc: "Шлюз и оплата" },
  ];

  return (
    <AnimatePresence>
      {selectedService && (
        <div className="hidden md:flex fixed inset-0 z-[200] items-end sm:items-center justify-center p-0 sm:p-5 overflow-hidden">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/70 backdrop-blur-md cursor-pointer"
          />

          {/* Wizard: Mobile Slide-up Bottom Sheet (92vh) + Desktop Centered Modal */}
          <motion.div
            drag={isMobile ? "y" : false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) {
                onClose();
              }
            }}
            initial={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.96, y: 15 }}
            animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
            exit={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.96, y: 15 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="relative w-full sm:max-w-2xl bg-card border-t sm:border border-border shadow-2xl rounded-t-[32px] sm:rounded-3xl overflow-hidden flex flex-col max-h-[92vh] h-[92vh] sm:h-auto z-10"
          >
            {/* Mobile Drag Handle Pill */}
            <div className="pt-2.5 pb-1 flex justify-center sm:hidden shrink-0 cursor-grab active:cursor-grabbing">
              <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Top Wizard Header */}
            <div className="px-4 sm:px-5 py-2.5 sm:py-3 border-b border-border/80 bg-muted/20 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
                  ID {selectedService.numericId}
                </span>
                <span className="text-xs sm:text-sm font-black text-foreground truncate max-w-[240px] sm:max-w-[420px] min-w-0">
                  {selectedService.name}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-content2 hover:bg-content3 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer shrink-0"
                title="Закрыть"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stepper Progress Indicator */}
            <div className="grid grid-cols-3 border-b border-border/60 bg-muted/10 shrink-0">
              {steps.map((s) => {
                const isActive = step === s.num;
                const isPassed = step > s.num;
                return (
                  <button
                    key={s.num}
                    type="button"
                    onClick={() => {
                      if (isPassed || (s.num === 2 && quantity > 0) || (s.num === 3 && quantity > 0 && url)) {
                        setStep(s.num as 1 | 2 | 3);
                      }
                    }}
                    className={`py-2.5 px-2 sm:px-4 text-left transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                      isActive
                        ? "border-primary bg-primary/5 text-primary"
                        : isPassed
                        ? "border-emerald-500/60 text-foreground hover:bg-muted/40"
                        : "border-transparent text-muted-foreground/60 hover:text-muted-foreground"
                    }`}
                  >
                    <div className={`w-5.5 h-5.5 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : isPassed
                        ? "bg-emerald-500 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {isPassed ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.num}
                    </div>
                    <div className="hidden sm:block min-w-0">
                      <p className={`text-xs font-black leading-tight truncate ${isActive ? "text-primary" : "text-foreground"}`}>
                        {s.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-none mt-0.5 truncate">
                        {s.desc}
                      </p>
                    </div>
                    <span className="sm:hidden text-[11px] font-bold text-foreground truncate">
                      {s.title}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Wizard Dynamic Content Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 scrollbar-thin">
              {/* STEP 1: QUANTITY */}
              {step === 1 && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-3"
                >
                  <DrawerOrderSummary
                    selectedService={selectedService}
                    url={url}
                    setShowLinkModal={setShowLinkModal}
                    engine={engine}
                  />

                  <DrawerQuantityCard
                    selectedService={selectedService}
                    quantity={quantity}
                    setQuantity={setQuantity}
                    pricing={pricing}
                    engine={engine}
                  />

                  <DripFeedConfigurator engine={engine} />
                </motion.div>
              )}

              {/* STEP 2: LINK & EMAIL */}
              {step === 2 && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-3"
                >
                  <DrawerOrderSummary
                    selectedService={selectedService}
                    url={url}
                    setShowLinkModal={setShowLinkModal}
                    engine={engine}
                  />

                  <DrawerFormInputs
                    email={email}
                    setEmail={setEmail}
                    promoCode={promoCode}
                    setPromoCode={setPromoCode}
                    emailInputRef={emailInputRef}
                    emailHasError={emailHasError}
                    engine={engine}
                  />
                </motion.div>
              )}

              {/* STEP 3: PAYMENT GATEWAY */}
              {step === 3 && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-3"
                >
                  <DrawerPaymentSelector
                    gateway={gateway}
                    setGateway={setGateway}
                    userBalanceCents={userBalanceCents}
                    totalCents={pricing?.totalCents || 0}
                  />

                  {/* Step 3: Explicit Email Input Card (54-FZ Compliant) */}
                  <div className="p-3.5 rounded-2xl bg-card border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-primary" />
                        <span>Email для отслеживания</span>
                        <span className="text-destructive">*</span>
                      </label>
                      {email && email.includes('@') && !isEditingEmail ? (
                        <button
                          type="button"
                          onClick={() => setIsEditingEmail(true)}
                          className="text-[11px] text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" /> Изменить
                        </button>
                      ) : null}
                    </div>

                    {(!email || isEditingEmail) ? (
                      <motion.div
                        animate={emailHasError ? { x: [0, -6, 6, -6, 6, 0] } : {}}
                        transition={{ duration: 0.4 }}
                        className="relative"
                      >
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                          }}
                          onBlur={() => {
                            if (email && email.includes('@')) {
                              setIsEditingEmail(false);
                            }
                          }}
                          placeholder="name@example.com"
                          className={`w-full h-11 px-3.5 rounded-xl border bg-background text-sm font-bold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all ${
                            emailHasError && (!email || !email.includes('@'))
                              ? "border-destructive ring-2 ring-destructive/20 bg-destructive/5"
                              : "border-border/80"
                          }`}
                        />
                      </motion.div>
                    ) : (
                      <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border/80">
                        <span className="text-sm font-bold text-foreground font-mono truncate min-w-0">{email}</span>
                        <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1 shrink-0 ml-2">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Указан
                        </span>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Статус заказа и детали выполнения будут отправлены на эту почту.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-medium">Услуга:</span>
                      <span className="font-bold text-foreground truncate max-w-[240px] sm:max-w-[280px] min-w-0">{selectedService.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-medium">Количество:</span>
                      <span className="font-bold text-foreground font-mono">{quantity.toLocaleString("ru-RU")} шт</span>
                    </div>
                    {url && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-medium">Цель:</span>
                        <span className="font-mono text-primary truncate max-w-[220px] sm:max-w-[260px] min-w-0">{url}</span>
                      </div>
                    )}
                  </div>

                  <motion.div
                    animate={termsHasError ? { x: [0, -6, 6, -6, 6, 0] } : {}}
                    transition={{ duration: 0.4 }}
                    className={`w-full rounded-xl transition-all ${
                      termsHasError ? "ring-2 ring-destructive/40 bg-destructive/5 border border-destructive/20 p-2" : ""
                    }`}
                  >
                    <LegalCheckbox
                      id="wizard-legal-checkbox"
                      checked={engine?.agreedToTerms ?? false}
                      onChange={(val) => {
                        engine?.setAgreedToTerms(val);
                        if (val && engine?.setTermsHasError) engine.setTermsHasError(false);
                      }}
                      hasError={termsHasError || engine?.termsHasError}
                      className="w-full text-[10px] font-bold text-muted-foreground justify-start"
                      onOpenDocument={onOpenDocument}
                    />
                  </motion.div>
                </motion.div>
              )}
            </div>

            {/* Wizard Navigation Footer (Sticky with Safe Area padding on mobile) */}
            <div className="border-t border-border/80 bg-muted/10 px-4 sm:px-5 pt-3 pb-6 sm:pb-3.5 shrink-0 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">
                  Итого к оплате
                </span>
                <p className="text-xl sm:text-2xl font-black text-foreground tabular-nums font-mono">
                  {formattedTotal} <span className="text-primary text-lg sm:text-xl">₽</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
                    className="min-h-[44px] h-11 px-3 sm:px-4 rounded-xl bg-content2 hover:bg-content3 border border-border text-foreground font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
                  >
                    <ArrowLeft className="w-4 h-4 shrink-0" />
                    <span className="hidden xs:inline">Назад</span>
                  </button>
                )}

                {step < 3 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (step === 2 && (!url || url.trim().length < 3)) {
                        toast.error("Пожалуйста, укажите ссылку для продолжения", { position: "top-center" });
                        return;
                      }
                      setStep((s) => (s + 1) as 1 | 2 | 3);
                    }}
                    className="min-h-[44px] h-11 px-4 sm:px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
                  >
                    <span>Далее: {steps[step].title}</span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = email?.trim();
                      if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
                        setIsEmailPromptOpen(true);
                        return;
                      }
                      handleCheckout(gateway);
                    }}
                    disabled={isSubmitting || isCalculating}
                    className="min-h-[44px] h-11 px-4 sm:px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <ShieldCheck className="w-4.5 h-4.5" />
                        <span>{getButtonText()}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Email Prompt Modal Fallback */}
            <EmailPromptModal
              isOpen={isEmailPromptOpen}
              onClose={() => setIsEmailPromptOpen(false)}
              onConfirm={(confirmedEmail) => {
                setEmail(confirmedEmail);
                setIsEmailPromptOpen(false);
                handleCheckout(gateway, confirmedEmail);
              }}
              initialEmail={email}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
