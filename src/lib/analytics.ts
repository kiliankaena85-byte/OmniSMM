// Augment the Window interface for third-party analytics SDKs
declare global {
  interface Window {
    ym?: (counterId: number, method: string, ...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: Record<string, unknown>[];
  }
}

export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  try {
    if (typeof window !== "undefined") {
      // 1. Ingest into internal telemetry endpoint (/api/analytics)
      try {
        const payload = JSON.stringify({
          event: eventName,
          metadata: params || {},
        });
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/analytics', new Blob([payload], { type: 'application/json' }));
        } else {
          fetch('/api/analytics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
            signal: AbortSignal.timeout(3000),
          }).catch(() => {
            // audit-ignore: telemetry failure is non-blocking
          });
        }
      } catch {
        // audit-ignore: Telemetry is non-blocking
      }

      // 2. Check if Yandex Metrika is available
      if (window.ym) {
        window.ym(96000000, "reachGoal", eventName, params);
      }
      
      // 3. 152-FZ Compliance (Cross-border data transfer guard):
      // Google Analytics (window.gtag) sends data to foreign jurisdiction servers.
      // Strictly require explicit Opt-In consent before dispatching events to Google.
      const hasForeignAnalyticsConsent = typeof localStorage !== "undefined" && localStorage.getItem("consent_foreign_analytics") === "true";
      if (window.gtag && hasForeignAnalyticsConsent) {
        window.gtag("event", eventName, params);
      }

      // 4. Also fallback to dataLayer
      if (window.dataLayer) {
        window.dataLayer.push({
          event: eventName,
          ...params
        });
      }
      
      if (process.env.NODE_ENV === "development") {
        console.info(`[Analytics Track]: ${eventName}`, params);
      }
    }
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Analytics error:", e);
    }
  }
}
