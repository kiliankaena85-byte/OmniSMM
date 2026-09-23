import { describe, it, expect } from 'vitest';
import { AdminAiSanitizerService } from '@/services/admin/ai-manual/admin-ai-sanitizer.service';

describe('AdminAiSanitizerService', () => {
  it('masks credit card numbers correctly', () => {
    const raw = 'Пользователь оплатил картой 4276 3800 1234 5678 в чеке';
    const sanitized = AdminAiSanitizerService.sanitizeInput(raw);
    expect(sanitized).toContain('[CARD_REDACTED_...5678]');
    expect(sanitized).not.toContain('4276');
  });

  it('masks phone numbers', () => {
    const raw = 'Номер клиента +7 (999) 123-45-67 для подтверждения';
    const sanitized = AdminAiSanitizerService.sanitizeInput(raw);
    expect(sanitized).toContain('[PHONE_REDACTED]');
    expect(sanitized).not.toContain('999');
  });

  it('masks email addresses preserving domain', () => {
    const raw = 'Почта пользователя ivanov.alex@yandex.ru в базе';
    const sanitized = AdminAiSanitizerService.sanitizeInput(raw);
    expect(sanitized).toContain('@yandex.ru');
    expect(sanitized).not.toContain('ivanov.alex');
  });

  it('masks API keys and secrets in text', () => {
    const raw = 'Параметр yookassaSecretKey="live_secret_key_1234567890abcdef12345"';
    const sanitized = AdminAiSanitizerService.sanitizeInput(raw);
    expect(sanitized).toContain('[REDACTED_SECRET]');
    expect(sanitized).not.toContain('live_secret_key');
  });

  it('sanitizes code snippets from secret strings', () => {
    const code = 'const token = "AIzaSyD-1234567890abcdefghijklmnopqrstu";';
    const sanitized = AdminAiSanitizerService.sanitizeCodeSnippet(code);
    expect(sanitized).toContain('[REDACTED_SECRET]');
    expect(sanitized).not.toContain('AIzaSyD');
  });
});
