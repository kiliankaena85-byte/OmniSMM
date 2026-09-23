// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { CookieConsent } from '@/components/common/CookieConsent';

let mockPathname = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('CookieConsent & Auth Auto-Consent Suite (SPEC-2026-09-18)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockPathname = '/';
    // Reset cookies & localStorage in jsdom
    document.cookie = 'cookie_consent=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('suppresses banner and auto-sets cookie_consent on /dashboard routes', () => {
    mockPathname = '/dashboard';
    const { container } = render(<CookieConsent />);

    expect(container.firstChild).toBeNull();
    expect(document.cookie).toContain('cookie_consent=true');
    expect(localStorage.getItem('cookie_consent')).toBe('true');
  });

  it('suppresses banner on /dashboard/orders and child routes', () => {
    mockPathname = '/dashboard/orders';
    const { container } = render(<CookieConsent />);

    expect(container.firstChild).toBeNull();
    expect(document.cookie).toContain('cookie_consent=true');
  });

  it('suppresses banner on /admin routes without setting public consent', () => {
    mockPathname = '/admin/dashboard';
    const { container } = render(<CookieConsent />);

    expect(container.firstChild).toBeNull();
  });

  it('displays banner on public landing page / when consent is missing', () => {
    mockPathname = '/';
    render(<CookieConsent />);

    // Initially hidden before timer
    expect(screen.queryByText(/Мы используем файлы cookie/i)).toBeNull();

    // Advance 1000ms delay
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(screen.getByText(/Мы используем файлы cookie/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Принять/i })).toBeDefined();
  });

  it('hides banner on public landing page / if cookie_consent already exists', () => {
    mockPathname = '/';
    document.cookie = 'cookie_consent=true';
    render(<CookieConsent />);

    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(screen.queryByText(/Мы используем файлы cookie/i)).toBeNull();
  });
});
