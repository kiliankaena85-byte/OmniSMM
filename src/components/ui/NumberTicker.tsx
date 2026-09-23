'use client';

import { useEffect, useRef } from "react";
import { useMotionValue, useSpring } from "framer-motion";

export interface NumberTickerProps {
  value: number;
  direction?: "up" | "down";
  delay?: number;
  decimalPlaces?: number;
  className?: string;
}

export function NumberTicker({
  value,
  direction = "up",
  delay = 0,
  decimalPlaces = 2,
  className = "",
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(direction === "down" ? value : 0);
  const springValue = useSpring(motionValue, {
    damping: 30,
    stiffness: 200,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      motionValue.set(direction === "down" ? 0 : value);
    }, delay * 1000);

    return () => clearTimeout(timer);
  }, [motionValue, value, delay, direction]);

  useEffect(() => {
    return springValue.on("change", (latest: number) => {
      if (ref.current) {
        ref.current.textContent = Number(latest).toFixed(decimalPlaces);
      }
    });
  }, [springValue, decimalPlaces]);

  return (
    <span
      ref={ref}
      className={`inline-block tabular-nums tracking-normal font-black text-foreground select-none ${className}`}
    >
      {Number(direction === "down" ? value : 0).toFixed(decimalPlaces)}
    </span>
  );
}
