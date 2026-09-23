'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@heroui/react';
import { LinkIcon, SparklesIcon, Box } from 'lucide-react';
import type { FluxNetwork } from '@/types/flux';
import { slideVariants, containerVariants, itemVariants } from './types';

interface FluxDashboardStepNetworkProps {
  direction: number;
  link: string;
  setLink: (link: string) => void;
  linkRef: React.RefObject<HTMLInputElement | null>;
  isAnalyzing: boolean;
  handleAnalyzeLink: (url: string) => void;
  isLoadingCatalog: boolean;
  catalog: FluxNetwork[];
  onSelectNetwork: (network: FluxNetwork) => void;
}

export function FluxDashboardStepNetwork({
  direction,
  link,
  setLink,
  linkRef,
  isAnalyzing,
  handleAnalyzeLink,
  isLoadingCatalog,
  catalog,
  onSelectNetwork
}: FluxDashboardStepNetworkProps) {
  return (
    <motion.div
      key="step-network"
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className="w-full space-y-6"
    >
      {/* Quick Link Input */}
      <div className="bg-card/85 backdrop-blur-md border border-border/40 rounded-[2rem] p-5 sm:p-6 shadow-sm">
        <h3 className="text-sm font-black text-foreground mb-3 flex items-center gap-2">
          <SparklesIcon className="w-4 h-4 text-primary shrink-0" /> Вставьте ссылку для быстрого определения:
        </h3>
        <div className="relative flex items-center">
          <LinkIcon className="text-muted-foreground w-5 h-5 absolute left-4 pointer-events-none" />
          <input
            ref={linkRef}
            type="url"
            className="w-full h-13 pl-12 pr-32 bg-background border border-border/60 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground transition-all"
            placeholder="https://t.me/your_channel или https://vk.com/..."
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && link) handleAnalyzeLink(link);
            }}
          />
          <Button
            isPending={isAnalyzing}
            onPress={() => handleAnalyzeLink(link)}
            className="absolute right-2 rounded-xl bg-foreground text-background font-bold text-xs h-9 px-4 min-w-0 cursor-pointer"
          >
            Далее
          </Button>
        </div>
      </div>

      {/* Network Grid */}
      <div className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">Выберите соцсеть</h2>
        {isLoadingCatalog ? (
          <div className="py-16 flex justify-center">
            <Box className="w-10 h-10 text-primary/50 animate-pulse" />
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 w-full"
          >
            {catalog.map((net) => (
              <motion.button
                key={net.id}
                variants={itemVariants}
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                onClick={() => onSelectNetwork(net)}
                className="flex flex-col items-center justify-center gap-2.5 p-4 sm:p-5 rounded-[1.5rem] border border-border/40 bg-card/85 backdrop-blur-md hover:bg-card hover:border-primary/50 hover:shadow-lg transition-colors duration-150 outline-none cursor-pointer group"
              >
                <img
                  src={net.icon || undefined}
                  alt={net.name}
                  className="w-9 h-9 sm:w-10 sm:h-10 object-contain pointer-events-none group-hover:scale-105 transition-transform"
                  loading="lazy"
                  decoding="async"
                />
                <span className="font-bold text-foreground text-xs sm:text-sm">{net.name}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
