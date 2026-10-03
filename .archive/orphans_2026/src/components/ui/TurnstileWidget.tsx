'use client';

import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact' | 'flexible';
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    onTurnstileLoaded?: () => void;
  }
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
}

export function TurnstileWidget({
  onVerify,
  onError,
  onExpire,
  theme = 'auto',
  className = '',
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Cloudflare Turnstile Site Key (Client-Safe public key)
  const siteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'; // Standard Cloudflare Always-Pass Test Sitekey if unset

  useEffect(() => {
    // 1. Check if script is already in document
    const scriptId = 'cloudflare-turnstile-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const initWidget = () => {
      if (window.turnstile && containerRef.current && !widgetIdRef.current) {
        try {
          const id = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            callback: (token: string) => {
              onVerify(token);
            },
            'error-callback': () => {
              if (onError) onError();
            },
            'expired-callback': () => {
              if (onExpire) onExpire();
            },
            theme,
            size: 'flexible',
          });
          widgetIdRef.current = id;
          setIsLoaded(true);
        } catch (err) {
          console.error('[Turnstile] render error:', err);
        }
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        initWidget();
      };
      document.head.appendChild(script);
    } else if (window.turnstile) {
      initWidget();
    } else {
      script.addEventListener('load', initWidget);
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        } catch {
          // Ignore unmount cleanup error
        }
      }
    };
  }, [siteKey, onVerify, onError, onExpire, theme]);

  return (
    <div className={`turnstile-wrapper my-3 min-h-[65px] flex items-center justify-center ${className}`}>
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
