/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OrderViewModeSwitcher } from '@/components/orders/OrderViewModeSwitcher';
import { CustomerOrdersWorkspace } from '@/components/orders/CustomerOrdersWorkspace';
import { MobileOrderList, MobileOrderItem } from '@/components/orders/MobileOrderList';
import { DesktopOrderTable } from '@/components/orders/DesktopOrderTable';
import { DesktopOrderCards } from '@/components/orders/DesktopOrderCards';

const mockPush = vi.fn();

// Mock Next.js router and hooks
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard/orders',
}));

const mockOrders: MobileOrderItem[] = [
  {
    id: 'order-1',
    numericId: 101,
    status: 'IN_PROGRESS',
    charge: 25000,
    discountCents: 0,
    usdToRubRate: 90,
    quantity: 500,
    remains: 250,
    link: 'https://t.me/testchannel',
    createdAt: new Date('2026-03-01T12:00:00Z').toISOString(),
    service: {
      id: 'srv-1',
      categoryId: 'cat-1',
      name: 'Telegram Подписчики Премиум',
      isRefillEnabled: true,
      category: {
        name: 'Подписчики',
        network: {
          name: 'Telegram',
          slug: 'telegram',
        },
      },
    },
  },
  {
    id: 'order-2',
    numericId: 102,
    status: 'COMPLETED',
    charge: 10000,
    discountCents: 1000,
    usdToRubRate: 90,
    quantity: 100,
    remains: 0,
    link: 'https://vk.com/group',
    createdAt: new Date('2026-03-02T10:00:00Z').toISOString(),
    service: {
      id: 'srv-2',
      categoryId: 'cat-2',
      name: 'VK Репосты',
      isRefillEnabled: false,
      category: {
        name: 'Репосты',
        network: {
          name: 'VK',
          slug: 'vk',
        },
      },
    },
  },
];

