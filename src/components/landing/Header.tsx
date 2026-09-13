'use client';

import React, { useState } from "react";
import Link from "next/link";
import { LogIn, LogOut, Menu, Loader2 } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { TenantLogo } from "@/components/ui/TenantLogo";
import { normalizeTenantId } from "@/lib/tenant-resolver-edge";

interface HeaderProps {
  initialEmail?: string;
  siteName: string;
  tenantId?: string;
  activePath?: string;
}

export function Header({ initialEmail, siteName, tenantId, activePath }: HeaderProps) {
  const isFlux = normalizeTenantId(tenantId) === 'flux';
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    }
    window.location.href = isFlux ? '/login?tenant=flux' : '/login';
  };

  return (
    <header className="w-full sticky top-0 z-50 backdrop-blur-2xl bg-background/80 border-b border-border/50 shadow-[0_4px_30px_rgba(0,0,0,0.02)] transition-all">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <TenantLogo tenantId={tenantId} className="w-8 h-8" iconClassName="w-4 h-4" />
          <span className="text-base sm:text-xl font-black tracking-tight text-foreground">
            {siteName}
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold">
          <Link 
            href={ROUTES.HOME} 
            className={`transition-colors ${
              activePath === "/" 
                ? (isFlux ? "text-purple-600 dark:text-purple-400 font-black" : "text-primary") 
                : (isFlux ? "text-muted-foreground hover:text-purple-600" : "text-muted-foreground hover:text-primary")
            }`}
          >
            Услуги
          </Link>
          <a 
            href="/api/support/telegram" 
            target="_blank" 
            rel="noopener noreferrer" 
            className={`flex items-center gap-1.5 transition-colors ${
              isFlux ? "text-muted-foreground hover:text-purple-600" : "text-muted-foreground hover:text-primary"
            }`}
          >
            <span>Поддержка</span>
            <span className={`w-1.5 h-1.5 rounded-full ${isFlux ? "bg-purple-600" : "bg-primary"}`} />
          </a>
          <Link 
            href={ROUTES.FAQ} 
            className={`transition-colors ${
              activePath === "/#faq" 
                ? (isFlux ? "text-purple-600 dark:text-purple-400 font-black" : "text-primary") 
                : (isFlux ? "text-muted-foreground hover:text-purple-600" : "text-muted-foreground hover:text-primary")
            }`}
          >
            FAQ
          </Link>
          <Link 
            href="/knowledge" 
            className={`transition-colors ${
              activePath === "/knowledge" 
                ? (isFlux ? "text-purple-600 dark:text-purple-400 font-black" : "text-primary") 
                : (isFlux ? "text-muted-foreground hover:text-purple-600" : "text-muted-foreground hover:text-primary")
            }`}
          >
            База знаний
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {initialEmail ? (
            <div className="hidden sm:flex items-center gap-2 sm:gap-3">
              <span className="hidden lg:inline text-xs font-semibold text-muted-foreground">
                Вы вошли как: <span className="text-foreground font-bold">{initialEmail}</span>
              </span>
              <Link
                href="/dashboard"
                className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all duration-300 ${
                  isFlux
                    ? "bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 text-white shadow-[0_4px_16px_rgba(168,85,247,0.35)] hover:shadow-[0_6px_22px_rgba(236,72,153,0.45)] hover:-translate-y-0.5"
                    : "bg-primary text-primary-foreground shadow-[0_2px_15px] shadow-primary/20 hover:opacity-90"
                }`}
              >
                <span>Личный кабинет</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center justify-center p-2 sm:p-2.5 min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] rounded-full bg-default-100 hover:bg-default-200 text-muted-foreground hover:text-destructive transition-colors border border-default-200 cursor-pointer disabled:opacity-50"
                title="Выйти из аккаунта"
                aria-label="Выйти из аккаунта"
              >
                {isLoggingOut ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
              </button>
            </div>
          ) : (
            <Link
              href={ROUTES.AUTH.LOGIN}
              className={`flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold border transition-all duration-300 ${
                isFlux
                  ? "bg-card text-foreground border-border/80 hover:border-purple-400 hover:text-purple-600 shadow-sm"
                  : "bg-default-100 text-foreground border-default-200 hover:bg-default-200"
              }`}
            >
              <LogIn className={`w-4 h-4 ${isFlux ? "text-purple-500" : "text-muted-foreground"}`} />
              <span>Войти</span>
            </Link>
          )}

          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Открыть меню навигации"
                className="flex items-center justify-center p-2.5 rounded-full bg-default-100 hover:bg-default-200 text-muted-foreground hover:text-foreground border border-default-200 cursor-pointer active:scale-95 transition-all min-h-[44px] min-w-[44px] outline-none"
              >
                <Menu className="w-5 h-5 shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl bg-card border-border shadow-xl">
                {initialEmail && (
                  <DropdownMenuItem className="p-0 cursor-pointer">
                    <Link href="/dashboard" className="flex items-center gap-2 w-full py-2 px-3 rounded-xl font-bold text-primary">
                      <span>Личный кабинет</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="p-0 cursor-pointer">
                  <Link href={ROUTES.HOME} className="flex items-center gap-2 w-full py-2 px-3 rounded-xl">
                    <span>Услуги</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="p-0 cursor-pointer">
                  <a href="/api/support/telegram" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 w-full py-2 px-3 rounded-xl">
                    <span>Поддержка</span>
                    <span className={`w-2 h-2 rounded-full ${isFlux ? "bg-purple-600" : "bg-primary"}`} />
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem className="p-0 cursor-pointer">
                  <Link href={ROUTES.FAQ} className="flex items-center gap-2 w-full py-2 px-3 rounded-xl">
                    <span>FAQ</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="p-0 cursor-pointer">
                  <Link href="/knowledge" className="flex items-center gap-2 w-full py-2 px-3 rounded-xl">
                    <span>База знаний</span>
                  </Link>
                </DropdownMenuItem>
                {initialEmail && (
                  <DropdownMenuItem className="p-0 cursor-pointer">
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="flex items-center gap-2 w-full py-2 px-3 rounded-xl text-destructive hover:bg-destructive/10 transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      <span>Выйти из аккаунта</span>
                    </button>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
