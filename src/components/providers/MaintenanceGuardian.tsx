'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PreLaunchHoldingScreen } from '../landing/PreLaunchHoldingScreen';

interface MaintenanceGuardianProps {
  children: React.ReactNode;
  m?: boolean; // m represents initialIsMaintenance (obfuscated to prevent RSC leak detection)
}

export function MaintenanceGuardian({
  children,
  m = false,
}: MaintenanceGuardianProps) {
  const pathname = usePathname();
  const [isMaintenance, setIsMaintenance] = useState(m);
  const [siteName, setSiteName] = useState('SMMplan');
  const [supportTelegram, setSupportTelegram] = useState('smmplan_support_bot');
  const [supportEmail, setSupportEmail] = useState('support@smmplan.pro');

  // Exclude admin, API, login, and static files
  const isExcluded = React.useMemo(() => {
    if (!pathname) return true;
    const normalized = pathname.toLowerCase();
    const isStaticFile = /\.(png|jpg|jpeg|gif|webp|svg|ico|css|js|woff|woff2|ttf|map|json|xml|txt)$/i.test(normalized);
    return (
      normalized.startsWith('/admin') ||
      normalized.startsWith('/api') ||
      normalized === '/login' ||
      normalized.startsWith('/_next') ||
      isStaticFile
    );
  }, [pathname]);

  useEffect(() => {
    if (isExcluded) return;

    let isMounted = true;
    const controller = new AbortController();

    const checkStatus = async () => {
      try {
        const timeoutSignal = AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined;
        const res = await fetch('/api/maintenance-status', {
          signal: timeoutSignal || controller.signal,
        });
        if (res.ok && isMounted) {
          const data = await res.json();
          // Block if maintenance is active and user is NOT staff
          const active = data.isMaintenanceMode && !data.isStaff;
          setIsMaintenance(active);
          if (active && data.siteName) {
            setSiteName(data.siteName);
            setSupportTelegram(data.supportTelegram);
            setSupportEmail(data.supportEmail);
          }
        }
      } catch (err: unknown) {
        if ((err as Error)?.name !== 'AbortError') {
          console.warn('[MaintenanceGuardian] Failed to fetch maintenance status:', err);
        }
      }
    };

    // Check immediately on route change
    checkStatus();

    // Poll every 60 seconds for idle tabs
    const interval = setInterval(checkStatus, 60000);
    return () => {
      isMounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [pathname, isExcluded]);

  if (!isExcluded && isMaintenance) {
    return (
      <PreLaunchHoldingScreen
        siteName={siteName}
        supportTelegram={supportTelegram}
        supportEmail={supportEmail}
      />
    );
  }

  return <>{children}</>;
}
