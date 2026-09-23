export interface PendingOrderSnapshot {
  serviceId?: string;
  link?: string;
  quantity?: number;
  promoCode?: string;
  runs?: number;
  interval?: number;
  isSmartDrip?: boolean;
  smartDripDays?: number;
  networkId?: string;
  categoryId?: string;
  customData?: string;
}

export function persistOrderSnapshot(orderSnapshot?: PendingOrderSnapshot, email?: string) {
  if (typeof window === 'undefined' || !orderSnapshot) return;
  try {
    const payload = {
      version: 1,
      ...orderSnapshot,
      url: orderSnapshot.link,
      email: email ? email.trim().toLowerCase() : '',
      savedAt: Date.now(),
      timestamp: Date.now(),
    };
    sessionStorage.setItem('smmplan_pending_order', JSON.stringify(payload));
    localStorage.setItem('smmplan_pending_order', JSON.stringify(payload));
    sessionStorage.setItem('omni_pending_order_v1', JSON.stringify(payload));
    localStorage.setItem('omni_pending_order_v1', JSON.stringify(payload));
  } catch (e) {
    console.warn('[CheckoutAuthModal] Failed to persist order snapshot:', e);
  }
}
