'use client';
import { PublicService } from '@/actions/order/catalog';

import React from "react";
import { Link2, Edit3, ShieldAlert } from "lucide-react";
import { SocialIcon } from "@/components/ui/SocialIcon";
import { OrderEngine } from "@/hooks/useOrderEngine";

interface DrawerOrderSummaryProps {
    selectedService: PublicService | null;
  url: string;
  setShowLinkModal: (show: boolean) => void;
  engine?: OrderEngine;
}

export function DrawerOrderSummary({
  selectedService,
  url,
  setShowLinkModal,
  engine
}: DrawerOrderSummaryProps) {
  const [isDescExpanded, setIsDescExpanded] = React.useState(false);
  if (!selectedService) return null;

  const selectedNetworkObj = React.useMemo(() => {
    if (!engine) return null;
    return engine.catalog.find(n => n.id === engine.networkId);
  }, [engine]);

  const networkSlug = selectedNetworkObj?.slug || "other";
  const networkName = selectedNetworkObj?.name || "Платформа";

  return (
    <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-4.5 space-y-3 shadow-sm">
      {/* Platform & Service Header */}
      <div className="flex items-start gap-3">
        <div className="p-2 bg-background rounded-xl border border-border/80 shadow-xs shrink-0 flex items-center justify-center">
          <SocialIcon slug={networkSlug} size={28} colored />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-[11px] font-black text-primary uppercase tracking-wider">
              {networkName}
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-background border border-border/80 text-foreground/80">
              #{selectedService.numericId}
            </span>
            {selectedService.speed && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Запуск: {selectedService.speed}
              </span>
            )}
          </div>
          <h4 className="text-sm sm:text-base font-black text-foreground leading-snug break-words">
            {selectedService.name}
          </h4>

          {selectedService.description && (
            <div className="mt-1.5">
              <button
                type="button"
                onClick={() => setIsDescExpanded(!isDescExpanded)}
                className="text-[11px] font-bold text-primary hover:text-primary/80 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>{isDescExpanded ? "Скрыть описание" : "Подробнее о тарифе"}</span>
              </button>
              
              {isDescExpanded && (
                <div className="mt-2 text-xs font-medium text-foreground/90 bg-background border border-border/80 rounded-xl p-3 whitespace-pre-wrap leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200 max-h-36 overflow-y-auto">
                  {selectedService.description}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Target Link Info / Input */}
      {!url ? (
        <div className="bg-background border-2 border-primary/50 focus-within:border-primary rounded-xl p-3 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-primary" />
              <span>Укажите ссылку для заказа</span>
              <span className="text-destructive font-bold">*</span>
            </label>
            <button
              type="button"
              onClick={() => setShowLinkModal(true)}
              className="text-[11px] text-primary hover:underline font-bold cursor-pointer"
            >
              Где взять?
            </button>
          </div>
          <input
            type="text"
            value={engine?.url || ""}
            onChange={(e) => engine?.setUrl(e.target.value)}
            placeholder={
              networkSlug === "telegram"
                ? "https://t.me/channel или @channel"
                : networkSlug === "vk"
                ? "https://vk.com/..."
                : "Вставьте ссылку на канал, группу или публикацию"
            }
            className="w-full h-10 px-3 rounded-lg bg-card border border-border/80 focus:border-primary outline-none text-base sm:text-xs font-mono text-foreground font-bold"
          />
        </div>
      ) : (
        <div className="bg-background border border-border/80 rounded-xl p-2.5 sm:p-3 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <Link2 className="w-4 h-4 text-primary shrink-0" />
            <p 
              className="text-xs sm:text-sm font-bold text-foreground truncate font-mono min-w-0"
              title={url}
            >
              {url}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowLinkModal(true)}
            className="p-1.5 hover:bg-content2 text-primary hover:text-primary/80 rounded-lg transition-all shrink-0 cursor-pointer active:scale-95 flex items-center gap-1 text-xs font-bold"
            title="Изменить ссылку"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Изменить</span>
          </button>
        </div>
      )}

      {/* Warranty indicator (if no guarantee) */}
      {selectedService.name.toLowerCase().includes("без гарант") && (
        <div className="flex items-center gap-2 p-2.5 bg-destructive/10 border border-destructive/20 text-destructive text-[11px] font-bold rounded-xl">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          <span>Тариф без гарантийного восстановления в случае списаний.</span>
        </div>
      )}
    </div>
  );
}
