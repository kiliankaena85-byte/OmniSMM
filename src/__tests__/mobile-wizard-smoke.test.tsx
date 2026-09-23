/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, render, screen, fireEvent } from '@testing-library/react';
import { useMobileWizard } from '@/components/landing/order-engine/wizard-steps/useMobileWizard';
import { MobileWizardStepper } from '@/components/landing/order-engine/wizard-steps/MobileWizardStepper';
import { MobileStep1Link } from '@/components/landing/order-engine/wizard-steps/MobileStep1Link';
import { MobileStep2Category } from '@/components/landing/order-engine/wizard-steps/MobileStep2Category';
import { MobileStep3Service } from '@/components/landing/order-engine/wizard-steps/MobileStep3Service';
import { OrderEngine } from '@/hooks/useOrderEngine';

describe('MobileWizard Stepper & State Machine (Smoke & E2E Tests)', () => {
  const mockCatalog = [
    {
      id: 'tg-net',
      slug: 'telegram',
      name: 'Telegram',
      categories: [
        {
          id: 'tg-subs',
          name: 'Подписчики',
          services: [
            {
              id: 'srv-1',
              name: 'Telegram Подписчики Стандарт',
              minQty: 10,
              maxQty: 50000,
              pricePerUnitRub: 0.15
            }
          ]
        }
      ]
    }
  ];

  const createMockEngine = (overrides?: Partial<OrderEngine>): OrderEngine => {
    return {
      url: '',
      setUrl: vi.fn(),
      networkId: 'tg-net',
      setNetworkId: vi.fn(),
      categoryId: null,
      setCategoryId: vi.fn(),
      selectedService: null,
      setSelectedService: vi.fn(),
      quantity: 100,
      setQuantity: vi.fn(),
      email: '',
      setEmail: vi.fn(),
      promoCode: '',
      setPromoCode: vi.fn(),
      agreedToTerms: true,
      setAgreedToTerms: vi.fn(),
      catalog: mockCatalog as any,
      isLoading: false,
      validationErrors: null,
      availableCategories: mockCatalog[0].categories as any,
      availableServices: mockCatalog[0].categories[0].services as any,
      isCalculating: false,
      totalPriceFormatted: '15.00 ₽',
      ...overrides
    } as unknown as OrderEngine;
  };

  if (typeof window !== 'undefined') {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  }

  it('1. Initializes on Step 1 when no URL or service is preselected', () => {
    const engine = createMockEngine();
    const { result } = renderHook(() => useMobileWizard(engine));

    expect(result.current.currentStep).toBe(1);
    expect(result.current.shouldShowCategories).toBe(true);
    expect(result.current.shouldShowTariffs).toBe(true);
    expect(result.current.shouldShowParameters).toBe(true);
  });

  it('2. Advances to Step 2 when user pastes a valid link in Step 1', () => {
    let engine = createMockEngine({ url: 'https://t.me/my_awesome_channel' });
    const { result } = renderHook(() => useMobileWizard(engine));

    expect(result.current.currentStep).toBe(2);
    expect(result.current.isLinkFilled).toBe(true);
  });

  it('2b (Phase 2 B1). proceedFromStep1 always advances to Step 2 and never auto-jumps to Step 3', () => {
    let engine = createMockEngine({ url: 'https://t.me/my_awesome_channel', categoryId: 'tg-subs' });
    const { result } = renderHook(() => useMobileWizard(engine));

    act(() => {
      result.current.proceedFromStep1();
    });

    // proceedFromStep1 must advance to Step 2 (selecting category), NOT jump past to Step 3
    expect(result.current.currentStep).toBe(2);
  });

  it('3. Advances directly to Step 4 when a service is chosen from Catalog without prior URL', () => {
    const selectedService = mockCatalog[0].categories[0].services[0];
    const engine = createMockEngine({
      url: '', // Empty link
      categoryId: 'tg-subs',
      selectedService: selectedService as any
    });

    const { result } = renderHook(() => useMobileWizard(engine));

    // Must NOT reset to Step 1; must advance directly to Step 4 for seamless checkout
    expect(result.current.currentStep).toBe(4);
    expect(result.current.shouldShowParameters).toBe(true);
  });

  it('4. Allows manual bidirectional step navigation without state corruption', () => {
    const engine = createMockEngine({ url: 'https://t.me/channel' });
    const { result } = renderHook(() => useMobileWizard(engine));

    expect(result.current.currentStep).toBe(2);

    act(() => {
      result.current.setActiveStep(1);
    });
    expect(result.current.currentStep).toBe(1);

    act(() => {
      result.current.setActiveStep(3);
    });
    expect(result.current.currentStep).toBe(3);
  });

  it('5. Correctly resolves selected category name and brand styling', () => {
    const engine = createMockEngine({
      url: 'https://t.me/channel',
      networkId: 'tg-net',
      categoryId: 'tg-subs'
    });
    const { result } = renderHook(() => useMobileWizard(engine));

    expect(result.current.selectedCategoryName).toBe('Подписчики');
    expect(result.current.brandStyle).toBeDefined();
  });

  it('6. MobileWizardStepper renders 4 interactive steps and handles navigation', () => {
    const setActiveStep = vi.fn();
    const { getByText } = render(
      <MobileWizardStepper
        currentStep={2}
        setActiveStep={setActiveStep}
        isLinkFilled={true}
        hasCategory={false}
        hasService={false}
      />
    );

    expect(getByText('Ссылка')).toBeDefined();
    expect(getByText('Категория')).toBeDefined();
    expect(getByText('Тариф')).toBeDefined();
    expect(getByText('Оплата')).toBeDefined();

    fireEvent.click(getByText('Ссылка'));
    expect(setActiveStep).toHaveBeenCalledWith(1);
  });

  it('7. MobileStep1Link renders actionable prompt button when currentStep > 1 and url is empty', () => {
    const setActiveStep = vi.fn();
    const engine = createMockEngine({ url: '' });

    const { container } = render(
      <MobileStep1Link
        engine={engine}
        currentStep={3}
        setActiveStep={setActiveStep}
        proceedFromStep1={vi.fn()}
        isFocused={false}
        setIsFocused={vi.fn()}
        localUrlError={null}
        setLocalUrlError={vi.fn()}
        catalogHint={false}
      />
    );

    expect(container.firstChild).not.toBeNull();
    const promptBtn = screen.getByText(/Укажите ссылку для заказа/i);
    expect(promptBtn).toBeDefined();

    fireEvent.click(promptBtn);
    expect(setActiveStep).toHaveBeenCalledWith(1);
  });

  it('8. Allows user to navigate back to Step 3 or Step 1 from Step 4 without getting trapped', () => {
    const selectedService = mockCatalog[0].categories[0].services[0];
    const engine = createMockEngine({
      url: 'https://t.me/channel',
      categoryId: 'tg-subs',
      selectedService: selectedService as any
    });

    const { result } = renderHook(() => useMobileWizard(engine));

    // Initially on Step 4 because service is selected
    expect(result.current.currentStep).toBe(4);

    // User clicks "Назад к тарифам" (Step 3)
    act(() => {
      result.current.setActiveStep(3);
    });
    // MUST remain on Step 3, not forced back to Step 4!
    expect(result.current.currentStep).toBe(3);

    // User clicks "Сменить ссылку" (Step 1)
    act(() => {
      result.current.setActiveStep(1);
    });
    // MUST remain on Step 1!
    expect(result.current.currentStep).toBe(1);
  });

  it('9. MobileStep1Link input has type="text" and inputMode="url" to prevent iOS Safari validation lock', () => {
    const engine = createMockEngine({ url: '' });

    render(
      <MobileStep1Link
        engine={engine}
        currentStep={1}
        setActiveStep={vi.fn()}
        proceedFromStep1={vi.fn()}
        isFocused={false}
        setIsFocused={vi.fn()}
        localUrlError={null}
        setLocalUrlError={vi.fn()}
        catalogHint={false}
      />
    );

    const input = document.getElementById('standard-url-input') as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.type).toBe('text');
    expect(input.getAttribute('inputmode')).toBe('url');
  });

  it('10. resetOrder method clears all draft state and returns user to Step 1 cleanly', () => {
    let currentUrl = 'https://t.me/test_channel';
    let currentService: any = mockCatalog[0].categories[0].services[0];
    let currentPromo = 'DISCOUNT10';

    const resetOrder = vi.fn(() => {
      currentUrl = '';
      currentService = null;
      currentPromo = '';
    });

    const engine = createMockEngine({
      url: currentUrl,
      selectedService: currentService,
      promoCode: currentPromo,
      resetOrder
    });

    const { result } = renderHook(() => useMobileWizard(engine));
    expect(result.current.currentStep).toBe(4);

    act(() => {
      engine.resetOrder();
      result.current.setActiveStep(1);
    });

    expect(resetOrder).toHaveBeenCalled();
    expect(currentUrl).toBe('');
    expect(currentService).toBeNull();
    expect(currentPromo).toBe('');
    expect(result.current.currentStep).toBe(1);
  });

  it('11. Supports browser Back button / popstate navigation between wizard steps', () => {
    const engine = createMockEngine({ url: 'https://t.me/test_channel' });
    const { result } = renderHook(() => useMobileWizard(engine));

    act(() => {
      result.current.setActiveStep(3);
    });
    expect(result.current.currentStep).toBe(3);

    // Simulate user pressing browser Back button
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', {
        state: { wizardStep: 2 }
      }));
    });
    expect(result.current.currentStep).toBe(2);

    // Simulate user pressing browser Back button again to Step 1
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', {
        state: { wizardStep: 1 }
      }));
    });
    expect(result.current.currentStep).toBe(1);
  });

  it('12. Clean Smart Adaptive Flow: MobileStep1Link displays smart detection badge when url is entered and manual catalog button when empty without duplicate platform shortcuts', () => {
    // Check empty state
    const engineEmpty = createMockEngine({ url: '' });
    const { getByText, queryByText, unmount } = render(
      <MobileStep1Link
        engine={engineEmpty}
        currentStep={1}
        setActiveStep={vi.fn()}
        proceedFromStep1={vi.fn()}
        isFocused={false}
        setIsFocused={vi.fn()}
        localUrlError={null}
        setLocalUrlError={vi.fn()}
        catalogHint={false}
      />
    );
    expect(queryByText('Или выберите соцсеть для заказа:')).toBeNull();
    expect(getByText('Или выбрать услугу вручную из каталога →')).toBeDefined();
    unmount();

    // Check with detected link
    const engineWithLink = createMockEngine({
      url: 'https://t.me/durov/123',
      platform: 'TELEGRAM' as any,
      detectedType: 'POST' as any
    });
    const { getByText: getByText2 } = render(
      <MobileStep1Link
        engine={engineWithLink}
        currentStep={1}
        setActiveStep={vi.fn()}
        proceedFromStep1={vi.fn()}
        isFocused={false}
        setIsFocused={vi.fn()}
        localUrlError={null}
        setLocalUrlError={vi.fn()}
        catalogHint={false}
      />
    );
    expect(getByText2('Публикация / Пост')).toBeDefined();
    expect(getByText2('✓ Ссылка подходит')).toBeDefined();
  });

  it('13. Zero-Dead-End UX: MobileStep3Service displays friendly bridge guidance when services are filtered', () => {
    const engineNoServices = createMockEngine({
      services: [],
      url: 'https://t.me/durov/123',
      detectedType: 'POST' as any,
      categoryId: 'tg-cat'
    });
    const { getByText } = render(
      <MobileStep3Service
        engine={engineNoServices}
        currentStep={3}
        setActiveStep={vi.fn()}
        shouldShowTariffs={true}
        selectedCategoryName="Подписчики"
        step3Ref={{ current: null }}
      />
    );

    expect(getByText(/В категории «Подписчики» нет тарифов для вашей ссылки/i)).toBeDefined();
    expect(getByText(/Выбрать подходящую категорию/i)).toBeDefined();
  });

  it('14. Channel Subscriber Flow (https://t.me/smmMarket69): Step 1 shows channel badge and Step 3 groups subscriber tariffs into Rule of 3', () => {
    // Step 1: Channel detection
    const engineChannel = createMockEngine({
      url: 'https://t.me/smmMarket69',
      platform: 'TELEGRAM' as any,
      detectedType: 'channel' as any
    });
    const { getByText, unmount } = render(
      <MobileStep1Link
        engine={engineChannel}
        currentStep={1}
        setActiveStep={vi.fn()}
        proceedFromStep1={vi.fn()}
        isFocused={false}
        setIsFocused={vi.fn()}
        localUrlError={null}
        setLocalUrlError={vi.fn()}
        catalogHint={false}
      />
    );
    expect(getByText('Канал / Сообщество')).toBeDefined();
    expect(getByText('✓ Ссылка подходит')).toBeDefined();
    unmount();

    // Step 3: Subscriber services display top 3 tiers with expand button
    const mockServices = [
      { id: 's1', name: 'Telegram Подписчики Быстрые', pricePerUnitRub: 0.05, minQty: 10, maxQty: 10000 },
      { id: 's2', name: 'Telegram Подписчики Реальные (Хит)', pricePerUnitRub: 0.12, minQty: 20, maxQty: 50000 },
      { id: 's3', name: 'Telegram Подписчики Премиум Гарантия', pricePerUnitRub: 0.25, minQty: 50, maxQty: 100000 },
      { id: 's4', name: 'Telegram Подписчики VIP', pricePerUnitRub: 0.50, minQty: 100, maxQty: 50000 },
    ];
    const engineStep3 = createMockEngine({
      url: 'https://t.me/smmMarket69',
      detectedType: 'channel' as any,
      categoryId: 'tg-subs',
      services: mockServices as any,
      selectedService: null,
      setSelectedService: vi.fn(),
    });
    const { getByText: getByText3 } = render(
      <MobileStep3Service
        engine={engineStep3}
        currentStep={3}
        setActiveStep={vi.fn()}
        shouldShowTariffs={true}
        selectedCategoryName="Подписчики на канал и в группу"
        step3Ref={{ current: null }}
      />
    );

    expect(getByText3('Telegram Подписчики Быстрые')).toBeDefined();
    expect(getByText3('Telegram Подписчики VIP')).toBeDefined();
    expect(getByText3('Telegram Подписчики Премиум Гарантия')).toBeDefined();
    expect(getByText3(/Показать все 4 тарифов/i)).toBeDefined();
  });

  it('15. Zero-False-Selection Invariant: MobileStep2Category never renders when currentStep is 1', () => {
    const engineWithCategory = createMockEngine({
      url: '',
      categoryId: 'tg-subs',
      activeNetwork: {
        id: 'tg-net',
        name: 'Telegram',
        slug: 'telegram',
        categories: [{ id: 'tg-subs', name: 'Подписчики', serviceCount: 5 }]
      } as any,
      availableCategories: [{ id: 'tg-subs', name: 'Подписчики', serviceCount: 5 }] as any,
    });

    const { container } = render(
      <MobileStep2Category
        engine={engineWithCategory}
        currentStep={1}
        setActiveStep={vi.fn()}
        shouldShowCategories={true}
        selectedCategoryName="Подписчики на канал и в группу"
        step2Ref={{ current: null }}
      />
    );

    // Step 2 must be completely hidden (null) on Step 1
    expect(container.firstChild).toBeNull();
  });
});

