import React, { useId } from "react";
import { normalizeTenantId } from "@/lib/tenant-resolver-edge";

interface TenantLogoProps {
  tenantId?: string;
  className?: string;
  iconClassName?: string;
}

export function TenantLogo({ tenantId, className = "w-8 h-8", iconClassName = "text-sm" }: TenantLogoProps) {
  const isFlux = normalizeTenantId(tenantId) === 'flux';
  // Unique ID per instance to prevent SVG gradient/filter collisions across multiple logos on the same page
  const uid = useId().replace(/:/g, '');

  if (isFlux) {
    return (
      <div className={`relative flex items-center justify-center select-none shrink-0 ${className}`}>
        <svg
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-[0_4px_12px_rgba(244,63,94,0.35)] transition-transform duration-300 hover:scale-110 active:scale-95"
        >
          <defs>
            <linearGradient id={`${uid}fluxWingLeft`} x1="0%" y1="20%" x2="80%" y2="100%">
              <stop offset="0%" stopColor="#FB923C" />
              <stop offset="35%" stopColor="#F43F5E" />
              <stop offset="80%" stopColor="#E11D48" />
              <stop offset="100%" stopColor="#BE185D" />
            </linearGradient>
            <linearGradient id={`${uid}fluxWingRight`} x1="100%" y1="10%" x2="20%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="30%" stopColor="#6366F1" />
              <stop offset="70%" stopColor="#A855F7" />
              <stop offset="100%" stopColor="#D946EF" />
            </linearGradient>
            <linearGradient id={`${uid}fluxInnerFold`} x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45" />
              <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.25" />
            </linearGradient>
            <filter id={`${uid}fluxHeartAmbient`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#EC4899" floodOpacity="0.25" />
            </filter>
          </defs>

          <path
            d="M 60 102
               C 32 82, 10 58, 10 34
               C 10 16, 24 8, 42 8
               C 51 8, 57 12, 60 18
               C 56 32, 48 50, 60 66
               C 60 66, 44 80, 60 102 Z"
            fill={`url(#${uid}fluxWingLeft)`}
            filter={`url(#${uid}fluxHeartAmbient)`}
          />
          <path
            d="M 60 102
               C 88 82, 110 58, 110 34
               C 110 16, 96 8, 78 8
               C 69 8, 63 12, 60 18
               C 64 32, 72 50, 60 66
               C 60 66, 76 80, 60 102 Z"
            fill={`url(#${uid}fluxWingRight)`}
          />
          <path
            d="M 60 22
               C 52 38, 46 54, 60 74
               C 74 54, 68 38, 60 22 Z"
            fill={`url(#${uid}fluxInnerFold)`}
          />
          <path
            d="M 42 12
               C 30 12, 20 18, 18 28
               C 22 20, 32 16, 42 16
               C 47 16, 51 18, 54 22
               C 52 16, 48 12, 42 12 Z"
            fill="#FFFFFF"
            opacity="0.65"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className={`relative flex items-center justify-center select-none shrink-0 ${className}`}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_4px_12px_rgba(2,132,199,0.3)] transition-transform duration-200"
      >
        <defs>
          <linearGradient id={`${uid}planSkyGrad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="50%" stopColor="#0EA5E9" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
          <filter id={`${uid}planInnerShadow`} x="-10%" y="-10%" width="120%" height="120%">
            <feOffset dx="0" dy="3" />
            <feGaussianBlur stdDeviation="3" result="offset-blur" />
            <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" />
            <feFlood floodColor="#000000" floodOpacity="0.25" result="color" />
            <feComposite operator="in" in="color" in2="inverse" result="shadow" />
            <feComposite operator="over" in="shadow" in2="SourceGraphic" />
          </filter>
        </defs>

        <rect
          x="2"
          y="2"
          width="96"
          height="96"
          rx="26"
          fill={`url(#${uid}planSkyGrad)`}
          filter={`url(#${uid}planInnerShadow)`}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          fill="#FFFFFF"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
          fontWeight="900"
          fontSize="74"
          letterSpacing="-0.04em"
          className="select-none"
        >
          S
        </text>
      </svg>
    </div>
  );
}



