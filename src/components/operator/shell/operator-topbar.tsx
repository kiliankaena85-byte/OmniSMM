'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NavGroup } from '@/types/operator/navigation';
import { Menu, X, LogOut, User } from 'lucide-react';

interface OperatorTopbarProps {
  userEmail: string;
  roleLabel: string;
  navigation: NavGroup[];
}

export function OperatorTopbar({ userEmail, roleLabel, navigation }: OperatorTopbarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Determine current page title
  const currentItem = React.useMemo(() => {
    for (const group of navigation) {
      const match = group.items.find(item => item.href === pathname);
      if (match) return match;
    }
    return null;
  }, [pathname, navigation]);

  const pageTitle = currentItem ? currentItem.label : 'Панель оператора';

  return (
    <header className="relative w-full border-b border-border/40 bg-card/65 backdrop-blur-md z-30">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        
        {/* Left Side: Mobile Menu Button & Breadcrumb */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted/80 hover:text-foreground md:hidden cursor-pointer"
            style={{ minHeight: '44px', minWidth: '44px' }}
            aria-label="Открыть меню навигации"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          
          <div className="flex flex-col">
            <h1 className="text-base font-bold text-foreground font-sans tracking-wide leading-none md:text-lg">
              {pageTitle}
            </h1>
            <span className="text-[10px] text-muted-foreground hidden md:inline font-mono leading-none mt-1">
              operator{pathname}
            </span>
          </div>
        </div>

        {/* Right Side: Quick Profile indicator */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end justify-center select-none text-right">
            <span className="text-xs font-semibold text-foreground leading-tight truncate max-w-[180px] font-sans">
              {userEmail}
            </span>
            <span className="text-[10px] font-bold text-primary tracking-widest uppercase mt-0.5 leading-none">
              {roleLabel}
            </span>
          </div>

          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20">
            <User className="h-4.5 w-4.5" />
          </div>

          <button
            type="button"
            onClick={async (e) => {
              e.preventDefault();
              try {
                await fetch('/api/auth/logout', { method: 'POST' });
              } catch {}
              window.location.href = '/login';
            }}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive border border-border/40 transition-colors duration-200 cursor-pointer"
            title="Выйти"
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            <LogOut className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation Fallback */}
      {mobileMenuOpen && (
        <div className="absolute top-16 left-0 w-full bg-card border-b border-border shadow-lg md:hidden animate-in fade-in slide-in-from-top-4 duration-200">
          <nav className="flex flex-col p-4 space-y-4">
            {navigation.map((group) => (
              <div key={group.group} className="space-y-1">
                <span className="text-[10px] font-extrabold text-muted-foreground/60 uppercase tracking-wider px-3 select-none">
                  {group.group}
                </span>
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center px-3 text-sm font-medium rounded-xl h-11 w-full",
                        isActive 
                          ? "bg-primary/10 text-primary font-bold" 
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
