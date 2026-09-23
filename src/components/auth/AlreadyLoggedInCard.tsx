import React from 'react';
import Link from 'next/link';
import { UserCheck, ArrowLeft, LogOut, ArrowRight } from 'lucide-react';
import { AuthBackLink } from './AuthBackLink';

export interface AlreadyLoggedInCardProps {
  isFlux: boolean;
  activeEmail: string;
  redirectLink: string;
}

export const AlreadyLoggedInCard: React.FC<AlreadyLoggedInCardProps> = ({
  isFlux,
  activeEmail,
  redirectLink,
}) => {
  const homeHref = isFlux ? '/?tenant=flux' : '/';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6 relative overflow-hidden">
      {/* Floating Back Link in the top-left */}
      <div className="absolute top-4 left-4 z-20 md:top-8 md:left-8">
        <AuthBackLink isFlux={isFlux} />
      </div>

      {isFlux && (
        <div className="absolute top-0 inset-x-0 h-screen z-0 pointer-events-none overflow-hidden select-none">
          <div
            className="absolute top-[-10%] left-[-10%] w-[60%] h-[50%] rounded-full bg-blue-500/90 blur-[120px] animate-pulse"
            style={{ animationDuration: '8s' }}
          />
          <div
            className="absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/85 blur-[120px] animate-pulse"
            style={{ animationDuration: '9s' }}
          />
        </div>
      )}

      <div
        className={`relative z-10 w-full max-w-md p-8 text-center space-y-6 animate-in fade-in duration-300 ${
          isFlux
            ? 'bg-card/50 backdrop-blur-3xl border border-border/50 rounded-[2.5rem] shadow-2xl'
            : 'bg-content1 border border-border/80 rounded-[var(--radius)] shadow-[0_20px_50px_rgba(0,0,0,0.05)]'
        }`}
      >
        <div className="flex justify-center">
          <div
            className={`w-16 h-16 rounded-3xl flex items-center justify-center border shadow-sm ${
              isFlux
                ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white border-white/20 font-black text-2xl'
                : 'bg-primary/10 text-primary border-primary/20 font-black text-2xl'
            }`}
          >
            {isFlux ? 'F' : <UserCheck className="w-8 h-8" />}
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Вы уже вошли</h1>
          <p className="text-muted-foreground text-xs leading-relaxed font-semibold">
            Вы авторизованы как:{' '}
            <span className="font-bold text-foreground block text-sm mt-1">{activeEmail}</span>
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <Link
            href={redirectLink}
            className={`w-full flex items-center justify-center gap-2 h-12 rounded-xl font-black text-sm hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 min-h-[44px] ${
              isFlux
                ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25'
                : 'bg-primary text-primary-foreground hover:shadow-lg'
            }`}
          >
            <span>Продолжить как {activeEmail.split('@')[0]}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href={homeHref}
            className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-card hover:bg-muted/80 text-foreground font-bold text-sm transition-all duration-200 border border-border/60 min-h-[44px]"
            aria-label="Вернуться на главную страницу"
          >
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            <span>Вернуться на главную</span>
          </Link>

          <a
            href="/api/auth/logout"
            className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-content2 hover:bg-content3 text-muted-foreground hover:text-foreground font-semibold text-xs transition-all duration-200 border border-border/40 min-h-[44px]"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Войти под другим аккаунтом</span>
          </a>
        </div>
      </div>
    </div>
  );
};
