/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlanSlideOrderClient } from '@/components/landing/order-engine/variants/PlanSlideOrderClient';
import { LayoutVariantToggle } from '@/components/landing/order-engine/LayoutVariantToggle';
import { PublicNetwork } from '@/actions/order/catalog';

// Mock Server Actions
vi.mock('@/actions/order/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/actions/order/catalog')>();
  return {
    ...actual,
    getServicesByCategoryAction: vi.fn().mockResolvedValue([
      {
        id: 'srv-101',
        name: 'Telegram Подписчики Живые API',
        pricePerUnitRub: 0.05,
        minQty: 100,
        maxQty: 10000,
        speed: '5 минут',
        warrantyDays: 30,
        isDripFeedEnabled: true,
      }
    ]),
  };
});

vi.mock('@/actions/order/checkout', () => ({
  checkoutAction: vi.fn().mockResolvedValue({ success: true, data: { orderId: 'ord-123' } }),
  getAvailableGatewaysAction: vi.fn().mockResolvedValue({
    success: true,
    data: { yookassa: true, robokassa: true, cryptobot: true }
  }),
  calculatePriceAction: vi.fn().mockResolvedValue({
    success: true,
    data: {
      totalCents: 500,
      originalTotalCents: 500,
      discountCents: 0,
      discountPercent: 0,
      providerCostCents: 0,
      safetyFloorCents: 100,
      tier: 'REGULAR',
    }
  }),
}));

vi.mock('@/actions/order/analyze-url', () => ({
  analyzeUrl: vi.fn().mockResolvedValue({
    success: true,
    data: {
      platform: 'TELEGRAM',
      type: 'CHANNEL',
      suggestedCategories: ['Подписчики', 'Бусты']
    }
  }),
}));

