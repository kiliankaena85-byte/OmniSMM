import * as React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface TabItem {
  label: string;
  href: string;
}

interface OnboardingFaq {
  q: string;
  a: string;
}

interface OnboardingData {
  description: string;
  faqs: OnboardingFaq[];
  docLink?: string;
}

interface AdminTabbedHeaderProps {
    icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  tabs?: TabItem[];
  onboardingKey?: string;
  onboarding?: OnboardingData;
  showTenantSelector?: boolean;
  currentTenant?: string;
}

import { AdminTabs } from './tabbed-header-client';

export function AdminTabbedHeader({
  icon: Icon,
  title,
  description,
  action,
  breadcrumbs,
  tabs,
}: AdminTabbedHeaderProps) {
  return (
    <div className="w-full flex flex-col gap-3 mb-5 border-b border-border/50 pb-4">
      {/* Breadcrumbs & Header Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className="flex items-center text-[10px] font-bold text-muted-foreground tracking-widest uppercase">
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

          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
            {Icon && (
              <div className="p-2 bg-primary/10 text-primary rounded-xl shadow-sm shrink-0">
                <Icon className="w-5 h-5" />
              </div>
            )}
            <span>{title}</span>
          </h1>
          {description && (
            <div className="text-muted-foreground font-medium text-xs">
              {description}
            </div>
          )}
        </div>

        {/* Action Slot */}
        <div className="flex items-center gap-2 shrink-0 self-start md:self-center flex-wrap">
          {action}
        </div>
      </div>

      {/* Sub tabs navigation */}
      {tabs && tabs.length > 0 && (
        <AdminTabs tabs={tabs} />
      )}
    </div>
  );
}

