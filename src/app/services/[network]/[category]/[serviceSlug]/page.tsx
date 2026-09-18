import { getServiceBySlugAction } from "@/actions/order/catalog";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Metadata } from "next";
import { headers } from "next/headers";
import { JsonLd } from "@/components/seo/JsonLd";
import { FAQSection } from "@/components/seo/FAQSection";
import { getFaqForCategory } from "@/data/seo/faq-templates";
import { absoluteCanonical, getTenantHost, getTenantSiteName, normalizeTenantId } from "@/lib/seo-helpers";
import { db } from "@/lib/db";
import { Header } from "@/components/landing/Header";
import { MegaFooter } from "@/components/landing/MegaFooter";
import { ServiceIdBadge } from "@/components/ui/service-id-badge";

export const dynamic = 'force-dynamic';



export async function generateMetadata({
  params
}: {
  params: Promise<{ network: string; category: string; serviceSlug: string }>
}): Promise<Metadata> {
  const { network, category, serviceSlug } = await params;
  const reqHeaders = await headers();
  const tenantId = normalizeTenantId(reqHeaders.get('x-tenant-id'));
  const siteName = getTenantSiteName(tenantId);

  const service = await getServiceBySlugAction(serviceSlug, tenantId);
  if (!service || !service.category || !service.category.network) {
    return { title: "Услуга не найдена" };
  }

  const canonical = absoluteCanonical(tenantId, `/services/${network}/${category}/${serviceSlug}`);
  const title = `${service.name} — ${service.pricePerUnitRub.toFixed(4)} ₽ / шт | ${siteName}`;
  const description = service.description 
    ? `${service.description.slice(0, 150)}... Купить ${service.name} по цене от ${service.pricePerUnitRub.toFixed(4)} ₽ за шт.`
    : `Быстрый заказ ${service.name} в ${siteName}. Минимальный заказ ${service.minQty} шт., гарантия качества и высокая скорость исполнения.`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName,
      type: "website",
      locale: 'ru_RU',
    },
    robots: { index: true, follow: true },
  };
}

