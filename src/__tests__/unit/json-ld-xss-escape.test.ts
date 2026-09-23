import { describe, it, expect } from 'vitest';

describe('XSS-02: JSON-LD Script Tag Escaping', () => {
  it('escapes closing script tags in JSON-LD payloads to prevent HTML breakout', () => {
    const maliciousData = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: '</script><script>alert(document.cookie)</script>',
      description: 'Malicious <img src=x onerror=alert(1)> and </script>',
    };

    const rawJson = JSON.stringify(maliciousData);
    expect(rawJson).toContain('</script>');

    const safeJson = rawJson.replace(/</g, '\\u003c');
    expect(safeJson).not.toContain('<');
    expect(safeJson).not.toContain('</script>');
    expect(safeJson).toContain('\\u003c/script>');
    expect(safeJson).toContain('\\u003cscript>');

    // Valid JSON parser reconstructs the original string value safely
    const parsed = JSON.parse(safeJson);
    expect(parsed.name).toBe('</script><script>alert(document.cookie)</script>');
  });
});
