/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthBackLink } from '@/components/auth/AuthBackLink';
import { AlreadyLoggedInCard } from '@/components/auth/AlreadyLoggedInCard';

describe('Auth Navigation: Zero-Trap Return to Home', () => {
  it('1. AuthBackLink links to / for SMMplan tenant by default', () => {
    render(<AuthBackLink isFlux={false} />);
    const link = screen.getByRole('link', { name: /вернуться на главную страницу/i });
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toBe('/');
    expect(link.textContent).toContain('На главную');
  });

  it('2. AuthBackLink links to /?tenant=flux when isFlux is true', () => {
    render(<AuthBackLink isFlux={true} />);
    const link = screen.getByRole('link', { name: /вернуться на главную страницу/i });
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toBe('/?tenant=flux');
    expect(link.textContent).toContain('На главную');
  });

  it('3. AlreadyLoggedInCard renders home links and user email for SMMplan', () => {
    render(
      <AlreadyLoggedInCard
        isFlux={false}
        activeEmail="admin@smmplan.pro"
        redirectLink="/admin/dashboard"
      />
    );

    expect(screen.getByText(/вы авторизованы как:/i)).toBeDefined();
    expect(screen.getByText('admin@smmplan.pro')).toBeDefined();

    // Verify continue button
    const continueLink = screen.getByRole('link', { name: /продолжить как admin/i });
    expect(continueLink.getAttribute('href')).toBe('/admin/dashboard');

    // Verify all return home links point to /
    const returnHomeLinks = screen.getAllByRole('link', { name: /вернуться на главную/i });
    expect(returnHomeLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of returnHomeLinks) {
      expect(link.getAttribute('href')).toBe('/');
    }

    // Verify logout link
    const logoutLink = screen.getByRole('link', { name: /войти под другим аккаунтом/i });
    expect(logoutLink.getAttribute('href')).toBe('/api/auth/logout');
  });

  it('4. AlreadyLoggedInCard renders home links to /?tenant=flux for SMMflux', () => {
    render(
      <AlreadyLoggedInCard
        isFlux={true}
        activeEmail="client@smmflux.ru"
        redirectLink="/dashboard"
      />
    );

    // Verify all return home links point to /?tenant=flux
    const returnHomeLinks = screen.getAllByRole('link', { name: /вернуться на главную/i });
    expect(returnHomeLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of returnHomeLinks) {
      expect(link.getAttribute('href')).toBe('/?tenant=flux');
    }
  });
});
