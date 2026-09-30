'use client';

import React from "react";
import { motion, type Variants } from "framer-motion";
import type { FluxNetwork } from "@/types/flux";
import { resolveNetworkIcon, isMonochromeIcon } from "../flux-network-helpers";

export interface FluxNetworkCapsuleTier2Props {
  network: FluxNetwork;
  onSelect: (net: FluxNetwork) => void;
  variants: Variants;
}

export function FluxNetworkCapsuleTier2({
  network,
  onSelect,
  variants,
}: FluxNetworkCapsuleTier2Props) {
  const isMono = isMonochromeIcon(network);

  return (
    <motion.button
      variants={variants}
      type="button"
      onClick={() => onSelect(network)}
      aria-label={network.name}
      className="h-11 px-3 rounded-xl border border-neutral-200/80 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 hover:bg-neutral-100 dark:hover:bg-zinc-800 hover:border-purple-500/40 shadow-2xs hover:shadow-xs transition-all duration-150 flex items-center gap-2.5 cursor-pointer group active:scale-[0.98]"
    >
      <div className="w-7 h-7 rounded-lg bg-neutral-100 dark:bg-zinc-800 border border-neutral-200/80 dark:border-zinc-700/80 flex items-center justify-center p-1 shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
        <img
          src={resolveNetworkIcon(network)}
          alt={network.name}
          onError={(e) => {
            e.currentTarget.src = "/brands/generic.svg";
          }}
          className={`w-4 h-4 object-contain pointer-events-none ${
            isMono ? "dark:invert" : ""
          }`}
          loading="lazy"
          decoding="async"
        />
      </div>
      <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
        {network.name}
      </span>
    </motion.button>
  );
}