export default async function ServiceDetailPage({
  params
}: {
  params: Promise<{ network: string; category: string; serviceSlug: string }>
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { network, category, serviceSlug } = await params;
  const reqHeaders = await headers();
  const tenantId = normalizeTenantId(reqHeaders.get('x-tenant-id'));
  const siteName = getTenantSiteName(tenantId);
  const host = getTenantHost(tenantId);

  const service = await getServiceBySlugAction(serviceSlug, tenantId);
  if (!service || !service.category || !service.category.network) {
    notFound();
  }

  const net = service.category.network;
  const cat = service.category;
  const pageUrl = `https://${host}/services/${net.slug}/${cat.slug}/${service.slug}`;

  // Хлебные крошки JSON-LD
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Главная", "item": `https://${host}` },
      { "@type": "ListItem", "position": 2, "name": "Услуги", "item": `https://${host}/services` },
      { "@type": "ListItem", "position": 3, "name": net.name, "item": `https://${host}/services/${net.slug}` },
      { "@type": "ListItem", "position": 4, "name": cat.name, "item": `https://${host}/services/${net.slug}/${cat.slug}` },
      { "@type": "ListItem", "position": 5, "name": service.name, "item": pageUrl },
    ],
  };

  // Service + Offer JSON-LD
  const serviceData = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": service.name,
    "description": service.description || `Услуга ${service.name} для продвижения в ${net.name}.`,
    "provider": {
      "@type": "Organization",
      "name": siteName,
      "url": `https://${host}`,
    },
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": cat.name,
    },
    "offers": {
      "@type": "Offer",
      "priceCurrency": "RUB",
      "price": String(service.pricePer1kRub),
      "url": pageUrl,
      "availability": "https://schema.org/InStock",
    },
  };

  const faqItems = getFaqForCategory(net.slug, cat.slug);

  // Смежные услуги категории
  const siblingServices = await db.service.findMany({
    where: {
      categoryId: cat.id,
      id: { not: service.id },
      isActive: true,
      isQuarantined: false,
      slug: { not: null }
    },
    take: 4,
    select: { id: true, name: true, slug: true, rate: true, markup: true }
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <Header siteName={siteName} activePath="/services" />

      <JsonLd data={breadcrumbData} />
      <JsonLd data={serviceData} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 space-y-8">
        {/* Breadcrumb UI */}
        <nav className="text-sm text-muted-foreground flex flex-wrap gap-2">
          <Link href="/" className="hover:text-foreground">Главная</Link> /
          <Link href="/services" className="hover:text-foreground">Услуги</Link> /
          <Link href={`/services/${net.slug}`} className="hover:text-foreground">{net.name}</Link> /
          <Link href={`/services/${net.slug}/${cat.slug}`} className="hover:text-foreground">{cat.name}</Link> /
          <span className="text-foreground font-semibold">{service.name}</span>
        </nav>

        {/* Hero Карточка услуги */}
        <div className="bg-card border border-border p-6 md:p-8 rounded-2xl shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold px-3 py-1 bg-primary/10 text-primary rounded-full uppercase tracking-wider">
                  {net.name} • {cat.name}
                </span>
                <ServiceIdBadge numericId={service.numericId} />
              </div>
              <h1 className="text-2xl md:text-4xl font-extrabold mt-2 text-foreground">{service.name}</h1>
            </div>
            <div className="text-left md:text-right bg-muted/40 p-4 rounded-xl border border-border/50 min-w-[200px]">
              <span className="text-xs text-muted-foreground block font-medium">Цена за 1 шт.</span>
              <span className="text-3xl font-black text-primary">{service.pricePerUnitRub.toFixed(4)} ₽</span>
              <span className="text-xs text-muted-foreground block mt-1 font-mono">/ шт</span>
            </div>
          </div>

          {/* Параметры & Характеристики */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-border pt-6 text-sm">
            <div>
              <span className="text-muted-foreground text-xs block">Мин. / Макс. заказ</span>
              <span className="font-semibold">{service.minQty.toLocaleString()} / {service.maxQty.toLocaleString()} шт.</span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs block">Скорость (ETA)</span>
              <span className="font-semibold">{service.etaSpeedClass || 'Обычная'}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs block">Drip-Feed / Автозаказ</span>
              <span className="font-semibold">{service.isDripFeedEnabled ? '✅ Доступно' : '❌ Нет'}</span>
            </div>
            <div>
              <span className="text-muted-foreground text-xs block">Автодокрутка (Refill)</span>
              <span className="font-semibold">{service.isRefillEnabled ? '✅ Доступно' : '❌ Нет'}</span>
            </div>
          </div>

          {/* Предупреждения и Инструкция */}
          {service.warningMessage && (
            <div className="bg-warning/10 border-l-4 border-warning p-4 rounded-r-lg text-sm text-warning-foreground">
              <p className="font-bold">⚠️ Внимание при заказе:</p>
              <p>{service.warningMessage}</p>
            </div>
          )}

          {/* Описание */}
          {service.description && (
            <div className="border-t border-border pt-6 space-y-2">
              <h2 className="text-lg font-bold text-foreground">Подробности услуги</h2>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {service.description}
              </p>
            </div>
          )}

          <div className="pt-4 flex gap-4">
            <Link
              href={`/dashboard/new-order?serviceId=${service.id}`}
              className="px-8 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all shadow-md"
            >
              Заказать услугу
            </Link>
          </div>
        </div>

        {/* Смежные услуги */}
        {siblingServices.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-foreground">Другие тарифы в категории {cat.name}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {siblingServices.map(s => (
                <Link
                  key={s.id}
                  href={`/services/${net.slug}/${cat.slug}/${s.slug}`}
                  className="p-4 bg-card border border-border rounded-xl hover:border-primary/50 transition-all block group"
                >
                  <p className="font-bold group-hover:text-primary transition-colors text-sm">{s.name}</p>
                  <span className="text-xs text-muted-foreground mt-1 block">Перейти к тарифу →</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <FAQSection items={faqItems} title={`Часто задаваемые вопросы по услуге ${service.name}`} />
      </main>

      <MegaFooter tenantId={tenantId} />
    </div>
  );
}
