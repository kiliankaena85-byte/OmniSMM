'use client';

import React from "react";
import { motion, type Variants } from "framer-motion";
import type { PublicNetwork } from "@/actions/order/catalog";

export interface StepNetworkGridProps {
  networks: PublicNetwork[];
  onSelectNetwork: (network: PublicNetwork) => void;
  containerVariants: Variants;
  itemVariants: Variants;
}

export function StepNetworkGrid({
  networks,
  onSelectNetwork,
  containerVariants,
  itemVariants,
}: StepNetworkGridProps) {
  return (
    <div className="w-full max-w-3xl">
      <div className="text-center mb-6">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
          Выберите соцсеть
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Выберите платформу, для которой требуется продвижение
        </p>
      </div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3.5"
      >
        {networks.map((net) => (
          <motion.button
            variants={itemVariants}
            key={net.id}
            type="button"
            onClick={() => onSelectNetwork(net)}
            className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-2xl bg-card border border-border/80 hover:border-primary/60 hover:bg-primary/5 shadow-sm hover:shadow-md transition-all duration-150 cursor-pointer group"
          >
            {net.icon ? (
              <img 
                src={net.icon} 
                alt="" 
                className="w-10 h-10 object-contain group-hover:scale-110 transition-transform" 
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                {net.name[0]}
              </div>
            )}
            <span className="font-bold text-foreground text-xs sm:text-sm text-center">
              {net.name}
            </span>
            {net.categories && net.categories.length > 0 && (
              <span className="text-[10px] font-medium text-muted-foreground">
                {net.categories.length} категорий
              </span>
            )}
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}
