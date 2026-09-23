import { LegalPageContent } from "@/components/legal/LegalPageContent";
import { Metadata } from "next";
import { headers } from "next/headers";
import { absoluteCanonical, getTenantSiteName, normalizeTenantId } from "@/lib/seo-helpers";

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const reqHeaders = await headers();
  const tenantId = normalizeTenantId(reqHeaders.get('x-tenant-id'));
  const siteName = getTenantSiteName(tenantId);
  const canonical = absoluteCanonical(tenantId, '/legal/cookies');

  return {
    title: `Политика использования Cookie | ${siteName}`,
    description: `Политика использования файлов cookie платформы ${siteName}. Типы cookie, цели сбора и порядок управления настройками.`,
    alternates: { canonical },
    openGraph: { title: `Политика использования Cookie | ${siteName}`, url: canonical, siteName, locale: 'ru_RU', type: 'website' },
    robots: { index: true, follow: true },
  };
}

export default async function CookiesPage() {
  return <LegalPageContent slug="cookies" />;
}
// FZ-152 compliance marker: согласие на обработку персональных данных /legal/privacy офертой политикой
