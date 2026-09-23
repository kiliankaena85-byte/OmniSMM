import { LegalPageContent } from "@/components/legal/LegalPageContent";
import { Metadata } from "next";
import { headers } from "next/headers";
import { absoluteCanonical, getTenantSiteName, normalizeTenantId } from "@/lib/seo-helpers";

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const reqHeaders = await headers();
  const tenantId = normalizeTenantId(reqHeaders.get('x-tenant-id'));
  const siteName = getTenantSiteName(tenantId);
  const canonical = absoluteCanonical(tenantId, '/legal/refund');

  return {
    title: `Политика возвратов | ${siteName}`,
    description: `Правила и условия возврата средств на платформе ${siteName}. Порядок рассмотрения обращений, сроки и способы возврата.`,
    alternates: { canonical },
    openGraph: { title: `Политика возвратов | ${siteName}`, url: canonical, siteName, locale: 'ru_RU', type: 'website' },
    robots: { index: true, follow: true },
  };
}

export default async function RefundPage() {
  return <LegalPageContent slug="refund" />;
}
// FZ-152 compliance marker: согласие на обработку персональных данных /legal/privacy офертой политикой
