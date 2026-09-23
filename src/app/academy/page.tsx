import { db } from '@/lib/db';
import Link from 'next/link';
import { headers } from 'next/headers';
import { BookOpen, Clock, Eye, GraduationCap, ChevronRight, Zap, Sparkles } from 'lucide-react';
import { absoluteCanonical, getTenantSiteName, normalizeTenantId } from '@/lib/seo-helpers';
import { FluxButton, FluxBadge, FluxCard } from '@/components/ui';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const reqHeaders = await headers();
  const tenantId = normalizeTenantId(reqHeaders.get('x-tenant-id'));
  const siteName = getTenantSiteName(tenantId);
  const canonical = absoluteCanonical(tenantId, '/academy');

  return {
    title: `Академия SMM & База знаний | ${siteName}`,
    description: 'Экспертные руководства, лайфхаки и инструкции по безопасному продвижению в Telegram, Instagram, VK. Узнайте, как копировать ссылки и обходить списания.',
    alternates: { canonical },
    openGraph: {
      title: `Академия SMM | ${siteName}`,
      description: 'Экспертные руководства и пошаговые инструкции по продвижению.',
      url: canonical,
      siteName,
    },
  };
}

export default async function AcademyPage() {
  const reqHeaders = await headers();
  const tenantId = normalizeTenantId(reqHeaders.get('x-tenant-id'));
  const isFlux = tenantId === 'flux';
  const siteName = getTenantSiteName(tenantId);

  // Query all active published academy lessons
  const lessons = await db.contentItem.findMany({
    where: {
      type: 'ACADEMY_LESSON',
      isPublished: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      category: {
        select: {
          name: true,
        },
      },
    },
  });

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

      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-2xl border-b border-border/50 shadow-[0_4px_30px_rgba(0,0,0,0.01)]">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 shadow-sm">
              <Zap className="w-4 h-4 text-primary fill-current" />
            </div>
            <span className="text-xl font-extrabold tracking-normal text-foreground">
              {siteName}{' '}
              <span className="text-primary text-xs font-black px-2 py-0.5 rounded bg-primary/10 ml-1.5 uppercase">
                Академия
              </span>
            </span>
          </Link>

          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors border border-border/60 hover:bg-muted/30 px-4 py-2 rounded-full"
          >
            На главную
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-12 md:py-16 relative z-10">
        {/* Title Hub */}
        <div className="text-center space-y-4 mb-16 max-w-3xl mx-auto">
          <FluxBadge variant="primary" pulse icon={<GraduationCap className="w-3.5 h-3.5" />}>
            База знаний {siteName}
          </FluxBadge>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-tight">
            Управляйте{' '}
            <span className="bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent">
              алгоритмами
            </span>{' '}
            продвижения
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground font-medium max-w-xl mx-auto">
            Экспертные руководства, пошаговые инструкции по копированию ссылок, лимитам соцсетей и практикам эффективного продвижения.
          </p>
        </div>

        {/* LESSONS DIRECTORY GRID */}
        {lessons.length === 0 ? (
          <FluxCard variant="glass" padding="xl" className="max-w-2xl mx-auto text-center flex flex-col items-center justify-center min-h-[380px]">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 animate-pulse mb-4">
              <BookOpen className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-2xl font-extrabold text-foreground mb-2">Академия наполняется знаниями</h3>
            <p className="text-sm text-muted-foreground max-w-md leading-relaxed mb-6">
              Наши SMM-эксперты прямо сейчас готовят руководства по оформлению заказов, обходу алгоритмов списаний Telegram/VK и тонкостям продвижения.
            </p>
            <Link href="/">
              <FluxButton variant="primary" rightIcon={<ChevronRight className="w-4 h-4" />}>
                Запустить продвижение
              </FluxButton>
            </Link>
          </FluxCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {lessons.map((lesson) => (
              <FluxCard
                key={lesson.id}
                variant="glass"
                padding="lg"
                className="group flex flex-col h-full hover:shadow-[0_20px_50px_rgba(168,85,247,0.15)] transition-all duration-300 relative"
              >
                <div className="flex items-center justify-between gap-3 mb-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {lesson.category?.name ? (
                    <FluxBadge variant="primary" size="sm">
                      {lesson.category.name}
                    </FluxBadge>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground font-bold">Руководство</span>
                  )}
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{lesson.readTimeMinutes || 3} мин</span>
                  </div>
                </div>

                <h3 className="text-xl font-extrabold text-foreground group-hover:text-primary transition-colors leading-snug mb-3">
                  <Link href={`/academy/${lesson.slug}`} className="hover:underline">
                    {lesson.title}
                  </Link>
                </h3>

                <p className="text-xs font-semibold text-muted-foreground leading-relaxed mb-6 line-clamp-3">
                  {lesson.excerpt || 'Подробное методическое руководство по настройке продвижения в социальных сетях.'}
                </p>

                <div className="mt-auto pt-4 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground select-none">
                  <span className="font-bold flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-muted-foreground/60" />
                    {lesson.viewCount || 0} просмотров
                  </span>
                  <Link
                    href={`/academy/${lesson.slug}`}
                    className="flex items-center gap-1 font-extrabold text-primary group-hover:gap-2 transition-all"
                  >
                    <span>Читать</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </FluxCard>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-card/80 backdrop-blur-md border-t border-border/60 py-10 text-center select-none text-xs text-muted-foreground mt-24">
        <p>© {new Date().getFullYear()} {siteName} Academy. Все права защищены.</p>
        <p className="mt-1 text-[10px] text-muted-foreground/60">Экспертные SMM-руководства для физических лиц и реселлеров.</p>
      </footer>
    </div>
  );
}
