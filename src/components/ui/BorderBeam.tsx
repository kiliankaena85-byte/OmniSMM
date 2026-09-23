'use client';

import React from "react";

export interface BorderBeamProps {
  duration?: number;
  borderWidth?: number;
  size?: number;
  colorFrom?: string;
  colorTo?: string;
  className?: string;
}

export function BorderBeam({
  duration = 6,
  borderWidth = 1.5,
  size = 300,
  colorFrom = "#9333ea",
  colorTo = "#ec4899",
  className = "",
}: BorderBeamProps) {
  return (
    <div
      style={
        {
          "--size": `${size}px`,
          "--duration": `${duration}s`,
          "--border-width": `${borderWidth}px`,
          "--color-from": colorFrom,
          "--color-to": colorTo,
        } as React.CSSProperties
      }
      className={`pointer-events-none absolute inset-0 rounded-[inherit] [border:calc(var(--border-width)*1px)_solid_transparent]
      ![mask-clip:padding-box,border-box] ![mask-composite:intersect]
      [mask:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]
      after:absolute after:aspect-square after:w-[calc(var(--size)*1px)] after:animate-border-beam after:[animation-duration:var(--duration)] after:[background:linear-gradient(to_left,var(--color-from),var(--color-to),transparent)] after:[offset-anchor:calc(var(--size)*0.5px)_50%] after:[offset-path:rect(0_auto_auto_0_round_calc(var(--size)*1px))] ${className}`}
    />
  );
}
