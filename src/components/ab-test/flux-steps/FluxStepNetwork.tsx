'use client';

import React, { useState, useMemo } from "react";
import { motion, type Variants } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { FluxNetwork } from "@/types/flux";
import {
  isTop6Network,
  getTop6Rank,
  matchesTaxonomy,
  matchesNetworkSearch,
  type TaxonomyId,
} from "./flux-network-helpers";
import { FluxNetworkCardTier1 } from "./sub/FluxNetworkCardTier1";
import { FluxNetworkCapsuleTier2 } from "./sub/FluxNetworkCapsuleTier2";
import { FluxNetworkSearchBar } from "./sub/FluxNetworkSearchBar";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTaxonomy, setActiveTaxonomy] = useState<TaxonomyId>("all");

  const query = searchQuery.trim().toLowerCase();
  const isDefaultView = !query && activeTaxonomy === "all";

  const top6 = useMemo(() => {
    return networks
      .filter(isTop6Network)
      .sort((a, b) => getTop6Rank(a) - getTop6Rank(b));
  }, [networks]);

  const otherNetworks = useMemo(() => {
    return networks.filter((n) => !isTop6Network(n));
  }, [networks]);

  const filteredNetworks = useMemo(() => {
    return networks.filter((net) => {
      const matchesQuery = matchesNetworkSearch(net, query);
      const matchesTax = matchesTaxonomy(net, activeTaxonomy);
      return matchesQuery && matchesTax;
    });
  }, [networks, query, activeTaxonomy]);

  return (
    <div className="w-full transform-gpu">
      <FluxNetworkSearchBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        activeTaxonomy={activeTaxonomy}
        setActiveTaxonomy={setActiveTaxonomy}
      />

      {/* ── DEFAULT 2-TIER ZERO-SCROLL VIEW ── */}
      {isDefaultView ? (
        <div className="w-full space-y-4">
          {/* Tier 1: Top-6 CIS Quick Access */}
          {top6.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                <span>Быстрый выбор (ТОП СНГ)</span>
              </div>

              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 w-full"
              >
                {top6.map((network) => (
                  <FluxNetworkCardTier1
                    key={network.id}
                    network={network}
                    onSelect={onSelectNetwork}
                    variants={itemVariants}
                  />
                ))}
              </motion.div>
            </div>
          )}

          {/* Tier 2: Compact Capsules */}
          {otherNetworks.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                <span>Другие платформы ({otherNetworks.length})</span>
              </div>

              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 w-full"
              >
                {otherNetworks.map((network) => (
                  <FluxNetworkCapsuleTier2
                    key={network.id}
                    network={network}
                    onSelect={onSelectNetwork}
                    variants={itemVariants}
                  />
                ))}
              </motion.div>
            </div>
          )}
        </div>
      ) : (
        /* ── FILTERED VIEW (Search or Taxonomy active) ── */
        <div className="w-full">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Найдено ({filteredNetworks.length})</span>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setActiveTaxonomy("all");
              }}
              className="text-purple-600 dark:text-purple-400 hover:underline text-xs cursor-pointer"
            >
              Сбросить фильтры
            </button>
          </div>

          {filteredNetworks.length > 0 ? (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 w-full"
            >
              {filteredNetworks.map((network) => (
                <FluxNetworkCapsuleTier2
                  key={network.id}
                  network={network}
                  onSelect={onSelectNetwork}
                  variants={itemVariants}
                />
              ))}
            </motion.div>
          ) : (
            <div className="text-center py-8 rounded-2xl border border-dashed border-border bg-card/40">
              <p className="text-sm font-semibold text-muted-foreground">
                Платформа не найдена
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setActiveTaxonomy("all");
                }}
                className="mt-2 text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
              >
                Показать все соцсети
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
