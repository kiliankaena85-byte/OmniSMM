/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderFilters } from '@/components/orders/OrderFilters';
import { MobileOrderList } from '@/components/orders/MobileOrderList';
import { ClassicDashboardShell } from '@/components/dashboard/classic/ClassicDashboardShell';
import { FluxDashboardShell } from '@/components/dashboard/flux/FluxDashboardShell';
import { BalanceDisplay } from '@/components/dashboard/balance/BalanceDisplay';

// Mock Next.js router and hooks
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard/orders',
}));

// Mock icons
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  return {
    ...actual,
  };
});

describe('Mobile Orders Layout & Viewport Responsiveness (Rule 9 / Mobile-First)', () => {
  it('OrderFilters renders a balanced 2-column mobile grid and full-width CTA without dead space', () => {
    const { container } = render(
      <OrderFilters
        initialSearch=""
        initialStatus="ALL"
        initialNetwork="ALL"
        availableNetworks={[
          { slug: 'telegram', name: 'Telegram' },
          { slug: 'vk', name: 'VK' },
        ]}
        currentPage={1}
        totalPages={1}
        statusCounts={{ PENDING: 2 }}
      />
    );

    // Form should have responsive direction and padding
    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    expect(form?.className).toContain('flex-col');
    expect(form?.className).toContain('sm:flex-row');

    // Filter dropdowns container must use grid-cols-2 on mobile for equal width
    const dropdownGrid = container.querySelector('.grid.grid-cols-2');
    expect(dropdownGrid).not.toBeNull();
    expect(dropdownGrid?.className).toContain('sm:flex');

    // Apply button must be flex-1 on mobile so there is no awkward dead space
    const applyButton = screen.getByRole('button', { name: /Применить/i });
    expect(applyButton.className).toContain('flex-1');
    expect(applyButton.className).toContain('sm:flex-initial');
  });

  it('MobileOrderList renders orders cleanly with space-y-3 and no negative margin overflow', () => {
    const mockOrders = [
      {
        id: 'order-1',
        numericId: 176,
        status: 'PENDING',
        charge: 360,
        discountCents: 0,
        usdToRubRate: 90,
        quantity: 100,
        remains: 100,
        link: 'https://t.me/channel',
        createdAt: new Date().toISOString(),
        service: {
          id: 'srv-1',
          categoryId: 'cat-1',
          name: 'Telegram Подписчики [Гарантия]',
          isRefillEnabled: false,
          category: {
            name: 'Подписчики',
            network: {
              name: 'Telegram',
              slug: 'telegram',
            },
          },
        },
      },
    ];

    const { container } = render(
      <MobileOrderList orders={mockOrders} user={{ balance: 1000 }} />
    );

    // Must NOT contain negative horizontal margins that clip cards
    const negativeMarginEl = container.querySelector('.-mx-4');
    expect(negativeMarginEl).toBeNull();

    // Must use clean vertical spacing
    const listContainer = container.querySelector('.space-y-3');
    expect(listContainer).not.toBeNull();

    // Must render order numeric id and service name
    expect(screen.getByText('#176')).not.toBeNull();
    expect(screen.getByText('Telegram Подписчики [Гарантия]')).not.toBeNull();
  });

  it('ClassicDashboardShell mobile top bar prevents horizontal overflow with compact items', () => {
    const mockUser = {
      email: 'tester@smmplan.pro',
      balanceCents: 1920,
      unreadTicketsCount: 0,
    };

    const { container } = render(
      <ClassicDashboardShell user={mockUser}>
        <div>Page content</div>
      </ClassicDashboardShell>
    );

    // Mobile top bar element
    const mobileTopBar = container.querySelector('.md\\:hidden.fixed.top-0');
    expect(mobileTopBar).not.toBeNull();

    // "На главную" text badge in mobile top bar must be hidden on mobile screens (< sm)
    const homeBadge = mobileTopBar?.querySelector('span.hidden.sm\\:inline-block');
    expect(homeBadge).not.toBeNull();
    expect(homeBadge?.textContent).toContain('На главную');

    // Deposit button in mobile bar must have compact icon on mobile and text on sm+
    const depositBtn = mobileTopBar?.querySelector('a[href="/dashboard/finance"]');
    expect(depositBtn).not.toBeNull();
    expect(depositBtn?.querySelector('.hidden.sm\\:inline')).not.toBeNull();

    // Avatar link must be compact on mobile (w-8 h-8)
    const avatarLink = mobileTopBar?.querySelector('a[href="/dashboard/settings"]');
    expect(avatarLink).not.toBeNull();
    expect(avatarLink?.className).toContain('w-8');
    expect(avatarLink?.className).toContain('h-8');
    expect(avatarLink?.className).toContain('sm:w-10');

    // ThemeSwitcher must be hidden on screens narrower than 400px to prevent clipping
    const themeSwitcher = mobileTopBar?.querySelector('.hidden.min-\\[400px\\]\\:flex');
    expect(themeSwitcher).not.toBeNull();
  });

  it('BalanceDisplay variant mobile-header enforces truncation and max-w on long balances', () => {
    const { container } = render(
      <BalanceDisplay initialBalance="1 234 567.89 ₽" variant="mobile-header" />
    );

    const balanceText = container.querySelector('span');
    expect(balanceText).not.toBeNull();
    expect(balanceText?.className).toContain('truncate');
    expect(balanceText?.className).toContain('max-w-[95px]');
    expect(balanceText?.className).toContain('sm:max-w-none');
    expect(balanceText?.getAttribute('title')).toBe('1 234 567.89 ₽');
  });

  it('FluxDashboardShell mobile top bar prevents horizontal overflow with responsive padding and compact buttons', () => {
    const mockUser = {
      email: 'tester@smmflux.ru',
      balanceCents: 5000,
      tenantId: 'flux',
      unreadTicketsCount: 0,
    };

    const { container } = render(
      <FluxDashboardShell user={mockUser}>
        <div>Flux Content</div>
      </FluxDashboardShell>
    );

    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    expect(header?.className).toContain('px-2.5');
    expect(header?.className).toContain('sm:px-8');

    const depositBtn = header?.querySelector('a[aria-label="Пополнить баланс"]');
    expect(depositBtn).not.toBeNull();
    expect(depositBtn?.querySelector('.hidden.sm\\:inline')).not.toBeNull();

    const themeSwitcher = header?.querySelector('.hidden.min-\\[400px\\]\\:flex');
    expect(themeSwitcher).not.toBeNull();
  });
});
