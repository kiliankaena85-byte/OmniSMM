import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/sonner';
import { NetworkAwareProvider } from '@/components/providers/NetworkAwareProvider';
import { FloatingQADock } from '@/components/dev/FloatingQADock';
import { CookieConsent } from '@/components/common/CookieConsent';
import { getTenantHost, normalizeTenantId } from '@/lib/seo-helpers';

import { headers } from 'next/headers';

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

import { SettingsProvider } from '@/lib/settings';
import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { MaintenanceScreen } from '@/components/ui/MaintenanceScreen';
import { MaintenanceGuardian } from '@/components/providers/MaintenanceGuardian';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const reqHeaders = await headers();
  const pathname = reqHeaders.get('x-pathname') || '';
  
  const normalized = pathname.toLowerCase();
  const isStaticFile = /\.(png|jpg|jpeg|gif|webp|svg|ico|css|js|woff|woff2|ttf|map|json|xml|txt)$/i.test(normalized);
  const isExcluded = 
    normalized.startsWith('/admin') ||
    normalized.startsWith('/api') ||
    normalized === '/login' ||
    normalized.startsWith('/_next') ||
    isStaticFile;

  const tenantId = normalizeTenantId(reqHeaders.get('x-tenant-id')) || 'smmplan';
  const settings = await SettingsProvider.get(tenantId);
  const isMaintenanceMode = settings.maintenanceMode;
  
  let isStaff = false;
  
  if (isMaintenanceMode) {
    const session = await verifySession();
    if (session) {
      const user = await db.user.findUnique({
        where: { id: session.userId },
        select: { role: true }
      });
      if (user && (['OWNER', 'ADMIN', 'MANAGER', 'SUPPORT'].includes(user.role) || user.role === 'OPERATOR')) {
        isStaff = true;
      }
    }
  }

  const isFlux = tenantId === 'flux';
  const siteName = isFlux ? 'SMMflux' : (settings.siteName || 'SMMplan');
  const supportEmail = isFlux
    ? (settings.contactSupportEmail || 'support@smmflux.ru')
    : (settings.contactSupportEmail || 'support@smmplan.pro');

  const nonce = reqHeaders.get('x-nonce') || undefined;
  const host = reqHeaders.get('host') || reqHeaders.get('x-forwarded-host') || '';
  
  // Only pure isolated sandbox test subdomains bypass maintenance screen; official domains and Tailscale funnel nodes enforce it
  const isTestDomain = host.startsWith('test.') && !host.includes('.ts.net') && !host.includes('tailscale');

  const isMaintenanceModeForDomain = isMaintenanceMode && !isTestDomain;
  const showMaintenance = isMaintenanceModeForDomain && !isStaff && !isExcluded;

  const supportTelegram = settings.contactTelegramBot || 'smmplan_support_bot';

  if (showMaintenance) {
    return (
      <html lang="ru" className={`theme-${tenantId}`} suppressHydrationWarning>
        <head>
          <title>{siteName} — Сервисное обслуживание</title>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        </head>
        <body className="font-sans antialiased bg-background text-foreground" suppressHydrationWarning>
          <MaintenanceScreen
            siteName={siteName}
            supportTelegram={supportTelegram}
            supportEmail={supportEmail}
          />
        </body>
      </html>
    );
  }

  return (
    <html lang="ru" className={`theme-${tenantId}`} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {(() => {
          const rawHost = reqHeaders.get('host') || reqHeaders.get('x-forwarded-host') || '';
          const canonicalHost = getTenantHost(tenantId, rawHost);
          const isLocal = canonicalHost.includes('localhost') || canonicalHost.includes('127.0.0.1');
          const siteBaseUrl = `${isLocal ? 'http' : 'https'}://${canonicalHost}`;
          const nonce = reqHeaders.get('x-nonce') || undefined;

          return (
            <script
              type="application/ld+json"
              nonce={nonce}
              suppressHydrationWarning
              dangerouslySetInnerHTML={{ __html: JSON.stringify([
                {
                  "@context": "https://schema.org",
                  "@type": "Organization",
                  "name": siteName,
                  "url": siteBaseUrl,
                  "logo": `${siteBaseUrl}/images/logo.png`,
                  "contactPoint": {
                    "@type": "ContactPoint",
                    "contactType": "customer support",
                    "email": supportEmail,
                    "availableLanguage": "Russian",
                  },
                  "address": {
                    "@type": "PostalAddress",
                    "addressCountry": "RU",
                  },
                },
                {
                  "@context": "https://schema.org",
                  "@type": "WebSite",
                  "name": siteName,
                  "url": siteBaseUrl,
                  "potentialAction": {
                    "@type": "SearchAction",
                    "target": `${siteBaseUrl}/services?q={search_term_string}`,
                    "query-input": "required name=search_term_string",
                  },
                },
              ]).replace(/</g, '\\u003c') }}
            />
          );
        })()}
      </head>
      <body className={`font-sans antialiased bg-background text-foreground theme-${tenantId}`} suppressHydrationWarning>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg z-[9999] font-semibold outline-none focus:ring-2 focus:ring-primary transition-all">
          Перейти к основному контенту
        </a>
        <Providers nonce={nonce}>
          <NetworkAwareProvider>
             <MaintenanceGuardian
               {...(isMaintenanceModeForDomain && !isStaff ? { m: true } : {})}
             >
               {children}
             </MaintenanceGuardian>
          </NetworkAwareProvider>
          {(process.env.NODE_ENV === 'development' || process.env.ENABLE_QA_TOOLS === 'true') && (
            <FloatingQADock />
          )}
          {!normalized.startsWith('/admin') && <CookieConsent />}
        </Providers>
        <Toaster
          position="top-right"
          richColors
          closeButton
          duration={3500}
        />
      </body>
    </html>
  );
}
