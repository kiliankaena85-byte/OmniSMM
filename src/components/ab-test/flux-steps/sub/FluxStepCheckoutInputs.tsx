import React from "react";
import { SparklesIcon, HelpCircle, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LinkGuideService } from "@/services/catalog/link-guide.service";
import { FluxCyberLinkDrawer } from "@/components/orders/flux/FluxCyberLinkDrawer";
import type { FluxService, FluxNetwork, FluxCategory } from "@/types/flux";

interface FluxStepCheckoutInputsProps {
  selectedService: FluxService;
  activeNetwork: FluxNetwork | null;
  activeCategory: FluxCategory | null;
  quantity: number | string;
  setQuantity: (val: number | string) => void;
  link: string;
  setLink: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  isRequirementsConfirmed: boolean;
  setIsRequirementsConfirmed: (val: boolean) => void;
  isTgGuideOpen: boolean;
  setIsTgGuideOpen: (val: boolean) => void;
  formState: { error?: string; field?: string };
  showShakeError: boolean;
  shakeKey: number;
  quantityRef: React.RefObject<HTMLInputElement | null>;
  emailRef: React.RefObject<HTMLInputElement | null>;
  linkRef: React.RefObject<HTMLInputElement | null>;
}

export function FluxStepCheckoutInputs({
  selectedService,
  activeNetwork,
  activeCategory,
  quantity,
  setQuantity,
  link,
  setLink,
  email,
  setEmail,
  isRequirementsConfirmed,
  setIsRequirementsConfirmed,
  isTgGuideOpen,
  setIsTgGuideOpen,
  formState,
  showShakeError,
  shakeKey,
  quantityRef,
  emailRef,
  linkRef,
}: FluxStepCheckoutInputsProps) {
  return (
    <>
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
            if (typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches) {
              e.currentTarget.select();
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
              className="text-[11px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1.5 cursor-pointer bg-purple-500/10 border border-purple-500/20 px-3 py-2 min-h-[44px] rounded-full transition-all"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Как скопировать ссылку?</span>
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
          className={`w-full bg-background backdrop-blur-md text-foreground placeholder:text-muted-foreground px-3 py-2.5 sm:px-4 sm:py-3 rounded-[1.25rem] sm:rounded-[1.5rem] border border-border/80 ${formState.field === 'link' ? '!border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-shake' : 'focus:ring-4 focus:ring-primary/10 focus:border-primary/40'} transition-all duration-300 text-base sm:text-base font-medium outline-none shadow-sm`}
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
          className={`w-full bg-background backdrop-blur-md text-foreground placeholder:text-muted-foreground px-3 py-2.5 sm:px-4 sm:py-3 rounded-[1.25rem] sm:rounded-[1.5rem] border border-border/80 ${formState.field === 'email' ? '!border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-shake' : 'focus:ring-4 focus:ring-primary/10 focus:border-primary/40'} transition-all duration-300 text-base sm:text-base font-medium outline-none shadow-sm`}
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

      {/* Чек-лист для старта */}
      {(selectedService.clientRequirement || selectedService.clientConfirmation || selectedService.requireWarning) && (
        <div id="field-requirement" className={`mb-4 p-3 rounded-[1.25rem] sm:rounded-[1.5rem] border transition-all duration-300 ${isRequirementsConfirmed ? 'bg-green-50/50 border-green-200' : (showShakeError || formState.field === 'requirement') ? 'bg-red-50 border-red-300 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-shake' : 'bg-amber-50/30 border-amber-200/50'}`}>
          <h4 className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider mb-1 text-foreground flex items-center gap-2">
            <SparklesIcon className="w-4 h-4 text-amber-500" />
            Чек-лист для старта
          </h4>
          <p className="text-sm text-muted-foreground mb-4">
            {selectedService.clientRequirement || selectedService.warningMessage || "Перед оформлением убедитесь, что объект продвижения доступен."}
          </p>
          <label className="flex items-center gap-3 cursor-pointer group min-h-[44px] py-1">
            <div className="relative flex items-center justify-center shrink-0">
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
            <span className={`text-sm font-medium transition-colors select-none ${isRequirementsConfirmed ? 'text-green-700' : showShakeError ? 'text-red-600' : 'text-foreground'}`}>
              {selectedService.clientConfirmation || "Я всё проверил, можно запускать"}
            </span>
          </label>
        </div>
      )}
    </>
  );
}
