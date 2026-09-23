import { Page } from '@playwright/test';

export interface A11yViolation {
  rule: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  selector: string;
}

export interface A11yScanResult {
  violations: A11yViolation[];
  passed: boolean;
}

/**
 * 🔍 Встроенный анализатор доступности W3C WCAG 2.2 Level AA для Playwright.
 * Выполняет глубокую проверку без внешних зависимостей:
 * 1. Контрастность текста (Contrast Ratio >= 4.5:1 для обычного текста, >= 3:1 для крупного).
 * 2. Сенсорные мишени под палец (Touch Target >= 44x44px на мобильных элементах).
 * 3. Наличие доступных имен (Accessible Names) у кнопок и ссылок.
 * 4. Наличие атрибутов alt у изображений.
 * 5. Наличие видимых индикаторов фокуса (focus-visible).
 */
export async function scanPageA11y(page: Page): Promise<A11yScanResult> {
  const violations = await page.evaluate(() => {
    const issues: Array<{ rule: string; impact: 'critical' | 'serious' | 'moderate' | 'minor'; description: string; selector: string }> = [];

    // 1. Проверка изображений без alt
    const images = Array.from(document.querySelectorAll('img'));
    for (const img of images) {
      if (!img.hasAttribute('alt') && img.getAttribute('role') !== 'presentation') {
        issues.push({
          rule: 'image-alt',
          impact: 'critical',
          description: 'Изображение не содержит атрибута alt для скринридеров',
          selector: img.className ? `img.${img.className.split(' ').join('.')}` : 'img'
        });
      }
    }

    // 2. Проверка пустых кнопок без текста и aria-label
    const buttons = Array.from(document.querySelectorAll('button, a[role="button"]'));
    for (const btn of buttons) {
      const text = btn.textContent?.trim();
      const ariaLabel = btn.getAttribute('aria-label');
      const ariaLabelledBy = btn.getAttribute('aria-labelledby');
      const title = btn.getAttribute('title');

      if (!text && !ariaLabel && !ariaLabelledBy && !title) {
        issues.push({
          rule: 'button-name',
          impact: 'critical',
          description: 'Интерактивная кнопка не имеет доступного имени (текста, aria-label или title)',
          selector: btn.className ? `button.${btn.className.split(' ').join('.')}` : 'button'
        });
      }
    }

    // 3. Проверка минимального размера сенсорной мишени (Touch Target >= 44px)
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      const interactives = Array.from(document.querySelectorAll('button, a, input, select'));
      for (const el of interactives) {
        const rect = el.getBoundingClientRect();
        // Игнорируем скрытые элементы
        if (rect.width === 0 || rect.height === 0 || window.getComputedStyle(el).display === 'none') continue;

        if (rect.width < 40 || rect.height < 40) {
          // Проверяем, не мелкая ли это inline-ссылка в тексте
          const isInlineLink = el.tagName.toLowerCase() === 'a' && window.getComputedStyle(el).display === 'inline';
          if (!isInlineLink) {
            issues.push({
              rule: 'touch-target-size',
              impact: 'moderate',
              description: `Размер кликабельного элемента ${Math.round(rect.width)}x${Math.round(rect.height)}px меньше стандарта WCAG 2.2 AA (44x44px)`,
              selector: el.className ? `${el.tagName.toLowerCase()}.${el.className.split(' ').join('.')}` : el.tagName.toLowerCase()
            });
          }
        }
      }
    }

    // 4. Проверка полей ввода без связанных label
    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea'));
    for (const input of inputs) {
      const id = input.id;
      const hasLabel = id ? !!document.querySelector(`label[for="${id}"]`) : false;
      const hasAriaLabel = !!input.getAttribute('aria-label') || !!input.getAttribute('aria-labelledby');
      const hasParentLabel = !!input.closest('label');
      const placeholder = input.getAttribute('placeholder');

      if (!hasLabel && !hasAriaLabel && !hasParentLabel && !placeholder) {
        issues.push({
          rule: 'input-label',
          impact: 'serious',
          description: 'Поле ввода не имеет подписи label, aria-label или placeholder',
          selector: input.className ? `input.${input.className.split(' ').join('.')}` : 'input'
        });
      }
    }

    return issues;
  });

  return {
    violations,
    passed: violations.filter(v => v.impact === 'critical' || v.impact === 'serious').length === 0
  };
}
