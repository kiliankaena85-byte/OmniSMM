import { getPublicCatalogAction } from "@/actions/order/catalog";
import { getArticles } from "@/actions/knowledge";
import Link from "next/link";
import { BookOpen, Info, ArrowRight, Sparkles } from "lucide-react";
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { absoluteCanonical, getTenantSiteName, normalizeTenantId } from '@/lib/seo-helpers';
import { SettingsProvider } from "@/lib/settings";
import { verifySession } from "@/lib/session";
import { db } from "@/lib/db";
import { Header } from "@/components/landing/Header";
import { MegaFooter } from "@/components/landing/MegaFooter";
import { FluxServicesCatalog } from "@/components/services/flux/FluxServicesCatalog";

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const reqHeaders = await headers();
  const tenantId = normalizeTenantId(reqHeaders.get('x-tenant-id'));
  const siteName = getTenantSiteName(tenantId);
  const canonical = absoluteCanonical(tenantId, '/services');

  return {
    title: `Каталог услуг для социальных сетей | ${siteName}`,
    description: `Все доступные услуги для продвижения в социальных сетях на платформе ${siteName}. Telegram, ВКонтакте, Instagram, YouTube и другие.`,
    alternates: {
      canonical: canonical,
    },
    openGraph: {
      title: `Каталог услуг | ${siteName}`,
      description: 'Выберите социальную сеть для продвижения',
      url: canonical,
      siteName: siteName,
      locale: 'ru_RU',
      type: 'website',
    },
    robots: { index: true, follow: true },
  };
}

