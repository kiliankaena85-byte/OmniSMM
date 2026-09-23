import { describe, it, expect } from 'vitest';
import { isNavTabActive, resolveSidebarDomain } from '@/components/admin/navigation-data';

// ✅ Updated sidebar hrefs — 10 domain roots (after transactions restored as own item)
const SIDEBAR_HREFS = [
  '/admin/dashboard',
  '/admin/orders',
  '/admin/catalog',
  '/admin/providers',
  '/admin/tickets',
  '/admin/clients',
  '/admin/transactions',
  '/admin/finance',
  '/admin/analytics',
  '/admin/settings',
];

describe('Admin Navigation Active State (Best Match Rule)', () => {
  // --- Legacy tests for isNavTabActive (tab-strip context) ---

  const legacyHrefs = [
    '/admin/dashboard',
    '/admin/orders',
    '/admin/catalog',
    '/admin/catalog/categories',
    '/admin/providers',
    '/admin/tickets',
    '/admin/clients',
    '/admin/finance',
    '/admin/finance/balance-requests',
    '/admin/analytics',
    '/admin/settings'
  ];

  it('should highlight ONLY Categories tab when visiting /admin/catalog/categories', () => {
    const isCatalogActive = isNavTabActive('/admin/catalog/categories', '/admin/catalog', legacyHrefs);
    const isCategoriesActive = isNavTabActive('/admin/catalog/categories', '/admin/catalog/categories', legacyHrefs);

    expect(isCategoriesActive).toBe(true);
    expect(isCatalogActive).toBe(false);
  });

  it('should highlight ONLY Catalog tab when visiting /admin/catalog', () => {
    const isCatalogActive = isNavTabActive('/admin/catalog', '/admin/catalog', legacyHrefs);
    const isCategoriesActive = isNavTabActive('/admin/catalog', '/admin/catalog/categories', legacyHrefs);

    expect(isCatalogActive).toBe(true);
    expect(isCategoriesActive).toBe(false);
  });

  it('should highlight Catalog tab when visiting nested catalog route (e.g. /admin/catalog/123 or /admin/catalog/new)', () => {
    const isCatalogActiveForDetail = isNavTabActive('/admin/catalog/123', '/admin/catalog', legacyHrefs);
    const isCategoriesActiveForDetail = isNavTabActive('/admin/catalog/123', '/admin/catalog/categories', legacyHrefs);

    expect(isCatalogActiveForDetail).toBe(true);
    expect(isCategoriesActiveForDetail).toBe(false);
  });

  it('should highlight Dashboard ONLY on exact /admin/dashboard', () => {
    expect(isNavTabActive('/admin/dashboard', '/admin/dashboard', legacyHrefs)).toBe(true);
    expect(isNavTabActive('/admin/orders', '/admin/dashboard', legacyHrefs)).toBe(false);
    expect(isNavTabActive('/admin/catalog', '/admin/dashboard', legacyHrefs)).toBe(false);
  });

  it('should handle tab navigation with query params without collisions', () => {
    const headerTabs = [
      '/admin/settings',
      '/admin/settings?tab=telegram',
      '/admin/settings?tab=proxy'
    ];

    // When on base settings without query params: ONLY base tab is active
    expect(isNavTabActive('/admin/settings', '/admin/settings', headerTabs)).toBe(true);
    expect(isNavTabActive('/admin/settings', '/admin/settings?tab=telegram', headerTabs)).toBe(false);
    expect(isNavTabActive('/admin/settings', '/admin/settings?tab=proxy', headerTabs)).toBe(false);

    // When on ?tab=telegram: ONLY telegram tab is active, base settings must be FALSE
    expect(isNavTabActive('/admin/settings?tab=telegram', '/admin/settings?tab=telegram', headerTabs)).toBe(true);
    expect(isNavTabActive('/admin/settings?tab=telegram', '/admin/settings', headerTabs)).toBe(false);
    expect(isNavTabActive('/admin/settings?tab=telegram', '/admin/settings?tab=proxy', headerTabs)).toBe(false);

    // When on ?tab=proxy: ONLY proxy tab is active, base settings must be FALSE
    expect(isNavTabActive('/admin/settings?tab=proxy', '/admin/settings?tab=proxy', headerTabs)).toBe(true);
    expect(isNavTabActive('/admin/settings?tab=proxy', '/admin/settings', headerTabs)).toBe(false);
  });
});

