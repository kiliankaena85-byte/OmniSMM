import * as React from 'react';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/sonner';
import { NetworkAwareProvider } from '@/components/providers/NetworkAwareProvider';
import { FloatingQADock } from '@/components/dev/FloatingQADock';
import { CookieConsent } from '@/components/common/CookieConsent';
import { getTenantHost, normalizeTenantId } from '@/lib/seo-helpers';
import { SettingsProvider } from '@/lib/settings';
import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { MaintenanceScreen } from '@/components/ui/MaintenanceScreen';
import { MaintenanceGuardian } from '@/components/providers/MaintenanceGuardian';
import { TenantThemeInjector } from '@/components/theme/TenantThemeInjector';
import { YandexMetrika } from '@/components/analytics/YandexMetrika';
import { RootJsonLd } from '@/components/layout/root-jsonld';
import { headers } from 'next/headers';

export { generateMetadata } from './layout-metadata';

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
        select: { role: true },
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
          <TenantThemeInjector tenantId={tenantId} nonce={nonce} />
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

  const canonicalHost = getTenantHost(tenantId, host);
  const isLocal = canonicalHost.includes('localhost') || canonicalHost.includes('127.0.0.1');
  const siteBaseUrl = `${isLocal ? 'http' : 'https'}://${canonicalHost}`;

  return (
    <html lang="ru" className={`theme-${tenantId}`} suppressHydrationWarning>
      <head>
        <TenantThemeInjector tenantId={tenantId} nonce={nonce} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <RootJsonLd
          siteName={siteName}
          siteBaseUrl={siteBaseUrl}
          supportEmail={supportEmail}
          nonce={nonce}
        />
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
          {!normalized.startsWith('/admin') && !normalized.startsWith('/depin') && <CookieConsent />}
          <YandexMetrika nonce={nonce} />
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