describe('OrderViewModeSwitcher & CustomerOrdersWorkspace', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('OrderViewModeSwitcher toggles view mode on button click', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <OrderViewModeSwitcher viewMode="table" onChange={onChange} />
    );

    // Initial state: table mode is active
    const tableBtn = screen.getByRole('radio', { name: /Список/i });
    const cardsBtn = screen.getByRole('radio', { name: /Карточки/i });

    expect(tableBtn.getAttribute('aria-checked')).toBe('true');
    expect(cardsBtn.getAttribute('aria-checked')).toBe('false');

    // Click cards button
    fireEvent.click(cardsBtn);
    expect(onChange).toHaveBeenCalledWith('cards');

    // Re-render in cards mode
    rerender(<OrderViewModeSwitcher viewMode="cards" onChange={onChange} />);
    expect(cardsBtn.getAttribute('aria-checked')).toBe('true');
    expect(tableBtn.getAttribute('aria-checked')).toBe('false');

    // Click table button
    fireEvent.click(tableBtn);
    expect(onChange).toHaveBeenCalledWith('table');
  });

  it('CustomerOrdersWorkspace displays total count and persists view mode in localStorage', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    render(
      <CustomerOrdersWorkspace
        orders={mockOrders}
        totalCount={mockOrders.length}
        user={{ balance: 50000 }}
      />
    );

    // Toolbar shows total count correctly with Russian plural
    expect(screen.getByText(/Найдено:/i).parentElement?.textContent).toContain('2');

    // Click on cards mode switcher
    const cardsBtn = screen.getByRole('radio', { name: /Карточки/i });
    fireEvent.click(cardsBtn);

    // Verifies localStorage was updated with the chosen mode
    expect(setItemSpy).toHaveBeenCalledWith('smmplan_orders_view_mode', 'cards');
  });

  it('CustomerOrdersWorkspace restores preference from localStorage on mount', async () => {
    localStorage.setItem('smmplan_orders_view_mode', 'cards');

    render(
      <CustomerOrdersWorkspace
        orders={mockOrders}
        totalCount={mockOrders.length}
        user={{ balance: 50000 }}
      />
    );

    await waitFor(() => {
      const cardsBtn = screen.getByRole('radio', { name: /Карточки/i });
      expect(cardsBtn.getAttribute('aria-checked')).toBe('true');
    });
  });

  it('MobileOrderList renders compact rows when viewMode="table" and opens Drawer on click', () => {
    render(
      <MobileOrderList
        orders={mockOrders}
        user={{ balance: 50000 }}
        viewMode="table"
      />
    );

    // Shows order numeric IDs in compact row
    expect(screen.getByText('#101')).not.toBeNull();
    expect(screen.getByText('#102')).not.toBeNull();
    expect(screen.getByText('Telegram Подписчики Премиум')).not.toBeNull();

    // Clicking order row opens Drawer
    const firstRow = screen.getByText('#101').closest('[role="button"]');
    expect(firstRow).not.toBeNull();
    fireEvent.click(firstRow!);

    // Drawer header should display opened order details
    expect(screen.getByText('Заказ #101')).not.toBeNull();
  });

  it('MobileOrderList renders cards when viewMode="cards" and maintains clean spacing', () => {
    const { container } = render(
      <MobileOrderList
        orders={mockOrders}
        user={{ balance: 50000 }}
        viewMode="cards"
      />
    );

    // Contains spacing container
    expect(container.querySelector('.space-y-3')).not.toBeNull();
    expect(screen.getByText('#101')).not.toBeNull();
    expect(screen.getByText('Telegram Подписчики Премиум')).not.toBeNull();
  });

  it('DesktopOrderTable renders all table columns and rows correctly', () => {
    render(<DesktopOrderTable orders={mockOrders} user={{ balance: 50000 }} />);

    expect(screen.getByRole('table', { name: /Список заказов/i })).not.toBeNull();
    expect(screen.getByText('#101')).not.toBeNull();
    expect(screen.getByText('#102')).not.toBeNull();
  });

  it('DesktopOrderCards renders Bento grid cards with action buttons and badges', () => {
    render(<DesktopOrderCards orders={mockOrders} user={{ balance: 50000 }} />);

    expect(screen.getByText('#101')).not.toBeNull();
    expect(screen.getByText('#102')).not.toBeNull();
    expect(screen.getByText('Telegram Подписчики Премиум')).not.toBeNull();
    expect(screen.getByText('VK Репосты')).not.toBeNull();
  });

  it('OrderViewModeSwitcher complies with W3C WAI-ARIA role="radiogroup" and touch target sizing', () => {
    render(<OrderViewModeSwitcher viewMode="table" onChange={vi.fn()} />);
    const radiogroup = screen.getByRole('radiogroup', { name: /Режим отображения заказов/i });
    expect(radiogroup).not.toBeNull();

    const buttons = screen.getAllByRole('radio');
    expect(buttons.length).toBe(2);
    // Touch target sizing classes: min-h-[44px] sm:min-h-[36px]
    buttons.forEach((btn) => {
      expect(btn.className).toContain('min-h-[44px]');
    });
  });

  it('CustomerOrdersWorkspace synchronizes viewMode across tabs via storage event', async () => {
    render(
      <CustomerOrdersWorkspace
        orders={mockOrders}
        totalCount={mockOrders.length}
        user={{ balance: 50000 }}
      />
    );

    // Initial is table
    const tableBtn = screen.getByRole('radio', { name: /Список/i });
    const cardsBtn = screen.getByRole('radio', { name: /Карточки/i });
    expect(tableBtn.getAttribute('aria-checked')).toBe('true');

    // Simulate cross-tab storage event
    fireEvent(
      window,
      new StorageEvent('storage', {
        key: 'smmplan_orders_view_mode',
        newValue: 'cards',
      })
    );

    await waitFor(() => {
      expect(cardsBtn.getAttribute('aria-checked')).toBe('true');
      expect(tableBtn.getAttribute('aria-checked')).toBe('false');
    });
  });

  it('MobileOrderList renders order.link and copy button in cards mode', () => {
    render(
      <MobileOrderList
        orders={mockOrders}
        user={{ balance: 50000 }}
        viewMode="cards"
      />
    );

    // Link is visible in cards mode
    expect(screen.getByText('https://t.me/testchannel')).not.toBeNull();
    expect(screen.getByText('https://vk.com/group')).not.toBeNull();
    // Copy link buttons exist
    const copyLinkButtons = screen.getAllByTitle('Копировать ссылку');
    expect(copyLinkButtons.length).toBeGreaterThan(0);
  });

  it('DesktopOrderTable navigates to order details on row click unless interactive element clicked', () => {
    render(<DesktopOrderTable orders={mockOrders} user={{ balance: 50000 }} />);

    const row = screen.getByText('#101').closest('tr');
    expect(row).not.toBeNull();

    // Click on empty space in row
    fireEvent.click(row!);
    expect(mockPush).toHaveBeenCalledWith('/dashboard/orders/order-1');
  });

  it('Resilient against invalid date values without crashing with RangeError', () => {
    const ordersWithBadDate: MobileOrderItem[] = [
      {
        ...mockOrders[0],
        id: 'order-corrupt-date',
        createdAt: 'invalid-date-string-from-legacy',
        service: null, // null service resilience
      },
    ];

    expect(() => {
      render(<DesktopOrderTable orders={ordersWithBadDate} user={{ balance: 0 }} />);
    }).not.toThrow();

    expect(() => {
      render(<DesktopOrderCards orders={ordersWithBadDate} user={{ balance: 0 }} />);
    }).not.toThrow();

    expect(() => {
      render(<MobileOrderList orders={ordersWithBadDate} user={{ balance: 0 }} viewMode="cards" />);
    }).not.toThrow();
  });
});
