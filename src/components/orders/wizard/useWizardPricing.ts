'use client';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { calculatePriceAction } from '@/actions/order/checkout';
import { PublicService } from '@/actions/order/catalog';

interface UseWizardPricingProps {
  selectedService: PublicService | null;
  quantity: number;
  setQuantity: (q: number) => void;
  totalQuantity: number;
  isDripFeedEnabled: boolean;
  dripRuns: number;
  isSmartDrip: boolean;
}

export function useWizardPricing({
  selectedService,
  quantity,
  setQuantity,
  totalQuantity,
  isDripFeedEnabled,
  dripRuns,
  isSmartDrip,
}: UseWizardPricingProps) {
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');
  const [showPromo, setShowPromo] = useState(false);
  const [promoMessage, setPromoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [calculatedPriceRub, setCalculatedPriceRub] = useState<number | null>(null);
  const [isCalculatingPrice, setIsCalculatingPrice] = useState(false);
  const priceRequestIdRef = useRef(0);

  const handleApplyPromo = async () => {
    const code = promoCodeInput.trim().toUpperCase();
    if (!code || !selectedService) return;
    setIsApplyingPromo(true);
    setPromoMessage(null);
    try {
      const res = await calculatePriceAction(
        selectedService.id,
        totalQuantity,
        code,
        isDripFeedEnabled ? dripRuns : undefined,
        isSmartDrip
      );
      if (res.success && res.data && res.data.discountCents > 0) {
        const base = res.data.originalTotalCents || res.data.totalCents;
        const disc = Math.round((res.data.discountCents / base) * 100);
        setAppliedPromo(code);
        setCalculatedPriceRub(res.data.totalCents / 100);
        setPromoMessage({ type: 'success', text: `Промокод «${code}» применен: скидка ${disc}%` });
        toast.success(`Промокод применен: скидка ${disc}%`);
      } else {
        setAppliedPromo('');
        setPromoMessage({ type: 'error', text: res.error || 'Промокод не найден' });
      }
    } catch {
      setPromoMessage({ type: 'error', text: 'Не удалось проверить промокод' });
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo('');
    setPromoCodeInput('');
    setPromoMessage(null);
  };

  useEffect(() => {
    if (!selectedService || !quantity) {
      setCalculatedPriceRub(null);
      return;
    }
    const currentRequestId = ++priceRequestIdRef.current;
    setIsCalculatingPrice(true);
    calculatePriceAction(
      selectedService.id,
      totalQuantity,
      appliedPromo || undefined,
      isDripFeedEnabled ? dripRuns : undefined,
      isSmartDrip
    )
      .then(res => {
        if (currentRequestId !== priceRequestIdRef.current) return;
        if (res.success && res.data) setCalculatedPriceRub(res.data.totalCents / 100);
        else setCalculatedPriceRub(selectedService.pricePerUnitRub * totalQuantity);
      })
      .catch(() => {
        if (currentRequestId === priceRequestIdRef.current) {
          setCalculatedPriceRub(selectedService.pricePerUnitRub * totalQuantity);
        }
      })
      .finally(() => {
        if (currentRequestId === priceRequestIdRef.current) setIsCalculatingPrice(false);
      });
  }, [selectedService, quantity, totalQuantity, appliedPromo, isSmartDrip, dripRuns, isDripFeedEnabled]);

  const addQuantity = (delta: number) => {
    if (!selectedService) return;
    setQuantity(Math.min(selectedService.maxQty, Math.max(selectedService.minQty, (quantity || 0) + delta)));
  };

  return {
    promoCodeInput,
    setPromoCodeInput,
    appliedPromo,
    setAppliedPromo,
    showPromo,
    setShowPromo,
    promoMessage,
    setPromoMessage,
    isApplyingPromo,
    handleApplyPromo,
    handleRemovePromo,
    calculatedPriceRub,
    setCalculatedPriceRub,
    isCalculatingPrice,
    addQuantity,
  };
}
