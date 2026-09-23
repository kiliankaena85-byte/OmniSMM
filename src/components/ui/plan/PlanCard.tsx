'use client';

import React from "react";

export interface PlanCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: "flat" | "bordered" | "interactive";
  padding?: "none" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function PlanCard({
  children,
  variant = "bordered",
  padding = "lg",
  className = "",
  ...props
}: PlanCardProps) {
  const baseStyles = "bg-card text-foreground rounded-2xl transition-all duration-200";

  const variantStyles = {
    flat: "bg-muted/30 border border-transparent",
    bordered: "border border-border/80 shadow-sm hover:shadow-md",
    interactive:
      "border border-border/80 shadow-sm hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 cursor-pointer",
  };

  const paddingStyles = {
    none: "p-0",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
    xl: "p-10",
  };

  return (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function PlanCardHeader({
  title,
  description,
  badge,
  action,
  className = "",
}: {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start justify-between gap-4 mb-6 pb-4 border-b border-border/50 ${className}`}>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-xl font-bold tracking-tight text-foreground">{title}</h3>
          {badge}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
