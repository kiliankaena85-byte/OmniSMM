import { db as prisma } from "@/lib/db";
import { Metadata } from "next";
import { headers } from "next/headers";
import { absoluteCanonical, normalizeTenantId } from "@/lib/seo-helpers";
import { LegalPageContent } from "@/components/legal/LegalPageContent";

export const revalidate = 3600; // Ревалидация раз в час

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const reqHeaders = await headers();
  const tenantId = normalizeTenantId(reqHeaders.get("x-tenant-id"));

  const post = await prisma.contentItem.findUnique({
    where: { slug: resolvedParams.slug },
    select: { title: true, metaTitle: true, metaDescription: true },
  });

  const canonical = absoluteCanonical(tenantId, `/legal/${resolvedParams.slug}`);

  if (!post) return { title: "Документ не найден", alternates: { canonical }, robots: { index: false, follow: false } };

  const title = post.metaTitle || post.title;
  const description = post.metaDescription || "";

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, locale: 'ru_RU', type: 'website' },
    robots: { index: true, follow: true },
  };
}

export default async function LegalPage({ params }: PageProps) {
  const resolvedParams = await params;
  return <LegalPageContent slug={resolvedParams.slug} />;
}
