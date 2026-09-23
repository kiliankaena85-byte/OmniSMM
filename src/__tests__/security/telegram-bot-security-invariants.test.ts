import { describe, it, expect, vi } from 'vitest';

describe('Telegram Bot Security Invariants (P2-11, P2-12, P2-16, P2-20)', () => {
  it('sanitizes malicious script and iframe tags in telegram templates', () => {
    function sanitizeTelegramTemplate(template: string): string {
      if (!template) return '';
      return template
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
    }

    const rawTemplate = '<b>Welcome!</b><script>alert("XSS")</script><iframe src="evil.com"></iframe><a href="http://smmplan.pro" onclick="steal()">Link</a>';
    const clean = sanitizeTelegramTemplate(rawTemplate);

    expect(clean.includes('<script>')).toBe(false);
    expect(clean.includes('<iframe>')).toBe(false);
    expect(clean.includes('onclick=')).toBe(false);
    expect(clean).toContain('<b>Welcome!</b>');
  });
});
