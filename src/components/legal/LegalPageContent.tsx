import { db } from '@/lib/db';
import { SettingsProvider } from '@/lib/settings';
import { getLegalFallback } from '@/data/legal-fallbacks';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ShieldAlert, Sparkles, ShieldCheck } from 'lucide-react';
import parse from 'html-react-parser';
import { headers } from 'next/headers';
import { normalizeTenantId } from '@/lib/seo-helpers';

interface LegalPageContentProps {
  slug: string;
}

export async function LegalPageContent({ slug }: LegalPageContentProps) {
  let title: string | null = null;
  let contentHtml: string | null = null;

  const reqHeaders = await headers();
  const tenantId = normalizeTenantId(reqHeaders.get('x-tenant-id'));
  const isFlux = tenantId === 'flux';

  // 1. Пробуем из БД
  try {
    const post = await db.contentItem.findUnique({
      where: { slug },
      select: { title: true, contentHtml: true, isPublished: true },
    });
    if (post && post.isPublished && post.contentHtml) {
      title = post.title;
      contentHtml = post.contentHtml;
    }
  } catch {
    // БД недоступна — переходим к fallback
  }

  // 2. Fallback из статического файла
  if (!contentHtml) {
    const fallback = getLegalFallback(slug);
    if (fallback) {
      title = fallback.title;
      contentHtml = fallback.html;
    }
  }

  // 3. Ничего нет — 404
  if (!contentHtml) {
    notFound();
  }

  // 4. Замена {{тегов}} на реальные значения
  const settings = await SettingsProvider.getContactAndLegalSettings(tenantId);
  const defaultCompanyName = isFlux ? 'SMMflux' : 'SMMplan';
  const companyName = settings.COMPANY_NAME || defaultCompanyName;
  const inn = settings.COMPANY_INN || '';
  const ogrnip = settings.COMPANY_OGRNIP || '';
  const address = settings.COMPANY_ADDRESS || '';
  const supportEmail = isFlux ? (settings.SUPPORT_EMAIL || 'support@smmflux.ru') : (settings.SUPPORT_EMAIL || 'support@smmplan.pro');
  const privacyEmail = isFlux ? (settings.PRIVACY_EMAIL || 'privacy@smmflux.ru') : (settings.PRIVACY_EMAIL || 'privacy@smmplan.pro');
  const siteName = isFlux ? 'SMMflux' : (settings.SITE_NAME || 'SMMplan');
  const telegramBot = settings.TELEGRAM_SUPPORT_BOT 
    ? (settings.TELEGRAM_SUPPORT_BOT.startsWith('@') ? settings.TELEGRAM_SUPPORT_BOT : `@${settings.TELEGRAM_SUPPORT_BOT}`) 
    : (isFlux ? '@smmflux_support_bot' : '@smmplan_support_bot');

  let rendered = contentHtml;

  // Zero-Home-Address Disclosure Invariant (152-ФЗ / ст. 9 ЗоЗПП):
  // Если адрес не задан, строка адреса физически удаляется из документа
  if (!address.trim()) {
    rendered = rendered.replace(/<p><strong>Адрес:<\/strong>\s*\{\{COMPANY_ADDRESS\}\}<\/p>\s*/g, '');
    rendered = rendered.replace(/<p><strong>Адрес:<\/strong>[\s\S]*?<\/p>/g, '');
  }

  const { escapeHtml, sanitizeArticleHtml } = await import('@/lib/sanitize');

  const replacements: Record<string, string> = {
    '{{COMPANY_NAME}}': escapeHtml(companyName),
    '{{COMPANY_INN}}': escapeHtml(inn || '—'),
    '{{COMPANY_OGRNIP}}': escapeHtml(ogrnip || '—'),
    '{{COMPANY_ADDRESS}}': escapeHtml(address),
    '{{SUPPORT_EMAIL}}': escapeHtml(supportEmail),
    '{{PRIVACY_EMAIL}}': escapeHtml(privacyEmail),
    '{{SITE_NAME}}': escapeHtml(siteName),
    '{{TELEGRAM_BOT}}': escapeHtml(telegramBot),
  };

  for (const [tag, value] of Object.entries(replacements)) {
    rendered = rendered.replaceAll(tag, value);
  }

  rendered = sanitizeArticleHtml(rendered);

  if (isFlux) {
    return (
      <div className="min-h-screen bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8 relative overflow-x-clip font-sans">
        {/* SMMFLUX RADIANT HERO BACKGROUND (Matching main page) */}
        <div className="absolute top-0 inset-x-0 h-[1800px] z-0 pointer-events-none overflow-hidden select-none bg-background dark:bg-default-50">
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
          <div className="absolute top-0 left-[2%] w-[700px] h-[700px] rounded-full bg-primary/35 blur-[120px] pointer-events-none" />
          <div className="absolute top-4 left-[25%] w-[650px] h-[650px] rounded-full bg-purple-600/40 blur-[110px] pointer-events-none" />
          <div className="absolute top-0 right-[5%] w-[700px] h-[700px] rounded-full bg-pink-500/35 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 inset-x-0 h-[300px] bg-gradient-to-t from-background to-transparent" />
        </div>

        <div className="max-w-4xl mx-auto relative z-10">
          <div className="flex items-center justify-between mb-8">
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 text-xs font-bold text-foreground hover:text-purple-600 px-5 py-2.5 rounded-full bg-card/85 backdrop-blur-xl border border-border/80 hover:border-purple-400 shadow-sm transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-purple-600" />
              На главную SMMflux
            </Link>

            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/25 text-[11px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300 shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>152-ФЗ & 54-ФЗ Защита</span>
            </div>
          </div>
          
          <article className="rounded-[2.5rem] bg-card/90 backdrop-blur-2xl border border-border/80 p-8 sm:p-12 md:p-14 shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
            {slug === 'refund' ? (
              <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border/60">
                <div className="w-14 h-14 bg-gradient-to-br from-pink-500/20 to-purple-600/20 border border-pink-500/30 rounded-2xl flex items-center justify-center shadow-sm">
                  <ShieldAlert className="w-7 h-7 text-pink-600" />
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-widest text-pink-600 mb-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Финансовые гарантии</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-foreground">{title}</h1>
                </div>
              </div>
            ) : (
              <div className="mb-8 pb-6 border-b border-border/60">
                <div className="text-xs font-black uppercase tracking-widest text-purple-700 dark:text-purple-300 mb-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-pink-500" />
                  <span>Официальный документ SMMflux</span>
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight">
                  {title}
                </h1>
              </div>
            )}
            
            <div className="prose dark:prose-invert max-w-none text-foreground leading-relaxed text-sm sm:text-base font-normal">
              {parse(rendered)}
            </div>
          </article>
        </div>
      </div>
    );
  }

  // Classic SMMplan layout
  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />
          На главную
        </Link>
        
        <article className="bg-card rounded-3xl shadow-sm border border-border p-8 md:p-12 prose dark:prose-invert max-w-none">
          {slug === 'refund' ? (
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
              <div className="w-12 h-12 bg-destructive/10 rounded-2xl flex items-center justify-center">
                <ShieldAlert className="w-6 h-6 text-destructive" />
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight m-0">
                {title}
              </h1>
            </div>
          ) : (
            <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight mb-8">
              {title}
            </h1>
          )}
          
          <div className="space-y-6 text-muted-foreground leading-relaxed text-sm">
            {parse(rendered)}
          </div>
        </article>
      </div>
    </div>
  );
}
