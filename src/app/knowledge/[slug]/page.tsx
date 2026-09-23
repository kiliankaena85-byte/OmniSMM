import { getArticleBySlug, getRecommendedServicesForArticle, getRelatedArticles } from "@/actions/knowledge";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import React from "react";
import { db } from "@/lib/db";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { JsonLd } from "@/components/seo/JsonLd";
import { headers } from "next/headers";
import { SettingsProvider } from "@/lib/settings";
import { applyBeautifulRounding } from "@/lib/financial-constants";
import { UrlMatcherWidget } from "./UrlMatcherWidget";
import { verifySession } from "@/lib/session";
import { Header } from "@/components/landing/Header";
import { MegaFooter } from "@/components/landing/MegaFooter";
import { absoluteCanonical, getTenantHost, getTenantSiteName, normalizeTenantId } from "@/lib/seo-helpers";
import { pillarPages, glossaryTerms, clusterArticles } from "@/data/seo";
import { FluxArticleReader } from "@/components/knowledge/flux/FluxArticleReader";
import { sanitizeArticleHtml } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getArticleBySlug(slug);

  const reqHeaders = await headers();
  const tenantId = normalizeTenantId(reqHeaders.get('x-tenant-id'));
  const siteName = getTenantSiteName(tenantId);

  if (!result.success || !result.article) {
    return { title: `Статья не найдена | ${siteName}` };
  }
  const canonical = absoluteCanonical(tenantId, `/knowledge/${slug}`);

  const { title, description } = result.article;
  return {
    title: `${title} | ${siteName}`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${title} | ${siteName}`,
      description,
      url: canonical,
      siteName,
      type: "article",
      locale: 'ru_RU',
    },
    robots: { index: true, follow: true },
  };
}

/**
 * Custom safe markdown renderer converting basic markdown tokens to secure React nodes
 * prevents any unsafe raw HTML rendering.
 */
function renderMarkdown(content: string): React.ReactNode[] {
  const lines = content.split("\n");
  let insideList = false;
  let listItems: React.ReactNode[] = [];
  const elements: React.ReactNode[] = [];

  // Parse inline structures (bold and links) safely
  const renderInline = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;
    const regex = /(\*\*.*?\*\*|\[.*?\]\(.*?\))/g;
    let match;
    let keyCounter = 0;

    while ((match = regex.exec(text)) !== null) {
      const matchStr = match[0];
      const matchIndex = match.index;

      if (matchIndex > currentIndex) {
        parts.push(text.substring(currentIndex, matchIndex));
      }

      if (matchStr.startsWith("**") && matchStr.endsWith("**")) {
        const boldText = matchStr.substring(2, matchStr.length - 2);
        parts.push(
          <strong key={`bold-${keyCounter++}`} className="font-extrabold text-foreground">
            {boldText}
          </strong>
        );
      } else if (matchStr.startsWith("[") && matchStr.includes("](")) {
        const closeBracket = matchStr.indexOf("]");
        const linkText = matchStr.substring(1, closeBracket);
        const linkUrl = matchStr.substring(closeBracket + 2, matchStr.length - 1);
        
        parts.push(
          <a
            key={`link-${keyCounter++}`}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:opacity-90 transition-opacity"
          >
            {linkText}
          </a>
        );
      }

      currentIndex = regex.lastIndex;
    }

    if (currentIndex < text.length) {
      parts.push(text.substring(currentIndex));
    }

    return parts.length > 0 ? parts : [text];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const itemText = trimmed.substring(2);
      listItems.push(
        <li key={`li-${index}`} className="mb-2 leading-relaxed pl-1 text-sm md:text-base text-foreground/90">
          {renderInline(itemText)}
        </li>
      );
      insideList = true;
    } else {
      if (insideList) {
        elements.push(
          <ul key={`ul-${index}`} className="list-disc list-inside mb-6 pl-4 space-y-1 text-foreground/80">
            {listItems}
          </ul>
        );
        listItems = [];
        insideList = false;
      }

      if (trimmed === "") {
        return;
      }

      if (trimmed.startsWith("### ")) {
        elements.push(
          <h3 key={`h3-${index}`} className="text-lg md:text-xl font-bold mt-6 mb-3 text-foreground tracking-tight">
            {renderInline(trimmed.substring(4))}
          </h3>
        );
      } else if (trimmed.startsWith("## ")) {
        elements.push(
          <h2 key={`h2-${index}`} className="text-xl md:text-2xl font-extrabold mt-8 mb-4 text-foreground tracking-tight border-b border-border/40 pb-2">
            {renderInline(trimmed.substring(3))}
          </h2>
        );
      } else if (trimmed.startsWith("# ")) {
        elements.push(
          <h1 key={`h1-${index}`} className="text-2xl md:text-3xl font-black mt-8 mb-4 text-foreground tracking-tight">
            {renderInline(trimmed.substring(2))}
          </h1>
        );
      } else {
        elements.push(
          <p key={`p-${index}`} className="mb-5 text-sm md:text-base leading-relaxed text-foreground/90">
            {renderInline(trimmed)}
          </p>
        );
      }
    }
  });

  if (insideList) {
    elements.push(
      <ul key="ul-end" className="list-disc list-inside mb-6 pl-4 space-y-1 text-foreground/80">
        {listItems}
      </ul>
    );
  }

  return elements;
}

export default async function ArticleDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getArticleBySlug(slug);

  if (!result.success || !result.article) {
    notFound();
  }

  const { article } = result;

  // Resolve user session and email
  const session = await verifySession();
  const userEmail = session?.userId 
    ? (await db.user.findUnique({ where: { id: session.userId }, select: { email: true } }))?.email 
    : undefined;

  const reqHeaders = await headers();
  const tenantId = normalizeTenantId(reqHeaders.get("x-tenant-id"));
  const isFlux = tenantId === 'flux';

  // Resolve settings and siteName
  const settings = await SettingsProvider.getContactAndLegalSettings();
  const siteName = isFlux ? "SMMflux" : (getTenantSiteName(tenantId) || settings.SITE_NAME || "SMMplan");
  const host = getTenantHost(tenantId);
  const canonical = absoluteCanonical(tenantId, `/knowledge/${article.slug}`);

  // Parallel data fetching for conversion recommended services and same category related articles
  const [recommendedServices, relatedResult] = await Promise.all([
    getRecommendedServicesForArticle(article.id),
    getRelatedArticles(article.id, article.category)
  ]);

  const relatedArticles = relatedResult.success ? relatedResult.articles : [];

  // Query all active services for this category to pass to the matcher widget
  const allCategoryServices = await db.service.findMany({
    where: {
      isActive: true,
      isQuarantined: false,
      category: {
        name: {
          contains: article.category,
          mode: "insensitive"
        }
      }
    },
    include: {
      category: true
    }
  });

  const usdToRub = await SettingsProvider.getExchangeRateUSD();
  
  const mappedServicesForWidget = allCategoryServices.map(s => {
    const exchangeRate = s.providerCurrency === 'RUB' ? 1.0 : usdToRub;
    const pricePer1kRub = applyBeautifulRounding(s.rate * s.markup * exchangeRate);
    const pricePerUnitRub = pricePer1kRub / 1000;
    return {
      id: s.id,
      name: s.name,
      targetType: s.targetType,
      pricePerUnitRub,
      categoryName: s.category.name
    };
  });

  const dateStr = new Date(article.createdAt).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  // Find matching pillar, cluster, or glossary term for structured schema extensions
  const currentPillar = pillarPages.find(p => p.slug === article.slug);
  const currentCluster = clusterArticles.find(c => c.slug === article.slug);
  const currentGlossary = glossaryTerms.find(g => g.slug === article.slug || g.slug === `glossary/${article.slug}`);

  // Resolve parent pillar for cluster breadcrumbs
  const parentPillarObj = currentCluster ? pillarPages.find(p => p.slug === currentCluster.parentPillar) : null;

  const breadcrumbItems = [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Главная",
      "item": `https://${host}`
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "База знаний",
      "item": `https://${host}/knowledge`
    }
  ];

  if (parentPillarObj) {
    breadcrumbItems.push({
      "@type": "ListItem",
      "position": 3,
      "name": parentPillarObj.title,
      "item": `https://${host}/knowledge/${parentPillarObj.slug}`
    });
    breadcrumbItems.push({
      "@type": "ListItem",
      "position": 4,
      "name": article.title,
      "item": canonical
    });
  } else {
    breadcrumbItems.push({
      "@type": "ListItem",
      "position": 3,
      "name": article.title,
      "item": canonical
    });
  }

  // Schema.org structured data setup
    const schemas: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": article.title,
      "description": article.description,
      "articleBody": article.content,
      "datePublished": article.createdAt.toISOString(),
      "dateModified": article.updatedAt.toISOString(),
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": canonical,
      },
      "author": {
        "@type": "Organization",
        "name": article.authorName || siteName,
        "url": `https://${host}`,
      },
      "publisher": {
        "@type": "Organization",
        "name": siteName,
        "url": `https://${host}`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": breadcrumbItems
    }
  ];

  const activeFaq = currentPillar?.faq || currentCluster?.faq;
  if (activeFaq && activeFaq.length > 0) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": activeFaq.map(item => ({
        "@type": "Question",
        "name": item.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": item.answer
        }
      }))
    });
  }

  if (currentGlossary) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "DefinedTerm",
      "name": currentGlossary.term,
      "description": currentGlossary.definition,
      "inDefinedTermSet": `https://${host}/knowledge`
    });
  }

  // Safe serialization preventing XSS injection inside raw scripts
  const escapedJsonLd = JSON.stringify(schemas).replace(/</g, '\\u003c');

  if (isFlux) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans flex flex-col relative overflow-x-clip">
        {/* SMMFLUX RADIANT HERO BACKGROUND (Matching main page) */}
        <div className="absolute top-0 inset-x-0 h-[1800px] z-0 pointer-events-none overflow-hidden select-none bg-white dark:bg-default-50">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(65% 55% at 15% 0%, rgba(59, 130, 246, 0.55), transparent 70%), ' +
                'radial-gradient(55% 55% at 85% 5%, rgba(56, 189, 248, 0.45), transparent 70%), ' +
                'radial-gradient(65% 55% at 20% 40%, rgba(244, 63, 94, 0.45), transparent 70%), ' +
                'radial-gradient(55% 55% at 80% 50%, rgba(249, 115, 22, 0.40), transparent 70%), ' +
                'radial-gradient(70% 70% at 50% 25%, rgba(217, 70, 239, 0.50), transparent 75%)',
            }}
          />
          <div className="absolute top-0 left-[2%] w-[700px] h-[700px] rounded-full bg-blue-500/35 blur-[120px] pointer-events-none" />
          <div className="absolute top-4 left-[25%] w-[650px] h-[650px] rounded-full bg-purple-600/40 blur-[110px] pointer-events-none" />
          <div className="absolute top-0 right-[5%] w-[700px] h-[700px] rounded-full bg-pink-500/35 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 inset-x-0 h-[300px] bg-gradient-to-t from-background to-transparent" />
        </div>

        <Header initialEmail={userEmail} siteName={siteName} tenantId={tenantId} activePath="/knowledge" />
        
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: escapedJsonLd }}
        />

        <main className="flex-1 w-full relative z-10">
          <FluxArticleReader
            article={article}
            renderedMarkdown={renderMarkdown(article.content)}
            relatedArticles={relatedArticles}
            recommendedServices={recommendedServices}
            allCategoryServices={mappedServicesForWidget}
          />
        </main>

        <MegaFooter contactSettings={settings} tenantId={tenantId} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col relative overflow-x-clip">
      
      {/* ── Abstract Soft Background ── */}
      <div className="absolute top-0 inset-x-0 h-[600px] z-[-1] pointer-events-none overflow-hidden premium-grid-backdrop" />
      <div className="absolute top-0 inset-x-0 h-[600px] z-[-1] pointer-events-none overflow-hidden bg-gradient-to-b from-primary/5 to-background" />

      {/* ── Секция 1: Шапка ── */}
      <Header initialEmail={userEmail} siteName={siteName} tenantId={tenantId} activePath="/knowledge" />

      {/* Dynamic JSON-LD injection */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: escapedJsonLd }}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-12 relative z-10 flex flex-col items-center">
        <div className="w-full max-w-6xl space-y-6">
          
          {/* Breadcrumbs Component */}
          <nav 
            aria-label="Breadcrumbs"
            className="flex flex-wrap items-center gap-2 text-xs md:text-sm font-medium text-muted-foreground select-none bg-card border border-border/80 px-4 py-1 rounded-xl shadow-sm"
          >
            <Link 
              href="/" 
              className="hover:text-primary transition-all duration-200 min-h-[44px] flex items-center"
            >
              Главная
            </Link>
            <span className="text-muted-foreground/50">/</span>
            
            <Link 
              href="/knowledge" 
              className="hover:text-primary transition-all duration-200 min-h-[44px] flex items-center"
            >
              База знаний
            </Link>
            <span className="text-muted-foreground/50">/</span>
            
            <Link 
              href={`/knowledge?category=${encodeURIComponent(article.category)}`} 
              className="hover:text-primary transition-all duration-200 min-h-[44px] flex items-center"
            >
              {article.category}
            </Link>
            <span className="text-muted-foreground/50">/</span>
            
            {parentPillarObj && (
              <>
                <Link 
                  href={`/knowledge/${parentPillarObj.slug}`} 
                  className="hover:text-primary transition-all duration-200 min-h-[44px] flex items-center"
                >
                  {parentPillarObj.title}
                </Link>
                <span className="text-muted-foreground/50">/</span>
              </>
            )}

            <span className="text-foreground font-semibold truncate max-w-[200px] md:max-w-[400px]">
              {article.title}
            </span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Main Article Body & Related Articles column */}
            <div className="lg:col-span-2 space-y-6">
              <article className="bg-card rounded-2xl border border-border/80 p-6 md:p-8 shadow-sm">
                {/* Header info */}
                <div className="space-y-4 mb-6">
                  <span className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">
                    {article.category}
                  </span>
                  <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight leading-tight">
                    {article.title}
                  </h1>
                  
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground font-medium pt-2 border-t border-border/40">
                    <span>{article.authorName}</span>
                    <span>•</span>
                    <time dateTime={article.createdAt.toISOString()}>{dateStr}</time>
                    <span>•</span>
                    <span>👁️ {article.viewCount} просмотров</span>
                  </div>
                </div>

                {/* Author Card */}
                <div className="my-6 p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-center gap-4 transition-all duration-200">
                  <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-extrabold text-sm select-none shrink-0">
                    {article.authorName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-foreground truncate">{article.authorName}</div>
                    <div className="text-xs text-muted-foreground leading-normal">{article.authorRole}</div>
                  </div>
                  <div className="hidden sm:inline-block bg-primary/10 text-primary text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider select-none shrink-0">
                    Автор
                  </div>
                </div>

                {/* Content rendering: handles HTML strings and markdown */}
                <div className="prose max-w-none text-foreground/90 leading-relaxed font-sans border-b border-border/40 pb-6 mb-6">
                  {article.content.trim().startsWith("<") ? (
                    <div dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(article.content) }} />
                  ) : (
                    renderMarkdown(article.content)
                  )}
                </div>
              </article>

              {/* Related Articles Widget */}
              <section className="bg-card rounded-2xl border border-border/80 p-6 shadow-sm space-y-6">
                <h2 className="text-lg md:text-xl font-extrabold text-foreground tracking-tight border-b border-border/40 pb-2 flex items-center gap-2 select-none">
                  📚 Похожие статьи
                </h2>
                
                {relatedArticles.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic leading-relaxed">
                    Больше публикаций по этой теме пока нет. Рекомендуем заглянуть в раздел «{article.category}» позже!
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {relatedArticles.map((art) => {
                      const artDate = new Date(art.createdAt).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "long",
                        year: "numeric"
                      });
                      
                      return (
                        <Link
                          key={art.id}
                          href={`/knowledge/${art.slug}`}
                          className="group bg-background hover:bg-primary/5 border border-border hover:border-primary/30 p-4 rounded-xl flex flex-col justify-between transition-all duration-200 shadow-sm hover:shadow-md min-h-[150px]"
                        >
                          <div className="space-y-2">
                            <span className="inline-block text-[9px] font-bold text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-[3px]">
                              {art.category}
                            </span>
                            <h3 className="text-xs md:text-sm font-bold text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                              {art.title}
                            </h3>
                          </div>
                          
                          <div className="pt-2 flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/20 mt-4 select-none">
                            <time dateTime={art.createdAt.toString()}>{artDate}</time>
                            <span>👁️ {art.viewCount}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* Sidebar Widgets (Conversion & Pricing) */}
            <aside className="lg:col-span-1 space-y-6 sticky top-24 self-start">
              <div className="bg-card rounded-2xl border border-border/80 p-6 shadow-sm space-y-4">
                <h2 className="text-lg font-extrabold text-foreground tracking-tight border-b border-border/40 pb-2">
                  Рекомендуемые услуги
                </h2>
                
                {recommendedServices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Наши специалисты подбирают лучшие предложения для вас. Ознакомьтесь со всеми услугами в каталоге!
                  </p>
                ) : (
                  <div className="space-y-4">
                    {recommendedServices.map((s) => (
                      <div 
                        key={s.id} 
                        className="p-4 bg-background border border-border rounded-xl space-y-2 flex flex-col justify-between"
                      >
                        <div>
                          <span className="text-[10px] font-bold text-primary uppercase tracking-wider bg-primary/5 px-2 py-0.5 rounded-[3px]">
                            {s.categoryName}
                          </span>
                          <h3 className="text-sm font-bold text-foreground line-clamp-2 mt-1 leading-snug">
                            {s.name}
                          </h3>
                        </div>
                        
                        <div className="pt-2 flex items-center justify-between border-t border-border/30">
                          <div className="text-xs text-muted-foreground">
                             Цена за 1 шт:
                          </div>
                          <div className="text-sm font-extrabold text-foreground">
                            {s.pricePerUnitRub.toLocaleString("ru-RU", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 4
                            })} ₽ / шт
                          </div>
                        </div>

                        <Link
                          href={`/?serviceId=${s.id}`}
                          className="min-h-[44px] w-full px-4 py-2 bg-primary text-primary-foreground font-bold rounded-full text-xs flex items-center justify-center hover:opacity-95 transition-opacity mt-2 text-center shadow-sm"
                        >
                          Заказать услугу
                        </Link>
                      </div>
                    ))}
                  </div>
                )}

                <Link 
                  href="/services" 
                  className="min-h-[44px] w-full border border-primary text-primary font-bold rounded-full text-xs flex items-center justify-center hover:bg-primary/5 transition-colors text-center"
                >
                  Открыть полный каталог
                </Link>
              </div>

              <UrlMatcherWidget services={mappedServicesForWidget} />

              {/* Quick SMM Help Widget */}
              <div className="bg-card rounded-2xl border border-border/80 p-6 shadow-sm text-center space-y-3">
                <div className="text-3xl">🚀</div>
                <h3 className="text-md font-extrabold text-foreground">Нужна консультация?</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Наша служба поддержки работает ежедневно с 09:00 до 21:00 МСК. Напишите нам в Telegram и мы поможем подобрать оптимальные услуги продвижения.
                </p>
                <Link 
                  href="/support" 
                  className="min-h-[44px] inline-flex w-full items-center justify-center px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-full text-xs hover:opacity-95 transition-all"
                >
                  Связаться с нами
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </main>

      {/* ── Секция 3: Подвал ── */}
      <MegaFooter contactSettings={settings} tenantId={tenantId} />
    </div>
  );
}
