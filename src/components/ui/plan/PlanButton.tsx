'use client';

import React from "react";
import { Loader2 } from "lucide-react";

export interface PlanButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function PlanButton({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  leftIcon,
  rightIcon,
  className = "",
  disabled,
  ...props
}: PlanButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center font-bold tracking-tight rounded-xl min-h-[36px] sm:min-h-[44px] transition-all duration-150 active:scale-[0.98] select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30";

  const sizeStyles = {
    sm: "h-9 px-3.5 text-xs gap-1.5",
    md: "h-11 px-5 text-sm gap-2",
    lg: "h-12 px-6 text-base gap-2.5",
  };

  const variantStyles = {
    primary:
      "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm border border-primary/20",
    secondary:
      "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-secondary/30",
    outline:
      "bg-card text-foreground border border-border hover:bg-muted/50 hover:border-foreground/20 shadow-sm",
    ghost:
      "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
    danger:
      "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
  };

  return (
    <button
      className={`min-h-[36px] sm:min-h-[44px] ${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${
        loading || disabled ? "opacity-70 pointer-events-none" : ""
      } ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        <>
          {leftIcon && <span className="shrink-0">{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
}
