import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export interface AuthBackLinkProps {
  isFlux?: boolean;
  className?: string;
  label?: string;
}

export const AuthBackLink: React.FC<AuthBackLinkProps> = ({
  isFlux = false,
  className = '',
  label = 'На главную',
}) => {
  const targetHref = isFlux ? '/?tenant=flux' : '/';

  return (
    <Link
      href={targetHref}
      aria-label="Вернуться на главную страницу"
      className={`inline-flex items-center gap-2 text-xs md:text-sm font-bold transition-all duration-200 min-h-[44px] px-3.5 py-2 rounded-xl group select-none ${
        isFlux
          ? 'text-foreground/80 hover:text-foreground bg-card/60 hover:bg-card/90 border border-border/60 hover:border-border/90 backdrop-blur-xl shadow-xs'
          : 'text-muted-foreground hover:text-foreground bg-content2/60 hover:bg-content2 border border-border/50 hover:border-border shadow-xs'
      } ${className}`}
    >
      <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" />
      <span>{label}</span>
    </Link>
  );
};
