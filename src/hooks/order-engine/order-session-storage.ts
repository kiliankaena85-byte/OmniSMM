/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Session and LocalStorage persistence for Order Engine.
 */
import { toast } from 'sonner';
import { getFreshServiceAction, type PublicService, type PublicNetwork } from '@/actions/order/catalog';

export interface OrderDraftData {
  url?: string;
  networkId?: string;
  categoryId?: string;
  quantity?: number;
}

export function restoreDraftFromSession(
  sortedInitialCatalog: PublicNetwork[],
  setUrl: (u: string) => void,
  setNetworkId: (n: string) => void,
  setCategoryId: (c: string) => void,
  setQuantity: (q: number) => void
): void {
  try {
    const saved = sessionStorage.getItem('smmplan_draft');
    if (saved) {
      const draft: OrderDraftData = JSON.parse(saved);
      if (draft.url && typeof draft.url === 'string' && draft.url !== 'https://' && draft.url !== 'http://') {
        setUrl(draft.url);
      }
      if (draft.networkId && sortedInitialCatalog.some((n: PublicNetwork) => n.id === draft.networkId)) {
        setNetworkId(draft.networkId);
      }
      if (draft.categoryId) setCategoryId(draft.categoryId);
      if (draft.quantity && typeof draft.quantity === 'number' && draft.quantity > 0) {
        setQuantity(draft.quantity);
      }
    }
  } catch {
    /* sessionStorage unavailable (SSR/incognito) */
  }
}

export function saveDraftToSession(draft: { url: string; networkId: string; categoryId: string; quantity: number }): void {
  try {
    sessionStorage.setItem('smmplan_draft', JSON.stringify(draft));
  } catch {
    /* sessionStorage unavailable */
  }
}

export function restorePendingOrderSnapshot(
  callbacks: {
    setUrl: (u: string) => void;
    setNetworkId: (n: string) => void;
    setCategoryId: (c: string) => void;
    setQuantity: (q: number) => void;
    setEmail: (e: string) => void;
    setPromoCode: (p: string) => void;
    setCustomData: (d: string) => void;
    setRuns: (r: number) => void;
    setDripFeedEnabled: (en: boolean) => void;
    setDripInterval: (i: number) => void;
    setIsSmartDrip: (s: boolean) => void;
    setSmartDripDays: (d: number) => void;
    setSelectedService: (s: PublicService) => void;
  }
): void {
  if (typeof window === 'undefined') return;
  try {
    const isAuthResume = window.location.search.includes('auth_resume=1');
    const rawSnapshot =
      sessionStorage.getItem('smmplan_pending_order') ||
      localStorage.getItem('smmplan_pending_order') ||
      sessionStorage.getItem('omni_pending_order_v1') ||
      localStorage.getItem('omni_pending_order_v1');

    if (!rawSnapshot) return;
    const snapshot = JSON.parse(rawSnapshot);
    if (!snapshot || typeof snapshot !== 'object') return;

    const savedTime = snapshot.savedAt || snapshot.timestamp || 0;
    const isExpired = Date.now() - savedTime > 30 * 60 * 1000; // 30 min TTL

    if (isExpired) {
      sessionStorage.removeItem('smmplan_pending_order');
      localStorage.removeItem('smmplan_pending_order');
      sessionStorage.removeItem('omni_pending_order_v1');
      localStorage.removeItem('omni_pending_order_v1');
      return;
    }

    if (isAuthResume) {
      const targetUrl = snapshot.link || snapshot.url;
      if (targetUrl && typeof targetUrl === 'string') callbacks.setUrl(targetUrl);
      if (snapshot.networkId) callbacks.setNetworkId(snapshot.networkId);
      if (snapshot.categoryId) callbacks.setCategoryId(snapshot.categoryId);
      if (snapshot.quantity && typeof snapshot.quantity === 'number' && snapshot.quantity > 0) callbacks.setQuantity(snapshot.quantity);
      if (snapshot.email && typeof snapshot.email === 'string') callbacks.setEmail(snapshot.email);
      if (snapshot.promoCode && typeof snapshot.promoCode === 'string') callbacks.setPromoCode(snapshot.promoCode);
      if (snapshot.customData && typeof snapshot.customData === 'string') callbacks.setCustomData(snapshot.customData);
      if (snapshot.runs || snapshot.dripRuns) {
        callbacks.setRuns(snapshot.runs || snapshot.dripRuns);
        callbacks.setDripFeedEnabled(true);
      }
      if (snapshot.interval || snapshot.dripInterval) {
        callbacks.setDripInterval(snapshot.interval || snapshot.dripInterval);
      }
      if (snapshot.isSmartDrip) {
        callbacks.setIsSmartDrip(true);
        callbacks.setSmartDripDays(snapshot.smartDripDays || 7);
      }

      if (snapshot.serviceId) {
        getFreshServiceAction(snapshot.serviceId)
          .then((fresh) => {
            if (fresh) callbacks.setSelectedService(fresh);
          })
          .catch(() => {});
      }

      toast.success('Вы успешно вошли в аккаунт!', {
        description: 'Параметры вашего заказа восстановлены и готовы к оплате.'
      });

      sessionStorage.removeItem('smmplan_pending_order');
      localStorage.removeItem('smmplan_pending_order');
      sessionStorage.removeItem('omni_pending_order_v1');
      localStorage.removeItem('omni_pending_order_v1');

      try {
        const urlObj = new URL(window.location.href);
        urlObj.searchParams.delete('auth_resume');
        window.history.replaceState({}, '', urlObj.pathname + (urlObj.search ? urlObj.search : '') + '#step-4');
      } catch {
        /* ignore history state error */
      }
    }
  } catch (e) {
    console.warn('[useOrderEngine] Failed to restore pending order snapshot:', e);
  }
}
