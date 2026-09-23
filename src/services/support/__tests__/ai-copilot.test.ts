import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiSupportCoPilotService } from '../ai-copilot.service';
import { GeminiClient } from '@/services/ai/gemini-client';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    ticket: {
      findUnique: vi.fn(),
    },
    order: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/services/ai/gemini-client', () => ({
  GeminiClient: {
    generateContent: vi.fn(),
  },
}));

describe('AiSupportCoPilotService (Enterprise Test Suite)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Test 1: Generates high-confidence draft using Gemini and ticket context', async () => {
    vi.mocked(db.ticket.findUnique).mockResolvedValue({
      id: 'ticket-101',
      subject: 'Завис заказ на просмотры',
      status: 'OPEN',
      tenantId: 'smmplan',
      user: {
        id: 'usr-1',
        email: 'client@example.com',
        balance: BigInt(150000), // 1500.00 RUB
        tenantId: 'smmplan',
        createdAt: new Date(),
      },
      messages: [
        { id: 'm-1', sender: 'USER', text: 'Здравствуйте, почему просмотры еще не пришли?', createdAt: new Date() },
      ],
    } as any);

    vi.mocked(db.order.findMany).mockResolvedValue([
      {
        id: 'ord-1',
        status: 'IN_PROGRESS',
        charge: BigInt(5000),
        createdAt: new Date(),
        service: { name: 'Telegram Просмотры HQ' },
      },
    ] as any);

    vi.mocked(GeminiClient.generateContent).mockResolvedValue(
      'Здравствуйте! Мы проверили ваш заказ #ord-1. Он находится в статусе выполнения у поставщика. Обычно запуск занимает от 15 минут. Пожалуйста, ожидайте.'
    );

    const result = await AiSupportCoPilotService.generateDraft('ticket-101');

    expect(result.success).toBe(true);
    expect(result.confidence).toBe('HIGH');
    expect(result.source).toBe('GEMINI_AI');
    expect(result.draftText).toContain('Здравствуйте!');
    expect(result.draftText).toContain('ord-1');
  });

  it('Test 2: Intercepts OutputPolicy violations (e.g. "гарантируем возврат на карту") and applies safe fallback', async () => {
    vi.mocked(db.ticket.findUnique).mockResolvedValue({
      id: 'ticket-102',
      subject: 'Верните деньги',
      status: 'OPEN',
      tenantId: 'smmplan',
      user: {
        id: 'usr-2',
        email: 'user2@example.com',
        balance: BigInt(0),
        tenantId: 'smmplan',
        createdAt: new Date(),
      },
      messages: [
        { id: 'm-2', sender: 'USER', text: 'Верните деньги на карту сбербанка!', createdAt: new Date() },
      ],
    } as any);

    vi.mocked(db.order.findMany).mockResolvedValue([]);

    // Gemini attempts to produce a hallucinated promise forbidden by policy
    vi.mocked(GeminiClient.generateContent).mockResolvedValue(
      'Мы гарантируем 100% вывод средств на карту в течение 5 минут.'
    );

    const result = await AiSupportCoPilotService.generateDraft('ticket-102');

    expect(result.success).toBe(true);
    // Policy violation should force fallback
    expect(result.source).toBe('DETERMINISTIC_FALLBACK');
    expect(result.draftText).not.toContain('вывод средств на карту');
    expect(result.warnings).toBeDefined();
    expect(result.warnings?.[0]).toContain('политикой безопасности');
  });

  it('Test 3: Gracefully falls back when Gemini API throws network or rate-limit error', async () => {
    vi.mocked(db.ticket.findUnique).mockResolvedValue({
      id: 'ticket-103',
      subject: 'Ошибка при пополнении баланса',
      status: 'OPEN',
      tenantId: 'flux',
      user: {
        id: 'usr-3',
        email: 'flux_user@example.com',
        balance: BigInt(5000),
        tenantId: 'flux',
        createdAt: new Date(),
      },
      messages: [],
    } as any);

    vi.mocked(db.order.findMany).mockResolvedValue([]);
    vi.mocked(GeminiClient.generateContent).mockRejectedValue(new Error('503 Service Unavailable'));

    const result = await AiSupportCoPilotService.generateDraft('ticket-103');

    expect(result.success).toBe(true);
    expect(result.confidence).toBe('FALLBACK');
    expect(result.source).toBe('DETERMINISTIC_FALLBACK');
    expect(result.draftText).toContain('SMMflux');
  });

  it('Test 4: Correctly adapts brand tone between SMMplan and SMMflux', async () => {
    vi.mocked(db.ticket.findUnique).mockResolvedValue({
      id: 'ticket-104',
      subject: 'Вопрос по заказу',
      status: 'OPEN',
      tenantId: 'flux',
      user: {
        id: 'usr-4',
        email: 'flux@test.ru',
        balance: BigInt(10000),
        tenantId: 'flux',
        createdAt: new Date(),
      },
      messages: [],
    } as any);

    vi.mocked(db.order.findMany).mockResolvedValue([]);
    vi.mocked(GeminiClient.generateContent).mockResolvedValue(
      'Привет! Спасибо за обращение в SMMflux. Проверяем ваш запрос.'
    );

    const result = await AiSupportCoPilotService.generateDraft('ticket-104');

    expect(result.success).toBe(true);
    expect(result.draftText).toContain('SMMflux');
  });

  it('Test 5: Returns error if ticket does not exist', async () => {
    vi.mocked(db.ticket.findUnique).mockResolvedValue(null);

    const result = await AiSupportCoPilotService.generateDraft('non-existent-id');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Тикет не найден');
  });
});
