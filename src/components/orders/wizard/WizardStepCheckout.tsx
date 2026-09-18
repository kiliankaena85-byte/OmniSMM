'use client';
import React from 'react';
import { Loader2, AlertTriangle, Link as LinkIcon, HelpCircle, Info, Sparkles, Hash, Zap, ShieldCheck } from 'lucide-react';
import { SocialIcon } from '@/components/ui/SocialIcon';
import { formatEtaSpeedBadge } from '@/utils/format-eta';
import { formatPricePerUnit, formatRubles } from '@/utils/format-price';
import { checkServiceRefill } from '@/utils/service-refill';
import { LinkGuideService } from '@/services/catalog/link-guide.service';
import { TelegramLinkGuideModal } from '@/components/orders/TelegramLinkGuideModal';
import { WizardStepCheckoutProps } from './types';
import { getTargetTypeHint } from './helpers';
import { CheckoutDripFeed } from './sub/CheckoutDripFeed';
import { CheckoutPaymentMethod } from './sub/CheckoutPaymentMethod';
import { CheckoutPromoCode } from './sub/CheckoutPromoCode';
import { clampOrderQuantity } from '@/hooks/useBaseOrderValidation';

export function WizardStepCheckout(props: WizardStepCheckoutProps) {
  const {
    selectedNetwork, selectedCategory, selectedService, isLoadingServices, formRef, errorRef,
    shakeKey, errors, link, setLink, handleBlurLink, isTgGuideOpen, setIsTgGuideOpen, customData, setCustomData,
    isDripFeedEnabled, setIsDripFeedEnabled, dripRuns, setDripRuns, dripInterval, setDripInterval,
    isRequirementsConfirmed, setIsRequirementsConfirmed, quantity, setQuantity, addQuantity, totalQuantity,
    email, setEmail, showPromo, setShowPromo, promoCodeInput, setPromoCodeInput, appliedPromo, promoMessage,
    isApplyingPromo, handleApplyPromo, handleRemovePromo, gateway, setGateway, userBalanceCents,
    availableGateways, isCalculatingPrice, calculatedPriceRub, dripFloorWarning, isSubmitting, onBackToServices, onSubmit, setErrors
  } = props;

  if (!selectedService || isLoadingServices) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground bg-card/70 backdrop-blur-xl p-8 rounded-3xl border border-border/60">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm font-medium">Загружаем тариф и форму заказа...</span>
      </div>
    );
  }

  const { hasRefill } = checkServiceRefill(selectedService);
  const hint = getTargetTypeHint(selectedCategory?.name, selectedService.targetType);
  const isTgViews = LinkGuideService.isTelegramViewsService(selectedNetwork?.slug, selectedCategory?.slug, selectedService.name);

  return (
    <form ref={formRef} onSubmit={onSubmit} key={'shake-' + shakeKey} className={`bg-card/70 backdrop-blur-xl p-6 md:p-8 rounded-3xl border border-border/60 shadow-md space-y-6 animate-in fade-in duration-300 ${shakeKey > 0 ? 'animate-shake' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted/40 rounded-2xl border border-border/50">
        <div className="flex items-center gap-3 min-w-0">
          {selectedNetwork && <SocialIcon slug={selectedNetwork.slug || selectedNetwork.name} className="w-8 h-8 shrink-0" />}
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-muted-foreground block truncate min-w-0">{selectedNetwork?.name} / {selectedCategory?.name}</span>
            <h3 className="text-sm sm:text-base font-bold text-foreground truncate min-w-0">{selectedService.name}</h3>
            <span className="text-xs text-primary font-semibold block mt-0.5">{formatEtaSpeedBadge(selectedService)}</span>
          </div>
        </div>
        <button type="button" onClick={onBackToServices} className="text-xs font-bold text-primary hover:underline px-3 py-2 min-h-[44px] flex items-center justify-center rounded-lg bg-primary/10 self-start sm:self-auto shrink-0">Изменить</button>
      </div>

      {errors.general && (
        <div ref={errorRef} className="p-4 bg-destructive/10 border border-destructive/30 rounded-2xl text-destructive text-sm font-semibold flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" /> <span>{errors.general}</span>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 flex-wrap">
          <label className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <LinkIcon className="w-4 h-4 text-primary shrink-0" /> <span>{hint.label || 'Ссылка для заказа'}</span> <span className="text-destructive">*</span>
          </label>
          {isTgViews && (
            <button type="button" onClick={() => setIsTgGuideOpen(true)} className="text-xs font-bold text-primary hover:underline flex items-center gap-1 bg-primary/10 px-3 py-2 min-h-[44px] rounded-xl transition-all">
              <HelpCircle className="w-3.5 h-3.5" /> <span>Как скопировать ссылку?</span>
            </button>
          )}
        </div>
        <TelegramLinkGuideModal isOpen={isTgGuideOpen} onClose={() => setIsTgGuideOpen(false)} onApplyLink={l => setLink(l)} tenantVariant="classic" />
        <input id="order-url" name="link" type="text" value={link} onChange={e => { setLink(e.target.value); if (errors.link) setErrors(prev => ({ ...prev, link: undefined })); }} onBlur={handleBlurLink} placeholder={hint.placeholder} className={`w-full px-4 py-3 text-base sm:text-sm bg-background border rounded-2xl text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 transition-all ${errors.link ? 'border-destructive ring-2 ring-destructive/20' : 'border-border/60 focus:ring-primary/30'}`} />
        {errors.link && <p className="text-xs font-semibold text-destructive mt-1 flex items-center gap-1"><Info className="w-3.5 h-3.5" />{errors.link}</p>}
        {isTgViews && <div className="p-3 rounded-2xl bg-primary/5 border border-primary/20 text-xs text-foreground flex items-start gap-2.5"><span className="text-sm shrink-0">💡</span><div className="space-y-0.5 min-w-0"><span className="font-bold text-primary block">Совет для альбомов:</span><p className="text-muted-foreground text-[11px]">{LinkGuideService.getTelegramAlbumAdvice(link)}</p></div></div>}
      </div>

      {selectedService.customDataType && selectedService.customDataType !== 'NONE' && (
        <div className="space-y-2">
          <label className="text-sm font-bold text-foreground flex items-center gap-1.5 shrink-0"><Sparkles className="w-4 h-4 text-primary" /> {selectedService.customDataLabel || 'Параметры заказа'} <span className="text-destructive">*</span></label>
          {selectedService.customDataType === 'TEXTAREA' ? (
            <textarea rows={3} value={customData} onChange={e => { setCustomData(e.target.value); if (errors.customData) setErrors(prev => ({ ...prev, customData: undefined })); }} placeholder="Каждый комментарий с новой строки..." className={`w-full px-4 py-3 text-base sm:text-sm bg-background border rounded-2xl text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 transition-all ${errors.customData ? 'border-destructive ring-2 ring-destructive/20' : 'border-border/60 focus:ring-primary/30'}`} />
          ) : (
            <input type="text" value={customData} onChange={e => { setCustomData(e.target.value); if (errors.customData) setErrors(prev => ({ ...prev, customData: undefined })); }} placeholder="Параметр заказа..." className={`w-full px-4 py-3 text-base sm:text-sm bg-background border rounded-2xl text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 transition-all ${errors.customData ? 'border-destructive ring-2 ring-destructive/20' : 'border-border/60 focus:ring-primary/30'}`} />
          )}
          {errors.customData && <p className="text-xs font-semibold text-destructive mt-1 flex items-center gap-1"><Info className="w-3.5 h-3.5" />{errors.customData}</p>}
        </div>
      )}

      <CheckoutDripFeed
        selectedService={selectedService}
        isDripFeedEnabled={isDripFeedEnabled}
        setIsDripFeedEnabled={setIsDripFeedEnabled}
        quantity={quantity}
        setQuantity={setQuantity}
        dripRuns={dripRuns}
        setDripRuns={setDripRuns}
        dripInterval={dripInterval}
        setDripInterval={setDripInterval}
        totalQuantity={totalQuantity}
        dripFloorWarning={dripFloorWarning}
      />

      {(selectedService.clientRequirement || selectedService.clientConfirmation || selectedService.requireWarning) && (
        <div className={`p-4 rounded-2xl border transition-all ${isRequirementsConfirmed ? 'bg-green-500/10 border-green-500/30' : errors.requirement ? 'bg-destructive/10 border-destructive/40 animate-shake' : 'bg-amber-500/10 border-amber-500/30'}`}>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-wider mb-1 shrink-0"><Sparkles className="w-4 h-4" /> Чек-лист для старта</div>
          <p className="text-xs text-muted-foreground mb-3">{selectedService.clientRequirement || selectedService.warningMessage || 'Перед началом убедитесь, что объект доступен для всех.'}</p>
          <label className="flex items-center gap-3 cursor-pointer min-h-[44px] py-1">
            <input type="checkbox" checked={isRequirementsConfirmed} onChange={(e) => { setIsRequirementsConfirmed(e.target.checked); if (errors.requirement) setErrors(prev => ({ ...prev, requirement: undefined })); }} className="h-5 w-5 rounded border-border text-primary focus:ring-primary shrink-0" />
            <span className={`text-xs font-bold select-none ${isRequirementsConfirmed ? 'text-green-700 dark:text-green-400' : errors.requirement ? 'text-destructive' : 'text-foreground'}`}>{selectedService.clientConfirmation || 'Я всё проверил, можно запускать'}</span>
          </label>
          {errors.requirement && <p className="text-xs font-bold text-destructive mt-2 flex items-center gap-1"><Info className="w-3.5 h-3.5" />{errors.requirement}</p>}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <label className="text-sm font-bold text-foreground flex items-center gap-1.5"><Hash className="w-4 h-4 text-primary shrink-0" /> <span>Количество</span> <span className="text-destructive">*</span></label>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <button type="button" onClick={() => { const runs = isDripFeedEnabled ? dripRuns : 1; setQuantity(selectedService.minQty * runs); }} className="px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 text-foreground font-bold transition-colors cursor-pointer" title="Установить минимальный объем">
              Мин: {(selectedService.minQty * (isDripFeedEnabled ? dripRuns : 1)).toLocaleString('ru-RU')}
            </button>
            <button type="button" onClick={() => setQuantity(selectedService.maxQty)} className="px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 text-foreground font-bold transition-colors cursor-pointer" title="Установить максимальный объем">
              Макс: {selectedService.maxQty.toLocaleString('ru-RU')}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text" inputMode="numeric" pattern="[0-9]*" value={quantity || ''}
            onFocus={(e) => { const t = e.currentTarget; setTimeout(() => t.select(), 10); }}
            onClick={(e) => { const t = e.currentTarget; setTimeout(() => t.select(), 10); }}
            onChange={e => {
              const val = e.target.value.replace(/\D/g, '');
              setQuantity(val ? parseInt(val, 10) : 0);
              if (errors.quantity) setErrors(prev => ({ ...prev, quantity: undefined }));
            }}
            onBlur={() => {
              if (selectedService) {
                const runs = isDripFeedEnabled ? dripRuns : 1;
                const clamped = clampOrderQuantity(quantity || 0, selectedService.minQty, selectedService.maxQty, runs);
                if (clamped !== quantity) setQuantity(clamped);
              }
            }}
            className={`w-full px-4 py-3 text-base sm:text-sm font-bold bg-background border rounded-2xl text-foreground focus:outline-none focus:ring-2 transition-all ${errors.quantity ? 'border-destructive ring-2 ring-destructive/20' : 'border-border/60 focus:ring-primary/30'}`}
          />
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" aria-label="Уменьшить количество" onClick={() => addQuantity(-Math.max(10, Math.floor((selectedService.minQty || 100) * (isDripFeedEnabled ? dripRuns : 1) / 10)))} className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-lg font-bold bg-muted/60 hover:bg-muted text-foreground border border-border/40 rounded-xl transition-all active:scale-95 cursor-pointer">–</button>
            <button type="button" aria-label="Увеличить количество" onClick={() => addQuantity(Math.max(10, Math.floor((selectedService.minQty || 100) * (isDripFeedEnabled ? dripRuns : 1) / 10)))} className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-lg font-bold bg-muted/60 hover:bg-muted text-foreground border border-border/40 rounded-xl transition-all active:scale-95 cursor-pointer">+</button>
          </div>
        </div>
        {errors.quantity && <p className="text-xs font-semibold text-destructive mt-1 flex items-center gap-1"><Info className="w-3.5 h-3.5" />{errors.quantity}</p>}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-foreground">Ваш Email (для чека и статуса) <span className="text-destructive">*</span></label>
        <input type="email" value={email} onChange={e => { setEmail(e.target.value); if (errors.email) setErrors(prev => ({ ...prev, email: undefined, general: undefined })); }} placeholder="name@example.com" className={`w-full px-4 py-3 text-base sm:text-sm bg-background border rounded-2xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all ${errors.email ? 'border-destructive ring-2 ring-destructive/20 bg-destructive/5' : 'border-border/60'}`} />
        {errors.email && <p className="text-xs font-semibold text-destructive mt-1 flex items-center gap-1"><Info className="w-3.5 h-3.5" />{errors.email}</p>}
      </div>

      <CheckoutPromoCode
        showPromo={showPromo} setShowPromo={setShowPromo} promoCodeInput={promoCodeInput}
        setPromoCodeInput={setPromoCodeInput} appliedPromo={appliedPromo} promoMessage={promoMessage}
        isApplyingPromo={isApplyingPromo} handleApplyPromo={handleApplyPromo} handleRemovePromo={handleRemovePromo}
      />

      <CheckoutPaymentMethod gateway={gateway} setGateway={setGateway} userBalanceCents={userBalanceCents} calculatedPriceRub={calculatedPriceRub} availableGateways={availableGateways} />

      <div className="p-4 rounded-2xl bg-primary/5 border border-primary/15 flex items-start gap-3 text-xs text-muted-foreground leading-relaxed">
        <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div>{hasRefill ? <><span className="font-bold text-foreground">🛡️ Гарантия Refill активна:</span> защита от списаний с автоматической докруткой. Запуск без паролей.</> : <><span className="font-bold text-foreground">100% Безопасный запуск:</span> соблюдаем лимиты соцсетей без ввода паролей. При сбое возврат средств на баланс.</>}</div>
      </div>

      <div className="pt-4 border-t border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs text-muted-foreground font-medium block">Итого к оплате:</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-primary">{isCalculatingPrice ? <Loader2 className="w-6 h-6 animate-spin inline text-primary" /> : formatRubles(calculatedPriceRub || 0)}</span>
            <span className="text-xs text-muted-foreground font-semibold">{isDripFeedEnabled ? `(${quantity || 0} шт всего: ${dripRuns} запусков по ${dripRuns > 0 ? Math.floor((quantity || 0) / dripRuns) : 0} шт × ${formatPricePerUnit(selectedService.pricePerUnitRub)} ₽/шт)` : `(${quantity || 0} шт × ${formatPricePerUnit(selectedService.pricePerUnitRub)} ₽/шт)`}</span>
          </div>
        </div>
        <button type="submit" disabled={isSubmitting} className="w-full md:w-auto px-8 py-4 bg-primary text-primary-foreground font-black text-base rounded-2xl shadow-lg shadow-primary/25 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2">
          {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin shrink-0" /><span>Обработка заказа...</span></> : <><Zap className="w-5 h-5 fill-current" /><span>Оплатить и запустить заказ</span></>}
        </button>
      </div>
    </form>
  );
}
