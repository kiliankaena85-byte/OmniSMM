'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { 
  Menu, X, Home, Users, Package, ShoppingCart, 
  MessageSquare, CreditCard, Link as LinkIcon, Settings,
  RefreshCw, BarChart, BarChart3, Inbox, Shield, AlertTriangle,
  Activity, BookOpen, Globe, FolderTree, Layers, TrendingUp, Landmark
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { isNavTabActive } from '@/components/admin/navigation-data';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  section?: string;
  badge?: number;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

interface MobileNavDrawerProps {
  userEmail: string;
  roleInfo: { label: string; color: string };
  navigation: NavGroup[];
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  Home,
  Users,
  Package,
  ShoppingCart,
  MessageSquare,
  CreditCard,
  Link: LinkIcon,
  Settings,
  RefreshCw,
  BarChart,
  BarChart3,
  Inbox,
  Shield,
  AlertTriangle,
  Activity,
  BookOpen,
  Globe,
  FolderTree,
  Layers,
  TrendingUp,
  Landmark,
};

export function MobileNavDrawer({ userEmail, roleInfo, navigation }: MobileNavDrawerProps) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  const allNavHrefs = React.useMemo(() => {
    return navigation.flatMap((g) => g.items.map((item) => item.href));
  }, [navigation]);

  // Close drawer on route change
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="md:hidden flex items-center justify-center h-11 w-11 min-h-[44px] min-w-[44px] rounded-xl border border-border/50 text-foreground hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition-all cursor-pointer"
        aria-label="Открыть меню навигации"
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>

      <SheetContent side="left" className="w-[290px] sm:w-[320px] p-0 bg-card/95 backdrop-blur-xl border-r border-border flex flex-col h-full z-50">
        {/* Header */}
        <div className="px-5 pt-6 pb-4 border-b border-border/60 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-black text-xs shadow-xs">
                ⚡
              </div>
              <h2 className="text-base font-extrabold tracking-tight text-foreground">
                OmniSMM
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 ml-1">
                  1.0
                </span>
              </h2>
            </div>
            <SheetClose
              className="h-11 w-11 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none cursor-pointer"
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </SheetClose>
          </div>

          <p className="text-[11px] text-muted-foreground font-medium truncate mb-2.5">
            {userEmail}
          </p>

          <span className={cn(
            "inline-flex items-center px-2 py-0.5 text-[10px] rounded-lg uppercase font-bold tracking-wider border border-border bg-muted/40",
            roleInfo.color
          )}>
            <div className="w-1.5 h-1.5 rounded-full bg-primary mr-1.5 animate-pulse" />
            {roleInfo.label}
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {navigation.map((section) => (
            <div key={section.group} className="space-y-1">
              <h3 className="px-2 text-[10px] font-black text-muted-foreground/80 uppercase tracking-[0.2em] mb-1">
                {section.group}
              </h3>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = isNavTabActive(pathname, item.href, allNavHrefs);
                  const IconComponent = ICON_MAP[item.icon] || Home;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center px-3 min-h-[44px] h-11 text-xs font-semibold rounded-lg transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                        isActive
                          ? "bg-primary text-primary-foreground font-bold shadow-xs"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <IconComponent
                        className={cn(
                          "w-4 h-4 mr-2.5 flex-shrink-0",
                          isActive ? "text-primary-foreground" : "text-muted-foreground"
                        )}
                        strokeWidth={isActive ? 2.5 : 2}
                      />
                      <span className="flex-1 truncate">{item.label}</span>

                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="ml-auto px-2 py-0.5 text-[10px] font-black leading-none rounded-full bg-rose-500 text-white shadow-sm shadow-rose-500/30">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer - Back to Client Dashboard */}
        <div className="p-3 border-t border-border/60 bg-muted/20 shrink-0">
          <Link
            href="/dashboard/new-order"
            className="flex items-center px-3 py-2 text-xs font-semibold rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200"
          >
            <svg className="w-4 h-4 mr-2.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>В кабинет клиента</span>
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
