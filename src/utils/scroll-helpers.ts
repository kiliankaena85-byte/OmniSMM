/**
 * Safe scroll & focus utilities conforming to W3C and zero-regression standards.
 * Prevents unwanted viewport jumps when focusing inputs, checkboxes, or handling validation.
 */

export function scrollIntoViewIfNeeded(element: HTMLElement | null, offset = 80): void {
  if (!element || typeof window === 'undefined') return;
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const isVisible = rect.top >= offset && rect.bottom <= viewportHeight - 20;
  if (!isVisible) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

export function safeFocus(element: HTMLElement | null, shouldScrollIfNeeded = false): void {
  if (!element || typeof window === 'undefined') return;
  try {
    element.focus({ preventScroll: true });
    if (shouldScrollIfNeeded) {
      scrollIntoViewIfNeeded(element);
    }
  } catch {
    // Fallback in older environments
    element.focus();
  }
}
