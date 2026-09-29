'use client';

import React from 'react';
import { BalanceDisplay } from '@/components/dashboard/balance/BalanceDisplay';
import { formatBalance } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wallet, LogOut, Settings, LayoutDashboard, PlusCircle, ListOrdered, Users, HelpCircle } from 'lucide-react';

import { MOBILE_BOTTOM_NAV_ITEMS } from '@/lib/navigation';
import { useUnreadSupport } from '@/hooks/useUnreadSupport';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { TenantLogo } from '@/components/ui/TenantLogo';

const FLUX_DESKTOP_NAV = [
  { href: '/dashboard', label: 'Дашборд', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/new-order', label: 'Создать заказ', icon: PlusCircle },
  { href: '/dashboard/orders', label: 'Заказы', icon: ListOrdered },
  { href: '/dashboard/finance', label: 'Финансы', icon: Wallet },
  { href: '/dashboard/referrals', label: 'Партнёрам', icon: Users },
  { href: '/dashboard/tickets', label: 'Поддержка', icon: HelpCircle },
];

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
      {/* ── FLUX VIBRANT AURORA BACKGROUND (Full Bleed Layer) ── */}
      <div 
        className="absolute top-0 inset-x-0 h-[1800px] z-0 pointer-events-none overflow-hidden select-none bg-slate-50/90 dark:bg-[#090d16]"
        style={{ transform: 'translate3d(0,0,0)', contain: 'paint' }}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-85 dark:opacity-60"
          style={{
            background:
              'radial-gradient(65% 55% at 5% 5%, rgba(147, 51, 234, 0.16), transparent 70%), ' +
              'radial-gradient(55% 50% at 95% 10%, rgba(56, 189, 248, 0.16), transparent 65%), ' +
              'radial-gradient(60% 50% at 15% 45%, rgba(244, 63, 94, 0.12), transparent 60%), ' +
              'radial-gradient(50% 50% at 85% 55%, rgba(249, 115, 22, 0.11), transparent 60%), ' +
              'radial-gradient(70% 60% at 50% 25%, rgba(217, 70, 239, 0.14), transparent 70%)',
          }}
        />
        <div className="absolute inset-0 pointer-events-none premium-dot-grid opacity-35 dark:opacity-20" />
        <div className="absolute bottom-0 inset-x-0 h-[400px] bg-gradient-to-t from-background via-background/80 to-transparent" />
      </div>

      {/* ── Top Navigation Bar ── */}
      <header className="relative z-40 w-full px-2.5 sm:px-8 py-2.5 flex items-center justify-between backdrop-blur-2xl bg-card/85 dark:bg-card/75 border-b border-border/40 shadow-xs sticky top-0 min-h-[58px]">
        {/* Left: Brand Logo & Title (Links to /) */}
        <div className="flex items-center gap-3 shrink-0">
          <Link 
            href="/" 
            className="flex items-center gap-2.5 font-black text-lg sm:text-xl text-foreground tracking-tight hover:opacity-90 transition-opacity shrink-0" 
            title="Перейти на главную страницу (Витрина)" 
            aria-label="На главную"
          >
            <TenantLogo tenantId="flux" className="w-8 h-8 sm:w-9 sm:h-9 shrink-0" iconClassName="w-4 h-4" />
            <span className="tracking-tight font-black shrink-0">SMMflux</span>
          </Link>
        </div>

        {/* Center: Navigation Links */}
        <nav className="hidden xl:flex items-center gap-1 shrink-0">
          {FLUX_DESKTOP_NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const isSupport = item.href === '/dashboard/tickets';
            const hasUnread = isSupport && unreadCount > 0;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 ${
                  active
                    ? 'bg-foreground text-background shadow-xs font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
                {hasUnread && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-4.5 px-1 rounded-full bg-rose-500 text-white font-extrabold text-[10px] animate-pulse ml-0.5">
                    {unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right: Balance, Quick Top-Up, Theme & User Menu */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <ThemeSwitcher variant="toggle" className="hidden min-[400px]:flex w-8 h-8 sm:w-9 sm:h-9 rounded-xl border border-border/70 bg-card/60 shrink-0" />
          <BalanceDisplay initialBalance={balanceRub} variant="mobile-header" />
          <Link
            href="/dashboard/finance"
            className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 min-h-[34px] sm:min-h-[38px] text-xs sm:text-sm font-bold bg-primary text-primary-foreground rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0"
            title="Пополнить баланс"
            aria-label="Пополнить баланс"
          >
            <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden sm:inline">Пополнить</span>
          </Link>

          {/* Mobile Profile Avatar Link */}
          <Link
            href="/dashboard/settings"
            className="xl:hidden flex items-center justify-center w-8 h-8 rounded-xl bg-primary/10 text-primary border border-primary/20 font-bold text-xs uppercase shrink-0"
            title="Профиль и настройки"
          >
            {user.email.substring(0, 2)}
          </Link>

          {/* Desktop User Menu */}
          <div className="hidden xl:flex items-center gap-2 pl-3 border-l border-border/40">
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-muted/50 text-foreground transition-colors group shrink-0"
              title="Настройки профиля"
            >
              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold uppercase group-hover:scale-105 transition-transform shrink-0">
                {user.email.substring(0, 2)}
              </div>
              <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground max-w-[130px] truncate shrink-0">
                {user.email}
              </span>
            </Link>

            <Link
              href="/dashboard/settings"
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-xl transition-colors shrink-0"
              title="Настройки профиля"
            >
              <Settings className="w-4 h-4" />
            </Link>

            <button
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                try {
                  await fetch('/api/auth/logout', { method: 'POST', signal: AbortSignal.timeout(5000) });
                } catch {}
                window.location.href = '/login?tenant=flux';
              }}
              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors shrink-0 cursor-pointer"
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
