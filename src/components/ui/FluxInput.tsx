'use client';

import React, { forwardRef } from "react";
import { AlertCircle } from "lucide-react";

export interface FluxInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerClassName?: string;
}

export const FluxInput = forwardRef<HTMLInputElement, FluxInputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      className = "",
      containerClassName = "",
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className={`w-full space-y-1.5 ${containerClassName}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-black uppercase tracking-wider text-muted-foreground pl-1"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-4 text-muted-foreground pointer-events-none flex items-center justify-center">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            className={`w-full h-12 bg-card/90 backdrop-blur-md border text-foreground placeholder:text-muted-foreground/60 rounded-full px-5 text-sm font-medium transition-all duration-200 outline-none focus:ring-2 focus:ring-purple-500/30 ${
              error
                ? "border-destructive focus:border-destructive shadow-[0_0_12px_rgba(244,63,94,0.25)] animate-shake"
                : "border-border/80 focus:border-purple-500/60 shadow-sm"
            } ${leftIcon ? "pl-11" : ""} ${rightIcon ? "pr-11" : ""} ${className}`}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-4 text-muted-foreground flex items-center justify-center">
              {rightIcon}
            </div>
          )}
        </div>

        {error ? (
          <div className="flex items-center gap-1.5 text-destructive text-xs font-semibold pl-2 pt-0.5 animate-shake">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : hint ? (
          <p className="text-[11px] text-muted-foreground pl-2">{hint}</p>
        ) : null}
      </div>
    );
  }
);

FluxInput.displayName = "FluxInput";
