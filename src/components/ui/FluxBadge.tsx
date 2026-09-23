'use client';

import React from "react";

export interface FluxBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "secondary" | "success" | "warning" | "destructive" | "neutral";
  size?: "sm" | "md";
  pulse?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function FluxBadge({
  variant = "primary",
  size = "md",
  pulse = false,
  icon,
  children,
  className = "",
  ...props
}: FluxBadgeProps) {
  const sizeClasses = {
    sm: "px-2.5 py-0.5 text-[10px]",
    md: "px-3.5 py-1 text-xs",
  }[size];

  const variantClasses = {
    primary:
      "bg-purple-500/10 border-purple-500/25 text-purple-700 dark:text-purple-300",
    secondary:
      "bg-pink-500/10 border-pink-500/25 text-pink-700 dark:text-pink-300",
    success:
      "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300",
    warning:
      "bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-300",
    destructive:
      "bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-300",
    neutral:
      "bg-muted/80 border-border text-muted-foreground",
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-black uppercase tracking-wider select-none shadow-xs transition-all ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
        </span>
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}
