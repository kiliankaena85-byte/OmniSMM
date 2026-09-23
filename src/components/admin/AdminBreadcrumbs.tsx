'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface AdminBreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function AdminBreadcrumbs({ items, className = '' }: AdminBreadcrumbsProps) {
  return (
    <nav 
      aria-label="Хлебные крошки" 
      className={`flex items-center gap-1.5 text-xs text-muted-foreground mb-4 select-none ${className}`}
    >
      <Link 
        href="/admin/dashboard" 
        className="flex items-center gap-1 hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted/40"
        title="Дашборд"
      >
        <Home className="w-3.5 h-3.5" />
      </Link>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={index}>
            <ChevronRight className="w-3.5 h-3.5 text-border shrink-0" />
            {isLast || !item.href ? (
              <span className="font-semibold text-foreground truncate max-w-[240px]">
                {item.label}
              </span>
            ) : (
              <Link 
                href={item.href} 
                className="hover:text-foreground transition-colors truncate max-w-[200px]"
              >
                {item.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
