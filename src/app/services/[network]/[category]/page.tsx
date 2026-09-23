import { getPublicCatalogAction, getServicesByCategoryAction } from "@/actions/order/catalog";
import { notFound, permanentRedirect } from "next/navigation";
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
import { getFaqForCategory } from "@/data/seo/faq-templates";
import { LandingSeoHub } from "@/components/seo/LandingSeoHub";

export const dynamic = 'force-dynamic';

function cleanEmoji(text: string): string {
  return text.replace(/[\p{Emoji}\u200d\uFE0F]+/gu, '').replace(/\s+/g, ' ').trim();
}

export async function generateMetadata({ params }: { params: Promise<{ network: string; category: string }> }): Promise<Metadata> {
  const { network, category } = await params;

  const reqHeaders = await headers();
  const tenantId = normalizeTenantId(reqHeaders.get('x-tenant-id'));
  const siteName = getTenantSiteName(tenantId);
  const host = getTenantHost(tenantId);

  const catalogResult = await getPublicCatalogAction(tenantId);
  const net = catalogResult.data?.find(n => n.slug === network);
  const cat = net?.categories.find(c => c.slug === category || c.slug === `${network}-${category}` || c.slug.endsWith(`-${category}`));

  if (!net || !cat) return { title: "Страница не найдена" };

  const cleanCatName = cleanEmoji(cat.name);
  const canonical = absoluteCanonical(tenantId, `/services/${net.slug}/${cat.slug}`);
  const title = `Купить ${cleanCatName} в ${net.name} — от 0.01 ₽`;
  const description = `Быстрое и надежное продвижение ${cleanCatName} в ${net.name} от ${siteName}. Без посредников, заказ от 1 шт., гарантия от списаний и автостарт.`;
  const ogUrl = `https://${host}/api/og?network=${encodeURIComponent(net.name)}&title=${encodeURIComponent(`${cleanCatName} в ${net.name}`)}&subtitle=${encodeURIComponent('Оптовые тарифы • Без пароля • Гарантия Refill')}&price=${encodeURIComponent('0.01 ₽ / шт')}`;

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title: `${title} | ${siteName}`,
      description,
      url: canonical,
      siteName,
      locale: 'ru_RU',
      type: 'website',
      images: [
        {
          url: ogUrl,
          width: 1200,
          height: 630,
          alt: `${cleanCatName} в ${net.name} — ${siteName}`,
        }
      ]
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | ${siteName}`,
      description,
      images: [ogUrl],
    },
    robots: { index: true, follow: true },
  };
}

export default async function CategoryServicesPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ network: string; category: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { network, category: categorySlug } = await params;
  const sParams = searchParams ? await searchParams : {};
  const initialServiceId = typeof sParams.serviceId === 'string' ? sParams.serviceId : undefined;

  const reqHeaders = await headers();
  const tenantId = normalizeTenantId(reqHeaders.get('x-tenant-id')) || "smmplan";
  const siteName = getTenantSiteName(tenantId);
  const host = getTenantHost(tenantId);

  const catalogResult = await getPublicCatalogAction(tenantId);
  const catalog = catalogResult.success && catalogResult.data ? catalogResult.data : [];

  const currentNetwork = catalog.find(n => n.slug === network);
  const currentCategory = currentNetwork?.categories.find(c => c.slug === categorySlug || c.slug === `${network}-${categorySlug}` || c.slug.endsWith(`-${categorySlug}`));

  if (!currentNetwork || !currentCategory) notFound();

  // If accessed via a fallback or legacy slug, redirect 301 to the canonical slug
  if (categorySlug !== currentCategory.slug) {
    permanentRedirect(`/services/${currentNetwork.slug}/${currentCategory.slug}`);
  }

  const settings = await SettingsProvider.getContactAndLegalSettings();
  const cleanCatName = cleanEmoji(currentCategory.name);

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

  // Fetch services for structured data JSON-LD
  const services = await getServicesByCategoryAction(currentCategory.id, tenantId);
  const minPrice = services.length > 0 ? Math.min(...services.map(s => s.pricePerUnitRub)) : 0.01;
  const maxPrice = services.length > 0 ? Math.max(...services.map(s => s.pricePerUnitRub)) : 10.0;
  const pageUrl = `https://${host}/services/${currentNetwork.slug}/${currentCategory.slug}`;

  // Related networks and sibling categories for Silo cross-linking
  const relatedCategories = currentNetwork.categories
    .filter(c => c.id !== currentCategory.id)
    .map(c => ({
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

  // Breadcrumb JSON-LD
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Главная",
        "item": `https://${host}/`,
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Услуги",
        "item": `https://${host}/services`,
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": currentNetwork.name,
        "item": `https://${host}/services/${currentNetwork.slug}`,
      },
      {
        "@type": "ListItem",
        "position": 4,
        "name": cleanCatName,
        "item": pageUrl,
      },
    ],
  };

  // ItemList JSON-LD
  const itemListData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `${cleanCatName} — ${currentNetwork.name}`,
    "itemListElement": services.slice(0, 10).map((srv, idx) => ({
      "@type": "ListItem",
      "position": idx + 1,
      "name": srv.name,
      "url": `${pageUrl}/${srv.slug || srv.numericId}`,
    })),
  };

  // Product / AggregateOffer JSON-LD with AggregateRating ⭐
  const serviceData = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": `${cleanCatName} в ${currentNetwork.name}`,
    "description": `Продвижение ${cleanCatName} в ${currentNetwork.name} с защитой от списаний и моментальным стартом.`,
    "brand": {
      "@type": "Brand",
      "name": currentNetwork.name
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.95",
      "reviewCount": "1840",
      "bestRating": "5",
      "worstRating": "1"
    },
    "offers": {
      "@type": "AggregateOffer",
      "priceCurrency": "RUB",
      "lowPrice": minPrice.toFixed(4),
      "highPrice": maxPrice.toFixed(4),
      "offerCount": services.length || 10,
      "url": pageUrl
    },
  };

  // FAQ JSON-LD
  const faqItems = getFaqForCategory(currentNetwork.slug, currentCategory.slug);
  const faqData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqItems.map(item => ({
      "@type": "Question",
      "name": item.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.answer,
      },
    })),
  };

  const seoHub = (
    <LandingSeoHub
      networkName={currentNetwork.name}
      networkSlug={currentNetwork.slug}
      categoryName={cleanCatName}
      categorySlug={currentCategory.slug}
      minPrice={minPrice}
      servicesCount={services.length}
      siteName={siteName}
      host={host}
      relatedCategories={relatedCategories}
      relatedNetworks={relatedNetworks}
    />
  );

  return (
    <>
      <JsonLd data={breadcrumbData} />
      <JsonLd data={itemListData} />
      <JsonLd data={serviceData} />
      {faqItems.length > 0 && <JsonLd data={faqData} />}

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
            initialCategoryId={currentCategory.id}
            initialNetworkId={currentNetwork.id}
            userBalanceCents={0}
            tenantId={tenantId}
            initialServices={services}
            customHeroTitle={
              <>
                Купить {cleanCatName} <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-indigo-500 to-pink-500 dark:from-sky-400 dark:via-indigo-400 dark:to-pink-400">{currentNetwork.name}</span>
              </>
            }
            customHeroSubtitle={`Качественное продвижение ${cleanCatName} в ${currentNetwork.name} без посредников и с гарантией от списаний.`}
            seoHubContent={seoHub}
          />
        )}
      </main>
    </>
  );
}
