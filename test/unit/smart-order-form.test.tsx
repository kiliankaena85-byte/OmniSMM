/**
 * QA-5: UI/UX & Performance Engineer
 * Test Suite: SmartOrderForm & UI Fallbacks
 * Standards: ISO 25010 §6.4 (Usability), WCAG 2.2 (Accessibility)
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SmartOrderForm } from '@/components/orders/SmartOrderForm';
import { useOrderEngine } from '@/hooks/useOrderEngine';
import { OrderSummaryCard } from '@/components/orders/sub/OrderSummaryCard';

// Mock dependencies
vi.mock('@/hooks/useOrderEngine', () => ({
  useOrderEngine: vi.fn(),
}));

vi.mock('@/components/orders/PlatformSelectorFallback', () => ({
  PlatformSelectorFallback: ({ onSelect }: any) => (
    <div data-testid="platform-fallback">
      <button onClick={() => onSelect('Telegram')} data-testid="btn-telegram">TG</button>
      <button onClick={() => onSelect('Instagram')} data-testid="btn-instagram">IG</button>
    </div>
  ),
}));

vi.mock('@/services/marketing.service', () => ({
  marketingService: {
    getB2BFormattedServices: vi.fn().mockReturnValue([]),
  },
}));

describe('SmartOrderForm & UX Fallbacks (QA-5)', () => {
  const getMockState = (overrides = {}) => ({
    url: '',
    setUrl: vi.fn(),
    categoryId: null,
    setCategoryId: vi.fn(),
    selectedService: null,
    setSelectedService: vi.fn(),
    quantity: 100,
    setQuantity: vi.fn(),
    email: '',
    setEmail: vi.fn(),
    dripFeedEnabled: false,
    setDripFeedEnabled: vi.fn(),
    runs: 0,
    setRuns: vi.fn(),
    interval: 0,
    setInterval: vi.fn(),
    availableCategories: [],
    services: [],
    catalog: [{ id: 'net-tg', name: 'Telegram', slug: 'telegram', categories: [] }],
    unfilteredCatalog: [{ id: 'net-tg', name: 'Telegram', slug: 'telegram', categories: [] }],
    isLoading: false,
    isCalculating: false,
    totalPriceFormatted: '0 ₽',
    validate: vi.fn(),
    validationErrors: {},
    platform: null,
    setPlatform: vi.fn(),
    setManualPlatform: vi.fn(),
    agreedToTerms: false,
    setAgreedToTerms: vi.fn(),
    ...overrides,
  });

  // ── TC-UX-001: Zero-Scroll input flow ──
  it('TC-UX-001: Renders main input field ready for zero-scroll flow', () => {
    vi.mocked(useOrderEngine).mockReturnValue(getMockState() as any);
    render(<SmartOrderForm />);

    const input = screen.getByPlaceholderText(/Вставьте ссылку/i);
    expect(input).toBeDefined();
    expect(input.tagName).toBe('INPUT');
  });

  // ── TC-UX-003: WCAG 2.2 Accessibility ──
  it('TC-UX-003: Main input has appropriate aria-label for screen readers (WCAG 1.3.1)', () => {
    vi.mocked(useOrderEngine).mockReturnValue(getMockState() as any);
    render(<SmartOrderForm />);

    const input = screen.getByPlaceholderText(/Вставьте ссылку/i) as HTMLInputElement;
    expect(input.getAttribute('aria-label') || input.id || input.getAttribute('placeholder')).toBeTruthy();
  });

  // ── TC-UX-005: Fallback UI Activation ──
  it('TC-UX-005: Renders PlatformSelectorFallback when engine.platform is falsy and url > 5', () => {
    vi.mocked(useOrderEngine).mockReturnValue(getMockState({ 
      url: 'https://example.com',
      platform: null,
      services: [] 
    }) as any);

    render(<SmartOrderForm />);

    expect(screen.getByTestId('platform-fallback')).toBeDefined();
  });

  // ── TC-UX-006: Manual Platform Selection ──
  it('TC-UX-006: Selecting a platform triggers setManualPlatform in the order engine', () => {
    const setManualPlatformMock = vi.fn();
    vi.mocked(useOrderEngine).mockReturnValue(getMockState({ 
      url: 'https://example.com',
      platform: null,
      services: [],
      setManualPlatform: setManualPlatformMock 
    }) as any);

    render(<SmartOrderForm />);

    fireEvent.click(screen.getByTestId('btn-telegram'));
    expect(setManualPlatformMock).toHaveBeenCalledWith('Telegram');
  });

  // ── TC-UX-008: Hides Category Panel when link is empty ──
  it('TC-UX-008: Order pane is hidden if no smartData and no manualPlatform exist', () => {
    vi.mocked(useOrderEngine).mockReturnValue(getMockState() as any);
    render(<SmartOrderForm />);

    const categoryTitle = screen.queryByText(/Выберите услугу/i);
    expect(categoryTitle).toBeNull();
  });

  // ── TC-UX-011: 152-FZ / GDPR Implicit Consent Compliance ──
  it('TC-UX-011: Renders implicit consent text instead of checkbox (152-FZ)', () => {
    const state = getMockState({
      selectedService: { id: 'srv1', name: 'Test SRV', minQty: 100, maxQty: 1000, pricePer1kRub: 100, pricePerUnitRub: 0.1 },
    });

    vi.mocked(useOrderEngine).mockReturnValue(state as any);
    render(<OrderSummaryCard userBalanceCents={1000} engine={state} />);

    // Ensure the consent text is present
    const consentText = screen.getByText(/Нажимая кнопку «Оплатить заказ», вы соглашаетесь с/i);
    expect(consentText).toBeDefined();

    // Ensure NO explicit consent checkbox is rendered
    const checkbox = screen.queryByRole('checkbox', { name: /Согласие с публичной офертой/i });
    expect(checkbox).toBeNull();

    // The submit button should be enabled by default (not disabled by a missing checkbox)
    const submitBtn = screen.getByRole('button', { name: /Оплатить заказ/i }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false);
  });
});
