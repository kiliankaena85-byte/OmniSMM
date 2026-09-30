'use client';

import React from "react";
import { motion, type Variants } from "framer-motion";
import type { FluxNetwork } from "@/types/flux";
import {
  resolveNetworkIcon,
  isMonochromeIcon,
  getTop6Rank,
  TOP_BADGES,
} from "../flux-network-helpers";

export interface FluxNetworkCardTier1Props {
  network: FluxNetwork;
  onSelect: (net: FluxNetwork) => void;
  variants: Variants;
}

export function FluxNetworkCardTier1({
  network,
  onSelect,
  variants,
}: FluxNetworkCardTier1Props) {
  const rank = getTop6Rank(network);
  const badge = TOP_BADGES[rank] || {
    label: "ТОП",
    badgeClass: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  };
  const isMono = isMonochromeIcon(network);

  return (
    <motion.button
      variants={variants}
      type="button"
      onClick={() => onSelect(network)}
      aria-label={network.name}
      className="h-14 w-full flex items-center justify-between px-3 sm:px-4 rounded-2xl border border-neutral-200/90 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 shadow-xs hover:shadow-md hover:border-purple-500/60 dark:hover:border-purple-400/60 transition-all duration-150 cursor-pointer group active:scale-[0.98]"
    >
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-zinc-800 border border-neutral-200/80 dark:border-zinc-700/80 flex items-center justify-center p-1.5 shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
          <img
            src={resolveNetworkIcon(network)}
            alt={network.name}
            onError={(e) => {
              e.currentTarget.src = "/brands/generic.svg";
            }}
            className={`w-5 h-5 sm:w-6 sm:h-6 object-contain pointer-events-none ${
              isMono ? "dark:invert" : ""
            }`}
            loading="lazy"
            decoding="async"
          />
        </div>
        <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate">
          {network.name}
        </span>
      </div>
      <span
        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shrink-0 ${badge.badgeClass}`}
      >
        {badge.label}
      </span>
    </motion.button>
  );
}
