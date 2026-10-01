'use client';

import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  getSocialLinkConfig,
  normalizeUserLink,
} from '@/utils/social-link-placeholder';
import { UNIFIED_REGEX } from '@/services/link-engine/link-rules-registry';

export function validateOrderLink(targetUrl: string, platformId: string): { isValid: boolean; error: string } {
  if (!targetUrl) return { isValid: true, error: '' };
  if (targetUrl.length > 512) return { isValid: false, error: 'Ссылка слишком длинная' };

  const platformKey = platformId.toUpperCase();
  const platformRegexes = UNIFIED_REGEX[platformKey as keyof typeof UNIFIED_REGEX];
  if (platformRegexes) {
    const anyMatch = Object.values(platformRegexes).some((r: RegExp) => r.test(targetUrl));
    return anyMatch
      ? { isValid: true, error: '' }
      : { isValid: false, error: 'Некорректный формат ссылки для выбранной платформы' };
  }

  const isGeneric = /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(targetUrl);
  return isGeneric
    ? { isValid: true, error: '' }
    : { isValid: false, error: 'Некорректный формат (ожидается http:// или https://)' };
}

interface WizardLinkFieldProps {
  targetUrl: string;
  setTargetUrl: (url: string) => void;
  platformId: string;
  categoryId?: string;
  serviceTitle: string;
  isLinkValid: boolean;
  linkError: string;
  mismatch: {
    isMismatch: boolean;
    detectedNetworkName?: string;
    expectedNetworkName?: string;
  };
}

export function WizardLinkField({
  targetUrl,
  setTargetUrl,
  platformId,
  categoryId,
  serviceTitle,
  isLinkValid,
  linkError,
  mismatch,
}: WizardLinkFieldProps) {
  const cfg = getSocialLinkConfig(platformId, categoryId, serviceTitle);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          Ссылка для заказа:
          {cfg.badge && (
            <span className="text-[10px] lowercase font-bold px-2 py-0.2 rounded-full bg-primary/10 text-primary border border-primary/20">
              {cfg.badge}
            </span>
          )}
        </label>
      </div>
      <div className="space-y-2">
        <input
          type="text"
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          onBlur={(e) => setTargetUrl(normalizeUserLink(e.target.value))}
          placeholder={cfg.placeholder}
          className={`w-full px-4 py-3 rounded-2xl bg-muted/50 border text-foreground font-medium text-sm focus:outline-none transition-all ${
            (!isLinkValid || mismatch.isMismatch)
              ? 'border-red-500/80 focus:ring-2 focus:ring-red-500/30 text-red-600 dark:text-red-400'
              : targetUrl.length > 5
              ? 'border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20'
              : 'border-border focus:ring-2 focus:ring-primary/40'
          }`}
        />
        {mismatch.isMismatch ? (
          <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium px-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>
              Внимание: ссылка на <strong>{mismatch.detectedNetworkName}</strong>, хотя выбран сервис <strong>{mismatch.expectedNetworkName}</strong>.
            </span>
          </div>
        ) : !isLinkValid && targetUrl.length > 5 ? (
          <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium px-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{linkError}</span>
          </div>
        ) : targetUrl.length > 5 && isLinkValid ? (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-500 font-medium px-1">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Ссылка корректна</span>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground font-medium px-1">
            💡 {cfg.hint}
          </div>
        )}
      </div>
    </div>
  );
}
