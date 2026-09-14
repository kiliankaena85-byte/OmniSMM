'use client';

import React from "react";
import { PublicService } from "@/actions/order/catalog";
import { CheckCircle2, Clock, Zap, ShieldCheck } from "lucide-react";
import { BrandStyle } from "@/utils/brand-styles";

interface TariffCardProps {
  service: PublicService;
  isSelected: boolean;
  onSelect: (srv: PublicService) => void;
  compact?: boolean;
  brandStyle?: BrandStyle;
}

function getBadgeStyle(badge: string) {
  switch (badge) {
    case "ПРЕМИУМ":
      return "bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-amber-700 dark:text-amber-300 border-amber-200/50 dark:border-amber-500/30";
    case "ЭКОНОМ":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-500/30";
    case "ЖИВЫЕ":
      return "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200/50 dark:border-sky-500/30";
    case "ХИТ":
      return "bg-primary/10 text-primary border-primary/20";
    case "ГАРАНТИЯ":
      return "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-200/50 dark:border-violet-500/30";
    default:
      return "bg-muted text-muted-foreground border-border/50";
  }
}

function cleanServiceName(name: string): string {
  if (!name) return "";
  return name
    .replace(/\s*\[(?:Сервер|Server|Srv|API|Провайдер)[\s:]*\d+\]/gi, '')
    .replace(/\s*\((?:vexboost|vexboost live|api\s*\d+|srv\s*\d+|сервер\s*\d+)\)/gi, '')
    .replace(/\s*(?:\[|\()(?:ID:\s*\d+|S\d+)(?:\]|\))/gi, '')
    .replace(/\bvexboost\b/gi, '')
    .replace(/\s*♻️/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function TariffCard({ service, isSelected, onSelect, compact, brandStyle }: TariffCardProps) {
  const isQuarantined = service.cooldownUntil && new Date(service.cooldownUntil) > new Date();

  // Selected brand classes
  const isBranded = isSelected && brandStyle;
  const cardBgAndText = isBranded
    ? `${brandStyle.activeBg} ${brandStyle.activeShadow} ${brandStyle.activeText} border-transparent scale-[1.01]`
    : isSelected
    ? "ring-2 ring-primary/80 border-primary/45 bg-primary/[0.03] shadow-[0_12px_25px_-5px_rgba(var(--primary-rgb),0.1)] md:-translate-y-0.5"
    : "border-border/50 bg-card hover:border-primary/40 md:hover:-translate-y-0.5 md:hover:shadow-[0_12px_25px_-8px_rgba(0,0,0,0.06)] dark:md:hover:shadow-[0_12px_25px_-8px_rgba(0,0,0,0.25)]";

  const textColorClass = isBranded
    ? brandStyle.activeText
    : "text-foreground";

  const mutedColorClass = isBranded
    ? `${brandStyle.activeText} opacity-75`
    : "text-muted-foreground";

  const checkColorClass = isBranded
    ? brandStyle.activeText
    : "text-primary";

  return (
    <button
      type="button"
      onClick={() => !isQuarantined && onSelect(service)}
      disabled={!!isQuarantined}
      className={`
        w-full text-left rounded-2xl border transition-all duration-300
        ${compact ? "p-3" : "p-4"}
        ${cardBgAndText}
        ${isQuarantined ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:scale-[0.99]"}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: Info */}
        <div className="flex-1 min-w-0">
          {/* Badge + selected indicator */}
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {isSelected && (
              <CheckCircle2 className={`w-4 h-4 shrink-0 ${checkColorClass}`} />
            )}
            {service.badge && (
              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                isBranded 
                  ? "bg-current/20 text-current border-current/20" 
                  : getBadgeStyle(service.badge)
              }`}>
                {service.badge}
              </span>
            )}
          </div>

          {/* Name */}
          <h4 className={`font-bold text-sm leading-tight mb-1.5 ${textColorClass}`}>
            {cleanServiceName(service.name)}
          </h4>

          {/* Meta line with structured execution badges (Zero Empty Blocks) */}
          <div className={`flex items-center gap-2.5 text-[11px] font-medium flex-wrap mt-1 ${mutedColorClass}`}>
            {service.startTime && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-primary/70 shrink-0" />
                {service.startTime}
              </span>
            )}
            {(service.speedDisplay || service.speed) && (
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-500/80 shrink-0" />
                {service.speedDisplay || service.speed}
              </span>
            )}
            {(service.warrantyDays && service.warrantyDays > 0) ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                {service.warrantyDays} дн. гарантия
              </span>
            ) : service.isRefillEnabled ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                Гарантия (Refill)
              </span>
            ) : null}
            <span className="opacity-75">
              от {service.minQty} шт
            </span>
          </div>

          {/* Description */}
          {service.description && (!compact || isSelected) && (
            <p className={`text-[11px] mt-2 leading-relaxed whitespace-pre-line transition-all duration-300 ${
              isBranded
                ? `${brandStyle.activeText} opacity-70`
                : "text-muted-foreground/70"
            } ${isSelected ? "" : "line-clamp-2"}`}>
              {service.description.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return <strong key={index} className="font-extrabold text-foreground">{part.slice(2, -2)}</strong>;
                }
                return part;
              })}
            </p>
          )}
        </div>

        {/* Right: Price */}
        <div className="text-right shrink-0 pt-0.5">
          <div className={`font-black tabular-nums text-lg leading-none ${textColorClass}`}>
            {service.pricePerUnitRub} ₽
          </div>
          <div className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${mutedColorClass}`}>
            / шт
          </div>
        </div>
      </div>

      {/* Quarantine warning */}
      {isQuarantined && (
        <div className="mt-2 text-[10px] font-semibold text-warning-text bg-warning/10 border border-warning/20 rounded-lg px-2 py-1">
          ⏳ Временно недоступен
        </div>
      )}
    </button>
  );
}
