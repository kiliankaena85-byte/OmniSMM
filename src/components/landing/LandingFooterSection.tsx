'use client';

import React from "react";
import { TrustBar } from "./TrustBar";
import { WhyUs } from "./WhyUs";
import { Reviews } from "./Reviews";
import { FAQ } from "./FAQ";
import { MegaFooter } from "./MegaFooter";

export interface LandingFooterSectionProps {
  seoHubContent?: React.ReactNode;
  companyName: string;
  contactSettings?: {
    SITE_NAME?: string;
    COMPANY_NAME?: string;
    SUPPORT_EMAIL?: string;
    TELEGRAM_SUPPORT_BOT?: string;
    LEGAL_INN?: string;
    LEGAL_OGRNIP?: string;
    LEGAL_ADDRESS?: string;
  };
  tenantId?: string;
}

export function LandingFooterSection({
  seoHubContent,
  companyName,
  contactSettings,
  tenantId,
}: LandingFooterSectionProps) {
  return (
    <>
      <div className="relative z-10 mt-8 sm:mt-12 md:mt-16 bg-background">
        {seoHubContent && (
          <div className="w-full max-w-[98%] xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-10">
            {seoHubContent}
          </div>
        )}
        <TrustBar />
        <WhyUs companyName={companyName} />
        <Reviews />
        <FAQ companyName={companyName} />
      </div>
      <MegaFooter contactSettings={contactSettings} tenantId={tenantId} />
      {/* Honeypot trap link for scrapers and DDoS bots (invisible to real users and assistive tech) */}
      <a 
        href="/api/v1/internal-sync" 
        style={{ display: 'none' }} 
        tabIndex={-1} 
        aria-hidden="true" 
        rel="nofollow"
      >
        Platform Sync
      </a>
    </>
  );
}
