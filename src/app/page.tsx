import dynamicImport from "next/dynamic";
import { SmartLinkLanding } from "@/components/landing/SmartLinkLanding";
import { Header } from "@/components/landing/Header";
import { FluxOrderClient } from "@/components/ab-test/FluxOrderClient";
import { FluxTrustBar } from "@/components/ab-test/FluxTrustBar";
import { PreLaunchHoldingScreen } from "@/components/landing/PreLaunchHoldingScreen";
import { ROUTES } from "@/lib/routes";
import { TENANTS } from "@/config/tenants";
import { readSessionTokenFromCookies } from "@/lib/session";
import { headers, cookies } from "next/headers";
import { normalizeTenantId } from "@/lib/tenant-resolver-edge";
import { loadStorefrontData, generateStorefrontMetadata } from "@/lib/storefront-loader";

const FluxHowItWorks = dynamicImport(() => import("@/components/ab-test/FluxHowItWorks").then(m => m.FluxHowItWorks));
const FluxLivePulse = dynamicImport(() => import("@/components/ab-test/FluxLivePulse").then(m => m.FluxLivePulse));
const FluxWhyUs = dynamicImport(() => import("@/components/ab-test/FluxWhyUs").then(m => m.FluxWhyUs));
const FluxReviews = dynamicImport(() => import("@/components/ab-test/FluxReviews").then(m => m.FluxReviews));
const FluxFAQ = dynamicImport(() => import("@/components/ab-test/FluxFAQ").then(m => m.FluxFAQ));
const FluxPreFooterCTA = dynamicImport(() => import("@/components/ab-test/FluxPreFooterCTA").then(m => m.FluxPreFooterCTA));
const MegaFooter = dynamicImport(() => import("@/components/landing/MegaFooter").then(m => m.MegaFooter));

export const dynamic = "force-dynamic";

export const generateMetadata = generateStorefrontMetadata;

