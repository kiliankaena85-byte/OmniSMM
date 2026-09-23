/**
 * scripts/qa-sentinel/dom-inspector.ts
 *
 * Модуль сенсорного анализа DOM, геометрии и фильтрации консольных/сетевых событий.
 */

import { DomInspectionResult, OverflowElementInfo } from './types';

/**
 * Игнорирование некритичного фонового шума в DevTools
 */
export function isBenignConsoleError(msg: string): boolean {
  const lower = msg.toLowerCase();
  
  // Игнорируем фоновые ошибки фавиконок
  if (lower.includes('favicon.ico')) return true;

  // Игнорируем блокировку внешних трекеров браузером / adblock
  if (lower.includes('yandex.ru') || lower.includes('metrika') || lower.includes('google-analytics')) return true;

  // Игнорируем информационные сообщения dev-сервера Next.js / Turbopack
  if (lower.includes('[hmr]') || lower.includes('_clientmiddlewaremanifest')) return true;

  // Игнорируем сообщения об отмене fetch при быстром переключении
  if (lower.includes('aborterror') || lower.includes('the user aborted a request')) return true;

  return false;
}

/**
 * Детекция ошибок гидратации React 19 / Next.js 16
 */
export function isHydrationError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('hydration failed') ||
    lower.includes('text content does not match') ||
    lower.includes('did not match') ||
    lower.includes('error while hydrating') ||
    lower.includes('minified react error #418') ||
    lower.includes('minified react error #423') ||
    lower.includes('minified react error #425')
  );
}

/**
 * Построение читаемого CSS-селектора для элемента-виновника
 */
export function generateElementSelector(el: { tagName: string; id?: string; className?: string }): string {
  const tag = el.tagName.toLowerCase();
  if (el.id && el.id.trim().length > 0) {
    return `${tag}#${el.id.trim()}`;
  }

  if (el.className && typeof el.className === 'string' && el.className.trim().length > 0) {
    // Берем первые 3 осмысленных класса (без пробелов)
    const classes = el.className
      .trim()
      .split(/\s+/)
      .filter((c) => c && !c.includes(':') && !c.includes('[') && !c.includes('/'))
      .slice(0, 3);
    if (classes.length > 0) {
      return `${tag}.${classes.join('.')}`;
    }
  }

  return tag;
}

/**
 * Определение итогового статуса экрана
 */
export function calculateScreenStatus(
  consoleErrors: string[],
  failedRequests: Array<{ url: string; status: number }>,
  domMetrics: DomInspectionResult
): 'PASS' | 'WARN' | 'FAIL' {
  // 1. Критические ошибки (FAIL)
  if (consoleErrors.length > 0) return 'FAIL';
  if (domMetrics.hasHorizontalScroll && domMetrics.overflowPixels > 2) return 'FAIL';
  if (domMetrics.hydrationErrorDetected) return 'FAIL';

  const criticalNetworkFails = failedRequests.filter((r) => r.status >= 500);
  if (criticalNetworkFails.length > 0) return 'FAIL';

  // 2. Предупреждения (WARN)
  if (domMetrics.smallTouchTargetsCount > 5) return 'WARN';
  if (failedRequests.length > 0) return 'WARN';
  if (domMetrics.overflowPixels > 0 && domMetrics.overflowPixels <= 2) return 'WARN';

  return 'PASS';
}

/**
 * JS-функция для выполнения внутри браузерного контекста через page.evaluate()
 */
export function browserDomScanner(): DomInspectionResult {
  const doc = document.documentElement;
  const body = document.body;
  const winWidth = window.innerWidth;
  const scrollWidth = Math.max(doc.scrollWidth, body ? body.scrollWidth : 0);
  const overflowPixels = Math.max(0, scrollWidth - winWidth);
  const hasHorizontalScroll = overflowPixels > 1;

  const overflowElements: OverflowElementInfo[] = [];

  if (hasHorizontalScroll) {
    const allElements = document.querySelectorAll('*');
    for (let i = 0; i < allElements.length; i++) {
      const node = allElements[i] as HTMLElement;
      if (!node.getBoundingClientRect) continue;

      const rect = node.getBoundingClientRect();
      // Элемент выступает за правый край видимой области более чем на 2px
      if (rect.right > winWidth + 2) {
        const tag = node.tagName ? node.tagName.toLowerCase() : 'div';
        const id = node.id ? `#${node.id}` : '';
        let classStr = '';
        if (node.className && typeof node.className === 'string') {
          const cls = node.className
            .split(/\s+/)
            .filter((c) => c && !c.includes(':') && !c.includes('[') && !c.includes('/'))
            .slice(0, 3)
            .join('.');
          if (cls) classStr = `.${cls}`;
        }

        overflowElements.push({
          selector: `${tag}${id}${classStr}`,
          tagName: tag,
          className: typeof node.className === 'string' ? node.className : '',
          boundingWidth: Math.round(rect.width),
          overflowAmount: Math.round(rect.right - winWidth),
        });

        // Ограничиваем список первыми 5 наиболее показательными элементами
        if (overflowElements.length >= 5) break;
      }
    }
  }

  // Проверка Touch Target (< 44px) на мобильных экранах (ширина <= 480)
  let smallTouchTargetsCount = 0;
  if (winWidth <= 480) {
    const interactives = document.querySelectorAll('button, a[href], input:not([type="hidden"]), select');
    interactives.forEach((el) => {
      const rect = el.getBoundingClientRect();
      // Исключаем скрытые или нулевые элементы
      if (rect.width > 0 && rect.height > 0) {
        if (rect.width < 40 || rect.height < 40) {
          smallTouchTargetsCount++;
        }
      }
    });
  }

  return {
    hasHorizontalScroll,
    scrollWidth,
    innerWidth: winWidth,
    overflowPixels,
    overflowElements,
    hydrationErrorDetected: false, // выставляется снаружи через перехватчик консоли
    smallTouchTargetsCount,
  };
}
