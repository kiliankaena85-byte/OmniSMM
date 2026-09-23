import { db as prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { draftMode, headers } from "next/headers";
import parse, { DOMNode, Element } from "html-react-parser";
import Link from "next/link";
import { absoluteCanonical, getTenantSiteName, normalizeTenantId } from "@/lib/seo-helpers";
import { FluxBadge, FluxButton, FluxCard } from "@/components/ui";
import { Calendar, User, Clock, ArrowLeft, ShoppingBag } from "lucide-react";

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const resolvedParams = await params;
  const reqHeaders = await headers();
  const tenantId = normalizeTenantId(reqHeaders.get('x-tenant-id'));
  const siteName = getTenantSiteName(tenantId);

  const post = await prisma.contentItem.findUnique({
    where: { slug: resolvedParams.slug },
    select: { title: true, metaTitle: true, metaDescription: true, coverImage: true },
  });

  if (!post) return { title: `Страница не найдена | ${siteName}` };

  const canonical = absoluteCanonical(tenantId, `/p/${resolvedParams.slug}`);

  return {
    title: `${post.metaTitle || post.title} | ${siteName}`,
    description: post.metaDescription || "",
    alternates: { canonical },
    openGraph: {
      title: post.metaTitle || post.title,
      url: canonical,
      siteName,
      images: post.coverImage ? [post.coverImage] : [],
    },
    robots: { index: true, follow: true },
  };
}

const parserOptions = {
  replace: (domNode: DOMNode) => {
    if (domNode instanceof Element && domNode.attribs) {
      if (domNode.attribs["data-custom-type"] === "service" && domNode.attribs["data-id"]) {
        return (
          <div className="my-8 p-6 border border-purple-500/20 rounded-[2rem] bg-card/80 backdrop-blur-xl shadow-lg">
            <h3 className="text-lg font-black text-foreground mb-2 flex items-center gap-2">
              <span className="text-purple-600">🔥</span> Рекомендуемая услуга
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Быстрый запуск тарифа ID: #{domNode.attribs["data-id"]}
            </p>
            <Link href="/">
              <FluxButton variant="primary" size="sm">
                Заказать со скидкой
              </FluxButton>
            </Link>
          </div>
        );
      }
    }
  },
};

export default async function CMSPage({ params }: PageProps) {
  const resolvedParams = await params;
  const draft = await draftMode();
  const isDraft = draft.isEnabled;
  const reqHeaders = await headers();
  const tenantId = normalizeTenantId(reqHeaders.get('x-tenant-id'));
  const isFlux = tenantId === 'flux';
  const siteName = getTenantSiteName(tenantId);

  const post = await prisma.contentItem.findUnique({
    where: { slug: resolvedParams.slug },
  });

  if (!post) {
    notFound();
  }

  if (!post.isPublished && !isDraft) {
    notFound();
  }

  let finalHtml = post.contentHtml || "";

  if (isDraft && post.contentJson) {
    const { ServerBlockNoteEditor } = await import("@blocknote/server-util");
    const editor = ServerBlockNoteEditor.create();
    try {
      const blocks = JSON.parse(post.contentJson);
      finalHtml = await editor.blocksToHTMLLossy(blocks);
    } catch (e) {
      console.error("Draft parsing error", e);
      finalHtml = "<p>Ошибка предпросмотра черновика</p>";
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground pt-12 pb-20 relative overflow-x-clip font-sans">
      {/* Radiant Aurora Mesh Backdrop for SMMflux */}
      {isFlux && (
        <div className="absolute top-0 inset-x-0 h-[1200px] z-0 pointer-events-none overflow-hidden select-none bg-white dark:bg-default-50">
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
        </div>
      )}

      {/* Draft Mode Alert */}
      {isDraft && (
        <div className="fixed top-0 left-0 w-full bg-warning text-warning-foreground text-center py-2.5 z-50 flex items-center justify-center gap-4 shadow-md font-bold text-sm">
          <span>⚠️ Внимание: Вы просматриваете черновик (Draft Mode)</span>
          <Link href={`/api/draft/disable?slug=${post.slug}`}>
            <FluxButton variant="outline" size="sm">Выйти</FluxButton>
          </Link>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-foreground hover:text-purple-600 px-4 py-2 rounded-full bg-card/85 backdrop-blur-xl border border-border/80 shadow-sm transition-all">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>На главную {siteName}</span>
          </Link>

          <Link href="/">
            <FluxButton variant="primary" size="sm" rightIcon={<ShoppingBag className="w-3.5 h-3.5" />}>
              Заказать продвижение
            </FluxButton>
          </Link>
        </div>

        <FluxCard variant="glass" padding="xl" className="mb-12">
          <header className="text-center space-y-4">
            {post.categoryId && (
              <div className="flex justify-center">
                <FluxBadge variant="primary" pulse>
                  {siteName} Эксперт
                </FluxBadge>
              </div>
            )}
            <h1 className="text-3xl sm:text-5xl font-black text-foreground tracking-tight leading-tight">
              {post.title}
            </h1>
            {post.metaDescription && (
              <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                {post.metaDescription}
              </p>
            )}
            <div className="pt-4 border-t border-border/40 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
              {post.authorName && (
                <span className="flex items-center gap-1.5 font-bold text-foreground">
                  <User className="w-3.5 h-3.5 text-purple-600" />
                  {post.authorName}
                </span>
              )}
              {post.publishedAt && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {post.publishedAt.toLocaleDateString("ru-RU")}
                </span>
              )}
              {post.readTimeMinutes && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {post.readTimeMinutes} мин. чтения
                </span>
              )}
            </div>
          </header>
        </FluxCard>

        {post.coverImage && (
          <div className="mb-12 rounded-[2.5rem] overflow-hidden shadow-2xl border border-border/60">
            <img 
              src={post.coverImage} 
              alt={post.title} 
              className="w-full h-auto object-cover max-h-[500px]"
            />
          </div>
        )}

        <FluxCard variant="glass" padding="xl" className="prose dark:prose-invert max-w-none text-foreground leading-relaxed text-sm sm:text-base font-normal prose-headings:font-black prose-headings:tracking-tight prose-a:text-purple-600 hover:prose-a:underline">
          {parse(finalHtml, parserOptions)}
        </FluxCard>
      </div>
    </main>
  );
}
