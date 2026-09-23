'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Package, 
  MessageSquare, 
  Users, 
  CreditCard, 
  PanelLeftOpen, 
  PanelLeftClose 
} from 'lucide-react';
import { NavGroup } from '@/types/operator/navigation';

// Dynamic Icon Registry
const ICON_MAP: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  LayoutDashboard,
  Package,
  MessageSquare,
  Users,
  CreditCard,
};

interface OperatorSidebarProps {
  userEmail: string;
  roleLabel: string;
  navigation: NavGroup[];
  badges?: Record<string, number>;
}

export function OperatorSidebar({ userEmail, roleLabel, navigation, badges = {} }: OperatorSidebarProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const pathname = usePathname();

  return (
    <aside 
      className={cn(
        "relative z-20 h-screen flex-shrink-0 transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] hidden md:flex flex-col",
        "bg-background/40 backdrop-blur-xl border-r border-border/40 shadow-[4px_0_24px_rgba(0,0,0,0.02)]",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Collapse Toggle Button */}
      <div className={cn("absolute z-50 transition-all duration-500", collapsed ? "top-6 left-1/2 -translate-x-1/2" : "top-7 right-4")}>
        <button 
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"}
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-card border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-200 active:scale-95 shadow-sm cursor-pointer"
          style={{ minHeight: '44px', minWidth: '44px' }} // WCAG 2.2 AA target size compliance
        >
          {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
        </button>
      </div>

      {/* Profile Header Area */}
      <div className={cn("pt-8 pb-6 px-6 transition-all duration-300 relative select-none", collapsed ? "opacity-0 invisible h-0 p-0" : "opacity-100")}>
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        
        <h2 className="text-lg font-extrabold tracking-tight mb-0.5 text-foreground leading-normal font-sans">
          SMMplan <span className="text-primary text-xs font-semibold px-1.5 py-0.5 bg-primary/10 rounded">Shell</span>
        </h2>
        <p className="text-[11px] text-muted-foreground font-medium truncate mb-3 tracking-wide leading-relaxed">{userEmail}</p>
        <div className="flex items-center">
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] rounded-full uppercase font-bold tracking-wider border border-border bg-muted/30 text-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mr-1.5 animate-pulse" />
            {roleLabel}
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className={cn(
        "flex-1 min-h-0 px-3 py-4 space-y-6 overflow-y-auto scrollbar-hide",
        collapsed && "pt-20 space-y-2"
      )}>
        {navigation.map((group) => (
          <div key={group.group} className="space-y-1">
            {!collapsed && (
              <h3 className="px-3 mb-2 text-[10px] font-extrabold text-muted-foreground/60 uppercase tracking-[0.15em] transition-all duration-300 select-none">
                {group.group}
              </h3>
            )}
            {group.items.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
              const IconComponent = ICON_MAP[item.icon] || LayoutDashboard;
              const badgeVal = item.badgeKey ? (badges[item.badgeKey] ?? item.badgeValue) : undefined;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "relative flex items-center px-3 text-sm font-medium rounded-xl transition-all duration-200 whitespace-nowrap overflow-hidden group",
                    "h-12 w-full", // 48px height satisfies WCAG P0 constraints
                    isActive 
                      ? "bg-primary/10 text-primary font-bold shadow-sm shadow-primary/5" 
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <span className={cn(
                    "transition-transform duration-300 group-hover:scale-105", 
                    collapsed ? "mx-auto" : "mr-3"
                  )}>
                    <IconComponent className="w-5 h-5 flex-shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                  </span>
                  
                  {!collapsed && <span className="tracking-wide leading-relaxed font-sans">{item.label}</span>}
                  
                  {/* Badges */}
                  {badgeVal !== undefined && badgeVal > 0 && (
                    <>
                      {!collapsed ? (
                        <span className="ml-auto mr-1 px-2 py-0.5 text-xs font-bold rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                          {badgeVal}
                        </span>
                      ) : (
                        <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-destructive border-2 border-background" />
                      )}
                    </>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
