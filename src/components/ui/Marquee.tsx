'use client';

import React from "react";

export interface MarqueeProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  pauseOnHover?: boolean;
  reverse?: boolean;
  className?: string;
}

export function Marquee({
  children,
  pauseOnHover = true,
  reverse = false,
  className = "",
  ...props
}: MarqueeProps) {
  return (
    <div
      className={`overflow-hidden flex gap-8 select-none [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)] ${
        pauseOnHover ? "group" : ""
      } ${className}`}
      {...props}
    >
      <div
        className={`flex shrink-0 gap-8 items-center ${
          reverse ? "animate-marquee-reverse" : "animate-marquee"
        } ${pauseOnHover ? "group-hover:[animation-play-state:paused]" : ""}`}
      >
        {children}
      </div>
      <div
        className={`flex shrink-0 gap-8 items-center ${
          reverse ? "animate-marquee-reverse" : "animate-marquee"
        } ${pauseOnHover ? "group-hover:[animation-play-state:paused]" : ""}`}
        aria-hidden="true"
      >
        {children}
      </div>
    </div>
  );
}
