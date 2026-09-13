import React from "react";
import Link from "next/link";
import { Mail, ArrowUpRight, Send, ShieldCheck, Zap } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { TenantLogo } from "@/components/ui/TenantLogo";

export function FluxCyberFooter({
  contactSettings,
  brandName = "SMMflux",
}: {
  contactSettings?: {
    SITE_NAME?: string;
    COMPANY_NAME?: string;
    SUPPORT_EMAIL?: string;
    TELEGRAM_SUPPORT_BOT?: string;
    LEGAL_INN?: string;
    LEGAL_OGRNIP?: string;
    LEGAL_ADDRESS?: string;
  };
  brandName?: string;
}) {
  const supportEmail = contactSettings?.SUPPORT_EMAIL || "support@smmflux.ru";

  return (
    <footer className="w-full bg-[#0a0d18] text-foreground pt-14 md:pt-20 pb-10 md:pb-14 border-t border-purple-500/20 relative overflow-hidden mt-auto shadow-[0_-20px_50px_rgba(0,0,0,0.3)]">
      {/* Prism Aurora Ambient Glow (No harsh grid lines) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-72 bg-gradient-to-b from-purple-600/15 via-fuchsia-600/10 to-transparent blur-[100px] pointer-events-none rounded-full" />
      <div className="absolute top-0 right-10 w-96 h-96 bg-pink-500/10 blur-[120px] pointer-events-none rounded-full" />
      <div className="absolute top-0 left-10 w-96 h-96 bg-indigo-500/10 blur-[120px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 md:px-8 grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12 mb-12 relative z-10">
        
        {/* Column 1: Brand & Identity */}
        <div className="md:col-span-5 space-y-5 pr-2 sm:pr-4">
          <div className="flex items-center gap-3">
            <TenantLogo tenantId="flux" className="w-10 h-10" iconClassName="w-5 h-5" />
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tight text-neutral-100 flex items-center gap-2">
                {brandName}
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Media Hub
                </span>
              </span>
            </div>
          </div>
          
          <p className="text-sm text-neutral-300 font-normal leading-relaxed max-w-md">
            Умная экосистема автоматизации и органического продвижения нового поколения. Мгновенный старт, безопасность и поддержка с 09:00 до 21:00 МСК.
          </p>

          {/* Payment Trust Badges in Cyber Glass Style */}
          <div className="pt-2 flex flex-wrap items-center gap-4 text-neutral-400 select-none border-t border-purple-500/15 max-w-md">
            {/* Visa */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900/80 border border-neutral-800 text-xs font-bold text-neutral-300 hover:border-purple-500/40 transition-colors">
              <span className="text-[11px] font-black italic tracking-wider">VISA</span>
            </div>

            {/* MIR */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900/80 border border-neutral-800 text-xs font-bold text-neutral-300 hover:border-purple-500/40 transition-colors">
              <span className="text-[11px] font-bold tracking-wider">МИР</span>
            </div>

            {/* SBP */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900/80 border border-neutral-800 text-xs font-bold text-neutral-300 hover:border-purple-500/40 transition-colors">
              <span className="text-[11px] font-black tracking-wider text-emerald-400">СБП</span>
            </div>

            {/* Cryptobot */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900/80 border border-neutral-800 text-xs font-bold text-neutral-300 hover:border-purple-500/40 transition-colors">
              <span className="text-[11px] font-bold tracking-wider text-cyan-400">CryptoPay</span>
            </div>

            <div className="flex items-center gap-1 text-[11px] text-neutral-400 ml-auto">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
              <span>SSL 256-bit</span>
            </div>
          </div>
        </div>

        {/* Column 2: Legal Documents */}
        <div className="md:col-span-3 space-y-4">
          <h4 className="text-purple-300 font-bold tracking-widest text-xs uppercase mb-4 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            Документы
          </h4>
          <ul className="space-y-3 text-sm font-medium">
            <li>
              <Link href={ROUTES.LEGAL.TERMS} className="text-neutral-300 hover:text-purple-300 transition-colors flex items-center justify-between group">
                <span>Публичная оферта</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-purple-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </li>
            <li>
              <Link href={ROUTES.LEGAL.PRIVACY} className="text-neutral-300 hover:text-purple-300 transition-colors flex items-center justify-between group">
                <span>Конфиденциальность</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-purple-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </li>
            <li>
              <Link href={ROUTES.LEGAL.REFUND} className="text-neutral-300 hover:text-purple-300 transition-colors flex items-center justify-between group">
                <span>Возврат средств</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-purple-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </li>
            <li>
              <Link href={ROUTES.LEGAL.COOKIES} className="text-neutral-300 hover:text-purple-300 transition-colors flex items-center justify-between group">
                <span>Использование Cookie</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-purple-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </li>
            <li>
              <Link href={ROUTES.LEGAL.SERVICE_RULES} className="text-neutral-300 hover:text-purple-300 transition-colors flex items-center justify-between group">
                <span>Правила сервиса</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-purple-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </li>
            <li>
              <Link href="/knowledge" className="text-neutral-300 hover:text-purple-300 transition-colors flex items-center justify-between group">
                <span>База знаний</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-purple-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </li>
          </ul>
        </div>

        {/* Column 3: Cyber Support & Contact */}
        <div className="md:col-span-4 space-y-4">
          <h4 className="text-pink-300 font-bold tracking-widest text-xs uppercase mb-4 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" />
            Поддержка
          </h4>
          <p className="text-sm text-neutral-300 leading-relaxed font-normal">
            Служба заботы на связи ежедневно с 09:00 до 21:00 МСК. Среднее время ответа оператора — до 15 минут.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <a 
              href="/api/support/telegram"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-neutral-100 font-bold text-sm shadow-[0_4px_20px_rgba(168,85,247,0.35)] hover:shadow-[0_6px_25px_rgba(236,72,153,0.45)] hover:-translate-y-0.5 transition-all w-full sm:w-auto active:scale-95"
            >
              <Send className="w-4 h-4 shrink-0" />
              Поддержка в Telegram
            </a>
            
            <a 
              href={`mailto:${supportEmail}`}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 font-bold text-sm border border-purple-500/25 hover:border-purple-500/50 transition-all w-full sm:w-auto"
            >
              <Mail className="w-4 h-4 text-purple-300 shrink-0" />
              Email
            </a>
          </div>
        </div>

      </div>

      {/* Footer Bottom Bar */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 border-t border-neutral-800/80 pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-neutral-400 relative z-10">
        <div className="flex flex-col gap-1">
          <p className="font-bold text-neutral-200">© {new Date().getFullYear()} {brandName}. Все права защищены.</p>
          <p className="text-xs text-neutral-400 font-medium">
            Информационно-техническая платформа
          </p>
        </div>
        
        <p className="flex items-center gap-1.5 text-neutral-300 font-medium">
          <span>Crafted with</span>
          <Zap className="w-3.5 h-3.5 text-purple-400 fill-current animate-bounce" />
          <span className="text-neutral-100 font-semibold">by FLUX Creative Lab</span>
        </p>
      </div>
    </footer>
  );
}
