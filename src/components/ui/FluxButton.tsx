'use client';

import React from "react";
import { Loader2 } from "lucide-react";

interface FluxButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function FluxButton({
  variant = "primary",
  size = "md",
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  className = "",
  disabled,
  ...props
}: FluxButtonProps) {
  const sizeClasses = {
    sm: "h-10 px-4 text-xs",
    md: "h-12 px-6 text-sm",
    lg: "h-14 px-8 text-base",
  }[size];

  const variantClasses = {
    primary:
      "bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-primary-foreground font-black shadow-[0_4px_18px_rgba(168,85,247,0.35)] hover:shadow-[0_6px_24px_rgba(236,72,153,0.45)] hover:-translate-y-0.5 active:scale-[0.98] border-transparent",
    secondary:
      "bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold border border-purple-500/25 hover:border-purple-500/40 shadow-sm",
    outline:
      "bg-card text-foreground border border-border/80 hover:border-purple-400 hover:text-purple-600 font-bold shadow-sm hover:bg-muted/40",
    ghost:
      "bg-transparent text-muted-foreground hover:text-foreground font-semibold hover:bg-muted/50",
  }[variant];

  return (
    <button
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center gap-2 rounded-full min-h-[40px] sm:min-h-[44px] transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-current" />
          <span>{children}</span>
        </>
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
