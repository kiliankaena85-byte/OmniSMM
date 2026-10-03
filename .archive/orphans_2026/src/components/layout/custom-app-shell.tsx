'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Menu, X, Sparkles, Bell } from 'lucide-react';
import { CustomAppSidebar, NavItem } from './custom-app-sidebar';

export interface CustomAppShellProps {
  children: React.ReactNode;
  userEmail?: string;
  userBalance?: string;
  brandName?: string;
  navItems?: NavItem[];
}

export function CustomAppShell({
  children,
  userEmail = 'client@smmplan.pro',
  userBalance = '0.00 ₽',
  brandName = 'SMMplan Pro',
  navItems,
}: CustomAppShellProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground flex relative selection:bg-primary/20 selection:text-primary">
      {/* ── Background Glow ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-indigo-500/5 rounded-full blur-[120px]" />
      </div>

      {/* ── Desktop Sidebar ── */}
      <div className="hidden lg:flex relative z-20 shrink-0">
        <CustomAppSidebar
          userEmail={userEmail}
          userBalance={userBalance}
          brandName={brandName}
          items={navItems}
        />
      </div>

      {/* ── Mobile Backdrop & Drawer ── */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10 animate-in slide-in-from-left duration-200">
            <CustomAppSidebar
              userEmail={userEmail}
              userBalance={userBalance}
              brandName={brandName}
              items={navItems}
            />
          </div>
          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-xl bg-card border border-border text-foreground z-10"
            aria-label="Закрыть меню"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* ── Main Layout Column ── */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* ── Top Header ── */}
        <header className="h-16 border-b border-border/80 bg-card/80 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Открыть главное меню"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link href="/" className="lg:hidden flex items-center gap-2 font-bold text-foreground">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-black text-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="truncate">{brandName}</span>
            </Link>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/60 border border-border text-xs">
              <span className="text-muted-foreground">Баланс:</span>
              <span className="font-bold text-foreground">{userBalance}</span>
            </div>
            <Link
              href="/dashboard/add-funds"
              className="px-3.5 py-1.5 text-xs font-bold bg-primary text-primary-foreground rounded-xl shadow-sm shadow-primary/20 hover:opacity-95 transition-all"
            >
              + Пополнить
            </Link>
            <button
              type="button"
              className="p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Уведомления"
            >
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ── Content Canvas ── */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto outline-none overflow-y-auto"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
