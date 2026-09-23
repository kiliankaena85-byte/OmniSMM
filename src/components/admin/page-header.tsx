import * as React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface AdminPageHeaderProps {
    icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  showTenantSelector?: boolean;
  currentTenant?: string;
}

export function AdminPageHeader({ 
  icon: Icon, 
  title, 
  description, 
  action, 
  breadcrumbs,
}: AdminPageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-border/50 mb-6">
      <div className="flex flex-col gap-3">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center text-[11px] font-semibold text-muted-foreground tracking-wide uppercase">
            <Link href="/admin/dashboard" className="hover:text-primary transition-colors">Admin</Link>
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                <ChevronRight className="w-3 h-3 mx-1 opacity-50" />
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-primary transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-foreground">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
        <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
          {Icon && (
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl shadow-sm">
              <Icon className="w-6 h-6" />
            </div>
          )}
          {title}
        </h1>
        {description && (
          <div className="text-muted-foreground mt-1 font-medium text-sm">
            {description}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {action}
      </div>
    </div>
  );
}
