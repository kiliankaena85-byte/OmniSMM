import { db } from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { BookOpen, Clock, Eye, ChevronLeft, Calendar, UserCircle, ShoppingCart } from 'lucide-react';
import { absoluteCanonical, getTenantHost, getTenantSiteName, normalizeTenantId } from '@/lib/seo-helpers';
import { FluxBadge, FluxButton, FluxCard } from '@/components/ui';
import { sanitizeArticleHtml } from '@/lib/sanitize';

export const dynamic = 'force-dynamic';

interface AcademyArticlePageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: AcademyArticlePageProps) {
  const { slug } = await params;
  const reqHeaders = await headers();
  const tenantId = normalizeTenantId(reqHeaders.get('x-tenant-id'));
  const siteName = getTenantSiteName(tenantId);

  const article = await db.contentItem.findUnique({
    where: { slug, type: 'ACADEMY_LESSON', isPublished: true },
  });

  if (!article) {
    return {
      title: `Статья не найдена | ${siteName} Academy`,
    };
  }

  const canonical = absoluteCanonical(tenantId, `/academy/${slug}`);

  return {
    title: `${article.title} | Академия ${siteName}`,
    description: article.excerpt || article.metaDescription || `Методическое руководство: ${article.title}. Безопасное продвижение.`,
    alternates: { canonical },
    openGraph: {
      title: `${article.title} | ${siteName}`,
      description: article.excerpt || article.metaDescription || '',
      url: canonical,
      siteName,
    },
  };
}

export default async function AcademyArticlePage({ params }: AcademyArticlePageProps) {
  const { slug } = await params;
  const reqHeaders = await headers();
  const tenantId = normalizeTenantId(reqHeaders.get('x-tenant-id'));
  const isFlux = tenantId === 'flux';
  const siteName = getTenantSiteName(tenantId);
  const host = getTenantHost(tenantId);

  // Retrieve individual lesson
  const article = await db.contentItem.findUnique({
    where: {
      slug,
      type: 'ACADEMY_LESSON',
      isPublished: true,
    },
    include: {
      category: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!article) {
    notFound();
  }

  // Increment view count asynchronously in the background
  db.contentItem.update({
    where: { id: article.id },
    data: { viewCount: { increment: 1 } },
  }).catch((err) => console.error('[Academy API] Failed to increment view count:', err));

  const publishDate = article.publishedAt || article.createdAt;
  const readingTime = article.readTimeMinutes || 3;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-x-clip font-sans">
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
          <div className="absolute top-0 left-[5%] w-[600px] h-[600px] rounded-full bg-blue-500/30 blur-[120px] pointer-events-none" />
          <div className="absolute top-4 right-[5%] w-[600px] h-[600px] rounded-full bg-pink-500/30 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 inset-x-0 h-[300px] bg-gradient-to-t from-background to-transparent" />
        </div>
      )}

      {/* Structural Schema.org TechArticle Metadata for advanced indexing */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'TechArticle',
            headline: article.title,
            description: article.excerpt || article.metaTitle,
            inLanguage: 'ru',
            author: {
              '@type': 'Person',
              name: article.authorName || `Эксперт ${siteName}`,
            },
            datePublished: publishDate.toISOString(),
            dateModified: article.updatedAt.toISOString(),
            articleSection: article.category?.name || 'SMM',
            mainEntityOfPage: {
              '@type': 'WebPage',
              '@id': `https://${host}/academy/${article.slug}`,
            },
          }),
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-2xl border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/academy"
            className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Назад в Академию</span>
          </Link>

          <Link href="/">
            <FluxButton variant="primary" size="sm" rightIcon={<ShoppingCart className="w-3.5 h-3.5" />}>
              Заказать продвижение
            </FluxButton>
          </Link>
        </div>
      </header>

      {/* Main content (Typography Prose) */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-10 md:py-14 relative z-10">
        {/* Article header Card */}
        <FluxCard variant="glass" padding="xl" className="mb-10">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-muted-foreground uppercase tracking-widest select-none">
              {article.category?.name && (
                <FluxBadge variant="primary" size="sm">
                  {article.category.name}
                </FluxBadge>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{readingTime} мин на чтение</span>
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                <span>{article.viewCount + 1} просмотров</span>
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-foreground leading-tight">
              {article.title}
            </h1>

            {article.excerpt && (
              <p className="text-sm sm:text-base font-medium text-muted-foreground leading-relaxed italic border-l-4 border-purple-500 pl-4 py-1 bg-muted/30 rounded-r-2xl">
                {article.excerpt}
              </p>
            )}

            {/* Author metadata bar */}
            <div className="flex items-center gap-3 pt-4 border-t border-border/40 text-xs text-muted-foreground select-none">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                <UserCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="font-extrabold text-foreground">{article.authorName || `Автор Академии ${siteName}`}</p>
                <div className="flex items-center gap-1 mt-0.5 font-semibold text-[10px] tracking-wide uppercase">
                  <Calendar className="w-3 h-3 text-muted-foreground/60" />
                  <span>
                    {publishDate.toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </FluxCard>

        {/* ARTICLE HTML RENDER (Tailwind Typography Prose) */}
        <FluxCard variant="glass" padding="xl" className="prose dark:prose-invert max-w-none prose-base sm:prose-lg leading-relaxed prose-headings:font-extrabold prose-headings:tracking-tight prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-strong:font-black prose-img:rounded-3xl prose-img:border prose-img:border-border/60">
          {article.contentHtml ? (
            <div dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(article.contentHtml) }} />
          ) : (
            <p className="text-muted-foreground font-semibold">Статья находится на доработке и скоро будет доступна.</p>
          )}
        </FluxCard>

        {/* CONVERSION BOTTOM CALL TO ACTION (CTA) */}
        <FluxCard variant="glow" padding="xl" className="text-center space-y-4 mt-12 select-none relative overflow-hidden">
          <h3 className="text-2xl font-black text-foreground">💡 Готовы применить знания на практике?</h3>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto font-medium">
            Запустите продвижение ваших каналов или постов за 1 минуту прямо сейчас. Мгновенный автоматический старт без регистрации!
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-3 pt-2">
            <Link href="/">
              <FluxButton variant="primary" rightIcon={<ShoppingCart className="w-4 h-4" />}>
                Оформить заказ
              </FluxButton>
            </Link>
            <Link href="/academy">
              <FluxButton variant="outline" rightIcon={<BookOpen className="w-4 h-4" />}>
                Другие статьи
              </FluxButton>
            </Link>
          </div>
        </FluxCard>
      </main>

      {/* Footer */}
      <footer className="bg-card/80 backdrop-blur-md border-t border-border/60 py-8 text-center select-none text-xs text-muted-foreground mt-20">
        <p>© {new Date().getFullYear()} {siteName} Academy. Все права защищены.</p>
      </footer>
    </div>
  );
}