export default async function ServicesCatalogPage() {
  const reqHeaders = await headers();
  const tenantId = normalizeTenantId(reqHeaders.get('x-tenant-id'));
  const isFlux = tenantId === 'flux';

  // Resolve session & settings
  const session = await verifySession();
  const userEmail = session?.userId 
    ? (await db.user.findUnique({ where: { id: session.userId }, select: { email: true } }))?.email 
    : undefined;

  const settings = await SettingsProvider.getContactAndLegalSettings();
  const siteName = isFlux ? "SMMflux" : (getTenantSiteName(tenantId) || settings.SITE_NAME || "SMMplan");

  // Parallel fetch catalog networks and featured articles
  const [catalogResult, articlesResult] = await Promise.all([
    getPublicCatalogAction(tenantId),
    getArticles()
  ]);

  const networks = catalogResult.success && catalogResult.data ? catalogResult.data : [];
  const featuredArticles = articlesResult.success && articlesResult.articles 
    ? articlesResult.articles.slice(0, 3) 
    : [];

  // Dedicated UI for SMMflux
  if (isFlux) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans flex flex-col relative overflow-x-clip">
        {/* SMMFLUX RADIANT HERO BACKGROUND (Matching main page) */}
        <div className="absolute top-0 inset-x-0 h-[1800px] z-0 pointer-events-none overflow-hidden select-none bg-white dark:bg-default-50">
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
          <div className="absolute top-0 left-[2%] w-[700px] h-[700px] rounded-full bg-blue-500/35 blur-[120px] pointer-events-none" />
          <div className="absolute top-4 left-[25%] w-[650px] h-[650px] rounded-full bg-purple-600/40 blur-[110px] pointer-events-none" />
          <div className="absolute top-0 right-[5%] w-[700px] h-[700px] rounded-full bg-pink-500/35 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 inset-x-0 h-[300px] bg-gradient-to-t from-background to-transparent" />
        </div>

        <Header initialEmail={userEmail} siteName={siteName} tenantId={tenantId} activePath={undefined} />
        <main className="flex-1 w-full relative z-10">
          <FluxServicesCatalog networks={networks} featuredArticles={featuredArticles} />
        </main>
        <MegaFooter contactSettings={settings} tenantId={tenantId} />
      </div>
    );
  }

  // Classic API Blueprint UI for SMMplan
  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col relative overflow-x-clip">
      <Header initialEmail={userEmail} siteName={siteName} tenantId={tenantId} activePath={undefined} />
      
      <main className="flex-1 w-full py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-10">
          
          {/* Header Block */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Интеллектуальное продвижение
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">
              Каталог услуг & База знаний
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Полноценный обучающий хаб. Мы не просто накручиваем показатели — мы объясняем механизмы работы алгоритмов соцсетей и защищаем ваш бюджет.
            </p>
          </div>

          {/* Bento Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6">
            
            {/* Left Block: SMM Academy & Expert Guides (Bento Span 7) */}
            <div className="lg:col-span-7 bg-card border border-border rounded-3xl p-6 md:p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden group">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl md:text-2xl font-extrabold text-foreground flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary" />
                    Экспертные гайды и обучение
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-success/10 text-success uppercase">
                    Актуально
                  </span>
                </div>
                
                <div className="space-y-4">
                  {featuredArticles.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground bg-muted/40 rounded-2xl border border-dashed border-border">
                      Статьи базы знаний скоро появятся.
                    </div>
                  ) : (
                    featuredArticles.map((art) => (
                      <Link
                        key={art.id}
                        href={`/knowledge/${art.slug}`}
                        className="block p-4 rounded-2xl bg-muted/40 border border-transparent hover:border-primary/20 hover:bg-primary/[0.02] transition-all duration-200 group/item"
                      >
                        <div className="flex justify-between items-start gap-2 mb-1.5">
                          <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                            {art.category}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            {art.authorName} ({art.authorRole.split("/")[0].trim()})
                          </span>
                        </div>
                        <h3 className="font-bold text-foreground text-sm group-hover/item:text-primary transition-colors leading-snug">
                          {art.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                          {art.description}
                        </p>
                      </Link>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-border/80 flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
                  Учитесь продвигать соцсети без списаний и блокировок
                </span>
                <Link
                  href="/knowledge"
                  className="inline-flex items-center justify-center gap-1.5 h-11 px-5 rounded-2xl text-xs font-bold bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-200 shadow-sm active:scale-95 whitespace-nowrap"
                >
                  <span>Все статьи базы знаний</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Right Block: Platform Quick Selector (Bento Span 5) */}
            <div className="lg:col-span-5 bg-card border border-border rounded-3xl p-6 md:p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-200">
              <div className="space-y-6">
                <h2 className="text-xl md:text-2xl font-extrabold text-foreground flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Выбор платформы
                </h2>
                
                <div className="grid grid-cols-2 gap-3">
                  {networks.map((net) => {
                    const slug = net.slug.toLowerCase();
                    const brandIcon = (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img 
                        src={`/brands/${slug}.svg`} 
                        alt={net.name} 
                        className="w-6 h-6 shrink-0 object-contain transition-transform group-hover:scale-110 duration-200" 
                      />
                    );
                    
                    return (
                      <Link
                        key={net.id}
                        href={`/services/${net.slug}`}
                        className="group p-4 bg-muted/40 border border-transparent rounded-2xl transition-all duration-200 text-center flex flex-col items-center justify-center gap-2 hover:border-primary/30 hover:bg-primary/5 hover:text-primary h-28"
                      >
                        <div className="p-2.5 rounded-xl bg-card border border-border group-hover:border-transparent text-muted-foreground group-hover:text-inherit transition-all shadow-sm">
                          {brandIcon}
                        </div>
                        <span className="font-bold text-xs text-foreground group-hover:text-inherit transition-colors tracking-tight">
                          {net.name}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
              
              <div className="pt-6 mt-6 border-t border-border/80 text-center text-xs text-muted-foreground font-semibold">
                Выберите сеть для просмотра группировок тарифов
              </div>
            </div>

            {/* Lower Block: Unified AI Sandbox Callout (Bento Span 12) */}
            <div className="lg:col-span-12 bg-gradient-to-r from-primary/5 via-secondary/15 to-primary/5 border border-border/80 rounded-3xl p-6 md:p-8 text-center space-y-4 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden group">
              <div className="max-w-2xl mx-auto space-y-4 relative">
                <div className="inline-flex p-2 rounded-2xl bg-primary/10 text-primary shrink-0 mb-1">
                  <Info className="w-6 h-6" />
                </div>
                <h2 className="text-xl md:text-2xl font-black text-foreground">
                  Испытайте наш «Умный анализатор ссылок»
                </h2>
                <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                  Вам больше не нужно гадать, какую услугу заказать. Просто перейдите на форму заказа и вставьте ссылку на ваш канал, пост или Reels. Наш ИИ-анализатор в реальном времени подберет совместимые тарифы и отсеет любые ошибки!
                </p>
                
                <div className="pt-2 flex flex-col sm:flex-row gap-3 items-center justify-center">
                  <Link
                    href="/knowledge/how-to-order"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 h-11 px-6 rounded-2xl text-xs font-bold bg-card text-foreground hover:bg-muted border border-border transition-all duration-200 active:scale-95"
                  >
                    <BookOpen className="w-4 h-4 text-muted-foreground" />
                    <span>Читать гайд по ссылкам</span>
                  </Link>
                  <Link
                    href="/"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 h-11 px-6 rounded-2xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/95 transition-all duration-200 shadow active:scale-95"
                  >
                    <span>Оформить заказ</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      <MegaFooter contactSettings={settings} tenantId={tenantId} />
    </div>
  );
}
