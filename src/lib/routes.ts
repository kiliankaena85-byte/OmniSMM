/**
 * E2E-Safe Route Registry
 * Centralized dictionary for all application routes to prevent 404 errors.
 */

export const ROUTES = {
  HOME: '/',
  AUTH: {
    LOGIN: '/login',
    REGISTER: '/register',
  },
  LEGAL: {
    TERMS: '/legal/terms',
    PRIVACY: '/legal/privacy',
    REFUND: '/legal/refund',
    COOKIE: '/legal/cookies',
    COOKIES: '/legal/cookies',
    SERVICE_RULES: '/legal/service-rules',
  },
  SUPPORT: '/support',
  FAQ: '/#faq',
  DASHBOARD: {
    HOME: '/dashboard',
    NEW_ORDER: '/dashboard/new-order',
    ORDERS: '/dashboard/orders',
    TICKETS: '/dashboard/tickets',
    ADD_FUNDS: '/dashboard/add-funds',
    REFERRALS: '/dashboard/referrals',
    SETTINGS: '/dashboard/settings',
    API: '/dashboard/settings/api',
  },
  SERVICES: {
    INDEX: '/services',
    NETWORK: (network: string) => `/services/${network}`,
  },
  ADMIN: {
    HOME: '/admin',
    DASHBOARD: '/admin/dashboard',
    ORDERS: '/admin/orders',
    FINANCE: '/admin/finance',
    USERS: '/admin/users',
    TICKETS: '/admin/tickets',
    PROVIDERS: '/admin/providers',
    CATALOG: '/admin/catalog',
  }
} as const;
