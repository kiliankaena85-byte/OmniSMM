'use client';

import React from 'react';
import { BalanceDisplay } from '@/components/dashboard/balance/BalanceDisplay';
import { formatBalance } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Wallet, 
  LogOut,
  Users,
  Settings
} from 'lucide-react';

import { MAIN_NAV_ITEMS, MOBILE_BOTTOM_NAV_ITEMS } from '@/lib/navigation';
import { useUnreadSupport } from '@/hooks/useUnreadSupport';

import { TenantLogo } from '@/components/ui/TenantLogo';

export function FluxDashboardShell({
  user,
  children,
}: {
  user: { email: string; balanceCents: number; tenantId: string; unreadTicketsCount?: number };
  children: React.ReactNode;
}) {
  const balanceRub = formatBalance(user.balanceCents);
  const pathname = usePathname();
  const unreadCount = useUnreadSupport(user.unreadTicketsCount ?? 0);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col relative overflow-x-clip">
      {/* ── FLUX VIBRANT HERO BACKGROUND (Full Bleed - GPU Isolated Layer) ── */}
      <div 
        className="absolute top-0 inset-x-0 h-[1800px] z-0 pointer-events-none overflow-hidden select-none bg-white dark:bg-default-50"
        style={{ transform: 'translate3d(0,0,0)', contain: 'paint' }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(60% 50% at 10% 0%, rgba(59, 130, 246, 0.22), transparent 60%), ' +
              'radial-gradient(50% 50% at 90% 10%, rgba(56, 189, 248, 0.18), transparent 60%), ' +
              'radial-gradient(60% 50% at 15% 50%, rgba(244, 63, 94, 0.15), transparent 60%), ' +
              'radial-gradient(50% 50% at 85% 60%, rgba(249, 115, 22, 0.15), transparent 60%), ' +
              'radial-gradient(60% 60% at 50% 30%, rgba(217, 70, 239, 0.15), transparent 60%)',
          }}
        />
        <div className="absolute bottom-0 inset-x-0 h-[400px] bg-gradient-to-t from-background via-background/80 to-transparent" />
      </div>

      {/* ── Top Navigation Bar ── */}
      <header className="relative z-40 w-full px-4 sm:px-8 py-3.5 flex items-center justify-between backdrop-blur-2xl bg-white/60 dark:bg-black/60 border-b border-border/30 shadow-sm sticky top-0">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-2.5 font-black text-xl text-foreground tracking-tight hover:opacity-90 transition-opacity">
            <TenantLogo tenantId="flux" className="w-9 h-9" iconClassName="w-4 h-4" />
            <span className="truncate tracking-tight font-black min-w-0">SMMflux</span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {MAIN_NAV_ITEMS.map((item) => {
              const active = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
              const isSupport = item.href === '/dashboard/tickets';
              const hasUnread = isSupport && unreadCount > 0;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all relative ${
                    active
                      ? 'bg-foreground text-background shadow-sm font-bold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <div className="relative">
                    <Icon className="w-4 h-4" />
                    {hasUnread && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    )}
                  </div>
                  <span>{item.label}</span>
                  {hasUnread && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-4.5 px-1 rounded-full bg-rose-500 text-white font-extrabold text-[10px] animate-pulse ml-1">
                      {unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-4">
          <BalanceDisplay initialBalance={balanceRub} variant="mobile-header" />
          <Link
            href="/dashboard/finance"
            className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold bg-primary text-primary-foreground rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-md flex items-center gap-1.5"
          >
            <Wallet className="w-4 h-4 shrink-0" />
            <span className="hidden xs:inline">+ Пополнить</span>
          </Link>

          {/* Mobile Profile Avatar Link (Variant A) */}
          <Link
            href="/dashboard/settings"
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-xl bg-primary/10 text-primary border border-primary/20 font-bold text-xs uppercase"
            title="Профиль и настройки"
          >
            {user.email.substring(0, 2)}
          </Link>

          {/* Desktop User Menu (Variant B) */}
          <div className="hidden md:flex items-center gap-2 pl-3 border-l border-border/40">
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-muted/50 text-foreground transition-colors group"
              title="Настройки профиля и безопасность"
            >
              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold uppercase group-hover:scale-105 transition-transform">
                {user.email.substring(0, 2)}
              </div>
              <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground max-w-[120px] truncate transition-colors min-w-0">
                {user.email}
              </span>
            </Link>

            <Link
              href="/dashboard/settings"
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-xl transition-colors"
              title="Настройки профиля"
            >
              <Settings className="w-4 h-4" />
            </Link>

            <button
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                try {
                  await fetch('/api/auth/logout', { method: 'POST' });
                } catch {}
                window.location.href = '/login?tenant=flux';
              }}
              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors ml-0.5 cursor-pointer"
              title="Выйти из аккаунта"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile Navigation Bar (Bottom Sticky - 5 items) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-2xl border-t border-border/40 px-1 pt-1 pb-[calc(0.25rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around shadow-lg">
        {MOBILE_BOTTOM_NAV_ITEMS.map((item) => {
          const active = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
          const isSupport = item.href === '/dashboard/tickets';
          const hasUnread = isSupport && unreadCount > 0;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center min-h-[44px] min-w-[44px] px-2 py-1 rounded-xl text-[10px] font-medium transition-all ${
                active ? 'text-primary font-bold bg-primary/10' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5 shrink-0" />
                {hasUnread && (
                  <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white font-black text-[9px] flex items-center justify-center animate-pulse shadow-sm shadow-rose-500/50">
                    {unreadCount}
                  </span>
                )}
              </div>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Main Content Area ── */}
      <main className="relative z-10 w-full flex-1 max-w-7xl mx-auto p-4 md:p-8 pb-24 md:pb-12">
        {children}
      </main>
    </div>
  );
}


