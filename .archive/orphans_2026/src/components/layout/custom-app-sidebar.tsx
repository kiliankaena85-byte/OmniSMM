'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  Layers,
  Wallet,
  Headphones,
  Settings,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Search,
} from 'lucide-react';

export interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  badgeVariant?: 'primary' | 'success' | 'warning';
}

const DEFAULT_NAV_ITEMS: NavItem[] = [
  { title: 'Главная панель', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Новый заказ', href: '/dashboard/order', icon: ShoppingCart, badge: 'HOT', badgeVariant: 'primary' },
  { title: 'Мои заказы', href: '/dashboard/orders', icon: Layers },
  { title: 'Каталог услуг', href: '/services', icon: TrendingUp },
  { title: 'Пополнение баланса', href: '/dashboard/add-funds', icon: Wallet },
  { title: 'Служба поддержки', href: '/dashboard/tickets', icon: Headphones },
  { title: 'Настройки', href: '/dashboard/settings', icon: Settings },
];

export interface CustomAppSidebarProps {
  userEmail?: string;
  userBalance?: string;
  items?: NavItem[];
  brandName?: string;
  brandLogo?: React.ReactNode;
}

export function CustomAppSidebar({
  userEmail = 'client@smmplan.pro',
  userBalance = '0.00 ₽',
  items = DEFAULT_NAV_ITEMS,
  brandName = 'SMMplan Custom',
  brandLogo,
}: CustomAppSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const pathname = usePathname();

  const filteredItems = items.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside
      aria-label="Боковая навигационная панель"
      className={`relative z-30 h-screen flex flex-col bg-card/95 backdrop-blur-xl border-r border-border transition-all duration-300 select-none ${
        isCollapsed ? 'w-20' : 'w-72'
      }`}
    >
      {/* ── Header / Brand ── */}
      <div className="flex items-center justify-between p-4 border-b border-border/80 h-16 shrink-0">
        <Link href="/" className="flex items-center gap-3 min-w-0 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary via-indigo-600 to-pink-500 flex items-center justify-center text-primary-foreground font-black text-sm shrink-0 shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform duration-200">
            {brandLogo || <Sparkles className="w-5 h-5 animate-pulse" />}
          </div>
          {!isCollapsed && (
            <div className="truncate flex flex-col">
              <span className="font-extrabold text-foreground tracking-tight text-base leading-tight">
                {brandName}
              </span>
              <span className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase">
                Pro Panel
              </span>
            </div>
          )}
        </Link>

        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          title={isCollapsed ? 'Развернуть панель' : 'Свернуть панель'}
          aria-label={isCollapsed ? 'Развернуть панель' : 'Свернуть панель'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* ── Search Bar (when expanded) ── */}
      {!isCollapsed && (
        <div className="p-3 border-b border-border/50">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Быстрый поиск разделов..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-muted/60 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200"
            />
          </div>
        </div>
      )}

      {/* ── Navigation Links ── */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
        {filteredItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
              } ${isCollapsed ? 'justify-center' : ''}`}
            >
              <Icon
                className={`w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                  isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-primary'
                }`}
              />

              {!isCollapsed && (
                <div className="flex-1 flex items-center justify-between truncate">
                  <span className="truncate">{item.title}</span>
                  {item.badge && (
                    <span
                      className={`text-[10px] uppercase font-black px-1.5 py-0.5 rounded-md ${
                        isActive
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-primary/15 text-primary'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              )}

              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2.5 py-1 rounded-lg bg-popover text-popover-foreground text-xs font-semibold shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-nowrap border border-border">
                  {item.title}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Bottom Balance / User Widget ── */}
      <div className="p-3 border-t border-border/80 bg-muted/20 shrink-0">
        {!isCollapsed ? (
          <div className="p-3 rounded-2xl bg-card border border-border/80 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Баланс счёта</span>
              <span className="font-black text-foreground tracking-tight text-sm">
                {userBalance}
              </span>
            </div>
            <Link
              href="/dashboard/add-funds"
              className="w-full py-1.5 flex items-center justify-center text-xs font-bold bg-primary text-primary-foreground rounded-xl shadow-sm shadow-primary/20 hover:opacity-95 active:scale-98 transition-all duration-200"
            >
              + Пополнить счёт
            </Link>
            <div className="pt-1 text-[11px] text-muted-foreground truncate" title={userEmail}>
              {userEmail}
            </div>
          </div>
        ) : (
          <Link
            href="/dashboard/add-funds"
            className="w-full h-10 flex items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:scale-105 transition-all duration-200"
            title={`Баланс: ${userBalance}`}
          >
            <Wallet className="w-5 h-5" />
          </Link>
        )}
      </div>
    </aside>
  );
}
