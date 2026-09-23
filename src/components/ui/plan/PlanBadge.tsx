'use client';

import React from "react";

export interface PlanBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
  variant?: "primary" | "secondary" | "success" | "warning" | "destructive" | "neutral" | "method";
  method?: "GET" | "POST" | "PUT" | "DELETE";
  size?: "sm" | "md";
  className?: string;
}

export function PlanBadge({
  children,
  variant = "neutral",
  method,
  size = "md",
  className = "",
  ...props
}: PlanBadgeProps) {
  const baseStyles =
    "inline-flex items-center font-bold tracking-wider uppercase select-none rounded-md transition-colors border";

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
  };

  const variantStyles = {
    primary: "bg-primary/10 text-primary border-primary/20",
    secondary: "bg-secondary text-secondary-foreground border-secondary/40",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    destructive: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    neutral: "bg-muted text-muted-foreground border-border",
    method: method === "POST" 
      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 font-mono font-black"
      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-mono font-black",
  };

  return (
    <span
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {method || children}
    </span>
  );
}
