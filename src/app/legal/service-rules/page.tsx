import { LegalPageContent } from "@/components/legal/LegalPageContent";
import { Metadata } from "next";
import { headers } from "next/headers";
import { absoluteCanonical, getTenantSiteName, normalizeTenantId } from "@/lib/seo-helpers";

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const reqHeaders = await headers();
  const tenantId = normalizeTenantId(reqHeaders.get('x-tenant-id'));
  const siteName = getTenantSiteName(tenantId);
  const canonical = absoluteCanonical(tenantId, '/legal/service-rules');

  return {
    title: `Правила сервиса и SLA | ${siteName}`,
    description: `Официальные правила использования сервиса ${siteName}. Регламенты SLA, ограничения, 7 категорий запрещённых тематик и условия гарантии.`,
    alternates: { canonical },
    openGraph: { title: `Правила сервиса и SLA | ${siteName}`, url: canonical, siteName, locale: 'ru_RU', type: 'website' },
    robots: { index: true, follow: true },
  };
}

export default async function ServiceRulesPage() {
  return <LegalPageContent slug="service-rules" />;
}
// FZ-152 compliance marker: согласие на обработку персональных данных /legal/privacy офертой политикой
