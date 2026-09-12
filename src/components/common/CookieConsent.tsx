'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Cookie, Check } from 'lucide-react';

export function CookieConsent() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Admin / operator panels do not require public GDPR/152-FZ consent popups
    if (pathname?.startsWith('/admin')) {
      setIsVisible(false);
      return;
    }

    // Check if user has already accepted cookies
    const cookieConsent = document.cookie.includes('cookie_consent=true');
    const localConsent = typeof window !== 'undefined' && localStorage.getItem('cookie_consent') === 'true';
    if (!cookieConsent && !localConsent) {
      // Small delay for smooth entry
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  // Completely omit rendering for admin routes
  if (pathname?.startsWith('/admin')) return null;

  const handleAccept = () => {
    // Save cookie consent for 1 year (compliant with 152-FZ)
    document.cookie = 'cookie_consent=true; path=/; max-age=31536000; SameSite=Lax; Secure';
    try {
      localStorage.setItem('cookie_consent', 'true');
    } catch {
      // Ignore localStorage security/private mode errors
    }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  const isDashboard = pathname?.startsWith('/dashboard');

  return (
    <aside
      aria-label="Согласие на использование файлов cookie"
      className={`fixed ${
        isDashboard
          ? 'bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] sm:bottom-4'
          : 'bottom-3 sm:bottom-4'
      } left-3 right-3 sm:left-auto sm:right-4 sm:max-w-md z-[9999] p-3 sm:p-3.5 rounded-2xl bg-zinc-900/95 text-zinc-100 border border-zinc-800 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-300`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-xl bg-blue-600/20 text-blue-400 shrink-0">
            <Cookie className="w-4 h-4" />
          </div>
          <p className="text-[11px] sm:text-xs text-zinc-300 leading-snug">
            Мы используем файлы cookie (152-ФЗ).{' '}
            <Link
              href="/legal/cookies"
              className="text-blue-400 hover:text-blue-300 underline underline-offset-2 whitespace-nowrap"
            >
              Подробнее
            </Link>
          </p>
        </div>
        <button
          onClick={handleAccept}
          className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-semibold text-xs transition-all cursor-pointer shadow-md shadow-blue-600/20 whitespace-nowrap min-h-[36px]"
        >
          <Check className="w-3.5 h-3.5" />
          Принять
        </button>
      </div>
    </aside>
  );
}
