/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlanFullscreenCheckout } from '@/components/landing/order-engine/variants/PlanFullscreenCheckout';
import { PublicNetwork, PublicService } from '@/actions/order/catalog';
import { OrderEngine } from '@/hooks/useOrderEngine';

vi.mock('@/actions/order/checkout', () => ({
  getAvailableGatewaysAction: vi.fn().mockResolvedValue({
    success: true,
    data: { yookassa: true, robokassa: false, cryptobot: false }
  }),
}));

describe('PlanFullscreenCheckout Component Tests', () => {
  const mockService: PublicService = {
    id: 'srv-test-1',
    numericId: 101,
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
    url: '',
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
      tier: 'STANDARD'
    },
    pricingError: null,
    totalPriceFormatted: '75.00',
    mediaGroupMultiplier: 1,
    isLoading: false,
    isServicesLoading: false,
    isAnalyzingUrl: false,
    isCalculating: false,
    error: null,
    servicesError: null,
    retryServices: vi.fn(),
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

  it('renders selected service name, price per unit, and limits', () => {
    const engine = createMockEngine();
    render(
      <PlanFullscreenCheckout
        engine={engine}
        selectedService={mockService}
        onClose={vi.fn()}
        handleCheckout={vi.fn()}
      />
    );

    expect(screen.getByText('Telegram Подписчики Премиум')).toBeDefined();
    expect(screen.getByText(/0,15\s*₽/)).toBeDefined();
    expect(screen.getByText(/за 1 шт/i)).toBeDefined();
    expect(screen.getByText('100 шт.')).toBeDefined();
  });

  it('renders top navigation bar and calls onClose when clicking Назад к тарифам', () => {
    const engine = createMockEngine();
    const onClose = vi.fn();
    render(
      <PlanFullscreenCheckout
        engine={engine}
        selectedService={mockService}
        onClose={onClose}
        handleCheckout={vi.fn()}
      />
    );

    const backBtn = screen.getByRole('button', { name: /Назад к тарифам/i });
    expect(backBtn).toBeDefined();
    fireEvent.click(backBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('updates quantity with stepper buttons', () => {
    const engine = createMockEngine({ quantity: 500 });
    render(
      <PlanFullscreenCheckout
        engine={engine}
        selectedService={mockService}
        onClose={vi.fn()}
        handleCheckout={vi.fn()}
      />
    );

    const plusBtn = screen.getByRole('button', { name: '+' });
    expect(plusBtn).toBeDefined();
    fireEvent.click(plusBtn);
    expect(engine.setQuantity).toHaveBeenCalledWith(600);

    const minusBtn = screen.getByRole('button', { name: '–' });
    expect(minusBtn).toBeDefined();
    fireEvent.click(minusBtn);
    expect(engine.setQuantity).toHaveBeenCalledWith(400);
  });

  it('prevents submission and displays error when link is empty', () => {
    const engine = createMockEngine({ url: '' });
    const handleCheckout = vi.fn();
    render(
      <PlanFullscreenCheckout
        engine={engine}
        selectedService={mockService}
        onClose={vi.fn()}
        handleCheckout={handleCheckout}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Оплатить/i });
    fireEvent.click(submitBtn);

    expect(handleCheckout).not.toHaveBeenCalled();
    expect(screen.getByText(/укажите ссылку на объект продвижения/i)).toBeDefined();
  });

  it('successfully triggers handleCheckout when all fields are valid', () => {
    const engine = createMockEngine({ url: 'https://t.me/channel', email: 'buyer@test.com' });
    const handleCheckout = vi.fn();
    render(
      <PlanFullscreenCheckout
        engine={engine}
        selectedService={mockService}
        onClose={vi.fn()}
        handleCheckout={handleCheckout}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Оплатить/i });
    fireEvent.click(submitBtn);

    expect(handleCheckout).toHaveBeenCalledWith('yookassa');
  });

  it('SIL-2026: window.scrollTo is called strictly once on desktop mount and NEVER on re-renders with new onClose reference', () => {
    const scrollToSpy = vi.fn();
    window.scrollTo = scrollToSpy;
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });

    const engine = createMockEngine({ url: 'https://t.me/channel', email: 'buyer@test.com' });
    const { rerender } = render(
      <PlanFullscreenCheckout
        engine={engine}
        selectedService={mockService}
        onClose={() => {}}
        handleCheckout={vi.fn()}
      />
    );

    // Initial mount on desktop (innerWidth = 1024) should scroll once
    expect(scrollToSpy).toHaveBeenCalledTimes(1);

    // Re-render with new onClose reference (simulating typing, state updates)
    rerender(
      <PlanFullscreenCheckout
        engine={engine}
        selectedService={mockService}
        onClose={() => {}}
        handleCheckout={vi.fn()}
      />
    );

    // Must STILL be 1 — no extra scroll!
    expect(scrollToSpy).toHaveBeenCalledTimes(1);
  });

  it('SIL-2026: window.scrollTo is completely suppressed on mobile viewports (< 768px)', () => {
    const scrollToSpy = vi.fn();
    window.scrollTo = scrollToSpy;
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });

    const engine = createMockEngine({ url: 'https://t.me/channel', email: 'buyer@test.com' });
    render(
      <PlanFullscreenCheckout
        engine={engine}
        selectedService={mockService}
        onClose={() => {}}
        handleCheckout={vi.fn()}
      />
    );

    // Mobile should NOT trigger desktop fullscreen checkout scroll
    expect(scrollToSpy).not.toHaveBeenCalled();
  });
});

