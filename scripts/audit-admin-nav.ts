// @ts-check
// Admin Navigation Full Audit Script
// Run: npx tsx scripts/audit-admin-nav.ts

// We need path aliases — use tsconfig-paths trick for tsx
import { isNavTabActive, resolveSidebarDomain, SYSTEM_TABS, FINANCE_TABS, OPERATIONS_TABS, PROVIDERS_TABS, CATALOG_TABS } from '../src/components/admin/navigation-data';

const SIDEBAR: string[] = [
  '/admin/dashboard', '/admin/orders', '/admin/catalog', '/admin/providers',
  '/admin/tickets',   '/admin/clients', '/admin/transactions', '/admin/finance', '/admin/analytics', '/admin/settings'
];

// All real filesystem routes (from Get-ChildItem scan)
const ALL_ROUTES: string[] = [
  '/admin/analytics',
  '/admin/catalog', '/admin/catalog/categories', '/admin/catalog/patterns',
  '/admin/catalog/quarantine', '/admin/catalog/sync', '/admin/catalog/drift', '/admin/catalog/new',
  '/admin/catalog/123',
  '/admin/clients', '/admin/clients/123',
  '/admin/cms', '/admin/cms/new', '/admin/cms/123',
  '/admin/dashboard',
  '/admin/docs', '/admin/docs/order-statuses',
  '/admin/economics', '/admin/economics/recommendations',
  '/admin/finance', '/admin/finance/balance-requests', '/admin/finance/treasury',
  '/admin/finance/payments', '/admin/finance/payments/123', '/admin/finance/support-review',
  '/admin/finance/balance-requests/stats',
  '/admin/fraud-monitor',
  '/admin/knowledge', '/admin/knowledge/123', '/admin/knowledge/create', '/admin/knowledge/123/edit',
  '/admin/manual',
  '/admin/marketing',
  '/admin/orders', '/admin/orders/123',
  '/admin/pages', '/admin/pages/about',
  '/admin/providers', '/admin/providers/import', '/admin/providers/health',
  '/admin/providers/keys', '/admin/providers/new', '/admin/providers/123',
  '/admin/refills',
  '/admin/services', '/admin/services/123', '/admin/services/123/routing',
  '/admin/settings', '/admin/settings/roles', '/admin/settings/proxy', '/admin/settings/telegram',
  '/admin/settings/team', '/admin/settings/balance-policies', '/admin/settings/storefront-keys',
  '/admin/smart',
  '/admin/staff',
  '/admin/system/features',
  '/admin/tenants',
  '/admin/tickets', '/admin/tickets/123',
  '/admin/transactions',
  '/admin/forbidden',
];

console.log('=== FULL ADMIN NAVIGATION AUDIT v2 ===\n');

const ghosts: string[] = [];
const correct: [string, string][] = [];

for (const route of ALL_ROUTES) {
  const resolved = resolveSidebarDomain(route);
  const active = SIDEBAR.filter(h => isNavTabActive(route, h, SIDEBAR, resolved));

  if (active.length === 0) {
    ghosts.push(route);
  } else {
    correct.push([route, active.join(', ')]);
  }
}

console.log(`✅ CORRECT (${correct.length}):`);
for (const [r, a] of correct) console.log(`  ${r.padEnd(50)} → ${a}`);

console.log(`\n❌ GHOST PAGES — NO SIDEBAR HIGHLIGHT (${ghosts.length}):`);
for (const r of ghosts) console.log(`  ${r}`);

// --- Tab strip audit ---
console.log('\n=== TAB STRIP CROSS-DOMAIN AUDIT ===\n');

const TAB_STRIPS: [string, { label: string; href: string }[]][] = [
  ['OPERATIONS_TABS', OPERATIONS_TABS],
  ['FINANCE_TABS',    FINANCE_TABS],
  ['CATALOG_TABS',    CATALOG_TABS],
  ['PROVIDERS_TABS',  PROVIDERS_TABS],
  ['SYSTEM_TABS',     SYSTEM_TABS],
];

for (const [name, tabs] of TAB_STRIPS) {
  console.log(`--- ${name} ---`);
  for (const tab of tabs) {
    const [path] = tab.href.split('?');
    const inSidebar = SIDEBAR.includes(path);
    const isSubOfDomain = SIDEBAR.some(s => s !== '/admin/dashboard' && s !== '/admin' && path.startsWith(s + '/'));
    const isQueryTab = tab.href.includes('?') && SIDEBAR.includes(path);

    if (!inSidebar && !isSubOfDomain && !isQueryTab) {
      console.log(`  ❌ CROSS-DOMAIN/ORPHAN: "${tab.label}" → ${tab.href}`);
    } else {
      console.log(`  ✅ OK: "${tab.label}" → ${tab.href}`);
    }
  }
}

// --- FINANCE_TABS domain check: /admin/clients and /admin/transactions are sidebar roots of OTHER domains ---
console.log('\n=== FINANCE_TABS DOMAIN PURITY CHECK ===');
const financePrefix = '/admin/finance';
const clientsPrefix = '/admin/clients';
const transactionsPrefix = '/admin/transactions';
for (const tab of FINANCE_TABS) {
  const [path] = tab.href.split('?');
  const isMixedDomain = path.startsWith(clientsPrefix) || path.startsWith(transactionsPrefix);
  if (isMixedDomain) {
    console.log(`  ⚠️  MIXED DOMAIN in FINANCE_TABS: "${tab.label}" → ${tab.href} (belongs to clients domain in sidebar)`);
  }
}

// --- RBAC section check: removed items ---
console.log('\n=== REMOVED SIDEBAR ITEMS (RBAC impact check) ===');
const REMOVED = [
  { href: '/admin/catalog/categories', section: 'catalog' },
  { href: '/admin/finance/treasury', section: 'finance' },
  { href: '/admin/finance/balance-requests', section: 'balance_requests' },
  { href: '/admin/transactions', section: 'clients' },
];
for (const item of REMOVED) {
  console.log(`  ℹ️  Removed from sidebar: ${item.href} (section=${item.section}) — access via tab strip only`);
}
