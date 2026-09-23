/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GlobalError from '@/app/global-error';

describe('GlobalError Root Error Boundary Component', () => {
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('logs structured error to console on mount', () => {
    const error = new Error('Test root crash') as Error & { digest?: string };
    error.digest = 'ERR_DIGEST_12345';
    const reset = vi.fn();

    render(<GlobalError error={error} reset={reset} />);

    expect(consoleErrorSpy).toHaveBeenCalledWith('[GlobalErrorRoot]', error);
  });

  it('renders error digest code when provided', () => {
    const error = new Error('Crash with digest') as Error & { digest?: string };
    error.digest = 'NEXT_CRASH_99999';
    const reset = vi.fn();

    render(<GlobalError error={error} reset={reset} />);

    expect(screen.getByText(/Код ошибки:/i)).toBeDefined();
    expect(screen.getByText(/NEXT_CRASH_99999/)).toBeDefined();
  });

  it('renders gracefully without digest code', () => {
    const error = new Error('Crash without digest');
    const reset = vi.fn();

    render(<GlobalError error={error} reset={reset} />);

    expect(screen.getByText(/Критическая ошибка приложения/i)).toBeDefined();
    expect(screen.queryByText(/Код ошибки:/i)).toBeNull();
  });

  it('calls reset when "Попробовать снова" is clicked', () => {
    const error = new Error('Crash to reset');
    const reset = vi.fn();

    render(<GlobalError error={error} reset={reset} />);

    const retryButton = screen.getByRole('button', { name: /Попробовать снова/i });
    fireEvent.click(retryButton);

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('renders navigation link to home page', () => {
    const error = new Error('Crash with home link');
    const reset = vi.fn();

    render(<GlobalError error={error} reset={reset} />);

    const homeLink = screen.getByRole('link', { name: /На главную/i });
    expect(homeLink.getAttribute('href')).toBe('/');
  });
});
