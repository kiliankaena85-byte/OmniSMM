'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CommandMenu } from '@/components/admin/command-menu';
import { StatusBadge } from '@/components/ui/status-badge';
import { 
  Home, Users, Package, RefreshCw, ShoppingCart, 
  MessageSquare, CreditCard, Link as LinkIcon, Gift, FileText, Settings,
  PanelLeftClose, PanelLeftOpen, ArrowLeft, BarChart, BarChart3, Inbox, Shield, AlertTriangle, ToggleLeft, Activity, Cpu, BookOpen,
  Sun, Moon, ArrowLeftRight, Globe, FolderTree, Layers, Star, ChevronDown, ChevronRight, TrendingUp, Landmark
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
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

interface SidebarProps {
  userEmail: string;
  roleInfo: { label: string; color: string };
  navigation: NavGroup[];
  siteName?: string;
  tenantId?: string;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  Home, Users, Package, RefreshCw, ShoppingCart, AlertTriangle,
  MessageSquare, CreditCard, Link: LinkIcon, Gift, FileText, Settings, BarChart, BarChart3, Inbox, Shield,
  ToggleLeft, Activity, Cpu, BookOpen, ArrowLeftRight, Globe, FolderTree, Layers, TrendingUp, Landmark
};

export function AdminSidebar({ userEmail, roleInfo, navigation }: SidebarProps) {
  const [collapsed, setCollapsed] = React.useState(true);
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // User Customization: Pinned Tabs & Collapsed Group Preferences
  const [pinnedHrefs, setPinnedHrefs] = React.useState<string[]>([]);
  const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    setMounted(true);
    try {
      const savedPinned = localStorage.getItem('admin_pinned_nav_tabs');
      if (savedPinned) {
        setPinnedHrefs(JSON.parse(savedPinned));
      }
      const savedGroups = localStorage.getItem('admin_collapsed_nav_groups');
      if (savedGroups) {
        setCollapsedGroups(JSON.parse(savedGroups));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const togglePin = (href: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPinnedHrefs((prev) => {
      const next = prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href];
      try {
        localStorage.setItem('admin_pinned_nav_tabs', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [groupName]: !prev[groupName] };
      try {
        localStorage.setItem('admin_collapsed_nav_groups', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const currentTheme = theme || 'sky-dark';
  const currentAccent = currentTheme.includes('emerald') ? 'emerald' : currentTheme.includes('violet') ? 'violet' : currentTheme.includes('warm') ? 'warm' : currentTheme.includes('telegram') ? 'telegram' : 'sky';

  const allNavHrefs = React.useMemo(() => {
    return navigation.flatMap((g) => g.items.map((item) => item.href));
  }, [navigation]);

  // All flat items map for pinned rendering
  const allItemsMap = React.useMemo(() => {
    const map = new Map<string, NavItem>();
    navigation.forEach((g) => g.items.forEach((item) => map.set(item.href, item)));
    return map;
  }, [navigation]);

  const pinnedItems = React.useMemo(() => {
    return pinnedHrefs.map((href) => allItemsMap.get(href)).filter(Boolean) as NavItem[];
  }, [pinnedHrefs, allItemsMap]);

  return (
    <aside 
      className={cn(
        "relative z-20 h-screen flex-shrink-0 transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] group hidden md:flex flex-col",
        "bg-background/40 backdrop-blur-xl border-r border-border/40 shadow-[4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.1)]",
        collapsed ? "w-16" : "w-[280px]"
      )}
    >
      {/* Collapse Toggle */}
      <div className={cn("absolute z-50 transition-all duration-500", collapsed ? "top-6 left-1/2 -translate-x-1/2" : "top-7 right-4")}>
        <button 
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"}
          className="flex items-center justify-center w-9 h-9 min-h-[36px] min-w-[36px] rounded-[10px] bg-card/80 backdrop-blur-md border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-300 active:scale-95 shadow-sm cursor-pointer"
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4 ml-0.5" /> : <PanelLeftClose className="w-4 h-4 mr-0.5" />}
        </button>
      </div>

      {/* Header Profile Area */}
      <div className={cn("pt-8 pb-6 px-6 transition-all duration-300 relative", collapsed ? "opacity-0 invisible h-0 p-0" : "opacity-100")}>
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-black text-xs shadow-sm">
            ⚡
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-foreground flex items-center gap-1.5">
            OmniSMM
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
              1.0
            </span>
          </h2>
        </div>
        <p className="text-[11px] text-muted-foreground font-medium truncate mb-3 tracking-wide">{userEmail}</p>
        <div className="flex items-center gap-2">
          <span className={cn(
            "inline-flex items-center px-2.5 py-1 text-[10px] rounded-[10px] uppercase font-bold tracking-wider shadow-sm border border-border bg-muted/30 text-foreground"
          )}>
            <div className="w-1.5 h-1.5 rounded-full bg-primary mr-1.5 animate-pulse" />
            {roleInfo.label}
          </span>
        </div>
      </div>

      <nav className={cn(
        "flex-1 min-h-0 px-3 py-4 space-y-5 overflow-y-auto scrollbar-hide",
        collapsed && "pt-20 space-y-2"
      )}>
        <div className={cn("mb-3 px-1", collapsed && "hidden")}>
          <CommandMenu navigation={navigation} />
        </div>

        {/* ── PINNED ITEMS (⭐ ИЗБРАННОЕ) ── */}
        {pinnedItems.length > 0 && (
          <div className="space-y-1 pb-3 mb-2 border-b border-border/40">
            {!collapsed && (
              <h3 className="px-3 mb-1.5 text-[10px] font-black text-warning uppercase tracking-[0.2em] flex items-center gap-1.5">
                <Star className="w-3 h-3 fill-warning/20" />
                Избранное
              </h3>
            )}
            {pinnedItems.map((tab) => {
              const isActive = isNavTabActive(pathname, tab.href, allNavHrefs);
              const IconComponent = ICON_MAP[tab.icon] || Home;
              return (
                <Link
                  key={`pinned-${tab.href}`}
                  href={tab.href}
                  title={collapsed ? `⭐ ${tab.label}` : undefined}
                  className={cn(
                    "relative flex items-center px-3 text-sm font-medium rounded-[10px] transition-all duration-200 whitespace-nowrap overflow-hidden group h-11",
                    isActive 
                      ? "bg-primary/15 text-primary font-bold shadow-sm" 
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    collapsed && "justify-center px-0 w-11 h-11 mx-auto"
                  )}
                >
                  <span className={cn(
                    "transition-transform duration-200 group-hover:scale-110", 
                    collapsed ? "" : "mr-3 w-5 text-center flex justify-center",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}>
                    <IconComponent className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                  </span>
                  {!collapsed && <span className="tracking-wide flex-1 truncate">{tab.label}</span>}
                  
                  {/* Unpin button */}
                  {!collapsed && (
                    <button
                      onClick={(e) => togglePin(tab.href, e)}
                      title="Убрать из избранного"
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-warning text-muted-foreground transition-opacity cursor-pointer"
                    >
                      <Star className="w-3.5 h-3.5 fill-warning text-warning" />
                    </button>
                  )}
                </Link>
              );
            })}
          </div>
        )}
        
        {/* ── STANDARD NAVIGATION GROUPS ── */}
        {navigation.map((section, sIdx) => {
          const isGroupCollapsed = Boolean(collapsedGroups[section.group]);

          return (
            <div key={section.group} className="space-y-1">
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup(section.group)}
                  className="w-full flex items-center justify-between px-3 py-1 text-[10px] font-extrabold text-muted-foreground/70 hover:text-foreground uppercase tracking-[0.2em] transition-colors cursor-pointer group/hdr"
                >
                  <span>{section.group}</span>
                  <span className="opacity-0 group-hover/hdr:opacity-100 transition-opacity">
                    {isGroupCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </span>
                </button>
              )}

              {/* Group Items */}
              {(!isGroupCollapsed || collapsed) && (
                <div className="space-y-0.5">
                  {section.items.map((tab) => {
                    const isActive = isNavTabActive(pathname, tab.href, allNavHrefs);
                    const isPinned = pinnedHrefs.includes(tab.href);
                    const IconComponent = ICON_MAP[tab.icon] || Home;

                    return (
                      <Link
                        key={tab.href}
                        href={tab.href}
                        title={collapsed ? tab.label : undefined}
                        aria-label={tab.label}
                        className={cn(
                          "relative flex items-center px-3 text-sm font-medium rounded-[10px] transition-all duration-200 whitespace-nowrap overflow-hidden group h-11",
                          isActive 
                            ? "bg-primary/10 text-primary font-bold shadow-sm shadow-primary/5" 
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                          collapsed && "justify-center px-0 w-11 h-11 mx-auto"
                        )}
                      >
                        <span className={cn(
                          "transition-transform duration-200 group-hover:scale-110", 
                          collapsed ? "" : "mr-3 w-5 text-center flex justify-center",
                          isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                        )}>
                          <IconComponent className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                        </span>
                        {!collapsed && <span className="tracking-wide flex-1 truncate">{tab.label}</span>}
                        
                        {/* Badge counter */}
                        {!collapsed && tab.badge !== undefined && tab.badge > 0 && (
                          <span className="ml-auto mr-1.5 px-2 py-0.5 text-[10px] font-black leading-none rounded-full bg-rose-500 text-white shadow-sm shadow-rose-500/30 flex items-center justify-center animate-pulse">
                            {tab.badge > 99 ? '99+' : tab.badge}
                          </span>
                        )}
                        {collapsed && tab.badge !== undefined && tab.badge > 0 && (
                          <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-card shadow-sm animate-pulse" />
                        )}

                        {/* Pin / Favorite button on hover */}
                        {!collapsed && (
                          <button
                            onClick={(e) => togglePin(tab.href, e)}
                            title={isPinned ? "Убрать из избранного" : "Закрепить в избранном"}
                            className={cn(
                              "p-1 rounded transition-all cursor-pointer",
                              isPinned
                                ? "text-warning fill-warning opacity-100"
                                : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-warning"
                            )}
                          >
                            <Star className={cn("w-3.5 h-3.5", isPinned && "fill-warning")} />
                          </button>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}

              {!collapsed && sIdx < navigation.length - 1 && (
                <div className="h-px bg-border/30 mx-3 mt-3 mb-1" />
              )}
            </div>
          );
        })}

        <div className="pt-3 mt-2 border-t border-border/40 mx-2">
          <Link
            href="/dashboard/new-order"
            title={collapsed ? "В кабинет клиента" : undefined}
            aria-label="В кабинет клиента"
            className={cn(
              "flex items-center px-3 text-sm font-medium rounded-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200 whitespace-nowrap border border-transparent hover:border-border group h-11",
              collapsed && "justify-center px-0 w-11 h-11 mx-auto"
            )}
          >
            <ArrowLeft className="w-[18px] h-[18px] flex-shrink-0 transition-transform group-hover:-translate-x-1" />
            {!collapsed && <span className="ml-3 tracking-wide">В кабинет клиента</span>}
          </Link>
        </div>
      </nav>
    </aside>
  );
}
