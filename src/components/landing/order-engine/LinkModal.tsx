'use client';

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { X, Link2, ChevronRight, AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getSocialLinkConfig,
  normalizeUserLink,
  detectMismatchedNetwork,
} from "@/utils/social-link-placeholder";

export function LinkModal({
  showLinkModal,
  setShowLinkModal,
  url,
  setUrl,
  handleCheckout,
  networkSlug,
  categorySlug,
  serviceName,
  serviceTargetType,
  servicePlaceholder,
  serviceHint,
  onSwitchToDetectedNetwork,
}: {
  showLinkModal: boolean;
  setShowLinkModal: (show: boolean) => void;
  url: string;
  setUrl: (url: string) => void;
  handleCheckout: () => void;
  networkSlug?: string | null;
  categorySlug?: string | null;
  serviceName?: string | null;
  serviceTargetType?: string | null;
  servicePlaceholder?: string | null;
  serviceHint?: string | null;
  onSwitchToDetectedNetwork?: (networkKey: string) => void;
}) {
  const linkConfig = useMemo(
    () => getSocialLinkConfig(networkSlug, categorySlug, serviceName, serviceTargetType, servicePlaceholder, serviceHint),
    [networkSlug, categorySlug, serviceName, serviceTargetType, servicePlaceholder, serviceHint]
  );

  const mismatch = useMemo(
    () => detectMismatchedNetwork(url, networkSlug),
    [url, networkSlug]
  );

  if (!showLinkModal) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
      onClick={() => setShowLinkModal(false)}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-card rounded-3xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.2)] p-6 sm:p-8 w-full max-w-lg border border-border/60"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black text-foreground">Укажите ссылку</h3>
              {linkConfig.badge && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {linkConfig.badge}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Куда отправить заказ?</p>
          </div>
          <button
            onClick={() => setShowLinkModal(false)}
            className="w-8 h-8 rounded-full bg-default-100 hover:bg-default-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="relative mb-3">
          <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder={linkConfig.placeholder}
            autoFocus
            className={`w-full h-14 pl-12 pr-6 rounded-2xl border-2 bg-background text-[14px] sm:text-[15px] font-semibold text-foreground placeholder:text-muted-foreground/60 outline-none transition-all ${
              mismatch.isMismatch
                ? 'border-amber-500/80 focus:border-amber-500 focus:shadow-[0_8px_20px_-6px_rgba(245,158,11,0.25)]'
                : 'border-border focus:border-primary/50 focus:shadow-[0_8px_20px_-6px] focus:shadow-primary/15'
            }`}
            onBlur={(e) => {
              const normalized = normalizeUserLink(e.target.value);
              setUrl(normalized);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && url.trim().length > 0) {
                const finalUrl = normalizeUserLink(url);
                setUrl(finalUrl);
                setShowLinkModal(false);
                handleCheckout();
              }
            }}
          />
        </div>

        {/* Dynamic Contextual Hint or Mismatch Warning with Immediate Switch Action */}
        <div className="mb-6">
          {mismatch.isMismatch ? (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 space-y-2.5">
              <div className="flex items-start gap-2 text-xs font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Вы указали ссылку на <strong>{mismatch.detectedNetworkName}</strong>, хотя выбрана услуга для <strong>{mismatch.expectedNetworkName}</strong>.
                </span>
              </div>
              {onSwitchToDetectedNetwork && mismatch.detectedNetworkKey && (
                <button
                  type="button"
                  onClick={() => {
                    setShowLinkModal(false);
                    onSwitchToDetectedNetwork(mismatch.detectedNetworkKey!);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  Перейти к тарифам {mismatch.detectedNetworkName} →
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium px-1">
              <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>{linkConfig.hint}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button
            onClick={() => {
              if (url.trim().length > 0) {
                const finalUrl = normalizeUserLink(url);
                setUrl(finalUrl);
                setShowLinkModal(false);
                handleCheckout();
              }
            }}
            disabled={url.trim().length === 0}
            className="h-13 px-7 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm sm:text-base shadow-lg transition-all flex items-center gap-2"
          >
            Продолжить <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
