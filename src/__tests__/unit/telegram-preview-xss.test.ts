import { describe, it, expect } from 'vitest';
import { sanitizeTelegramPreviewHtml } from '@/lib/sanitize';

describe('XSS-03: Telegram Live Preview Template Sanitization', () => {
  it('strips script tags and malicious event handlers from templates', () => {
    const malicious = 'Привет! <script>alert("XSS")</script><img src="x" onerror="alert(1)"> <b>Ваш баланс:</b> 100 ₽';
    const sanitized = sanitizeTelegramPreviewHtml(malicious);

    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('alert("XSS")');
    expect(sanitized).not.toContain('<img');
    expect(sanitized).not.toContain('onerror');
    expect(sanitized).toContain('<b>Ваш баланс:</b> 100 ₽');
  });

  it('strips iframes, javascript: pseudo-protocols and unauthorized tags', () => {
    const malicious = '<iframe src="http://evil.com"></iframe><a href="javascript:alert(1)">Ссылка</a>';
    const sanitized = sanitizeTelegramPreviewHtml(malicious);

    expect(sanitized).not.toContain('<iframe');
    expect(sanitized).not.toContain('evil.com');
    expect(sanitized).not.toContain('javascript:');
  });

  it('preserves valid Telegram HTML tags (b, i, u, code, a, br)', () => {
    const valid = '✅ <b>Успешно!</b><br/>Пожалуйста, перейдите в <a href="https://smmplan.pro">кабинет</a>. Код: <code>12345</code>';
    const sanitized = sanitizeTelegramPreviewHtml(valid);

    expect(sanitized).toContain('<b>Успешно!</b>');
    expect(sanitized).toContain('<br />');
    expect(sanitized).toContain('<a href="https://smmplan.pro">кабинет</a>');
    expect(sanitized).toContain('<code>12345</code>');
  });
});
