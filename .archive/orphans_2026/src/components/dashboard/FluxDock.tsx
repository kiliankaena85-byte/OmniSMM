'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { DOCK_NAV_ITEMS } from '@/lib/navigation';

export function FluxDock({ email, className }: { email?: string; className?: string }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname.startsWith(href);

  return (
    <div className={`hidden md:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-2xl bg-card/80 backdrop-blur-2xl border border-border/45 rounded-3xl py-3 px-4 shadow-[0_12px_40px_rgba(0,0,0,0.12)] items-center justify-between transition-all duration-300 ${className || ''}`}>
      <nav className="flex-1 flex items-center justify-around gap-1">
        {DOCK_NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              aria-label={label}
              className={`relative flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3.5 py-2.5 sm:px-3 sm:py-2 text-xs font-semibold rounded-2xl transition-all duration-300 ${
                active
                  ? 'bg-primary text-primary-foreground shadow-[0_0_15px_var(--color-blob-sky)]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <Icon className="w-4.5 h-4.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          );
        })}
      </nav>
      
      <div className="h-6 w-px bg-border/60 mx-4" />

      {/* User / Logout */}
      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold uppercase shrink-0">
            {(email || '').substring(0, 2)}
          </div>
          <span className="text-xs text-muted-foreground font-semibold max-w-[100px] truncate min-w-0">{email}</span>
        </div>
        <button
          type="button"
          onClick={async (e) => {
            e.preventDefault();
            try {
              await fetch('/api/auth/logout', { method: 'POST', signal: AbortSignal.timeout(5000) });
            } catch {}
            window.location.href = '/login?tenant=flux';
          }}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-2xl transition-colors cursor-pointer"
          title="Выйти"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
