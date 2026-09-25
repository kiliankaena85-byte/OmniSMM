import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
export const dynamic = "force-dynamic";
import Link from 'next/link';
import { Toaster } from '@/components/ui/sonner';
import { AdminSidebar } from '@/components/admin/sidebar';
import { MobileNavDrawer } from '@/components/admin/mobile-nav-drawer';
import { CommandPalette } from '@/components/admin/command-palette';
import { ShortcutsProvider } from '@/components/admin/shortcuts-provider';
import { DensityProvider } from '@/components/admin/density-provider';
import { AdminProfileDropdown } from '@/components/admin/admin-profile-dropdown';
import { GlobalSiteSwitcher } from '@/components/admin/tenant-switcher';
import { EnvironmentModeSwitcher } from '@/components/admin/EnvironmentModeSwitcher';
import { SystemEmergencyBanner } from '@/components/admin/system-emergency-banner';
import { AdminAiManualWidget } from '@/components/admin/ai-manual/AdminAiManualWidget';
import { unstable_cache } from 'next/cache';
import { cookies } from 'next/headers';
import { normalizeTenantId } from '@/lib/tenant-resolver-edge';

// ADM-16: catalog anomaly badge — cached for 60s instead of a COUNT on every admin page load
const getCachedAnomalyCount = (tenantId: string) => unstable_cache(
  async () => db.service.count({
    where: {
      tenantId,
      OR: [
        { isQuarantined: true },
        { cooldownReason: 'ZOMBIE_AUTO_DISABLED', isActive: false },
        { cooldownUntil: { gt: new Date() }, cooldownReason: { not: 'ZOMBIE_AUTO_DISABLED' } },
      ]
    }
  }),
  [`admin-catalog-anomaly-count-v1-${tenantId}`],
  { revalidate: 60, tags: ['catalog', 'anomaly-count', `catalog-${tenantId}`] }
)();

// Cached count of OPEN tickets requiring staff response (tenant-isolated)
const getCachedOpenTicketCount = (tenantId: string) => unstable_cache(
  async () => db.ticket.count({
    where: {
      status: 'OPEN',
      tenantId
    }
  }),
  [`admin-open-tickets-count-v1-${tenantId}`],
  { revalidate: 30, tags: ['tickets', 'open-count', `tickets-${tenantId}`] }
)();

// RBAC: Allowed roles for admin panel access
const ADMIN_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SUPPORT'];

