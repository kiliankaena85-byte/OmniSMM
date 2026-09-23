import React from 'react';
import Link from 'next/link';
import { TenantLogo } from '@/components/ui/TenantLogo';

export const PlanLoginHero: React.FC = () => {
  return (
    <div className="hidden lg:flex flex-col justify-between bg-primary p-10 text-primary-foreground relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(255,255,255,0.15),rgba(255,255,255,0))] pointer-events-none z-0" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none z-0" />
      <div className="absolute top-1/4 right-0 w-96 h-96 bg-primary-foreground/15 rounded-full blur-3xl pointer-events-none z-0" />
      <div className="absolute bottom-1/4 left-0 w-80 h-80 bg-primary-foreground/5 rounded-full blur-3xl pointer-events-none z-0" />

      <div className="relative z-10">
        <Link href="/" className="flex items-center gap-2.5 group select-none" aria-label="SMMplan — На главную">
          <TenantLogo tenantId="smmplan" className="w-9 h-9 group-hover:scale-105 transition-transform" iconClassName="w-5 h-5" />
          <span className="font-bold text-xl">SMMplan</span>
        </Link>
      </div>

      <div className="space-y-6 relative z-10">
        <div className="space-y-4">
          <div className="text-4xl font-black leading-tight">
            Продвижение<br />в социальных<br />сетях
          </div>
          <p className="text-primary-foreground/80 text-base leading-relaxed">
            Быстрое продвижение подписчиков, лайков и просмотров. 
            Результат в течение нескольких минут.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { value: '10K+', label: 'Клиентов' },
            { value: '99%', label: 'Выполнено' },
            { value: '9-21', label: 'Поддержка (МСК)' },
          ].map(({ value, label }) => (
            <div key={label} className="bg-primary-foreground/10 rounded-2xl p-4 text-center">
              <div className="text-2xl font-black">{value}</div>
              <div className="text-xs text-primary-foreground/60 font-semibold mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-primary-foreground/40 relative z-10">
        © {new Date().getFullYear()} SMMplan · Безопасная оплата через ЮKassa
      </p>
    </div>
  );
};
