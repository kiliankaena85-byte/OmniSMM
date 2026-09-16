'use client';
import React, { Suspense } from 'react';
import { toast } from 'sonner';
import { DashboardHeroLinkInput } from '@/components/orders/DashboardHeroLinkInput';
import { trackEvent } from '@/lib/analytics';
import { checkoutAction } from '@/actions/order/checkout';
import { validateDripFeedLimits } from '@/hooks/useOrderWizard';
import { FormErrors, SmmplanOrderWizardProps } from './wizard/types';
import { useSmmplanOrderWizard } from './wizard/useSmmplanOrderWizard';
import { WizardStepIndicator } from './wizard/WizardStepIndicator';
import { WizardStepNetwork } from './wizard/WizardStepNetwork';
import { WizardStepCategory } from './wizard/WizardStepCategory';
import { WizardStepService } from './wizard/WizardStepService';
import { WizardStepCheckout } from './wizard/WizardStepCheckout';
import { parseActionableError } from '@/lib/errors/actionable-error';

function SmmplanOrderWizardInner(props: SmmplanOrderWizardProps) {
  const { userEmail = '', userBalanceCents = 0, initialReorderData, tenantId = 'smmplan' } = props;
  const w = useSmmplanOrderWizard(props);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault(); w.setErrors({});
    const newErrors: FormErrors = {};
    if (!w.selectedService) newErrors.general = 'Пожалуйста, выберите услугу';
    const trimmedLink = w.link.trim();
    if (!trimmedLink || trimmedLink.length < 3) {
      newErrors.link = 'Введите корректную ссылку для выполнения заказа';
    } else {
      // [T1-8] Use getLinkValidator instead of naive regex for accurate format check
      const linkFormatError = w.validateLinkFormat();
      if (linkFormatError) {
        newErrors.link = linkFormatError;
      } else if (w.detectedType && w.selectedService && w.selectedNetwork) {
        // [T1-8] isLinkServiceCompatible guard: catch incompatible link/service combos before backend
        const { isLinkServiceCompatible, getCompatibilityError, normalizeServiceTargetType } = await import('@/constants/link-service-compatibility');
        const { resolveServiceTargetType } = await import('@/utils/target-type-mapper');
        const svcTargetType = normalizeServiceTargetType(resolveServiceTargetType(w.selectedService));
        if (!isLinkServiceCompatible(w.detectedType, svcTargetType)) {
          newErrors.link = getCompatibilityError(w.detectedType, svcTargetType, w.selectedService.name);
        }
      }
    }
    if (w.selectedService) {
      if (!w.quantity || w.quantity < w.selectedService.minQty) {
        newErrors.quantity = 'Минимальное количество для этой услуги: ' + w.selectedService.minQty + ' шт.';
      } else if (w.quantity > w.selectedService.maxQty) {
        newErrors.quantity = 'Максимальное количество для этой услуги: ' + w.selectedService.maxQty + ' шт.';
      } else if (w.isDripFeedEnabled) {
        // [T1-8] Block submission if Drip-Feed Floor is violated (mirrors backend checkoutAction)
        if (w.dripFloorWarning) {
          newErrors.quantity = w.dripFloorWarning;
        } else {
          const dCheck = validateDripFeedLimits(w.quantity, w.dripRuns, w.selectedService.minQty, w.selectedService.maxQty);
          if (!dCheck.isValid) newErrors.quantity = dCheck.error;
        }
      }
    }
    if (w.selectedService?.customDataType && w.selectedService.customDataType !== 'NONE' && !w.customData.trim()) {
      newErrors.customData = w.selectedService.customDataLabel || 'Пожалуйста, заполните пользовательские данные';
    }
    const hasReq = w.selectedService?.clientRequirement || w.selectedService?.clientConfirmation || w.selectedService?.requireWarning;
    if (hasReq && !w.isRequirementsConfirmed) newErrors.requirement = 'Пожалуйста, подтвердите чек-лист для старта заказа';
    if (!w.email || !w.email.includes('@')) {
      newErrors.email = 'Укажите корректный email для чека и статуса заказа';
      newErrors.general = 'Укажите корректный email для чека и статуса заказа';
    }
    if (Object.keys(newErrors).length > 0) {
      w.setErrors(newErrors); w.setShakeKey(prev => prev + 1);
      setTimeout(() => { if (w.errorRef.current) w.errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 50);
      return;
    }

    w.setIsSubmitting(true);
    trackEvent('payment_clicked', { serviceId: w.selectedService!.id, serviceName: w.selectedService!.name, gateway: w.gateway, quantity: w.totalQuantity, priceRub: w.calculatedPriceRub });
    try {
      const res = await checkoutAction({
        serviceId: w.selectedService!.id, link: w.link.trim(), quantity: w.totalQuantity, email: w.email.trim(),
        promoCodeStr: w.appliedPromo ? w.appliedPromo.trim() : undefined, runs: w.isDripFeedEnabled ? w.dripRuns : undefined,
        interval: w.isDripFeedEnabled ? w.dripInterval : undefined, customData: w.selectedService!.customDataType !== 'NONE' ? w.customData : undefined,
        isRequirementsConfirmed: w.isRequirementsConfirmed, gateway: w.gateway,
        tenantId: tenantId || 'smmplan',
        idempotencyKey: w.idempotencyKey,
      });
      if (res.success && res.data) {
        w.resetIdempotencyKey();
        if (w.gateway === 'balance' || !res.data.paymentUrl) {
          toast.success('Заказ #' + (res.data.orderId || '') + ' успешно запущен!', { description: 'Оплата произведена с вашего баланса.' });
          w.router.push((res.data as any).redirectUrl || '/dashboard/orders?success=1&orderId=' + (res.data.orderId || '') + '&payment=balance');
        } else { window.location.href = res.data.paymentUrl; }
      } else {
        const errorMsg = !res.success ? res.error : 'Ошибка при оформлении заказа';
        const actionable = parseActionableError(errorMsg, { serviceId: w.selectedService?.id });
        w.setErrors({ general: actionable.message });
        w.setShakeKey(prev => prev + 1);
      }
    } catch (err: unknown) {
      const actionable = parseActionableError(err, { serviceId: w.selectedService?.id });
      w.setErrors({ general: actionable.message });
      w.setShakeKey(prev => prev + 1);
    } finally { w.setIsSubmitting(false); }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-28 sm:pb-24 md:pb-0">
      <div className="space-y-6 animate-in fade-in duration-300">
        <DashboardHeroLinkInput
            link={w.link} setLink={w.setLink} networks={w.networks} selectedNetwork={w.selectedNetwork}
            setSelectedNetwork={(net) => w.setSelectedNetwork(net)} selectedCategory={w.selectedCategory}
            selectedService={w.selectedService} step={w.step}
            onAdvanceStep={() => {
              if (w.selectedService) w.changeStep(4); else if (w.selectedCategory) w.changeStep(3);
              else if (w.selectedNetwork) w.changeStep(2); else w.changeStep(1);
            }}
          />
          <WizardStepIndicator step={w.step} selectedNetwork={w.selectedNetwork} selectedCategory={w.selectedCategory} selectedService={w.selectedService} changeStep={w.changeStep} />
          {w.step === 1 && (
            <WizardStepNetwork
              searchNetwork={w.searchNetwork} setSearchNetwork={w.setSearchNetwork} isLoadingCatalog={w.isLoadingCatalog}
              filteredNetworks={w.filteredNetworks} selectedNetwork={w.selectedNetwork}
              onSelectNetwork={(net) => { w.setSelectedNetwork(net); w.setSelectedCategory(null); w.setSelectedService(null); w.changeStep(2, undefined, undefined, net.id); }}
            />
          )}
          {w.step === 2 && (
            <WizardStepCategory
              selectedNetwork={w.selectedNetwork} selectedCategory={w.selectedCategory} searchCategory={w.searchCategory}
              setSearchCategory={w.setSearchCategory} hasSmartFilter={w.hasSmartFilter} detectedType={w.detectedType}
              matchedCategories={w.matchedCategories} showAllCategories={w.showAllCategories} setShowAllCategories={w.setShowAllCategories}
              filteredCategories={w.filteredCategories} onBack={() => w.changeStep(1)}
              onSelectCategory={(cat) => { w.setSelectedCategory(cat); w.setSelectedService(null); w.setTariffSubtypeFilter('auto'); w.changeStep(3, undefined, cat.id, w.selectedNetwork?.id); }}
            />
          )}
          {w.step === 3 && (
            <WizardStepService
              selectedNetwork={w.selectedNetwork} selectedCategory={w.selectedCategory} selectedService={w.selectedService}
              services={w.services} isLoadingServices={w.isLoadingServices} displayedServices={w.displayedServices}
              hasMultipleSubtypes={w.hasMultipleSubtypes} effectiveSubtype={w.effectiveSubtype} tariffSubtypeFilter={w.tariffSubtypeFilter}
              setTariffSubtypeFilter={w.setTariffSubtypeFilter} channelServicesCount={w.channelServicesCount} postServicesCount={w.postServicesCount}
              detectedType={w.detectedType} onBack={() => w.changeStep(2)} onSelectService={w.handleSelectService}
            />
          )}
          {w.step === 4 && (
            <div className={w.shakeKey > 0 ? 'animate-shake' : ''}>
              <WizardStepCheckout
                selectedNetwork={w.selectedNetwork} selectedCategory={w.selectedCategory} selectedService={w.selectedService}
                isLoadingServices={w.isLoadingServices} formRef={w.formRef} errorRef={w.errorRef} shakeKey={w.shakeKey}
                errors={w.errors} link={w.link} setLink={w.setLink} handleBlurLink={w.handleBlurLink} isTgGuideOpen={w.isTgGuideOpen}
                setIsTgGuideOpen={w.setIsTgGuideOpen} customData={w.customData} setCustomData={w.setCustomData}
                isDripFeedEnabled={w.isDripFeedEnabled} setIsDripFeedEnabled={w.setIsDripFeedEnabled} dripRuns={w.dripRuns}
                setDripRuns={w.setDripRuns} dripInterval={w.dripInterval} setDripInterval={w.setDripInterval}
                isRequirementsConfirmed={w.isRequirementsConfirmed} setIsRequirementsConfirmed={w.setIsRequirementsConfirmed}
                quantity={w.quantity} setQuantity={w.setQuantity} addQuantity={w.addQuantity} totalQuantity={w.totalQuantity}
                email={w.email} setEmail={w.setEmail} showPromo={w.showPromo} setShowPromo={w.setShowPromo}
                promoCodeInput={w.promoCodeInput} setPromoCodeInput={w.setPromoCodeInput} appliedPromo={w.appliedPromo}
                promoMessage={w.promoMessage} isApplyingPromo={w.isApplyingPromo} handleApplyPromo={w.handleApplyPromo}
                handleRemovePromo={w.handleRemovePromo} gateway={w.gateway} setGateway={w.setGateway}
                userBalanceCents={userBalanceCents} availableGateways={w.availableGateways} isCalculatingPrice={w.isCalculatingPrice}
                calculatedPriceRub={w.calculatedPriceRub} dripFloorWarning={w.dripFloorWarning} isSubmitting={w.isSubmitting} onBackToServices={() => w.changeStep(3)}
                onSubmit={handleSubmitOrder} setErrors={w.setErrors}
              />
            </div>
          )}
      </div>
    </div>
  );
}

export function SmmplanOrderWizard(props: SmmplanOrderWizardProps) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Загрузка визарда заказа...</div>}>
      <SmmplanOrderWizardInner {...props} />
    </Suspense>
  );
}