// Navigation sections with role-based visibility.
// ✅ FIX [ADMIN-NAV-DOMAIN-2026]: Only domain ROOTS are listed here.
// Sub-pages are accessible via their domain's tab strip (CATALOG_TABS, FINANCE_TABS, etc.).
// This ensures the sidebar never jumps between items when navigating sub-tabs.
const ADMIN_NAVIGATION = [
  {
    group: 'Главное управление',
    items: [
      { href: '/admin/dashboard',    icon: 'Home',           label: 'Дашборд',         section: 'dashboard' },
      { href: '/admin/orders',       icon: 'Package',        label: 'Заказы',          section: 'orders' },
      { href: '/admin/catalog',      icon: 'ShoppingCart',   label: 'Каталог услуг',   section: 'catalog' },
      { href: '/admin/providers',    icon: 'Link',           label: 'Провайдеры',      section: 'providers' },
      { href: '/admin/tickets',      icon: 'MessageSquare',  label: 'Поддержка',       section: 'tickets' },
      { href: '/admin/clients',      icon: 'Users',          label: 'Клиенты',         section: 'clients' },
      { href: '/admin/transactions', icon: 'ArrowLeftRight', label: 'Транзакции',      section: 'clients' },
      { href: '/admin/finance',      icon: 'CreditCard',     label: 'Финансы & Касса', section: 'finance' },
      { href: '/admin/analytics',    icon: 'BarChart3',      label: 'Аналитика',       section: 'analytics' },
      { href: '/admin/settings',     icon: 'Settings',       label: 'Настройки',       section: 'settings' },
    ]
  }
];

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  OWNER:   { label: 'Владелец',  color: 'bg-primary/10 text-primary border-primary/20 font-bold' },
  ADMIN:   { label: 'Админ',     color: 'bg-info/10 text-info border-info/20 font-bold' },
  MANAGER: { label: 'Менеджер',  color: 'bg-success/10 text-success-text border-success/20 font-bold' },
  SUPPORT: { label: 'Саппорт',   color: 'bg-muted text-muted-foreground border-border font-bold' },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await verifySession();
  
  if (!session) {
    redirect('/login');
  }

  const user = await db.user.findUnique({ 
    where: { id: session.userId },
    include: { staffRole: { include: { permissions: true } } }
  });

  if (!user || !ADMIN_ROLES.includes(user.role)) {
    redirect('/dashboard/new-order');
  }

  const cookieStore = await cookies();
  const cookieTenant = cookieStore.get('x_admin_tenant')?.value;

  // Check server-side session in Redis first, then cookie, then user tenant
  let serverSessionTenant: string | null = null;
  try {
    const { redis } = await import('@/lib/redis');
    serverSessionTenant = await redis.get(`staff:${user.id}:active_tenant`);
  } catch {}

  const isOwner = user.role === 'OWNER';
  const userAllowedTenants = isOwner
    ? undefined
    : (user.allowedTenants && user.allowedTenants.length > 0 ? user.allowedTenants : [user.tenantId || 'smmplan']);

  let activeTenantId = normalizeTenantId(serverSessionTenant || cookieTenant) || user.tenantId || 'smmplan';
  if (!isOwner && userAllowedTenants && !userAllowedTenants.includes(activeTenantId)) {
    activeTenantId = userAllowedTenants[0] || user.tenantId || 'smmplan';
  }

  const anomalyCount = await getCachedAnomalyCount(activeTenantId);
  const openTicketCount = await getCachedOpenTicketCount(activeTenantId);

  // Filter navigation based on canonical RBAC sections
  const navigation = ADMIN_NAVIGATION.map(group => ({
    ...group,
    items: group.items.map(item => {
      if (item.href === '/admin/catalog' && anomalyCount > 0) {
        return { ...item, badge: anomalyCount };
      }
      if (item.section === 'tickets' && openTicketCount > 0) {
        return { ...item, badge: openTicketCount };
      }
      return item;
    }).filter(item => {
      if (user.role === 'OWNER' || user.role === 'ADMIN') return true;
      if (item.section === 'dashboard') return true;
      const normalizedSection = item.section.toUpperCase();
      const { BUILTIN_ROLE_PERMISSIONS } = require('@/lib/server/rbac');
      const builtin = BUILTIN_ROLE_PERMISSIONS[user.role]?.[normalizedSection];
      const explicit = user.staffRole?.permissions?.find(
        (p: { section: string; canView: boolean; canEdit: boolean }) =>
          p.section.toUpperCase() === normalizedSection
      );
      return Boolean((builtin && (builtin.canView || builtin.canEdit)) || (explicit && (explicit.canView || explicit.canEdit)));
    })
  })).filter(group => group.items.length > 0);

  const roleInfo = ROLE_LABELS[user.role] || { label: user.role, color: 'bg-muted text-foreground' };

  const canEditSettings = user.role === 'OWNER' || user.role === 'ADMIN' || Boolean(
    user.staffRole?.permissions?.some((p: { section: string; canEdit: boolean }) => p.section.toUpperCase() === 'SETTINGS' && p.canEdit)
  );

  const allTenants = await db.tenant.findMany({
    where: { isActive: true },
    select: { id: true, name: true, domain: true },
    orderBy: { createdAt: 'asc' },
  }).catch(() => []);

  return (
    <DensityProvider>
      <ShortcutsProvider>
        <div className="h-screen w-full overflow-hidden bg-muted/10 dark:bg-background flex flex-col md:flex-row relative selection:bg-primary/20 selection:text-foreground font-sans">
          {/* Soft Ambient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted/20 pointer-events-none z-0" />

          <AdminSidebar 
            userEmail={user.email}
            roleInfo={roleInfo}
            navigation={navigation}
          />

          {/* Floating Main Content Area */}
          <div className="flex-1 min-w-0 h-screen overflow-y-auto has-[.tickets-workspace]:overflow-hidden p-0 md:p-3.5 z-10 relative flex flex-col">
            <SystemEmergencyBanner />
            {/* Top Sticky Header Bar with Mobile Drawer, Global Site Switcher & Profile Dropdown */}
            <header className="sticky top-0 z-30 mb-2 px-3 md:px-3 py-2 md:py-2.5 flex items-center justify-between gap-3 shrink-0 bg-background/90 backdrop-blur-md border-b border-border/70 shadow-xs md:rounded-lg">
              <div className="flex items-center gap-2 md:gap-3">
                <MobileNavDrawer
                  userEmail={user.email}
                  roleInfo={roleInfo}
                  navigation={navigation}
                />
                <GlobalSiteSwitcher 
                  currentTenant={activeTenantId} 
                  allowedTenants={userAllowedTenants}
                  isOwner={isOwner}
                  allTenants={allTenants}
                />
                <EnvironmentModeSwitcher readOnly={!canEditSettings} />
              </div>
              <div className="flex items-center gap-2">
                <AdminProfileDropdown
                  userEmail={user.email}
                  role={user.role}
                  roleLabel={roleInfo.label}
                  roleColor={roleInfo.color}
                />
              </div>
            </header>

            <main id="main-content" tabIndex={-1} className="w-full flex-1 min-h-fit has-[.tickets-workspace]:min-h-0 flex flex-col relative transition-all duration-200 bg-card md:rounded-lg md:border md:border-border/70 md:shadow-xs outline-none has-[.tickets-workspace]:h-full has-[.tickets-workspace]:overflow-hidden">
              <div className="w-full flex-1 min-h-fit has-[.tickets-workspace]:min-h-0 flex flex-col relative p-3 md:p-4.5 has-[.tickets-workspace]:p-0 has-[.tickets-workspace]:h-full has-[.tickets-workspace]:overflow-hidden">
                {children}
              </div>
            </main>
          </div>

          <CommandPalette />
          <AdminAiManualWidget userRole={user.role} activeTenantId={activeTenantId} />
          <Toaster position="top-right" richColors closeButton className="mt-4 mr-4" />
        </div>
      </ShortcutsProvider>
    </DensityProvider>
  );
}
