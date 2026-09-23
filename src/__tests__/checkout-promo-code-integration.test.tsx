/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlanFullscreenCheckout } from '@/components/landing/order-engine/variants/PlanFullscreenCheckout';
import { PlanCheckoutPromo } from '@/components/landing/order-engine/variants/PlanCheckoutPromo';
import { MobileCheckoutPromo } from '@/components/landing/order-engine/wizard-steps/MobileCheckoutPromo';
import { MobileCheckoutOrderSummary } from '@/components/landing/order-engine/wizard-steps/MobileCheckoutOrderSummary';
import { validateAndSubmitPlanCheckout } from '@/components/landing/order-engine/variants/usePlanCheckoutValidation';
import { PublicNetwork, PublicService } from '@/actions/order/catalog';
import { OrderEngine } from '@/hooks/useOrderEngine';

vi.mock('@/actions/order/checkout', () => ({
  getAvailableGatewaysAction: vi.fn().mockResolvedValue({
    success: true,
    data: { yookassa: true, robokassa: false, cryptobot: false }
  }),
}));

describe('Order Form Promo Code Integration Tests (Desktop & Mobile)', () => {
  const mockService: PublicService = {
    id: 'srv-promo-1',
    numericId: 201,
    name: 'Telegram Подписчики Премиум',
    pricePer1kRub: 150,
    pricePerUnitRub: 0.15,
    minQty: 100,
    maxQty: 50000,
    badge: 'Премиум',
    speed: '10 мин',
    warrantyDays: 30,
    isDripFeedEnabled: true,
    categoryId: 'cat-subs',
    description: 'Качественные русские подписчики с гарантией'
  };

  const mockCatalog: PublicNetwork[] = [
    {
      id: 'net-tg',
      name: 'Telegram',
      slug: 'telegram',
      icon: '/icons/telegram.svg',
      categories: [
        {
          id: 'cat-subs',
          name: '👥 Подписчики канала',
          slug: 'subscribers',
          networkId: 'net-tg',
          serviceCount: 1,
        }
      ]
    }
  ];

  const createMockEngine = (overrides?: Partial<OrderEngine>): OrderEngine => ({
    url: 'https://t.me/testchannel',
    setUrl: vi.fn(),
    networkId: 'net-tg',
    setNetworkId: vi.fn(),
    categoryId: 'cat-subs',
    setCategoryId: vi.fn(),
    selectedService: mockService,
    setSelectedService: vi.fn(),
    quantity: 500,
    setQuantity: vi.fn(),
    email: 'test@example.com',
    setEmail: vi.fn(),
    customData: '',
    setCustomData: vi.fn(),
    mediaGroupUrl: '',
    setMediaGroupUrl: vi.fn(),
    promoCode: '',
    setPromoCode: vi.fn(),
    agreedToTerms: true,
    setAgreedToTerms: vi.fn(),
    isLinkOverridden: false,
    setIsLinkOverridden: vi.fn(),
    isWarningConfirmed: true,
    setIsWarningConfirmed: vi.fn(),
    warningHasError: false,
    setWarningHasError: vi.fn(),
    termsHasError: false,
    setTermsHasError: vi.fn(),
    dripFeedEnabled: false,
    setDripFeedEnabled: vi.fn(),
    runs: 5,
    setRuns: vi.fn(),
    dripInterval: 60,
    setDripInterval: vi.fn(),
    isSmartDrip: false,
    setIsSmartDrip: vi.fn(),
    smartDripDays: 3,
    setSmartDripDays: vi.fn(),
    platform: null,
    detectedType: null,
    suggestedCategories: [],
    manualPlatform: null,
    setManualPlatform: vi.fn(),
    activeNetwork: mockCatalog[0],
    catalog: mockCatalog,
    unfilteredCatalog: mockCatalog,
    availableCategories: mockCatalog[0].categories,
    services: [mockService],
    pricing: {
      totalCents: 7500,
      originalTotalCents: 7500,
      discountCents: 0,
      discountPercent: 0,
      providerCostCents: 5000,
      safetyFloorCents: 5500,
      tier: 'REGULAR'
    },
    pricingError: null,
    totalPriceFormatted: '75.00',
    mediaGroupMultiplier: 1,
    isLoading: false,
    isServicesLoading: false,
    isAnalyzingUrl: false,
    isCalculating: false,
    error: null,
    validationErrors: {},
    compatibilityWarning: null,
    urlMutatedTrigger: false,
    urlHint: null,
    validate: vi.fn().mockReturnValue(true),
    resetOrder: vi.fn(),
    ...overrides
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Desktop PlanFullscreenCheckout Promo Code Integration', () => {
    it('renders "+ У меня есть промокод" trigger button initially when no code is active', () => {
      const engine = createMockEngine({ promoCode: '' });
      render(
        <PlanFullscreenCheckout
          engine={engine}
          selectedService={mockService}
          onClose={vi.fn()}
          handleCheckout={vi.fn()}
        />
      );

      const promoBtn = screen.getByRole('button', { name: /У меня есть промокод/i });
      expect(promoBtn).toBeDefined();
    });

    it('expands promo code input when clicking "+ У меня есть промокод"', () => {
      const engine = createMockEngine({ promoCode: '' });
      render(
        <PlanFullscreenCheckout
          engine={engine}
          selectedService={mockService}
          onClose={vi.fn()}
          handleCheckout={vi.fn()}
        />
      );

      const promoBtn = screen.getByRole('button', { name: /У меня есть промокод/i });
      fireEvent.click(promoBtn);

      const promoInput = screen.getByPlaceholderText(/ВВЕДИТЕ ПРОМОКОД/i);
      expect(promoInput).toBeDefined();
    });

    it('converts entered promo code to uppercase and calls setPromoCode', () => {
      const setPromoCode = vi.fn();
      const engine = createMockEngine({ promoCode: '', setPromoCode });
      render(
        <PlanFullscreenCheckout
          engine={engine}
          selectedService={mockService}
          onClose={vi.fn()}
          handleCheckout={vi.fn()}
        />
      );

      const promoBtn = screen.getByRole('button', { name: /У меня есть промокод/i });
      fireEvent.click(promoBtn);

      const promoInput = screen.getByPlaceholderText(/ВВЕДИТЕ ПРОМОКОД/i);
      fireEvent.change(promoInput, { target: { value: 'bonus20' } });

      expect(setPromoCode).toHaveBeenCalledWith('BONUS20');
    });

    it('displays discount banner and strikethrough price when promo discount is active', () => {
      const engine = createMockEngine({
        promoCode: 'SALE10',
        pricing: {
          totalCents: 6750,
          originalTotalCents: 7500,
          discountCents: 750,
          discountPercent: 10,
          providerCostCents: 5000,
          safetyFloorCents: 5500,
          tier: 'REGULAR'
        },
        totalPriceFormatted: '67.50'
      });

      render(
        <PlanFullscreenCheckout
          engine={engine}
          selectedService={mockService}
          onClose={vi.fn()}
          handleCheckout={vi.fn()}
        />
      );

      // Discount banner is visible
      expect(screen.getByText(/Скидка по промокоду \(10%\)/i)).toBeDefined();
      expect(screen.getByText(/-7.50 ₽/i)).toBeDefined();

      // Original price crossed out
      expect(screen.getByText('75.00 ₽')).toBeDefined();
      // Final price to pay
      expect(screen.getByText(/Оплатить 67.50 ₽/i)).toBeDefined();
    });
  });

  describe('PlanCheckoutPromo Component Validation Feedback', () => {
    it('shows loading state while calculating promo code', () => {
      render(
        <PlanCheckoutPromo
          promoCode="TESTCODE"
          setPromoCode={vi.fn()}
          isCalculating={true}
        />
      );

      expect(screen.getByText(/Проверяем промокод.../i)).toBeDefined();
    });

    it('shows voucher notification when voucher error is encountered', () => {
      render(
        <PlanCheckoutPromo
          promoCode="VOUCHER100"
          setPromoCode={vi.fn()}
          pricingError="voucher"
          isCalculating={false}
        />
      );

      expect(screen.getByText(/Это ваучер для пополнения баланса/i)).toBeDefined();
    });

    it('shows not found error when promo code yields no discount', () => {
      render(
        <PlanCheckoutPromo
          promoCode="INVALIDCODE"
          setPromoCode={vi.fn()}
          pricing={{
            totalCents: 7500,
            originalTotalCents: 7500,
            discountCents: 0,
            discountPercent: 0,
            providerCostCents: 5000,
            safetyFloorCents: 5500,
            tier: 'REGULAR'
          }}
          isCalculating={false}
        />
      );

      expect(screen.getByText(/Промокод не найден или срок действия истёк/i)).toBeDefined();
    });

    it('allows clearing active promo code via Удалить button', () => {
      const setPromoCode = vi.fn();
      render(
        <PlanCheckoutPromo
          promoCode="ACTIVE10"
          setPromoCode={setPromoCode}
          pricing={{
            totalCents: 6750,
            originalTotalCents: 7500,
            discountCents: 750,
            discountPercent: 10,
            providerCostCents: 5000,
            safetyFloorCents: 5500,
            tier: 'REGULAR'
          }}
          isCalculating={false}
        />
      );

      const deleteBtn = screen.getByRole('button', { name: /Удалить/i });
      fireEvent.click(deleteBtn);
      expect(setPromoCode).toHaveBeenCalledWith('');
    });
  });

  describe('MobileCheckoutPromo Component Touch & Ergonomics', () => {
    it('renders "+ Есть промокод?" trigger button initially', () => {
      render(
        <MobileCheckoutPromo
          promoCode=""
          setPromoCode={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /\+ Есть промокод\?/i })).toBeDefined();
    });

    it('expands on tap and transforms input to uppercase', () => {
      const setPromoCode = vi.fn();
      render(
        <MobileCheckoutPromo
          promoCode=""
          setPromoCode={setPromoCode}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /\+ Есть промокод\?/i }));
      const input = screen.getByPlaceholderText(/ВВЕДИТЕ ПРОМОКОД/i);
      fireEvent.change(input, { target: { value: 'mobile50' } });

      expect(setPromoCode).toHaveBeenCalledWith('MOBILE50');
    });

    it('shows active discount feedback badge and message', () => {
      render(
        <MobileCheckoutPromo
          promoCode="MOBILE15"
          setPromoCode={vi.fn()}
          pricing={{
            totalCents: 8500,
            originalTotalCents: 10000,
            discountCents: 1500,
            discountPercent: 15,
            providerCostCents: 6000,
            safetyFloorCents: 6500,
            tier: 'REGULAR'
          }}
          isCalculating={false}
        />
      );

      expect(screen.getByText('-15%')).toBeDefined();
      expect(screen.getByText(/Скидка 15% \(-15.00 ₽\) активирована/i)).toBeDefined();
    });

    it('in-field X button clears input value without collapsing the promo section', () => {
      const setPromoCode = vi.fn();
      render(
        <MobileCheckoutPromo
          promoCode="TYPO"
          setPromoCode={setPromoCode}
        />
      );

      const clearBtn = screen.getByTitle('Очистить промокод');
      fireEvent.click(clearBtn);

      expect(setPromoCode).toHaveBeenCalledWith('');
      // Section is still expanded with input visible
      expect(screen.getByPlaceholderText(/ВВЕДИТЕ ПРОМОКОД/i)).toBeDefined();
    });
  });

  describe('MobileCheckoutOrderSummary Promo Discount Display', () => {
    it('displays discount savings banner and strikethrough price on mobile', () => {
      render(
        <MobileCheckoutOrderSummary
          localError={null}
          checkoutError={null}
          shakeKey={0}
          isSubmitting={false}
          isCalculating={false}
          quantity={500}
          minQty={100}
          selectedGateway="yookassa"
          totalPriceFormatted="67.50"
          onOrderClick={vi.fn()}
          pricing={{
            totalCents: 6750,
            originalTotalCents: 7500,
            discountCents: 750,
            discountPercent: 10,
            providerCostCents: 5000,
            safetyFloorCents: 5500,
            tier: 'REGULAR'
          }}
        />
      );

      expect(screen.getByText(/Скидка по промокоду \(10%\):/i)).toBeDefined();
      expect(screen.getByText(/-7.50 ₽/i)).toBeDefined();
      expect(screen.getByText('75.00 ₽')).toBeDefined();
      expect(screen.getByText(/Оплатить СБП \/ Картой — 67.50 ₽/i)).toBeDefined();
    });
  });

  describe('validateAndSubmitPlanCheckout Promo Safety Guards', () => {
    it('blocks checkout when promo code is still calculating', () => {
      const setLocalError = vi.fn();
      const setShakeKey = vi.fn();
      const handleCheckout = vi.fn();

      const result = validateAndSubmitPlanCheckout({
        url: 'https://t.me/channel',
        selectedService: mockService,
        isWarningConfirmed: true,
        customData: '',
        quantity: 500,
        minQty: 100,
        maxQty: 50000,
        effectiveMinQty: 100,
        dripFeedEnabled: false,
        runs: 1,
        email: 'user@example.com',
        agreedToTerms: true,
        selectedGateway: 'yookassa',
        linkInputRef: { current: null },
        emailInputRef: { current: null },
        quantityInputRef: { current: null },
        setLocalError,
        setShakeKey,
        handleCheckout,
        isCalculating: true,
        promoCode: 'WAITING',
      });

      expect(result).toBe(false);
      expect(setLocalError).toHaveBeenCalledWith('Пожалуйста, дождитесь завершения проверки промокода');
      expect(handleCheckout).not.toHaveBeenCalled();
    });

    it('blocks checkout when promo code is a balance voucher', () => {
      const setLocalError = vi.fn();
      const setShakeKey = vi.fn();
      const handleCheckout = vi.fn();

      const result = validateAndSubmitPlanCheckout({
        url: 'https://t.me/channel',
        selectedService: mockService,
        isWarningConfirmed: true,
        customData: '',
        quantity: 500,
        minQty: 100,
        maxQty: 50000,
        effectiveMinQty: 100,
        dripFeedEnabled: false,
        runs: 1,
        email: 'user@example.com',
        agreedToTerms: true,
        selectedGateway: 'yookassa',
        linkInputRef: { current: null },
        emailInputRef: { current: null },
        quantityInputRef: { current: null },
        setLocalError,
        setShakeKey,
        handleCheckout,
        pricingError: 'voucher',
        promoCode: 'VOUCHER100',
      });

      expect(result).toBe(false);
      expect(setLocalError).toHaveBeenCalledWith('Введён ваучер на пополнение баланса. Активируйте его в личном кабинете или очистите поле');
      expect(handleCheckout).not.toHaveBeenCalled();
    });

    it('blocks checkout when promo code is invalid / gives zero discount', () => {
      const setLocalError = vi.fn();
      const setShakeKey = vi.fn();
      const handleCheckout = vi.fn();

      const result = validateAndSubmitPlanCheckout({
        url: 'https://t.me/channel',
        selectedService: mockService,
        isWarningConfirmed: true,
        customData: '',
        quantity: 500,
        minQty: 100,
        maxQty: 50000,
        effectiveMinQty: 100,
        dripFeedEnabled: false,
        runs: 1,
        email: 'user@example.com',
        agreedToTerms: true,
        selectedGateway: 'yookassa',
        linkInputRef: { current: null },
        emailInputRef: { current: null },
        quantityInputRef: { current: null },
        setLocalError,
        setShakeKey,
        handleCheckout,
        promoCode: 'INVALID999',
        isCalculating: false,
        pricing: {
          totalCents: 7500,
          originalTotalCents: 7500,
          discountCents: 0,
          discountPercent: 0,
          providerCostCents: 5000,
          safetyFloorCents: 5500,
          tier: 'REGULAR'
        }
      });

      expect(result).toBe(false);
      expect(setLocalError).toHaveBeenCalledWith('Указан недействительный промокод. Очистите поле или укажите верный промокод');
      expect(handleCheckout).not.toHaveBeenCalled();
    });

    it('blocks checkout when promo code is short (< 3 chars, e.g. "AB") and gives zero discount', () => {
      const setLocalError = vi.fn();
      const setShakeKey = vi.fn();
      const handleCheckout = vi.fn();

      const result = validateAndSubmitPlanCheckout({
        url: 'https://t.me/channel',
        selectedService: mockService,
        isWarningConfirmed: true,
        customData: '',
        quantity: 500,
        minQty: 100,
        maxQty: 50000,
        effectiveMinQty: 100,
        dripFeedEnabled: false,
        runs: 1,
        email: 'user@example.com',
        agreedToTerms: true,
        selectedGateway: 'yookassa',
        linkInputRef: { current: null },
        emailInputRef: { current: null },
        quantityInputRef: { current: null },
        setLocalError,
        setShakeKey,
        handleCheckout,
        promoCode: 'AB',
        isCalculating: false,
        pricing: {
          totalCents: 7500,
          originalTotalCents: 7500,
          discountCents: 0,
          discountPercent: 0,
          providerCostCents: 5000,
          safetyFloorCents: 5500,
          tier: 'REGULAR'
        }
      });

      expect(result).toBe(false);
      expect(setLocalError).toHaveBeenCalledWith('Указан недействительный промокод. Очистите поле или укажите верный промокод');
      expect(handleCheckout).not.toHaveBeenCalled();
    });

    it('displays min length hint when promo code is 1-2 characters in PlanCheckoutPromo', () => {
      render(
        <PlanCheckoutPromo
          promoCode="A"
          setPromoCode={vi.fn()}
          isCalculating={false}
        />
      );

      expect(screen.getByText(/Минимальная длина промокода — 3 символа/i)).toBeDefined();
    });
  });
});
