import React from "react";
import Link from "next/link";
import { ChevronRight, Home, LayoutDashboard } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface DashboardBreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function DashboardBreadcrumbs({ items, className = "" }: DashboardBreadcrumbsProps) {
  return (
    <nav aria-label="Хлебные крошки" className={`flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap mb-3 ${className}`}>
      <Link
        href="/"
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary/60"
        title="Главный сайт"
        aria-label="Главный сайт"
      >
        <Home className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Сайт</span>
      </Link>
      <ChevronRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />
      
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary/60"
        title="Кабинет"
        aria-label="Кабинет"
      >
        <LayoutDashboard className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Кабинет</span>
      </Link>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={item.label + index}>
            <ChevronRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary/60 truncate max-w-[160px]"
              >
                {item.label}
              </Link>
            ) : (
              <span className="font-semibold text-foreground truncate max-w-[200px]" aria-current={isLast ? "page" : undefined}>
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
