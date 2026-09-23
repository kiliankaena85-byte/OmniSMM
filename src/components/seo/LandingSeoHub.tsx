import React from "react";
import { LandingSeoTariffComparison } from "@/components/seo/sub/LandingSeoTariffComparison";
import { LandingSeoFactBox } from "@/components/seo/sub/LandingSeoFactBox";
import { LandingSeoHowTo } from "@/components/seo/sub/LandingSeoHowTo";
import { LandingSeoExpertise } from "@/components/seo/sub/LandingSeoExpertise";
import { LandingSeoRelated } from "@/components/seo/sub/LandingSeoRelated";

export interface LandingSeoHubProps {
  networkName: string;
  networkSlug: string;
  categoryName?: string;
  categorySlug?: string;
  minPrice?: number;
  servicesCount?: number;
  siteName?: string;
  host?: string;
  relatedCategories?: Array<{ id: string; name: string; slug: string }>;
  relatedNetworks?: Array<{ id: string; name: string; slug: string }>;
}

export function LandingSeoHub({
  networkName,
  networkSlug,
  categoryName,
  categorySlug,
  minPrice = 0.01,
  servicesCount = 10,
  siteName = "SMMplan",
  host = "smmplan.pro", // audit-ignore
  relatedCategories = [],
  relatedNetworks = []
}: LandingSeoHubProps) {
  const currentTitle = categoryName ? `${categoryName} в ${networkName}` : `Продвижение в ${networkName}`;
  const targetEntity = categoryName ? categoryName.toLowerCase() : "услуги продвижения";
  const formattedMinPrice = minPrice.toFixed(4);

  return (
    <div className="w-full space-y-12 md:space-y-16 pt-8 pb-12 font-sans text-foreground">
      {/* 1. Сравнительная таблица тарифов */}
      <LandingSeoTariffComparison
        networkName={networkName}
        formattedMinPrice={formattedMinPrice}
        minPrice={minPrice}
      />

      {/* 2. AEO Factbox & Характеристики */}
      <LandingSeoFactBox
        currentTitle={currentTitle}
        networkName={networkName}
        siteName={siteName}
      />

      {/* 3. Пошаговая инструкция (JSON-LD HowTo) */}
      <LandingSeoHowTo
        targetEntity={targetEntity}
        networkName={networkName}
        siteName={siteName}
      />

      {/* 4. LSI Экспертный блок */}
      <LandingSeoExpertise
        targetEntity={targetEntity}
        networkName={networkName}
        siteName={siteName}
      />

      {/* 5. Silo Cross-linking & Платежные логотипы */}
      <LandingSeoRelated
        networkName={networkName}
        networkSlug={networkSlug}
        relatedCategories={relatedCategories}
        relatedNetworks={relatedNetworks}
      />
    </div>
  );
}
