'use client';

import React from "react";

export interface FluxCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "glass" | "solid" | "glow" | "interactive";
  padding?: "none" | "sm" | "md" | "lg" | "xl";
  children: React.ReactNode;
  className?: string;
}

export function FluxCard({
  variant = "glass",
  padding = "lg",
  children,
  className = "",
  ...props
}: FluxCardProps) {
  const paddingClasses = {
    none: "p-0",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
    xl: "p-10",
  }[padding];

  const variantClasses = {
    glass:
      "bg-card/90 backdrop-blur-2xl border border-border/80 shadow-[0_15px_45px_rgba(0,0,0,0.04)]",
    solid:
      "bg-card border border-border/80 shadow-md",
    glow:
      "bg-card/90 backdrop-blur-2xl border border-purple-500/20 shadow-[0_20px_60px_rgba(147,51,234,0.12)]",
    interactive:
      "bg-card/90 backdrop-blur-2xl border border-border/80 shadow-[0_10px_30px_rgba(0,0,0,0.04)] hover:border-purple-500/40 hover:shadow-[0_20px_50px_rgba(147,51,234,0.12)] hover:-translate-y-1 transition-all duration-300 cursor-pointer",
  }[variant];

  return (
    <div
      className={`rounded-[2.5rem] relative overflow-hidden transition-all duration-300 ${paddingClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
