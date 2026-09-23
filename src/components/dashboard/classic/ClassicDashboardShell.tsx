import Link from 'next/link';
import { SidebarNav, MobileBottomNav } from '@/app/dashboard/sidebar-nav';
import { formatBalance } from '@/lib/utils';
import { BalanceDisplay } from '@/components/dashboard/balance/BalanceDisplay';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { Plus } from 'lucide-react';

import { TenantLogo } from '@/components/ui/TenantLogo';

export function ClassicDashboardShell({
  user,
  children,
}: {
  user: { email: string; balanceCents: number; unreadTicketsCount?: number; tenantId?: string };
  children: React.ReactNode;
}) {
  const balanceRub = formatBalance(user.balanceCents);
  const tenantId = user.tenantId || 'smmplan';
  const siteName = tenantId === 'flux' ? 'SMMflux' : tenantId ? tenantId.charAt(0).toUpperCase() + tenantId.slice(1) : 'SMMplan';

  return (
    <div className="min-h-screen bg-background text-foreground flex relative selection:bg-primary/20 selection:text-primary">
      {/* Background Decorative Glow (Matches Landing Page) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-indigo-500/5 rounded-full blur-[120px]" />
      </div>

      {/* ── Sidebar (desktop, client — for active highlight) ── */}
      <div className="relative z-20 shrink-0">
        <SidebarNav email={user.email} balanceRub={balanceRub} initialUnreadCount={user.unreadTicketsCount} tenantId={tenantId} siteName={siteName} />
      </div>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card/85 backdrop-blur-2xl border-b border-border/80 px-2.5 sm:px-4 py-2 flex items-center justify-between min-h-[56px] shadow-sm gap-1.5 sm:gap-2">
        <Link
          href="/"
          className="flex items-center gap-1.5 sm:gap-2 font-black text-foreground shrink-0 min-h-[44px] hover:opacity-90 active:scale-95 transition-all min-w-0"
          title="Перейти на главную страницу (Витрина)"
          aria-label="На главную"
        >
          <TenantLogo tenantId={tenantId} className="w-7 h-7 shrink-0" iconClassName="w-3.5 h-3.5" />
          <span className="truncate tracking-tight font-bold text-sm sm:text-base min-w-0">{siteName}</span>
          <span className="hidden sm:inline-block text-[10px] font-semibold text-muted-foreground bg-secondary/80 px-1.5 py-0.5 rounded border border-border/60">
            На главную
          </span>
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <ThemeSwitcher variant="toggle" className="hidden min-[400px]:flex w-8 h-8 sm:w-9 sm:h-9 rounded-xl border border-border/70 bg-card/60 shrink-0" />
          <BalanceDisplay initialBalance={formatBalance(user.balanceCents)} variant="mobile-header" />
          <Link
            href="/dashboard/finance"
            className="px-2 sm:px-3 py-1.5 sm:py-2 min-h-[34px] sm:min-h-[40px] flex items-center justify-center gap-1 text-xs font-bold bg-primary text-primary-foreground rounded-xl shadow-sm shadow-primary/20 hover:scale-105 active:scale-95 transition-all shrink-0"
            title="Пополнить баланс"
            aria-label="Пополнить баланс"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Пополнить</span>
          </Link>
          <Link
            href="/dashboard/settings"
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs uppercase shrink-0"
            title="Профиль и настройки"
          >
            {user.email.substring(0, 2)}
          </Link>
        </div>
      </div>

      {/* ── Mobile bottom nav (client — for active highlight) ── */}
      <MobileBottomNav initialUnreadCount={user.unreadTicketsCount} />

      {/* ── Main content ── */}
      <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 pt-[72px] sm:pt-20 md:pt-0 pb-24 md:pb-0 overflow-y-auto outline-none relative z-10">
        <div className="p-4 sm:p-6 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
