import { LoginForm } from './login-form';
import Link from 'next/link';
import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { headers } from 'next/headers';
import { Sparkles } from 'lucide-react';
import { TenantLogo } from '@/components/ui/TenantLogo';
import { AuthBackLink } from '@/components/auth/AuthBackLink';
import { AlreadyLoggedInCard } from '@/components/auth/AlreadyLoggedInCard';
import { FluxLoginHero } from '@/components/auth/FluxLoginHero';
import { PlanLoginHero } from '@/components/auth/PlanLoginHero';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ error?: string; tenant?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const isFlux = resolvedParams?.tenant === 'flux' || resolvedParams?.tenant === 'smmflux';

  return {
    title: isFlux ? 'Вход | SMMflux' : 'Вход | SMMplan',
    description: 'Войдите в личный кабинет — управляйте заказами на продвижение.',
  };
}

export default async function LoginPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const error = resolvedParams?.error;

  const reqHeaders = await headers();
  const host = reqHeaders.get('host') || '';
  const xTenant = reqHeaders.get('x-tenant-id') || '';
  const isFlux =
    xTenant === 'flux' ||
    xTenant === 'smmflux' ||
    host.includes('smmflux') ||
    resolvedParams?.tenant === 'flux' ||
    resolvedParams?.tenant === 'smmflux';

  const session = await verifySession();
  let activeEmail = '';
  let activeRole = 'USER';
  if (session?.userId) {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { email: true, role: true },
    });
    activeEmail = user?.email || '';
    activeRole = user?.role || 'USER';
  }

  if (activeEmail) {
    const isStaff = ['OWNER', 'ADMIN', 'MANAGER', 'SUPPORT'].includes(activeRole);
    const redirectLink = isStaff ? '/admin/dashboard' : '/dashboard';

    return (
      <AlreadyLoggedInCard
        isFlux={isFlux}
        activeEmail={activeEmail}
        redirectLink={redirectLink}
      />
    );
  }

  // ── SMMFLUX VARIANT ──
  if (isFlux) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans flex flex-col justify-center items-center relative overflow-x-clip p-4 md:p-8">
        {/* Top-Left Floating Back Link */}
        <div className="absolute top-4 left-4 z-20 md:top-6 md:left-6">
          <AuthBackLink isFlux={true} />
        </div>

        {/* SMMFLUX RADIANT AURORA BACKGROUND */}
        <div className="absolute top-0 inset-x-0 h-screen z-0 pointer-events-none overflow-hidden select-none bg-background">
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

        <div className="relative z-10 w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center pt-12 lg:pt-0">
          {/* Left Hero branding for SMMflux */}
          <FluxLoginHero />

          {/* Right SMMflux Card */}
          <div className="w-full max-w-md mx-auto bg-card/90 backdrop-blur-2xl border border-border/80 rounded-[2.5rem] p-8 md:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.08)] space-y-8 text-foreground">
            <div className="text-center lg:text-left">
              <Link
                href="/?tenant=flux"
                className="lg:hidden inline-flex items-center justify-center gap-2 mb-6 group cursor-pointer"
                aria-label="SMMflux — На главную"
              >
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 text-white flex items-center justify-center font-black text-lg shadow-lg group-hover:scale-105 transition-transform">
                  <Sparkles className="w-5 h-5" />
                </div>
                <span className="font-black text-2xl tracking-tight text-foreground">SMMflux</span>
              </Link>
              <h2 className="text-2xl font-black text-foreground tracking-tight">Вход в SMMflux</h2>
              <p className="text-muted-foreground text-sm mt-1 font-medium">
                Введите email и пароль для доступа к кабинету.
              </p>
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl px-4 py-3 text-xs text-rose-500 text-center font-bold">
                {error === 'AccountBlocked' && 'Ваш аккаунт заблокирован или удален.'}
                {error === 'InvalidToken' && 'Неверный или поврежденный токен входа.'}
                {error === 'ExpiredToken' && 'Срок действия ссылки входа истек.'}
                {error === 'AlreadyUsed' && 'Эта ссылка входа уже была использована.'}
                {!['AccountBlocked', 'InvalidToken', 'ExpiredToken', 'AlreadyUsed'].includes(error) &&
                  'Произошла ошибка при входе. Попробуйте снова.'}
              </div>
            )}

            <LoginForm isFlux={true} />
          </div>
        </div>
      </div>
    );
  }

  // ── CLASSIC SMMPLAN VARIANT ──
  return (
    <div className="min-h-screen grid lg:grid-cols-2 relative">
      {/* ── Left: Branding panel ── */}
      <PlanLoginHero />

      {/* ── Right: Form panel ── */}
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-background relative">
        {/* Top-Right or Top-Left Navigation Link */}
        <div className="absolute top-4 left-4 z-20 md:top-6 md:left-6 lg:left-auto lg:right-8">
          <AuthBackLink isFlux={false} />
        </div>

        {/* Mobile Logo Link */}
        <div className="lg:hidden mb-6 pt-10">
          <Link href="/" className="flex items-center gap-2 justify-center group" aria-label="SMMplan — На главную">
            <TenantLogo tenantId="smmplan" className="w-9 h-9 group-hover:scale-105 transition-transform" iconClassName="w-5 h-5" />
            <span className="font-bold text-xl text-foreground">SMMplan</span>
          </Link>
        </div>

        <div className="w-full max-w-sm space-y-6">
          <div className="text-center lg:text-left">
            <h1 className="text-2xl font-bold text-foreground">Вход в аккаунт</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Войдите в личный кабинет по паролю или с помощью ссылки на почту.
            </p>
          </div>

          {error && (
            <div className="bg-destructive/15 border border-destructive/20 rounded-xl px-4 py-3 text-xs text-destructive text-center font-bold">
              {error === 'AccountBlocked' && 'Ваш аккаунт заблокирован или удален.'}
              {error === 'InvalidToken' && 'Неверный или поврежденный токен входа.'}
              {error === 'ExpiredToken' && 'Срок действия ссылки входа истек.'}
              {error === 'AlreadyUsed' && 'Эта ссылка входа уже была использована.'}
              {!['AccountBlocked', 'InvalidToken', 'ExpiredToken', 'AlreadyUsed'].includes(error) &&
                'Произошла ошибка при входе. Попробуйте снова.'}
            </div>
          )}

          <LoginForm isFlux={false} />
        </div>
      </div>
    </div>
  );
}
