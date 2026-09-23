import { describe, it, expect } from 'vitest';
import { escapeHtml, sanitizeArticleHtml } from '@/lib/sanitize';

describe('XSS-01: Legal Requisites HTML Escaping and Sanitization', () => {
  it('neutralizes HTML tags and attributes in escapeHtml', () => {
    const maliciousPayloads = [
      { input: '<img src=x onerror=alert(1)>', expected: '&lt;img src=x onerror=alert(1)&gt;' },
      { input: '<script>alert("XSS")</script>', expected: '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;' },
      { input: '<a href="javascript:alert(1)">Click</a>', expected: '&lt;a href=&quot;javascript:alert(1)&quot;&gt;Click&lt;/a&gt;' },
      { input: 'ИП Иванов & Партнеры <"ООО">', expected: 'ИП Иванов &amp; Партнеры &lt;&quot;ООО&quot;&gt;' },
    ];

    for (const { input, expected } of maliciousPayloads) {
      expect(escapeHtml(input)).toBe(expected);
    }
  });

  it('escapes requisites before substitution into legal HTML document', () => {
    const template = `
      <p>Организация: {{COMPANY_NAME}}</p>
      <p>ИНН: {{COMPANY_INN}}</p>
      <p>Адрес: {{COMPANY_ADDRESS}}</p>
      <p>Email: {{SUPPORT_EMAIL}}</p>
    `;

    const maliciousSettings = {
      COMPANY_NAME: '<img src=x onerror=alert(1)> ООО "Рога и Копыта"',
      COMPANY_INN: '7700000000<script>alert(2)</script>',
      COMPANY_ADDRESS: 'г. Москва <iframe src="evil.com"></iframe>',
      SUPPORT_EMAIL: 'support@smmplan.pro" onmouseover="alert(3)',
    };

    let substituted = template
      .replace(/{{COMPANY_NAME}}/g, escapeHtml(maliciousSettings.COMPANY_NAME))
      .replace(/{{COMPANY_INN}}/g, escapeHtml(maliciousSettings.COMPANY_INN))
      .replace(/{{COMPANY_ADDRESS}}/g, escapeHtml(maliciousSettings.COMPANY_ADDRESS))
      .replace(/{{SUPPORT_EMAIL}}/g, escapeHtml(maliciousSettings.SUPPORT_EMAIL));

    const finalHtml = sanitizeArticleHtml(substituted);

    // The injected payloads must NOT appear as executable raw HTML tags
    expect(finalHtml).not.toContain('<img src=x onerror=alert(1)>');
    expect(finalHtml).not.toContain('<script>');
    expect(finalHtml).not.toContain('<iframe');

    // The text representation should be preserved safely as escaped entities
    expect(finalHtml).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(finalHtml).toContain('&lt;script&gt;alert(2)&lt;/script&gt;');
    expect(finalHtml).toContain('&lt;iframe src="evil.com"&gt;&lt;/iframe&gt;');
  });

  it('prevents attribute breakout when requisite is used inside an HTML attribute', () => {
    const template = `<a href="mailto:{{SUPPORT_EMAIL}}" title="{{COMPANY_NAME}}">Contact</a>`;
    const maliciousPayload = 'test@example.com" bad="evil';
    const substituted = template
      .replace(/{{SUPPORT_EMAIL}}/g, escapeHtml(maliciousPayload))
      .replace(/{{COMPANY_NAME}}/g, escapeHtml('<script>alert(1)</script>'));

    const finalHtml = sanitizeArticleHtml(substituted);
    // Attribute breakout must be prevented: bad attribute is inside href value, script is escaped
    expect(finalHtml).toContain('href="mailto:test@example.com&quot; bad=&quot;evil"');
    expect(finalHtml).not.toContain('<script>');
    expect(finalHtml).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
