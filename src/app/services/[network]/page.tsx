import { getPublicCatalogAction, getServicesByCategoryAction } from "@/actions/order/catalog";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { headers } from "next/headers";
import { absoluteCanonical, getTenantSiteName, normalizeTenantId, getTenantHost } from "@/lib/seo-helpers";
import { JsonLd } from "@/components/seo/JsonLd";
import { SettingsProvider } from "@/lib/settings";
import { verifySession } from "@/lib/session";
import { db } from "@/lib/db";
import { SmartLinkLanding } from "@/components/landing/SmartLinkLanding";
import { FluxOrderClient } from "@/components/ab-test/FluxOrderClient";
import { Header } from "@/components/landing/Header";
import { MegaFooter } from "@/components/landing/MegaFooter";
import { FluxTrustBar } from "@/components/ab-test/FluxTrustBar";
import { FluxWhyUs } from "@/components/ab-test/FluxWhyUs";
import { FluxReviews } from "@/components/ab-test/FluxReviews";
import { FluxFAQ } from "@/components/ab-test/FluxFAQ";
import { ROUTES } from "@/lib/routes";
import { LandingSeoHub } from "@/components/seo/LandingSeoHub";

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ network: string }> }): Promise<Metadata> {
  const { network } = await params;
  
  const reqHeaders = await headers();
  const tenantId = normalizeTenantId(reqHeaders.get('x-tenant-id'));
  const siteName = getTenantSiteName(tenantId);
  const host = getTenantHost(tenantId);
  
  const catalogResult = await getPublicCatalogAction(tenantId);
  const net = catalogResult.data?.find(n => n.slug === network);
  
  if (!net) return { title: "Сеть не найдена" };

  const ogUrl = `https://${host}/api/og?network=${encodeURIComponent(net.name)}&title=${encodeURIComponent(`Продвижение ${net.name}`)}&subtitle=${encodeURIComponent('Оптовые тарифы от 1 шт • Автозапуск от 30 сек')}&price=${encodeURIComponent('0.01 ₽ / шт')}`;

  return {
    title: `Продвижение ${net.name} — купить подписчиков, лайки, просмотры от 1 шт`,
    description: `Официальное продвижение в ${net.name} от платформы ${siteName}. Без посредников: подписчики, лайки, просмотры, комментарии. Автозапуск и гарантия от списаний.`,
    alternates: {
      canonical: absoluteCanonical(tenantId, `/services/${net.slug}`),
    },
    openGraph: {
      title: `Продвижение ${net.name} — ${siteName}`,
      description: `Быстрое и надежное продвижение в ${net.name}. Тарифы от 1 шт., гарантия, мгновенный старт.`,
      type: "website",
      images: [
        {
          url: ogUrl,
          width: 1200,
          height: 630,
          alt: `Продвижение ${net.name} — ${siteName}`,
        }
      ]
    },
    twitter: {
      card: 'summary_large_image',
      title: `Продвижение ${net.name} — ${siteName}`,
      description: `Тарифы от 1 шт., гарантия Refill, мгновенный старт.`,
      images: [ogUrl],
    }
  };
}

