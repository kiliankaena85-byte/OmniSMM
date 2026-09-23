import React from "react";
import Link from "next/link";
import { CreditCard, ShieldCheck } from "lucide-react";

interface LandingSeoRelatedProps {
  networkName: string;
  networkSlug: string;
  relatedCategories?: Array<{ id: string; name: string; slug: string }>;
  relatedNetworks?: Array<{ id: string; name: string; slug: string }>;
}

export function LandingSeoRelated({
  networkName,
  networkSlug,
  relatedCategories = [],
  relatedNetworks = [],
}: LandingSeoRelatedProps) {
  return (
    <div className="space-y-8">
      {/* ── SILO CROSS-LINKING & ТЕГИ ПЕРЕЛИНКОВКИ ── */}
      <section className="space-y-6 pt-4">
        <div className="border-b border-border pb-3">
          <h2 className="text-lg sm:text-xl font-black text-foreground">
            Популярные направления продвижения
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Быстрый переход к сопутствующим услугам и другим социальным сетям
          </p>
        </div>

        {/* Смежные категории текущей сети */}
        {relatedCategories.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-bold text-muted-foreground block">Другие услуги в {networkName}:</span>
            <div className="flex flex-wrap gap-2">
              {relatedCategories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/services/${networkSlug}/${cat.slug}`}
                  className="px-3.5 py-1.5 rounded-xl bg-secondary hover:bg-primary/10 border border-border hover:border-primary/40 text-xs font-bold text-foreground hover:text-primary transition-all duration-200"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Другие соцсети */}
        {relatedNetworks.length > 0 && (
          <div className="space-y-2 pt-2">
            <span className="text-xs font-bold text-muted-foreground block">Продвижение в других соцсетях:</span>
            <div className="flex flex-wrap gap-2">
              {relatedNetworks.map((net) => (
                <Link
                  key={net.id}
                  href={`/services/${net.slug}`}
                  className="px-3.5 py-1.5 rounded-xl bg-card hover:bg-secondary border border-border text-xs font-bold text-foreground transition-all duration-200"
                >
                  {net.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── КОММЕРЧЕСКИЕ ПЛАТЕЖНЫЕ ЛОГОТИПЫ (ДОВЕРИЕ ЯНДЕКСА) ── */}
      <div className="pt-6 border-t border-border flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-3 font-semibold">
          <CreditCard className="w-4 h-4 text-primary shrink-0" />
          <span>Безопасная оплата: МИР, СБП, Visa, Mastercard, T-Pay, SberPay</span>
        </div>
        <div className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>Электронный чек 54-ФЗ на email</span>
        </div>
      </div>
    </div>
  );
}
