'use client';

import { useEffect, useRef } from 'react';

interface SmartCaptchaWidgetProps {
  onTokenChange: (token: string) => void;
  className?: string;
}

declare global {
  interface Window {
    smartCaptcha?: {
      render: (
        container: HTMLElement | string,
        params: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: (error: unknown) => void;
          'network-error-callback'?: () => void;
          'token-expired-callback'?: () => void;
          hl?: string;
          test?: boolean;
          webview?: boolean;
        }
      ) => number;
      reset: (widgetId: number) => void;
      destroy: (widgetId: number) => void;
      getResponse: (widgetId: number) => string;
    };
    __onSmartCaptchaLoaded?: () => void;
  }
}

export function SmartCaptchaWidget({ onTokenChange, className }: SmartCaptchaWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const clientKey = process.env.NEXT_PUBLIC_SMARTCAPTCHA_CLIENT_KEY;

  useEffect(() => {
    if (!clientKey || !containerRef.current) {
      return;
    }

    const initWidget = () => {
      if (!window.smartCaptcha || !containerRef.current) return;
      if (widgetIdRef.current !== null) {
        try {
          window.smartCaptcha.destroy(widgetIdRef.current);
        } catch {
          // ignore destroy errors on re-mount
        }
      }

      try {
        const id = window.smartCaptcha.render(containerRef.current, {
          sitekey: clientKey,
          callback: (token: string) => onTokenChange(token),
          'token-expired-callback': () => onTokenChange(''),
          'error-callback': () => onTokenChange(''),
          hl: 'ru',
        });
        widgetIdRef.current = id;
      } catch (e) {
        console.error('SmartCaptcha render error:', e);
      }
    };

    if (window.smartCaptcha) {
      initWidget();
      return;
    }

    // Load Yandex SmartCaptcha script dynamically
    const existingScript = document.getElementById('smart-captcha-script');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'smart-captcha-script';
      script.src = 'https://smartcaptcha.yandexcloud.net/captcha.js?render=onload&onload=__onSmartCaptchaLoaded';
      script.async = true;
      script.defer = true;
      window.__onSmartCaptchaLoaded = () => {
        initWidget();
      };
      document.body.appendChild(script);
    } else {
      window.__onSmartCaptchaLoaded = () => {
        initWidget();
      };
    }

    return () => {
      if (widgetIdRef.current !== null && window.smartCaptcha) {
        try {
          window.smartCaptcha.destroy(widgetIdRef.current);
          widgetIdRef.current = null;
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, [clientKey, onTokenChange]);

  if (!clientKey) {
    return null;
  }

  return (
    <div className={`flex justify-center my-3 min-h-[100px] ${className || ''}`}>
      <div ref={containerRef} id="smart-captcha-container" />
    </div>
  );
}