export default async function Home({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await searchParams;
  const initialServiceId = typeof params.serviceId === 'string' ? params.serviceId : undefined;

  const reqHeaders = await headers();
  const reqCookies = await cookies();
  const host = reqHeaders.get("x-host") || reqHeaders.get("x-forwarded-host") || reqHeaders.get("host") || "";
  const cleanHost = host.split(":")[0].toLowerCase().trim();
  const tenantId = normalizeTenantId(reqHeaders.get("x-tenant-id")) || (params.tenant === "flux" ? "flux" : "smmplan");

  const cookieFlow = reqCookies.get("smmplan_order_flow")?.value;
  const flowParam = typeof params.flow === 'string' ? params.flow : undefined;
  const initialFlow = (flowParam === 'slide' || flowParam === 'classic')
    ? (flowParam as 'slide' | 'classic')
    : (cookieFlow === 'slide' || cookieFlow === 'classic')
      ? (cookieFlow as 'slide' | 'classic')
      : 'classic';

  const isProdHost = cleanHost === "smmplan.pro" || cleanHost === "www.smmplan.pro";
  const isHoldingParam = params.mode === "holding";
  const isHoldingMode = isHoldingParam || (isProdHost && params.contour !== "test");

  const sessionToken = readSessionTokenFromCookies(reqCookies);
  const isGuest = !sessionToken;

  const {
    catalog,
    settings,
    baseUrl,
    targetCategoryId,
    targetNetworkId,
    initialServices,
    userEmail,
    userBalanceCents,
  } = await loadStorefrontData({
    tenantId,
    isGuest,
    initialServiceId,
  });

  const tenantConfig = TENANTS.find(t => t.id === tenantId);
  const siteName = tenantConfig?.name || settings.SITE_NAME || "SMMplan";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: siteName,
            url: baseUrl,
            potentialAction: {
              "@type": "SearchAction",
              target: `${baseUrl}/?q={search_term_string}`,
              "query-input": "required name=search_term_string",
            },
          }).replace(/</g, '\\u003c'),
        }}
      />
      
      {/* Static SEO block visible only to search engines */}
      <section id="services-catalog" className="sr-only">
        <h1>Продвижение подписчиков и просмотров в соцсетях</h1>
        {catalog.map((network) => (
          <div key={network.id}>
            <h2>{network.name}</h2>
            <ul>
              {network.categories.map((category) => (
                <li key={category.id}>{category.name}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* Interactive App */}
      <div id="main-content" tabIndex={-1} className="outline-none">
        {tenantId === "flux" ? (
          <div className="min-h-screen bg-background text-foreground font-sans flex flex-col relative overflow-x-clip">
            <div className="sticky top-0 z-50 w-full">
              <Header initialEmail={userEmail} siteName={siteName} tenantId={tenantId} activePath={ROUTES.HOME} />
            </div>

            {/* ── SMMFLUX ELASTIC HERO SECTION (Dynamic Gradient Container) ── */}
            <section className="relative w-full flex-1 flex flex-col items-center">
              {/* Elastic Background Canvas extending under sticky header (-top-16) to bottom-0 */}
              <div className="absolute -top-16 inset-x-0 bottom-0 z-0 pointer-events-none overflow-hidden select-none bg-white dark:bg-[#070b14] transform-gpu contain-paint">
                {/* Radiant Aurora v2: Rich vibrant mesh with warm sunset amber and electric indigo */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(ellipse 70% 60% at 18% 22%, rgba(99, 102, 241, 0.72) 0%, rgba(59, 130, 246, 0.45) 42%, transparent 78%), ' +
                      'radial-gradient(ellipse 70% 60% at 82% 22%, rgba(6, 182, 212, 0.70) 0%, rgba(99, 102, 241, 0.42) 42%, transparent 78%), ' +
                      'radial-gradient(ellipse 65% 55% at 50% 38%, rgba(168, 85, 247, 0.42) 0%, rgba(99, 102, 241, 0.22) 45%, transparent 80%), ' +
                      'radial-gradient(ellipse 90% 70% at 50% 86%, rgba(244, 63, 94, 0.72) 0%, rgba(236, 72, 153, 0.65) 30%, rgba(251, 146, 60, 0.50) 60%, transparent 92%), ' +
                      'radial-gradient(ellipse 60% 55% at 10% 94%, rgba(236, 72, 153, 0.62) 0%, transparent 75%), ' +
                      'radial-gradient(ellipse 60% 55% at 90% 94%, rgba(251, 146, 60, 0.58) 0%, transparent 75%)',
                  }}
                />
                {/* Digital Canvas Blueprint Micro-Dot Matrix */}
                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.14] dark:opacity-[0.22] mix-blend-multiply dark:mix-blend-screen" />
                <div className="absolute bottom-0 inset-x-0 h-44 bg-gradient-to-t from-background via-background/60 to-transparent" />
              </div>

              <div className="w-full max-w-screen-2xl mx-auto px-4 pt-2 md:pt-6 pb-2 md:pb-4 flex flex-col items-center relative z-10 flex-1">
                <FluxOrderClient initialCatalog={catalog} initialEmail={userEmail} userBalanceCents={userBalanceCents} tenantId={tenantId} />
              </div>

              <div className="relative z-10 w-full my-2 md:my-4">
                <FluxTrustBar />
              </div>
            </section>

            {/* Atmosphere underlay for lower page sections to eliminate white-on-white */}
            <div className="relative z-10 bg-slate-50/80 dark:bg-[#070b14]/95 mx-2 sm:mx-4 lg:mx-6 rounded-t-[32px] md:rounded-t-[48px] border-t border-slate-200/70 dark:border-white/10 shadow-[0_-8px_30px_rgb(0,0,0,0.03)] pt-6 pb-16 overflow-hidden">
              <div className="absolute top-16 left-1/4 w-[500px] h-[500px] bg-purple-500/12 blur-[140px] rounded-full pointer-events-none" />
              <div className="absolute top-1/2 right-1/4 w-[500px] h-[500px] bg-cyan-500/10 blur-[140px] rounded-full pointer-events-none" />
              <div className="absolute bottom-1/4 left-1/3 w-[500px] h-[500px] bg-pink-500/10 blur-[150px] rounded-full pointer-events-none" />
              <div className="relative z-10 flex flex-col gap-10 md:gap-14">
                <FluxLivePulse />
                <FluxHowItWorks />
                <FluxWhyUs companyName={siteName} />
                <FluxReviews />
                <FluxFAQ companyName={siteName} />
                <FluxPreFooterCTA siteName={siteName} />
              </div>
            </div>

            <MegaFooter contactSettings={settings} tenantId={tenantId} />
          </div>
        ) : isHoldingMode ? (
          <PreLaunchHoldingScreen
            siteName={siteName}
            supportTelegram={settings.TELEGRAM_SUPPORT_BOT || "smmplan_support_bot"}
            supportEmail={settings.SUPPORT_EMAIL || "support@smmplan.pro"}
            tenantId={tenantId}
          />
        ) : (
          <SmartLinkLanding 
            initialCatalog={catalog} 
            initialEmail={userEmail} 
            contactSettings={settings} 
            initialServiceId={initialServiceId} 
            initialCategoryId={targetCategoryId}
            initialNetworkId={targetNetworkId}
            userBalanceCents={userBalanceCents}
            tenantId={tenantId}
            initialServices={initialServices}
            initialFlow={initialFlow}
          />
        )}
      </div>
    </>
  );
}
