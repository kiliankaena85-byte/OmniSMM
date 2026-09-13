'use client';
import React from 'react';
import { Search, Loader2 } from 'lucide-react';
import { SocialIcon } from '@/components/ui/SocialIcon';
import { PublicNetwork } from '@/actions/order/catalog';

interface WizardStepNetworkProps {
  searchNetwork: string;
  setSearchNetwork: (val: string) => void;
  isLoadingCatalog: boolean;
  filteredNetworks: PublicNetwork[];
  selectedNetwork: PublicNetwork | null;
  onSelectNetwork: (net: PublicNetwork) => void;
}

export function WizardStepNetwork({
  searchNetwork,
  setSearchNetwork,
  isLoadingCatalog,
  filteredNetworks,
  selectedNetwork,
  onSelectNetwork,
}: WizardStepNetworkProps) {
  return (
    <div className="bg-card/70 backdrop-blur-xl p-6 rounded-3xl border border-border/60 shadow-sm space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Шаг 1: Выберите социальную сеть</h2>
          <p className="text-muted-foreground text-sm mt-0.5">Выберите платформу для продвижения вашего аккаунта</p>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <input
            type="text"
            value={searchNetwork}
            onChange={e => setSearchNetwork(e.target.value)}
            placeholder="Поиск платформы..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-background/80 border border-border/60 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </div>
      </div>

      {isLoadingCatalog ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm font-medium">Загружаем список социальных сетей...</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filteredNetworks.map(net => {
            const isSelected = selectedNetwork?.id === net.id;
            return (
              <button
                key={net.id}
                type="button"
                onClick={() => onSelectNetwork(net)}
                className={`group p-4 rounded-2xl border text-left transition-all duration-200 flex flex-col items-center text-center gap-3 relative overflow-hidden ${
                  isSelected
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/30 shadow-md scale-[1.02]'
                    : 'border-border/60 bg-background/60 hover:bg-card hover:border-primary/40 hover:shadow-md'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-muted/50 p-2.5 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <SocialIcon slug={net.slug || net.name} className="w-full h-full object-contain" />
                </div>

                <div>
                  <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                    {net.name}
                  </h3>
                  <span className="text-xs text-muted-foreground mt-0.5 block">
                    {net.categories.length} категорий
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
