'use client';

import React from "react";
import { Link2, Pencil } from "lucide-react";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { DynamicPayloadWarnings } from "../DynamicPayloadWarnings";

export interface MobileCheckoutLinkFieldProps {
  engine: OrderEngine;
  linkConfig: {
    label?: string;
    badge?: string;
    placeholder?: string;
    hint?: string;
  };
  setActiveStep: (step: 1 | 2 | 3 | 4) => void;
}

export function MobileCheckoutLinkField({
  engine,
  linkConfig,
  setActiveStep,
}: MobileCheckoutLinkFieldProps) {
  const { url, setUrl, validationErrors } = engine;
  const isLinkReady = url.trim().length >= 5;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor="mobile-checkout-url-input" className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1 flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5 text-primary" />
          <span>{linkConfig.label || "Ссылка для выполнения заказа"}</span>
          <span className="text-destructive">*</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10">
            {linkConfig.badge}
          </span>
          {isLinkReady && (
            <button
              type="button"
              onClick={() => setActiveStep(1)}
              className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Pencil className="w-3 h-3 shrink-0" />
              <span>Изменить</span>
            </button>
          )}
        </div>
      </div>

      {isLinkReady ? (
        <div
          onClick={() => setActiveStep(1)}
          className="p-3 rounded-2xl bg-content2/80 border border-border/60 hover:border-primary/50 transition-all flex items-center justify-between gap-2.5 cursor-pointer group"
          title="Нажмите, чтобы изменить ссылку"
        >
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-bold text-foreground font-mono break-all leading-relaxed select-all">
              {url}
            </span>
            <span className="text-[10px] text-muted-foreground font-medium mt-0.5">
              {linkConfig.hint}
            </span>
          </div>
          <span className="text-[11px] font-bold text-primary px-2.5 py-1 rounded-lg bg-primary/10 group-hover:bg-primary/20 shrink-0 flex items-center gap-1 transition-colors">
            <Pencil className="w-3 h-3 shrink-0" />
            <span>Сменить</span>
          </span>
        </div>
      ) : (
        <div>
          <input
            id="mobile-checkout-url-input"
            type="text"
            inputMode="url"
            autoComplete="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            aria-describedby={validationErrors?.link ? "step4-url-error" : undefined}
            placeholder={linkConfig.placeholder}
            className={`w-full h-11 px-4 rounded-2xl border bg-background text-sm text-foreground outline-none transition-all ${
              validationErrors?.link
                ? 'border-destructive focus:border-destructive ring-2 ring-destructive/30'
                : 'border-border focus:border-primary focus:ring-2 ring-primary/30'
            }`}
          />
          {linkConfig.hint && !validationErrors?.link && (
            <p className="text-[11px] text-muted-foreground pl-1 mt-1 font-medium">
              {linkConfig.hint}
            </p>
          )}
          {validationErrors?.link && (
            <p id="step4-url-error" className="text-[11px] font-bold text-destructive pl-1 animate-in fade-in duration-200 mt-1">
              {validationErrors.link}
            </p>
          )}
        </div>
      )}

      <DynamicPayloadWarnings engine={engine} />
    </div>
  );
}
