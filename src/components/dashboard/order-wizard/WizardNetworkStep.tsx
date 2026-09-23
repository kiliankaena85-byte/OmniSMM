'use client';

import React from 'react';
import { PublicNetwork } from '@/actions/order/catalog';
import { SocialIcon } from '@/components/ui/SocialIcon';
import { Link2, Sparkles } from 'lucide-react';
import { IntelligencePlatform } from '@/services/analyzer/link-rules';

interface WizardNetworkStepProps {
  catalog: PublicNetwork[];
  selectedNetwork: PublicNetwork | null;
  onSelectNetwork: (net: PublicNetwork) => void;
  link: string;
  onLinkChange: (val: string) => void;
  detectedPlatform: IntelligencePlatform;
  linkRef: React.RefObject<HTMLInputElement | null>;
  error?: string;
  validationTimestamp?: number;
}

export function WizardNetworkStep({
  catalog,
  selectedNetwork,
  onSelectNetwork,
  link,
  onLinkChange,
  detectedPlatform,
  linkRef,
  error,
  validationTimestamp,
}: WizardNetworkStepProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Target Link Quick Input */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-foreground flex items-center justify-between">
          <span>Ссылка на канал / видео / пост</span>
          {detectedPlatform !== IntelligencePlatform.OTHER && (
            <span className="text-[10px] text-primary font-mono flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-full">
              <Sparkles className="w-3 h-3 shrink-0" /> Автоопределение: {detectedPlatform}
            </span>
          )}
        </label>
        <div className="relative">
          <input
            ref={linkRef}
            type="url"
            value={link}
            onChange={(e) => onLinkChange(e.target.value)}
            placeholder="https://t.me/your_channel или https://vk.com/wall..."
            className={`w-full h-12 pl-10 pr-4 bg-background border ${
              error ? 'border-destructive animate-shake' : 'border-border/60 hover:border-primary/40'
            } rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all`}
            key={error ? `link-${validationTimestamp}` : 'link-normal'}
          />
          <Link2 className="w-4 h-4 text-muted-foreground absolute left-3.5 top-4" />
        </div>
        {error && <p className="text-xs text-destructive font-semibold mt-1">{error}</p>}
      </div>

      {/* Grid of Available Social Networks */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-muted-foreground">Или выберите соцсеть вручную:</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {catalog.map((net) => {
            const isSelected = selectedNetwork?.id === net.id;
            return (
              <button
                key={net.id}
                type="button"
                onClick={() => onSelectNetwork(net)}
                className={`p-4 rounded-2xl border text-left flex flex-col items-center justify-center gap-2.5 transition-all duration-200 ${
                  isSelected
                    ? 'bg-primary/10 border-primary text-primary shadow-md scale-[1.02]'
                    : 'bg-card/75 border-border/30 hover:border-primary/30 hover:bg-card text-foreground'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center border border-border/40 shadow-xs">
                  <SocialIcon slug={net.slug} size={22} />
                </div>
                <span className="font-extrabold text-xs truncate max-w-full min-w-0">{net.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
