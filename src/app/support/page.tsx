import { Metadata } from 'next';
import { GuestSupportOptions } from '@/components/support/GuestSupportOptions';
import { SettingsProvider } from '@/lib/settings';
import { verifySession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { normalizeTenantId, getTenantSiteName } from '@/lib/seo-helpers';
import { Header } from '@/components/landing/Header';
import { MegaFooter } from '@/components/landing/MegaFooter';
import { Sparkles, MessageSquare } from 'lucide-react';

export async function generateMetadata(): Promise<Metadata> {
  const reqHeaders = await headers();
  const tenantId = normalizeTenantId(reqHeaders.get('x-tenant-id'));
  const siteName = isFluxCheck(tenantId) ? 'SMMflux' : 'SMMplan';
  
  return {
    title: `Служба заботы | ${siteName}`,
    description: 'Обратная связь и оперативная помощь. Напишите нам в Telegram или на Email.',
  };
}

function isFluxCheck(tenantId: string) {
  return tenantId === 'flux' || tenantId === 'smmflux';
}

export default async function SupportPage() {
  const session = await verifySession();
  if (session?.userId) {
    redirect('/dashboard/tickets');
  }

  const reqHeaders = await headers();
  const tenantId = normalizeTenantId(reqHeaders.get('x-tenant-id')) || 'smmplan';
  const isFlux = isFluxCheck(tenantId);

  const settings = await SettingsProvider.getContactAndLegalSettings();
  const siteName = isFlux ? 'SMMflux' : (getTenantSiteName(tenantId) || settings.SITE_NAME || 'SMMplan');

  return (
    <div className="min-h-screen font-sans flex flex-col justify-between relative overflow-x-clip bg-background text-foreground">
      {/* ── Abstract Aurora Background ── */}
      {isFlux ? (
        <div className="absolute top-0 inset-x-0 h-screen z-0 pointer-events-none overflow-hidden select-none bg-white dark:bg-default-50">
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
        </div>
      ) : (
        <>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[500px] bg-primary/20 blur-[120px] rounded-full pointer-events-none opacity-50" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-sky-500/10 blur-[100px] rounded-full pointer-events-none opacity-50" />
        </>
      )}

      {/* Header */}
      <Header siteName={siteName} tenantId={tenantId} activePath="/support" />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 relative z-10 flex flex-col items-center justify-center">
        <div className="text-center mb-12 space-y-4 max-w-2xl">
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${
            isFlux 
              ? "bg-purple-500/10 border border-purple-500/25 text-purple-700 dark:text-purple-300 shadow-sm" 
              : "bg-primary/10 text-primary border border-primary/20"
          }`}>
            {isFlux ? <Sparkles className="w-3.5 h-3.5 text-pink-500" /> : <MessageSquare className="w-3.5 h-3.5" />}
            <span>Служба заботы в Telegram</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground">
            Служба заботы о клиентах
          </h1>
          <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
            Мы всегда готовы помочь вам. Выберите наиболее удобный способ связи, и наша команда ответит в течение 1–2 минут.
          </p>
        </div>

        <div className="w-full">
          <GuestSupportOptions 
            telegramBotUsername={settings.TELEGRAM_SUPPORT_BOT} 
            supportEmail={isFlux ? 'support@smmflux.ru' : settings.SUPPORT_EMAIL} 
          />
        </div>
      </main>

      {/* Footer */}
      <MegaFooter contactSettings={settings} tenantId={tenantId} />
    </div>
  );
}
