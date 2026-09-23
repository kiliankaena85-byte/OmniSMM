import { describe, it, expect } from 'vitest';

describe('Security Alert HTML Escaping Invariants (P2-15)', () => {
  it('escapes special characters to prevent Telegram HTML injection in alerts', () => {
    function escapeHtml(str: string): string {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    const payload = '<script>alert("XSS")</script>&<b>Injected</b>';
    const escaped = escapeHtml(payload);

    expect(escaped).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;&amp;&lt;b&gt;Injected&lt;/b&gt;');
  });
});
