// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Pagination } from '@/components/ui/Pagination';
import { ServiceForm, validateUrl } from '@/components/admin/services/ServiceForm';
import { ServiceCard } from '@/components/catalog/ServiceCard';
import { CatalogGrid } from '@/components/catalog/CatalogGrid';
import { sanitizeServiceDescription } from '@/lib/sanitize';

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/catalog',
  useSearchParams: () => new URLSearchParams('page=1'),
}));

describe('Catalog UI/UX & Security Suite', () => {

  describe('1. Pagination Component', () => {
    it('renders pagination with correct total pages and items count', () => {
      render(
        <Pagination
          currentPage={1}
          totalPages={11}
          totalItems={125}
          pageSize={12}
        />
      );

      const summary = screen.getByText(/Показано/i);
      expect(summary).toBeDefined();
      expect(summary.textContent).toContain('1');
      expect(summary.textContent).toContain('12');
      expect(summary.textContent).toContain('125');
      
      const page1Btn = screen.getByRole('button', { name: /^Страница 1$/i });
      expect(page1Btn).toBeDefined();
      expect(page1Btn.getAttribute('aria-current')).toBe('page');

      const lastButton = screen.getByRole('button', { name: /Последняя/i });
      expect(lastButton).toBeDefined();
      expect(lastButton.getAttribute('aria-disabled')).toBe('false');
    });

    it('disables previous and first buttons on first page', () => {
      render(
        <Pagination
          currentPage={1}
          totalPages={5}
          totalItems={60}
          pageSize={12}
        />
      );

      const prevBtn = screen.getByRole('button', { name: /Назад/i });
      const firstBtn = screen.getByRole('button', { name: /Первая/i });
      expect(prevBtn.getAttribute('aria-disabled')).toBe('true');
      expect(firstBtn.getAttribute('aria-disabled')).toBe('true');
    });

    it('triggers onPageChange when clicking a page number', () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          currentPage={1}
          totalPages={5}
          totalItems={60}
          pageSize={12}
          onPageChange={onPageChange}
        />
      );

      const page2Btn = screen.getByRole('button', { name: /^Страница 2$/i });
      fireEvent.click(page2Btn);
      expect(onPageChange).toHaveBeenCalledWith(2);
    });
  });

  describe('2. ServiceForm & Real-time Calculator', () => {
    it('calculates selling price and profit in real-time', () => {
      render(<ServiceForm initialData={{ costPrice: 0, markupPercent: 20 }} />);
      
      const costInput = screen.getByLabelText(/Цена закупки/i);
      const markupInput = screen.getByLabelText(/Наценка/i);

      fireEvent.change(costInput, { target: { value: '100' } });
      fireEvent.change(markupInput, { target: { value: '20' } });

      expect(screen.getByText(/Итоговая цена: 120 ₽/i)).toBeDefined();
      const profitEl = screen.getByText(/Прибыль:/i);
      expect(profitEl).toBeDefined();
      expect(profitEl.textContent).toContain('20 ₽');
    });

    it('updates live calculation when markup changes to 50%', () => {
      render(<ServiceForm initialData={{ costPrice: 100, markupPercent: 20 }} />);
      
      const markupInput = screen.getByLabelText(/Наценка/i);
      fireEvent.change(markupInput, { target: { value: '50' } });

      expect(screen.getByText(/Итоговая цена: 150 ₽/i)).toBeDefined();
      const profitEl = screen.getByText(/Прибыль:/i);
      expect(profitEl).toBeDefined();
      expect(profitEl.textContent).toContain('50 ₽');
    });

    it('rejects invalid URLs with error status message', async () => {
      render(<ServiceForm />);
      
      const nameInput = screen.getByLabelText(/Название услуги/i);
      const urlInput = screen.getByLabelText(/Ссылка/i);
      const form = nameInput.closest('form')!;

      fireEvent.change(nameInput, { target: { value: 'Тестовая услуга' } });
      fireEvent.change(urlInput, { target: { value: 'not-a-valid-url' } });
      fireEvent.submit(form);

      await waitFor(() => {
        const errorMsg = screen.getByText(/Некорректный формат ссылки/i);
        expect(errorMsg).toBeDefined();
        expect(screen.getByRole('status')).toBeDefined();
      });
    });

    it('validateUrl helper correctly validates URLs', () => {
      expect(validateUrl('https://example.com/service/123')).toBe(true);
      expect(validateUrl('http://mysite.ru/services/10')).toBe(true);
      expect(validateUrl('not-a-url')).toBe(false);
      expect(validateUrl('ftp://invalid-proto')).toBe(false);
      expect(validateUrl('')).toBe(false);
    });
  });

  describe('3. XSS Protection & Sanitization', () => {
    it('discards dangerous script tags from description', () => {
      const dirtyHtml = '<script>alert("xss")</script><p>Безопасный <strong>текст</strong></p>';
      const clean = sanitizeServiceDescription(dirtyHtml);

      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('alert');
      expect(clean).toContain('<strong>текст</strong>');
    });

    it('renders ServiceCard with clamped text and safe description', () => {
      const mockService = {
        id: 'srv-1',
        name: 'Быстрые подписчики Telegram',
        description: '<b>Гарантия 30 дней</b><script>alert(1)</script>',
        pricePerUnitRub: 0.15,
        badge: 'ХИТ',
      };

      render(<ServiceCard service={mockService} />);
      
      expect(screen.getByText('Быстрые подписчики Telegram')).toBeDefined();
      expect(screen.getByText('0.15 ₽ / шт')).toBeDefined();
      expect(screen.getByText('ХИТ')).toBeDefined();
      expect(screen.queryByText(/alert/i)).toBeNull();
    });

    it('renders CatalogGrid empty state when list is empty', () => {
      render(<CatalogGrid services={[]} />);
      expect(screen.getByText(/Услуги не найдены/i)).toBeDefined();
    });
  });
});
