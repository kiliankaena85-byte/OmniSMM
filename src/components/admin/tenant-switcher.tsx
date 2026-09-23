'use client';

import React, { useState, useRef, useEffect, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { TENANTS, TenantId } from '@/config/tenants';
import { Globe, ChevronDown, Check, ExternalLink, Sparkles, Loader2 } from 'lucide-react';
import { getTenantHost } from '@/lib/seo-helpers';
import { switchAdminTenantAction } from '@/actions/admin/tenants';

interface TenantSwitcherProps {
  currentTenant?: string;
  className?: string;
  variant?: 'dropdown' | 'segmented';
  allowedTenants?: string[];
  isOwner?: boolean;
}

export function TenantSwitcher({
  currentTenant = 'smmplan',
  className = '',
  variant = 'dropdown',
  allowedTenants,
  isOwner = true,
}: TenantSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter tenants list according to staff RBAC boundary
  const visibleTenants = React.useMemo(() => {
    if (isOwner) return TENANTS;
    if (allowedTenants && allowedTenants.length > 0) {
      return TENANTS.filter((t) => allowedTenants.includes(t.id));
    }
    return TENANTS.filter((t) => t.id === currentTenant);
  }, [isOwner, allowedTenants, currentTenant]);

  const canSwitch = isOwner || visibleTenants.length > 1;

  // Initialize tenant from searchParams or currentTenant
  const [selectedTenantId, setSelectedTenantId] = useState<TenantId>(() => {
    const urlTenant = searchParams.get('tenant') as TenantId | null;
    if (urlTenant && visibleTenants.some((t) => t.id === urlTenant)) return urlTenant;
    const matched = visibleTenants.find((t) => t.id === currentTenant);
    return (matched ? matched.id : visibleTenants[0]?.id) || 'smmplan';
  });

  // Keep state synchronized with URL searchParams and cookie
  useEffect(() => {
    const urlTenant = searchParams.get('tenant') as TenantId | null;
    if (urlTenant && visibleTenants.some((t) => t.id === urlTenant)) {
      setSelectedTenantId(urlTenant);
      return;
    }

    try {
      const match = document.cookie.match(/(?:^|;\s*)x_admin_tenant=([^;]+)/);
      if (match && match[1]) {
        const cTenant = match[1] as TenantId;
        if (visibleTenants.some((t) => t.id === cTenant)) {
          setSelectedTenantId(cTenant);
        }
      }
    } catch {}
  }, [searchParams, currentTenant, visibleTenants]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const activeTenant = visibleTenants.find((t) => t.id === selectedTenantId) || visibleTenants[0] || TENANTS[0];

  const handleSelect = (tenantId: TenantId) => {
    setIsOpen(false);
    setSelectedTenantId(tenantId); // ⚡ Optimistic UI update

    // 1. Set cookie on client for immediate network fetch availability
    try {
      document.cookie = `x_admin_tenant=${tenantId}; path=/; max-age=31536000; SameSite=Lax`;
      const adminContainer = document.querySelector('[data-tenant]');
      if (adminContainer) {
        adminContainer.setAttribute('data-tenant', tenantId);
      }
    } catch {}

    // 2. Server Action for atomic cookie set and layout cache invalidation
    startTransition(async () => {
      await switchAdminTenantAction(tenantId);

      const params = new URLSearchParams(searchParams.toString());
      params.set('tenant', tenantId);
      params.delete('cursor');
      params.delete('page');

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      router.refresh(); // Force Server Components re-render with new tenant cookie
    });
  };

  if (variant === 'segmented') {
    return (
      <div className={`inline-flex items-center p-1 bg-muted/60 dark:bg-muted/30 border border-border/60 rounded-xl shadow-inner ${className}`}>
        <div className="flex items-center gap-1.5 px-2.5 text-xs font-bold text-muted-foreground border-r border-border/40 mr-1 select-none">
          <Globe className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Сайт:</span>
        </div>
        <div className="flex items-center gap-1">
          {visibleTenants.map((t) => {
            const isActive = activeTenant.id === t.id;
            return (
              <button
                key={t.id}
                type="button"
                disabled={!canSwitch}
                onClick={() => handleSelect(t.id)}
                className={`px-3 py-2 min-h-[44px] flex items-center justify-center text-xs font-extrabold rounded-lg transition-all duration-200 active:scale-95 cursor-pointer ${
                  isActive
                    ? 'bg-background text-primary shadow-sm ring-1 ring-border/50'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                } ${!canSwitch ? 'opacity-80 cursor-default' : ''}`}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Default: Dropdown variant as seen in SmmPanel screenshots
  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        disabled={!canSwitch}
        onClick={() => canSwitch && setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className={`flex items-center gap-2 px-3.5 py-2 min-h-[44px] bg-card/90 hover:bg-card border border-border/80 text-foreground font-semibold rounded-xl transition-all duration-200 shadow-sm text-xs sm:text-sm select-none ${
          canSwitch ? 'hover:border-primary/50 active:scale-95 cursor-pointer' : 'cursor-default opacity-90'
        }`}
      >
        <div className="w-5 h-5 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
        </div>
        
        <span className="font-black text-foreground tracking-tight">
          {activeTenant.domain}
        </span>

        <span className="text-[11px] font-bold text-muted-foreground hidden lg:inline">
          ({activeTenant.name})
        </span>

        {canSwitch && (
          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : ''}`} />
        )}
      </button>

      {isOpen && canSwitch && (
        <div className="absolute left-0 mt-2 w-72 rounded-2xl bg-card/95 border border-border/80 shadow-2xl z-[100] py-2 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl">
          <div className="px-3.5 py-2 border-b border-border/50 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Список сайтов
            </span>
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {visibleTenants.length} {visibleTenants.length === 1 ? 'сайт' : 'сайта'}
            </span>
          </div>

          <div className="p-1.5 space-y-1">
            {visibleTenants.map((t) => {
              const isSelected = t.id === activeTenant.id;
              const host = getTenantHost(t.id);

              return (
                <div
                  key={t.id}
                  onClick={() => handleSelect(t.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all duration-150 group ${
                    isSelected
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'hover:bg-muted/70 text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-black ${
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground group-hover:bg-background group-hover:text-foreground'
                    }`}>
                      {t.id === 'flux' ? <Sparkles className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                    </div>
                    
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-extrabold truncate">
                        {t.domain}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {t.name}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                    
                    <a
                      href={`https://${host}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title={`Открыть ${t.name} в новой вкладке`}
                      className="p-1 text-muted-foreground/50 hover:text-foreground rounded-md hover:bg-muted transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export const GlobalSiteSwitcher = TenantSwitcher;