describe('resolveSidebarDomain — Ghost-page aliasing', () => {
  it('maps /admin/refills to /admin/orders', () => {
    expect(resolveSidebarDomain('/admin/refills')).toBe('/admin/orders');
  });

  it('maps /admin/marketing to /admin/finance', () => {
    expect(resolveSidebarDomain('/admin/marketing')).toBe('/admin/finance');
  });

  it('maps /admin/tenants to /admin/settings', () => {
    expect(resolveSidebarDomain('/admin/tenants')).toBe('/admin/settings');
  });

  it('maps /admin/pages to /admin/settings', () => {
    expect(resolveSidebarDomain('/admin/pages')).toBe('/admin/settings');
  });

  it('maps /admin/knowledge to /admin/settings', () => {
    expect(resolveSidebarDomain('/admin/knowledge')).toBe('/admin/settings');
  });

  it('maps /admin/system/features to /admin/settings', () => {
    expect(resolveSidebarDomain('/admin/system/features')).toBe('/admin/settings');
  });

  it('maps /admin/smart to /admin/orders', () => {
    expect(resolveSidebarDomain('/admin/smart')).toBe('/admin/orders');
  });

  it('does NOT alias known sidebar roots (pass-through)', () => {
    expect(resolveSidebarDomain('/admin/catalog')).toBe('/admin/catalog');
    expect(resolveSidebarDomain('/admin/finance')).toBe('/admin/finance');
    expect(resolveSidebarDomain('/admin/settings')).toBe('/admin/settings');
  });

  it('handles null/undefined gracefully', () => {
    expect(resolveSidebarDomain(null)).toBe('');
    expect(resolveSidebarDomain(undefined)).toBe('');
  });
});

describe('Sidebar domain isolation — consolidated ADMIN_NAVIGATION (domain roots only)', () => {
  it('/admin/catalog/* does NOT jump to any other sidebar item', () => {
    const subPages = ['/admin/catalog/categories', '/admin/catalog/patterns', '/admin/catalog/quarantine'];
    for (const page of subPages) {
      const resolved = resolveSidebarDomain(page);
      // resolved is /admin/catalog (no alias), Best Match Rule kicks in
      const activeItems = SIDEBAR_HREFS.filter(h => isNavTabActive(page, h, SIDEBAR_HREFS, resolved));
      expect(activeItems).toEqual(['/admin/catalog']);
    }
  });

  it('/admin/finance/* stays on /admin/finance sidebar item', () => {
    const subPages = ['/admin/finance/treasury', '/admin/finance/balance-requests'];
    for (const page of subPages) {
      const resolved = resolveSidebarDomain(page);
      const activeItems = SIDEBAR_HREFS.filter(h => isNavTabActive(page, h, SIDEBAR_HREFS, resolved));
      expect(activeItems).toEqual(['/admin/finance']);
    }
  });

  it('/admin/providers/import stays on /admin/providers sidebar item', () => {
    const resolved = resolveSidebarDomain('/admin/providers/import');
    const activeItems = SIDEBAR_HREFS.filter(h => isNavTabActive('/admin/providers/import', h, SIDEBAR_HREFS, resolved));
    expect(activeItems).toEqual(['/admin/providers']);
  });

  it('ghost pages resolve correctly to their parent domain items', () => {
    const ghostRoutes: [string, string][] = [
      ['/admin/refills', '/admin/orders'],
      ['/admin/marketing', '/admin/finance'],
      ['/admin/tenants', '/admin/settings'],
      ['/admin/pages', '/admin/settings'],
      ['/admin/knowledge', '/admin/settings'],
      ['/admin/system/features', '/admin/settings'],
    ];

    for (const [ghost, expectedParent] of ghostRoutes) {
      const resolved = resolveSidebarDomain(ghost);
      const activeItems = SIDEBAR_HREFS.filter(h => isNavTabActive(ghost, h, SIDEBAR_HREFS, resolved));
      expect(activeItems).toEqual([expectedParent]);
    }
  });

  it('/admin/transactions highlights its own sidebar item', () => {
    const resolved = resolveSidebarDomain('/admin/transactions');
    const activeItems = SIDEBAR_HREFS.filter(h => isNavTabActive('/admin/transactions', h, SIDEBAR_HREFS, resolved));
    expect(activeItems).toEqual(['/admin/transactions']);
  });

  it('newly added ghost pages resolve to their domains', () => {
    const additionalGhosts: [string, string][] = [
      ['/admin/services', '/admin/catalog'],
      ['/admin/services/123/routing', '/admin/catalog'],
      ['/admin/fraud-monitor', '/admin/finance'],
      ['/admin/staff', '/admin/settings'],
      ['/admin/cms', '/admin/settings'],
      ['/admin/cms/new', '/admin/settings'],
      ['/admin/economics', '/admin/analytics'],
      ['/admin/docs', '/admin/orders'],
      ['/admin/manual', '/admin/settings'],
    ];

    for (const [route, expectedParent] of additionalGhosts) {
      const resolved = resolveSidebarDomain(route);
      const activeItems = SIDEBAR_HREFS.filter(h => isNavTabActive(route, h, SIDEBAR_HREFS, resolved));
      expect(activeItems).toEqual([expectedParent]);
    }
  });

  it('/admin/settings/roles stays on /admin/settings sidebar item', () => {
    const resolved = resolveSidebarDomain('/admin/settings/roles');
    const activeItems = SIDEBAR_HREFS.filter(h => isNavTabActive('/admin/settings/roles', h, SIDEBAR_HREFS, resolved));
    expect(activeItems).toEqual(['/admin/settings']);
  });
});
