'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export function PaymentAutoSync() {
  const router = useRouter();
  const hasSynced = useRef(false);

  useEffect(() => {
    if (hasSynced.current) return;
    hasSynced.current = true;

    async function doSync() {
      try {
        const { forceSyncMyPaymentsAction } = await import('@/actions/order/sync-payment');
        const anySynced = await forceSyncMyPaymentsAction();
        if (anySynced) {
          router.refresh();
        }
      } catch (e) {
        console.error('[PaymentAutoSync] Failed to sync payments:', e);
      }
    }

    // Run the sync shortly after mount
    const timer = setTimeout(doSync, 1000);
    return () => clearTimeout(timer);
  }, [router]);

  return null; // Invisible component
}