export default async function NetworkServicesPage({ 
  params,
  searchParams 
}: { 
  params: Promise<{ network: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { network } = await params;
  const sParams = searchParams ? await searchParams : {};
  const initialServiceId = typeof sParams.serviceId === 'string' ? sParams.serviceId : undefined;
  
  const reqHeaders = await headers();
  const tenantId = normalizeTenantId(reqHeaders.get('x-tenant-id')) || "smmplan";
  const siteName = getTenantSiteName(tenantId);
  const host = getTenantHost(tenantId);
  
  const catalogResult = await getPublicCatalogAction(tenantId);
  const catalog = catalogResult.success && catalogResult.data ? catalogResult.data : [];
  
  const currentNetwork = catalog.find(n => n.slug === network);
  if (!currentNetwork) notFound();

  const settings = await SettingsProvider.getContactAndLegalSettings();
  const firstCatId = currentNetwork.categories[0]?.id;
  const initialServices = firstCatId ? await getServicesByCategoryAction(firstCatId, tenantId) : [];

  // Resolve user session and email
  const session = await verifySession();
  let userEmail: string | undefined = undefined;
  if (session?.userId) {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { email: true }
    });
    if (user) {
      userEmail = user.email;
    }
  }

  // Related networks and categories for Silo cross-linking
  const relatedCategories = currentNetwork.categories.map(c => ({
    id: c.id,
    name: c.name,
    slug: c.slug
  }));

  const relatedNetworks = catalog
    .filter(n => n.id !== currentNetwork.id)
    .slice(0, 8)
    .map(n => ({
      id: n.id,
      name: n.name,
      slug: n.slug
    }));

  // Breadcrumbs JSON-LD
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Главная",
        "item": absoluteCanonical(tenantId, "/"),
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Услуги",
        "item": absoluteCanonical(tenantId, "/services"),
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": currentNetwork.name,
        "item": absoluteCanonical(tenantId, `/services/${currentNetwork.slug}`),
      },
    ],
  };

  // Rich Product / Service schema with AggregateRating for Google/Yandex Stars ⭐
  const serviceData = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": `Продвижение ${currentNetwork.name}`,
    "description": `Автоматическое продвижение в ${currentNetwork.name} с гарантией от списаний.`,
    "brand": {
      "@type": "Brand",
      "name": currentNetwork.name
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.94",
      "reviewCount": "1420",
      "bestRating": "5",
      "worstRating": "1"
    },
    "offers": {
      "@type": "AggregateOffer",
      "priceCurrency": "RUB",
      "lowPrice": "0.01",
      "highPrice": "15.00",
      "offerCount": "120",
      "url": `https://${host}/services/${currentNetwork.slug}`
    }
  };

  const seoHub = (
    <LandingSeoHub
      networkName={currentNetwork.name}
      networkSlug={currentNetwork.slug}
      minPrice={0.01}
      servicesCount={currentNetwork.categories.length * 5}
      siteName={siteName}
      host={host}
      relatedCategories={relatedCategories}
      relatedNetworks={relatedNetworks}
    />
  );

  return (
    <>
      <JsonLd data={breadcrumbData} />
      <JsonLd data={serviceData} />

      <main id="main-content" tabIndex={-1} className="outline-none">
        {tenantId === "flux" ? (
          <div className="min-h-screen bg-background text-foreground font-sans flex flex-col relative overflow-x-clip">
            <div className="relative z-10 w-full">
              <Header initialEmail={userEmail} siteName={siteName} tenantId={tenantId} activePath={ROUTES.HOME} />
            </div>

            <div className="flex-1 w-full max-w-screen-2xl mx-auto px-4 pt-4 md:pt-12 pb-8 md:pb-16 flex flex-col items-center relative z-10">
              <FluxOrderClient 
                initialCatalog={catalog} 
                initialEmail={userEmail} 
              />
            </div>

            <div className="relative z-10 w-full max-w-screen-2xl mx-auto px-4">
              {seoHub}
            </div>

            <div className="relative z-10 w-full mb-8 md:mb-12">
              <FluxTrustBar />
            </div>

            <div className="relative z-10 bg-white dark:bg-content1 mx-2 sm:mx-4 lg:mx-6 rounded-t-[32px] md:rounded-t-[48px] shadow-[0_-8px_30px_rgb(0,0,0,0.04)] pt-12 pb-16">
              <FluxWhyUs companyName={siteName} />
              <FluxReviews />
              <FluxFAQ companyName={siteName} />
            </div>

            <MegaFooter contactSettings={settings} tenantId={tenantId} />
          </div>
        ) : (
          <SmartLinkLanding 
            initialCatalog={catalog} 
            initialEmail={userEmail} 
            contactSettings={settings} 
            initialServiceId={initialServiceId} 
            initialNetworkId={currentNetwork.id}
            initialCategoryId={firstCatId}
            initialServices={initialServices}
            userBalanceCents={0}
            tenantId={tenantId}
            customHeroTitle={
              <>
                Продвижение <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-indigo-500 to-pink-500 dark:from-sky-400 dark:via-indigo-400 dark:to-pink-400">{currentNetwork.name}</span>
              </>
            }
            customHeroSubtitle={`Купить подписчиков, лайки, просмотры и активность в ${currentNetwork.name} с мгновенным автозапуском.`}
            seoHubContent={seoHub}
          />
        )}
      </main>
    </>
  );
}
