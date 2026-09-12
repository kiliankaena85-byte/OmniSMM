/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LandingHeroArea } from '@/components/landing/LandingHeroArea';
import { Header } from '@/components/landing/Header';

describe('Mobile Trust Header & First-Screen Value Prop (SDD-2026)', () => {
  const mockEngine = {
    selectedCategory: null,
    selectedService: null,
    targetUrl: '',
    setTargetUrl: vi.fn(),
    url: '',
    setUrl: vi.fn(),
    email: '',
    setEmail: vi.fn(),
    isMassMode: false,
    isMassCalculating: false,
    filteredCategories: [],
    categories: [],
    services: [],
    setSelectedCategory: vi.fn(),
    setSelectedService: vi.fn(),
    serviceTypes: [],
    selectedType: 'all',
    setSelectedType: vi.fn(),
    searchQuery: '',
    setSearchQuery: vi.fn(),
    isLoading: false,
    error: null,
  } as any;

  it('renders clear mobile positioning title explaining the service', () => {
    render(
      <LandingHeroArea
        engine={mockEngine}
        handleCheckout={vi.fn()}
        linkHasError={false}
        setLinkHasError={vi.fn()}
        onOpenGuide={vi.fn()}
      />
    );

    // Mobile H1 must clearly state what the service is doing (Продвижение в Telegram, VK и соцсетях)
    const headings = screen.getAllByRole('heading', { level: 1 });
    const mobileHeading = headings[0];
    expect(mobileHeading).toBeDefined();
    expect(mobileHeading.textContent).toMatch(/Продвижение/i);
    expect(mobileHeading.textContent).toMatch(/Telegram/i);
  });

  it('renders trust badges and social proof on mobile first screen', () => {
    render(
      <LandingHeroArea
        engine={mockEngine}
        handleCheckout={vi.fn()}
        linkHasError={false}
        setLinkHasError={vi.fn()}
        onOpenGuide={vi.fn()}
      />
    );

    // Must contain trust signals like rating, guarantee, and no passwords required
    expect(screen.getAllByText(/4\.9/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2M\+/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Гарантия/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Без паролей/i).length).toBeGreaterThan(0);
  });

  it('renders recognizable social platforms bar on mobile', () => {
    const { container } = render(
      <LandingHeroArea
        engine={mockEngine}
        handleCheckout={vi.fn()}
        linkHasError={false}
        setLinkHasError={vi.fn()}
        onOpenGuide={vi.fn()}
      />
    );

    // Check for social platforms badge or icons container
    const socialBar = container.querySelector('[data-testid="mobile-social-bar"]');
    expect(socialBar).not.toBeNull();
  });

  it('Header component renders site identity and accessible navigation on mobile', () => {
    render(
      <Header
        siteName="Smmplan"
        tenantId="smmplan"
      />
    );

    expect(screen.getByText('Smmplan')).toBeDefined();
    expect(screen.getByLabelText('Открыть меню навигации')).toBeDefined();
  });
});
