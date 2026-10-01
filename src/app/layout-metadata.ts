import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getTenantHost, normalizeTenantId } from '@/lib/seo-helpers';
import { SettingsProvider, getTenantFallbackBranding } from '@/lib/settings';

export async function generateMetadata(): Promise<Metadata> {
  const reqHeaders = await headers();
  const tenantId = normalizeTenantId(reqHeaders.get('x-tenant-id'));
  const rawHost = reqHeaders.get('host') || reqHeaders.get('x-forwarded-host') || getTenantHost(tenantId);
  const host = (rawHost.includes('0.0.0.0') || rawHost.includes('host.docker.internal')) ? getTenantHost(tenantId) : rawHost;
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const metadataBase = new URL(`${protocol}://${host}`);

  if (tenantId === 'flux') {
    return {
      title: {
        default: 'SMMflux — Быстрое продвижение для бизнеса',
        template: '%s | SMMflux',
      },
      description: 'Быстрая накрутка и продвижение в социальных сетях для бизнеса. Фокус на качество и скорость.',
      keywords: ['smm', 'накрутка', 'продвижение', 'smmflux', 'быстрый старт', 'подписчики telegram', 'просмотры vk'],
      openGraph: {
        type: 'website',
        locale: 'ru_RU',
        siteName: 'SMMflux',
        title: 'SMMflux — Быстрое продвижение для бизнеса',
        description: 'Быстрая накрутка и продвижение в социальных сетях для бизнеса. Фокус на качество и скорость.',
        images: [
          {
            url: '/images/og-flux.png',
            width: 1200,
            height: 630,
            alt: 'SMMflux — Платформа продвижения',
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'SMMflux — Быстрое продвижение для бизнеса',
        description: 'Быстрая накрутка и продвижение в социальных сетях для бизнеса.',
        images: ['/images/og-flux.png'],
      },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-video-preview': -1,
          'max-image-preview': 'large',
          'max-snippet': -1,
        },
      },
      metadataBase,
    };
  }

  if (tenantId !== 'smmplan') {
    const settings = await SettingsProvider.get(tenantId).catch(() => null);
    const branding = getTenantFallbackBranding(tenantId);
    const siteName = settings?.siteName || branding.name;
    const description = settings?.siteDescription || `Продвижение и накрутка в социальных сетях от ${siteName}. Быстрый старт и надежные исполнители.`;
    const logo = settings?.siteLogoUrl || '/images/og-smmplan.png';
    const favicon = settings?.siteFaviconUrl || '/favicon.ico';

    return {
      title: {
        default: `${siteName} — продвижение в социальных сетях`,
        template: `%s | ${siteName}`,
      },
      description,
      keywords: ['smm', 'продвижение', siteName.toLowerCase(), 'подписчики', 'лайки', 'просмотры', 'telegram', 'vk'],
      icons: {
        icon: favicon,
      },
      openGraph: {
        type: 'website',
        locale: 'ru_RU',
        siteName,
        title: `${siteName} — продвижение в социальных сетях`,
        description,
        images: [
          {
            url: logo,
            width: 1200,
            height: 630,
            alt: `${siteName} — Платформа продвижения`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${siteName} — продвижение в социальных сетях`,
        description,
        images: [logo],
      },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-video-preview': -1,
          'max-image-preview': 'large',
          'max-snippet': -1,
        },
      },
      metadataBase,
    };
  }

  return {
    title: {
      default: 'SMMplan — продвижение в социальных сетях',
      template: '%s | SMMplan',
    },
    description:
      'Продвижение подписчиков, лайков, просмотров для Instagram, TikTok, VK, YouTube. Быстрый старт, надежные исполнители, поддержка 9-21 МСК.',
    keywords: ['smm', 'продвижение', 'подписчики', 'лайки', 'instagram', 'tiktok', 'youtube', 'vk', 'telegram'],
    openGraph: {
      type: 'website',
      locale: 'ru_RU',
      siteName: 'SMMplan',
      title: 'SMMplan — продвижение в социальных сетях',
      description:
        'Продвижение подписчиков, лайков, просмотров. Быстрый старт, профессиональное выполнение, поддержка 9-21 МСК.',
      images: [
        {
          url: '/images/og-smmplan.png',
          width: 1200,
          height: 630,
          alt: 'SMMplan — API Платформа продвижения',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'SMMplan — продвижение в социальных сетях',
      description: 'API платформа продвижения: продвижение подписчиков, лайков, просмотров.',
      images: ['/images/og-smmplan.png'],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    metadataBase,
  };
}
