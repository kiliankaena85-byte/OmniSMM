/**
 * Safe scroll & focus utilities conforming to W3C and zero-regression standards.
 * Prevents unwanted viewport jumps when focusing inputs, checkboxes, or handling validation.
 */

export function scrollIntoViewIfNeeded(element: HTMLElement | null, offset = 85): void {
  if (!element || typeof window === 'undefined') return;
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const isMobile = window.innerWidth < 768;

  // On mobile, the on-screen keyboard takes ~40-50% of the screen height.
  // To avoid bouncing, ensure the input sits comfortably in the upper safe zone (below header).
  const safeBottomLimit = isMobile ? viewportHeight * 0.45 : viewportHeight - 100;
  const isComfortablyVisible = rect.top >= offset && rect.bottom <= safeBottomLimit;

  if (!isComfortablyVisible) {
    const targetY = window.pageYOffset + rect.top - offset;
    window.scrollTo({
      top: Math.max(0, targetY),
      behavior: 'smooth'
    });
  }
}

export function safeFocus(element: HTMLElement | null, shouldScrollIfNeeded = false, offset = 85): void {
  if (!element || typeof window === 'undefined') return;

  const isTextInput = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;

  if (shouldScrollIfNeeded) {
    scrollIntoViewIfNeeded(element, offset);
  }

  // If scrolling on mobile for a text input, delay focus slightly so smooth scroll doesn't fight the opening keyboard
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  if (shouldScrollIfNeeded && isMobile && isTextInput) {
    setTimeout(() => {
      try {
        element.focus({ preventScroll: true });
      } catch {
        element.focus();
      }
    }, 180);
  } else {
    try {
      element.focus({ preventScroll: true });
    } catch {
      element.focus();
    }
  }
}