describe('PlanSlideOrderClient & LayoutVariantToggle Tests', () => {
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
          serviceCount: 5
        },
        {
          id: 'cat-views',
          name: '👁️ Просмотры постов',
          slug: 'views',
          networkId: 'net-tg',
          serviceCount: 8
        }
      ]
    },
    {
      id: 'net-vk',
      name: 'ВКонтакте',
      slug: 'vk',
      icon: '/icons/vk.svg',
      categories: [
        {
          id: 'cat-vk-followers',
          name: '👥 Подписчики паблика',
          slug: 'vk-followers',
          networkId: 'net-vk',
          serviceCount: 3
        }
      ]
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof window !== 'undefined') {
      window.HTMLElement.prototype.scrollIntoView = vi.fn();
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
      const storage: Record<string, string> = {};
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn((key: string) => storage[key] ?? null),
          setItem: vi.fn((key: string, val: string) => { storage[key] = val; }),
          removeItem: vi.fn((key: string) => { delete storage[key]; }),
          clear: vi.fn(() => { Object.keys(storage).forEach(k => delete storage[k]); }),
        },
        writable: true,
      });
    }
  });

  it('renders Step 1 (Link input) on mount with title and quick platforms', () => {
    render(
      <PlanSlideOrderClient 
        initialCatalog={mockCatalog}
        initialEmail="client@example.com"
        tenantId="smmplan"
      />
    );

    expect(screen.getByText(/Что хотите/i)).toBeDefined();
    expect(screen.getByText(/продвигать/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/Например: https:\/\/t.me\/channel/i)).toBeDefined();
    expect(screen.getByText(/Telegram/i)).toBeDefined();
    expect(screen.getByText(/ВКонтакте/i)).toBeDefined();
  });

  it('transitions to Step 2 (Category selection) when clicking on a quick platform pill', async () => {
    render(
      <PlanSlideOrderClient 
        initialCatalog={mockCatalog}
        initialEmail="client@example.com"
        tenantId="smmplan"
      />
    );

    // Find the quick platform pill for Telegram
    const tgButtons = screen.getAllByRole('button', { name: /Telegram/i });
    const quickTgBtn = tgButtons[0];
    fireEvent.click(quickTgBtn);

    // Should now be on Category step and show "Telegram: выберите категорию"
    await waitFor(() => {
      expect(screen.getByText(/Telegram: выберите категорию/i)).toBeDefined();
      expect(screen.getByText(/Подписчики канала/i)).toBeDefined();
      expect(screen.getByText(/Просмотры постов/i)).toBeDefined();
    });

    // Should show navigation back button
    expect(screen.getByTitle(/Назад/i)).toBeDefined();
  });

  it('navigates back to Step 1 when clicking back button from Step 2', async () => {
    render(
      <PlanSlideOrderClient 
        initialCatalog={mockCatalog}
        initialEmail="client@example.com"
        tenantId="smmplan"
      />
    );

    const tgButtons = screen.getAllByRole('button', { name: /Telegram/i });
    fireEvent.click(tgButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Telegram: выберите категорию/i)).toBeDefined();
    });

    const backBtn = screen.getByTitle(/Назад/i);
    fireEvent.click(backBtn);

    await waitFor(() => {
      expect(screen.getByText(/Что хотите/i)).toBeDefined();
    });
  });

  it('LayoutVariantToggle switches between slide and classic variants', () => {
    const onFlowChange = vi.fn();
    const { rerender } = render(
      <LayoutVariantToggle currentFlow="slide" onFlowChange={onFlowChange} />
    );

    const classicBtn = screen.getByText(/Классический/i);
    fireEvent.click(classicBtn);
    expect(onFlowChange).toHaveBeenCalledWith('classic');

    rerender(<LayoutVariantToggle currentFlow="classic" onFlowChange={onFlowChange} />);
    const slideBtn = screen.getByText(/Слайд-визард/i);
    fireEvent.click(slideBtn);
    expect(onFlowChange).toHaveBeenCalledWith('slide');
  });

  it('does NOT jump to Telegram when an email is entered in the link field', async () => {
    render(
      <PlanSlideOrderClient 
        initialCatalog={mockCatalog}
        tenantId="smmplan"
      />
    );

    const input = screen.getByPlaceholderText(/Например: https:\/\/t.me\/channel/i);
    fireEvent.change(input, { target: { value: 'user@example.com' } });
    
    // Press Enter or click Next
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // Should stay on Step 1, input should be cleared, and NOT jump to Telegram categories
    await waitFor(() => {
      expect(screen.queryByText(/Telegram: выберите категорию/i)).toBeNull();
      expect(screen.getByText(/Что хотите/i)).toBeDefined();
    });
  });

  it('renders field-link on Step 5 checkout screen', async () => {
    render(
      <PlanSlideOrderClient 
        initialCatalog={mockCatalog}
        tenantId="smmplan"
      />
    );

    // 1. Click Telegram
    const tgButtons = screen.getAllByRole('button', { name: /Telegram/i });
    fireEvent.click(tgButtons[0]);

    // 2. Click category
    await waitFor(() => {
      expect(screen.getByText(/Подписчики канала/i)).toBeDefined();
    });
    fireEvent.click(screen.getByText(/Подписчики канала/i));

    // 3. Click service
    await waitFor(() => {
      expect(screen.getByText(/Telegram Подписчики Живые API/i)).toBeDefined();
    });
    fireEvent.click(screen.getByText(/Telegram Подписчики Живые API/i));

    // 4. Now on checkout step: field-link, field-email, field-promo MUST exist and be rendered
    await waitFor(() => {
      expect(screen.getByText(/Ссылка для заказа/i)).toBeDefined();
      expect(document.getElementById('field-link')).not.toBeNull();
      expect(document.getElementById('field-quantity')).not.toBeNull();
      expect(document.getElementById('field-email')).not.toBeNull();
      expect(document.getElementById('field-promo')).not.toBeNull();
      expect(screen.getByText(/У меня есть промокод/i)).toBeDefined();
    });

    // 5. Open promo code input
    const promoBtn = screen.getByText(/У меня есть промокод/i);
    fireEvent.click(promoBtn);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/ВВЕДИТЕ КОД/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /Применить/i })).toBeDefined();
    });
  });
});
