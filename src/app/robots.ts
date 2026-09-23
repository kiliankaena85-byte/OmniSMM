import { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { getTenantHost, normalizeTenantId } from '@/lib/seo-helpers';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const reqHeaders = await headers();
  const rawHost = reqHeaders.get('host') || reqHeaders.get('x-forwarded-host') || '';
  const tenantId = normalizeTenantId(reqHeaders.get('x-tenant-id') || (rawHost.includes('flux') ? 'flux' : 'smmplan'));
  
  const isLocal = rawHost.includes('localhost') || rawHost.includes('127.0.0.1');
  const protocol = isLocal ? 'http' : 'https';
  const host = isLocal ? rawHost : getTenantHost(tenantId, rawHost);

  const disallowList = [
    '/api/',
    '/admin/',
  ];

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/services', '/knowledge', '/legal', '/_next/static', '/brands/'],
        disallow: disallowList,
      },
      {
        userAgent: ['GPTBot', 'PerplexityBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'YandexBot'],
        allow: ['/', '/services', '/knowledge', '/legal', '/llms.txt', '/brands/'],
        disallow: disallowList,
      }
    ],
    sitemap: `${protocol}://${host}/sitemap.xml`,
  };
}
