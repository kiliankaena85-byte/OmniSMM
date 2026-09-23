import { describe, it, expect } from 'vitest';
import { parseSmartTemplate } from '@/components/support/chat/input/chat-template-parser';
import type { ChatInputOrder } from '@/components/support/chat/ChatInput';

describe('chat-template-parser (SPEC-2026-WAVE-9)', () => {
  it('correctly replaces basic user, email, domain and ticket macros', () => {
    const raw = 'Здравствуйте, {user_name}! Домен: {domain}. Тикет: {ticket_id}. Email: {email}';
    const parsed = parseSmartTemplate(raw, {
      ticketId: 'tick_123',
      clientEmail: 'alex@example.com',
      domain: 'smmplan.pro',
    });

    expect(parsed).toBe('Здравствуйте, alex! Домен: smmplan.pro. Тикет: tick_123. Email: alex@example.com');
  });

  it('correctly replaces order-specific macros when an order is selected', () => {
    const order: ChatInputOrder = {
      id: 'ord_99998888',
      numericId: 54321,
      status: 'PROCESSING',
      charge: 150,
      serviceName: 'Telegram Подписчики Премиум',
    };

    const raw = 'По заказу #{order_id} ({service_name}) статус: {order_status}.';
    const parsed = parseSmartTemplate(raw, {
      ticketId: 'tick_123',
      selectedOrder: order,
    });

    expect(parsed).toBe('По заказу #54321 (Telegram Подписчики Премиум) статус: В работе.');
  });

  it('falls back to gentle defaults when no order is provided', () => {
    const raw = 'Информация по заказу #{order_id}: статус {order_status}. Услуга: {service_name}';
    const parsed = parseSmartTemplate(raw, {
      ticketId: 'tick_123',
    });

    expect(parsed).toBe('Информация по заказу #указанному заказу: статус обрабатывается. Услуга: выбранной услуге');
  });

  it('correctly formats localized date {current_date}', () => {
    const raw = 'Сегодняшняя дата: {current_date}';
    const parsed = parseSmartTemplate(raw, { ticketId: 'tick_123' });
    const expectedDate = new Date().toLocaleDateString('ru-RU');
    expect(parsed).toBe(`Сегодняшняя дата: ${expectedDate}`);
  });
});
