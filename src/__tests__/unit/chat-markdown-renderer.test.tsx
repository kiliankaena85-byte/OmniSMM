/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ChatMarkdownRenderer } from '@/components/admin/ai-manual/sub/chat-markdown-renderer';

describe('ChatMarkdownRenderer Component', () => {
  it('1. Renders h4 for ### headings with proper text', () => {
    const markdown = '### 🛡️ Зомби-услуги и Карантин цен';
    const { container } = render(<ChatMarkdownRenderer content={markdown} />);

    const h4 = container.querySelector('h4');
    expect(h4).toBeTruthy();
    expect(h4?.textContent).toContain('🛡️ Зомби-услуги и Карантин цен');
  });

  it('2. Renders bullet items for * or - lines with bullet dots', () => {
    const markdown = '* Первый пункт списка\n- Второй пункт списка';
    const { container } = render(<ChatMarkdownRenderer content={markdown} />);

    const bullets = container.querySelectorAll('span.select-none');
    expect(bullets.length).toBe(2);
    expect(container.textContent).toContain('Первый пункт списка');
    expect(container.textContent).toContain('Второй пункт списка');
  });

  it('3. Renders strong and inline code properly', () => {
    const markdown = '**1. Зомби-услуги:** механизм `CAT-ZOMBIE-PURGE` в деле';
    const { container } = render(<ChatMarkdownRenderer content={markdown} />);

    const strong = container.querySelector('strong');
    const code = container.querySelector('code');

    expect(strong).toBeTruthy();
    expect(strong?.textContent).toBe('1. Зомби-услуги:');
    expect(code).toBeTruthy();
    expect(code?.textContent).toBe('CAT-ZOMBIE-PURGE');
  });

  it('4. Renders nested code inside bold tags **`CODE`**', () => {
    const markdown = 'Инвариант **`CAT-PRICE-QUARANTINE-30`** активен';
    const { container } = render(<ChatMarkdownRenderer content={markdown} />);

    const strong = container.querySelector('strong');
    const code = container.querySelector('code');

    expect(strong).toBeTruthy();
    expect(code).toBeTruthy();
    expect(strong?.contains(code)).toBe(true);
    expect(code?.textContent).toBe('CAT-PRICE-QUARANTINE-30');
  });

  it('5. Renders internal next/link for [label](/internal/url)', () => {
    const markdown = 'Смотрите [Импорт каталога](/admin/providers/import)';
    const { container } = render(<ChatMarkdownRenderer content={markdown} />);

    const link = container.querySelector('a');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('/admin/providers/import');
    expect(link?.textContent).toContain('Импорт каталога');
  });

  it('6. Handles unclosed markdown tokens safely without errors', () => {
    const partial = 'Стриминг **незавершенный жирный `код';
    expect(() => render(<ChatMarkdownRenderer content={partial} />)).not.toThrow();
  });
});
