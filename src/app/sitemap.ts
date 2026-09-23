import { MetadataRoute } from 'next';
import { getPublicCatalogAction, getServicesByCategoryAction } from '@/actions/order/catalog';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { normalizeTenantId, getTenantHost, absoluteCanonical } from '@/lib/seo-helpers';

// sitemap.ts uses headers() -> force-dynamic
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const reqHeaders = await headers();
  const rawHost = reqHeaders.get('host') || reqHeaders.get('x-forwarded-host') || '';
  const tenantId = normalizeTenantId(reqHeaders.get('x-tenant-id') || (rawHost.includes('flux') ? 'flux' : 'smmplan'));
  
  const isLocalhost = rawHost.includes('localhost') || rawHost.includes('127.0.0.1');
  const protocol = isLocalhost ? 'http' : 'https';
  const canonicalHost = getTenantHost(tenantId, rawHost);
  const baseUrl = isLocalhost ? `${protocol}://${rawHost}` : `https://${canonicalHost}`;

  const routes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/services`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/knowledge`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/legal/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/legal/refund`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/legal/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ];

  // Catalog pages with Quality Gate (only categories with >=3 active, non-quarantined services)
  try {
    const catalogResult = await getPublicCatalogAction(tenantId);
    if (catalogResult.success && catalogResult.data) {
      for (const network of catalogResult.data) {
        routes.push({
          url: `${baseUrl}/services/${network.slug}`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.8,
        });

        for (const category of network.categories) {
          // Quality Gate: fetch services to verify eligibility before adding to sitemap (>=3 active services with price > 0)
          const services = await getServicesByCategoryAction(category.id, tenantId);
          const activeServices = services.filter(s => s.pricePerUnitRub > 0);
          const passesQualityGate = activeServices.length >= 3;
          
          if (passesQualityGate) {
            routes.push({
              url: `${baseUrl}/services/${network.slug}/${category.slug}`,
              lastModified: new Date(),
              changeFrequency: 'weekly',
              priority: 0.7,
            });

            // Добавление URL конкретных тарифных услуг категории
            for (const s of activeServices) {
              if (s.slug) {
                routes.push({
                  url: `${baseUrl}/services/${network.slug}/${category.slug}/${s.slug}`,
                  lastModified: new Date(),
                  changeFrequency: 'weekly',
                  priority: 0.6,
                });
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('[sitemap] Failed to generate catalog routes', error);
  }

  // Knowledge base articles
  try {
    const articles = await db.contentItem.findMany({
      where: {
        isPublished: true,
        type: { in: ['PAGE', 'NEWS_POST'] },
      },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });

    for (const article of articles) {
      if (article.slug) {
        routes.push({
          url: `${baseUrl}/knowledge/${article.slug}`,
          lastModified: article.updatedAt,
          changeFrequency: 'weekly',
          priority: 0.6,
        });
      }
    }
  } catch (error) {
    console.error('[sitemap] Failed to generate knowledge routes', error);
  }

  // Custom pages (/p/[slug]) — type PAGE that are published
  try {
    const pages = await db.contentItem.findMany({
      where: {
        isPublished: true,
        type: 'PAGE',
        // Only pages that don't have a knowledge-style slug prefix
        // Both knowledge and p/ share PAGE type, so we include all
      },
      select: { slug: true, updatedAt: true },
    });

    for (const page of pages) {
      if (page.slug) {
        routes.push({
          url: `${baseUrl}/p/${page.slug}`,
          lastModified: page.updatedAt,
          changeFrequency: 'monthly',
          priority: 0.5,
        });
      }
    }
  } catch (error) {
    console.error('[sitemap] Failed to generate /p/ routes', error);
  }

  // Academy lessons
  try {
    const lessons = await db.contentItem.findMany({
      where: {
        isPublished: true,
        type: 'ACADEMY_LESSON',
      },
      select: { slug: true, updatedAt: true },
    });

    for (const lesson of lessons) {
      if (lesson.slug) {
        routes.push({
          url: `${baseUrl}/academy/${lesson.slug}`,
          lastModified: lesson.updatedAt,
          changeFrequency: 'monthly',
          priority: 0.6,
        });
      }
    }
  } catch (error) {
    console.error('[sitemap] Failed to generate academy routes', error);
  }

  // Glossary terms
  try {
    const terms = await db.contentItem.findMany({
      where: {
        isPublished: true,
        type: 'GLOSSARY_TERM',
      },
      select: { slug: true, updatedAt: true },
    });

    for (const term of terms) {
      if (term.slug) {
        routes.push({
          url: `${baseUrl}/knowledge/glossary/${term.slug}`,
          lastModified: term.updatedAt,
          changeFrequency: 'monthly',
          priority: 0.5,
        });
      }
    }
  } catch (error) {
    console.error('[sitemap] Failed to generate glossary routes', error);
  }

  return routes;
}
