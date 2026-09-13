import React from "react";
import Link from "next/link";
import { Mail, ArrowUpRight } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { normalizeTenantId } from "@/lib/tenant-resolver-edge";
import { TENANTS } from "@/config/tenants";
import { TenantLogo } from "@/components/ui/TenantLogo";
import { FluxCyberFooter } from "./flux/FluxCyberFooter";

export function MegaFooter({ 
  contactSettings,
  tenantId
}: { 
  contactSettings?: {
    SITE_NAME?: string;
    COMPANY_NAME?: string;
    SUPPORT_EMAIL?: string;
    TELEGRAM_SUPPORT_BOT?: string;
    LEGAL_INN?: string;
    LEGAL_OGRNIP?: string;
    LEGAL_ADDRESS?: string;
  },
  tenantId?: string
}) {
  const normalizedTenant = normalizeTenantId(tenantId) || 'smmplan';
  const tenantConfig = TENANTS.find(t => t.id === normalizedTenant) ?? TENANTS[0];
  const isFluxBrand = tenantConfig.id === 'flux';
  const brandName = tenantConfig.name;

  // Render authentic Prism Cyberpunk Footer for SMMflux
  if (isFluxBrand) {
    return <FluxCyberFooter contactSettings={contactSettings} brandName={brandName} />;
  }

  const supportEmail = contactSettings?.SUPPORT_EMAIL || "support@smmplan.pro";

  return (
    <footer className="bg-card/90 dark:bg-card/40 text-foreground pt-12 md:pt-20 pb-8 md:pb-12 border-t border-border/80 relative overflow-hidden mt-auto shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
      {/* SMMplan Blueprint Glow & Subtle Grid */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-64 bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-40" style={{ maskImage: 'linear-gradient(to bottom, white, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, white, transparent)' }} />
      
      <div className="max-w-7xl mx-auto px-4 md:px-6 grid grid-cols-1 md:grid-cols-12 gap-12 mb-14 relative z-10">
        
        {/* Column 1: Brand & Payments */}
        <div className="md:col-span-5 space-y-6 pr-4">
          <div className="flex items-center gap-3">
            <TenantLogo tenantId={tenantConfig.id} className="w-10 h-10" iconClassName="text-base" />
            <span className="text-2xl font-black tracking-tight text-foreground">{brandName}</span>
          </div>
          <p className="text-sm sm:text-base text-foreground/80 font-medium leading-relaxed max-w-sm">
            Платформа нового поколения для продвижения в социальных сетях. Мгновенный запуск, строгая конфиденциальность и официальная работа с гарантиями.
          </p>
          <div className="pt-4 flex flex-wrap items-center gap-5 text-foreground/60 select-none border-t border-border/20 max-w-sm">
            {/* SBP */}
            <div className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer">
              <svg className="h-4.5 w-auto text-foreground/60 hover:text-foreground transition-colors" viewBox="0 0 97 120" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 26.12l14.532 25.975v15.844L.017 93.863 0 26.12z" />
                <path d="M55.797 42.643l13.617-8.346 27.868-.026-41.485 25.414V42.643z" />
                <path d="M55.72 25.967l.077 34.39-14.566-8.95V0l14.49 25.967z" />
                <path d="M97.282 34.271l-27.869.026-13.693-8.33L41.231 0l56.05 34.271z" />
                <path d="M55.797 94.007V77.322l-14.566-8.78.008 51.458 14.558-25.993z" />
                <path d="M69.38 85.737L14.531 52.095 0 26.12l97.223 59.583-27.844.034z" />
                <path d="M41.24 120l14.556-25.993 13.583-8.27 27.843-.034L41.24 120z" />
                <path d="M.017 93.863l41.333-25.32-13.896-8.526-12.922 7.922L.017 93.863z" />
              </svg>
              <span className="font-black text-[11px] tracking-wider leading-none">СБП</span>
            </div>

            {/* MIR */}
            <svg className="h-4.5 w-auto text-foreground/60 hover:text-foreground transition-colors cursor-pointer" viewBox="0 0 400 120" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="m31 13h33c3 0 12-1 16 13 3 9 7 23 13 44h2c6-22 11-37 13-44 4-14 14-13 18-13h31v96h-32v-57h-2l-17 57h-24l-17-57h-3v57h-31m139-96h32v57h3l21-47c4-9 13-10 13-10h30v96h-32v-57h-2l-21 47c-4 9-14 10-14 10h-30m142-29v29h-30v-50h98c-4 12-18 21-34 21" />
              <path d="m382 53c4-18-8-40-34-40h-68c2 21 20 40 39 40" />
            </svg>

            {/* Visa */}
            <svg className="h-3.5 w-auto text-foreground/60 hover:text-foreground transition-colors cursor-pointer" viewBox="0 0 780 500" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M489.823 143.111C442.988 143.111 401.134 167.393 401.134 212.256C401.134 263.706 475.364 267.259 475.364 293.106C475.364 303.989 462.895 313.731 441.6 313.731C411.377 313.731 388.789 300.119 388.789 300.119L379.123 345.391C379.123 345.391 405.145 356.889 439.692 356.889C490.898 356.889 531.19 331.415 531.19 285.784C531.19 231.419 456.652 227.971 456.652 203.981C456.652 195.455 466.887 186.114 488.122 186.114C512.081 186.114 531.628 196.014 531.628 196.014L541.087 152.289C541.087 152.289 519.818 143.111 489.823 143.111ZM61.3294 146.411L60.1953 153.011C60.1953 153.011 79.8988 156.618 97.645 163.814C120.495 172.064 122.122 176.868 125.971 191.786L167.905 353.486H224.118L310.719 146.411H254.635L198.989 287.202L176.282 167.861C174.199 154.203 163.651 146.411 150.74 146.411H61.3294ZM333.271 146.411L289.275 353.486H342.756L386.598 146.411H333.271ZM631.554 146.411C618.658 146.411 611.825 153.318 606.811 165.386L528.458 353.486H584.542L595.393 322.136H663.72L670.318 353.486H719.805L676.633 146.411H631.554ZM638.848 202.356L655.473 280.061H610.935L638.848 202.356Z" />
            </svg>

            {/* Cryptobot */}
            <div className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer">
              <svg className="h-4.5 w-auto text-foreground/60 hover:text-foreground transition-colors" viewBox="0 0 56 56" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M28 56C43.464 56 56 43.464 56 28C56 12.536 43.464 0 28 0C12.536 0 0 12.536 0 28C0 43.464 12.536 56 28 56Z" opacity="0.15" />
                <path fillRule="evenodd" clipRule="evenodd" d="M20.199 18.4844H35.9034C36.459 18.4844 37.0142 18.566 37.5944 18.8365C38.2899 19.1606 38.6587 19.6717 38.9171 20.0496C38.9372 20.079 38.956 20.1093 38.9734 20.1403C39.2772 20.6811 39.4338 21.265 39.4338 21.8931C39.4338 22.4899 39.2918 23.1401 38.9734 23.7068C38.9704 23.7122 38.9673 23.7176 38.9642 23.723L29.0424 40.7665C28.8236 41.1423 28.4209 41.3729 27.986 41.3714C27.5511 41.3698 27.15 41.1364 26.9339 40.759L17.1943 23.7518C17.1915 23.7473 17.1887 23.7426 17.1859 23.738C16.963 23.3707 16.6183 22.8027 16.558 22.0696C16.5026 21.3956 16.6541 20.7202 16.9928 20.1346C17.3315 19.5489 17.8414 19.0807 18.4547 18.7941C19.1123 18.4868 19.7787 18.4844 20.199 18.4844ZM26.7729 20.9192H20.199C19.7671 20.9192 19.6013 20.9458 19.4854 21C19.3251 21.0748 19.1905 21.1978 19.1005 21.3535C19.0105 21.3535 18.9698 21.6896 18.9846 21.8701C18.9931 21.9737 19.0353 22.0921 19.2842 22.5026C19.2894 22.5112 19.2945 22.5199 19.2995 22.5286L26.7729 35.5785V20.9192ZM29.2077 20.9192V35.643L36.8542 22.5079C36.9405 22.3511 36.999 22.1245 36.999 21.8931C36.999 21.7054 36.9601 21.5424 36.8731 21.3743C36.7818 21.2431 36.7262 21.1736 36.6797 21.126C36.6398 20.959 36.1999 20.9192 35.9034 20.9192H29.2077Z" />
              </svg>
              <span className="font-black text-[11px] tracking-wider leading-none">Cryptobot</span>
            </div>
          </div>
          <p className="text-xs text-foreground/60 max-w-sm leading-relaxed mt-4">
            * Сервисы Instagram и Facebook принадлежат компании Meta, признанной экстремистской организацией и запрещенной на территории РФ.
          </p>
        </div>

        {/* Column 2: Legal Links */}
        <div className="md:col-span-3 space-y-5">
          <h4 className="text-foreground font-black tracking-widest text-xs uppercase mb-5">Документы</h4>
          <ul className="space-y-3.5 text-sm font-semibold">
            <li><Link href={ROUTES.LEGAL.TERMS} className="text-foreground/90 hover:text-primary transition-colors flex items-center gap-1 group">Публичная оферта <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity -ml-1 group-hover:ml-0" /></Link></li>
            <li><Link href={ROUTES.LEGAL.PRIVACY} className="text-foreground/90 hover:text-primary transition-colors flex items-center gap-1 group">Конфиденциальность <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity -ml-1 group-hover:ml-0" /></Link></li>
            <li><Link href={ROUTES.LEGAL.REFUND} className="text-foreground/90 hover:text-primary transition-colors flex items-center gap-1 group">Возврат средств <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity -ml-1 group-hover:ml-0" /></Link></li>
            <li><Link href={ROUTES.LEGAL.COOKIES} className="text-foreground/90 hover:text-primary transition-colors flex items-center gap-1 group">Использование Cookie <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity -ml-1 group-hover:ml-0" /></Link></li>
            <li><Link href={ROUTES.LEGAL.SERVICE_RULES} className="text-foreground/90 hover:text-primary transition-colors flex items-center gap-1 group">Правила сервиса <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity -ml-1 group-hover:ml-0" /></Link></li>
            <li><Link href="/knowledge" className="text-foreground/90 hover:text-primary transition-colors flex items-center gap-1 group">База знаний <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity -ml-1 group-hover:ml-0" /></Link></li>
          </ul>
        </div>

        {/* Column 3: Contact & Support */}
        <div className="md:col-span-4 space-y-5">
          <h4 className="text-foreground font-black tracking-widest text-xs uppercase mb-5">Поддержка</h4>
          <p className="text-sm font-medium text-foreground/80 leading-relaxed">Наша команда на связи с 09:00 до 21:00 МСК. Среднее время ответа составляет 15 минут.</p>
          
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <a 
              href="/api/support/telegram"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-sm hover:shadow-md hover:bg-primary/90 hover:-translate-y-0.5 transition-all w-full sm:w-auto"
            >
              Поддержка в Telegram
            </a>
            <a 
              href={`mailto:${supportEmail}`}
              className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-muted/80 hover:bg-muted text-foreground font-bold text-sm border border-border/80 transition-all w-full sm:w-auto gap-2"
            >
              <Mail className="w-4 h-4 text-foreground/70" /> Email
            </a>
          </div>
        </div>

      </div>

      <div className="max-w-7xl mx-auto px-6 border-t border-border/50 pt-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs font-semibold text-foreground/80 relative z-10">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-bold text-foreground">© {new Date().getFullYear()} {brandName}. Все права защищены.</p>
          <p className="text-xs text-foreground/70 font-medium">
            Информационно-техническая платформа
          </p>
        </div>
      </div>
    </footer>
  );
}
