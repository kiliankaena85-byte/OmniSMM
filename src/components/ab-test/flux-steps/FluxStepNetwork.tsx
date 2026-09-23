'use client';

import React from "react";
import { motion, type Variants } from "framer-motion";
import type { FluxNetwork } from "@/types/flux";

export interface FluxStepNetworkProps {
  networks: FluxNetwork[];
  onSelectNetwork: (net: FluxNetwork) => void;
  containerVariants: Variants;
  itemVariants: Variants;
}

export function FluxStepNetwork({
  networks,
  onSelectNetwork,
  containerVariants,
  itemVariants,
}: FluxStepNetworkProps) {
  return (
    <div className="w-full transform-gpu">
      <div className="mb-6 w-full">
        <h2 className="text-2xl font-bold text-foreground mb-6 tracking-tight">Выберите соцсеть</h2>
        
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 w-full"
        >
          {networks.map((network: FluxNetwork) => (
            <motion.button
              variants={itemVariants}
              key={network.id}
              onClick={() => onSelectNetwork(network)}
              className="flex flex-col items-center justify-center gap-2 sm:gap-3 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-white/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-md hover:shadow-xl hover:border-primary/50 transition-all duration-150 outline-none cursor-pointer transform-gpu hover:scale-[1.02] active:scale-[0.98]"
            >
              <img 
                src={network.icon || undefined} 
                alt={network.name} 
                className="w-8 h-8 sm:w-10 sm:h-10 object-contain pointer-events-none" 
                loading="lazy"
                decoding="async"
              />
              <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm">{network.name}</span>
            </motion.button>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
