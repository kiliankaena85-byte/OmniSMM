import { getPublicCatalogAction } from "@/actions/order/catalog";

import { SettingsProvider } from "@/lib/settings";
import { headers } from "next/headers";
import { FluxOrderClient as LovableOrderClient } from "@/components/ab-test/FluxOrderClient";

import { Header } from "@/components/landing/Header";
import { FluxTrustBar as LovableTrustBar } from "@/components/ab-test/FluxTrustBar";
import { FluxWhyUs as LovableWhyUs } from "@/components/ab-test/FluxWhyUs";
import { FluxReviews as LovableReviews } from "@/components/ab-test/FluxReviews";
import { FluxFAQ as LovableFAQ } from "@/components/ab-test/FluxFAQ";
import { MegaFooter } from "@/components/landing/MegaFooter";

import { normalizeTenantId, getTenantHost, absoluteCanonical } from "@/lib/seo-helpers";

export const revalidate = 300;

export async function generateMetadata() {
  const reqHeaders = await headers();
  const rawTenantId = reqHeaders.get("x-tenant-id");
  const tenantId = normalizeTenantId(rawTenantId) || "smmplan";
  const settings = await SettingsProvider.getContactAndLegalSettings(tenantId);
  const siteName = settings.SITE_NAME || (tenantId === 'flux' ? "SMMflux" : "SMMplan");
  
  const rawHost = reqHeaders.get("host") || "";
  const safeHost = /^[a-z0-9.-]+(?::\d+)?$/i.test(rawHost) ? rawHost : getTenantHost(tenantId);
  const baseUrl = `https://${safeHost}`;
  
  return {
    metadataBase: new URL(baseUrl),
    title: `${siteName} | Продвижение социальных сетей`,
    description: `Современная платформа продвижения ${siteName} (Next-Gen AI Growth). Быстрый запуск, автоматизация и гарантия качества.`,
    alternates: {
      canonical: absoluteCanonical(tenantId, '/ab-lovable'),
    },
    openGraph: {
      title: `${siteName} | Продвижение социальных сетей`,
      description: `Современная платформа продвижения ${siteName} (Next-Gen AI Growth).`,
      url: `${baseUrl}/ab-lovable`,
      siteName: siteName,
      type: "website",
    },
  };
}

export default async function LovablePage() {
  const catalogResult = await getPublicCatalogAction();
  const catalog = catalogResult.success && catalogResult.data ? catalogResult.data : [];
  
  const reqHeaders = await headers();
  const rawTenantId = reqHeaders.get("x-tenant-id");
  const tenantId = normalizeTenantId(rawTenantId) || "smmplan";

  const settings = await SettingsProvider.getContactAndLegalSettings(tenantId);
  const siteName = settings.SITE_NAME || (tenantId === 'flux' ? "SMMflux" : "SMMplan");

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col relative overflow-x-clip">
      
      {/* ── LOVABLE VIBRANT HERO BACKGROUND (Full Bleed - GPU Optimized Static Layer) ── */}
      <div className="absolute top-0 inset-x-0 h-[2500px] z-0 pointer-events-none overflow-hidden select-none bg-white dark:bg-default-50">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(65% 55% at 15% 0%, rgba(59, 130, 246, 0.65), transparent 70%), ' +
              'radial-gradient(55% 55% at 85% 5%, rgba(56, 189, 248, 0.55), transparent 70%), ' +
              'radial-gradient(65% 55% at 20% 40%, rgba(244, 63, 94, 0.55), transparent 70%), ' +
              'radial-gradient(55% 55% at 80% 50%, rgba(249, 115, 22, 0.50), transparent 70%), ' +
              'radial-gradient(70% 70% at 50% 25%, rgba(217, 70, 239, 0.60), transparent 75%)',
          }}
        />
        {/* Saturated Mesh Color Orbs for extra visual punch */}
        <div className="absolute top-0 left-[2%] w-[700px] h-[700px] rounded-full bg-blue-500/40 blur-[120px] pointer-events-none" />
        <div className="absolute top-4 left-[25%] w-[650px] h-[650px] rounded-full bg-purple-600/50 blur-[110px] pointer-events-none" />
        <div className="absolute top-0 right-[5%] w-[700px] h-[700px] rounded-full bg-pink-500/45 blur-[120px] pointer-events-none" />
        <div className="absolute top-20 right-[1%] w-[500px] h-[500px] rounded-full bg-orange-400/35 blur-[90px] pointer-events-none" />

        <div className="absolute bottom-0 inset-x-0 h-[400px] bg-gradient-to-t from-background via-background/80 to-transparent" />
      </div>

      <div className="relative z-10 w-full">
        <Header siteName={siteName} activePath="/ab-lovable" />
      </div>
      
      <main className="flex-1 w-full max-w-screen-2xl mx-auto px-4 pt-12 md:pt-28 pb-8 md:pb-16 flex flex-col items-center relative z-10">
        <LovableOrderClient 
          initialCatalog={catalog} 
        />
      </main>
      <div className="relative z-10 w-full mb-8 md:mb-12">
        <LovableTrustBar />
      </div>

      {/* Solid Underlay for the rest of the page content */}
      <div className="relative z-10 bg-white dark:bg-content1 mx-2 sm:mx-4 lg:mx-6 rounded-t-[32px] md:rounded-t-[48px] shadow-[0_-8px_30px_rgb(0,0,0,0.04)] pt-12 pb-16">
        <LovableWhyUs />
        <LovableReviews />
        <LovableFAQ companyName={siteName} />
      </div>
      
      <MegaFooter contactSettings={settings} tenantId={tenantId} />
    </div>
  );
}
