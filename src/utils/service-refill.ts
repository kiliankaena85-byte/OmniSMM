import type { PublicService } from "@/actions/order/catalog";

/**
 * Точечная проверка наличия гарантии/автодокрутки (Refill) для услуги.
 * Защищает от ложных срабатываний на услугах с пометкой "Без гарантии" / "No Refill".
 */
export function checkServiceRefill(srv: Pick<PublicService, 'name' | 'description' | 'badge' | 'isRefillEnabled'>): {
  hasRefill: boolean;
  badgeLabel?: string | null;
} {
  const nameLower = (srv.name || '').toLowerCase();
  const descLower = (srv.description || '').toLowerCase();
  const badgeLower = (srv.badge || '').toLowerCase();

  // 1. Исключаем услуги, где явно указано отсутствие гарантии
  const isExplicitlyNoRefill = 
    nameLower.includes('без гарант') ||
    nameLower.includes('no refill') ||
    nameLower.includes('no-refill') ||
    nameLower.includes('без рефил') ||
    nameLower.includes('без восстановлен') ||
    descLower.includes('без гарант') ||
    descLower.includes('без рефила');

  if (isExplicitlyNoRefill) {
    return { hasRefill: false, badgeLabel: null };
  }

  // 2. Проверяем системный флаг провайдера
  if (srv.isRefillEnabled) {
    return { hasRefill: true, badgeLabel: '🛡️ Refill Гарантия' };
  }

  // 3. Проверяем бейдж
  if (badgeLower.includes('refill') || badgeLower.includes('гарант')) {
    return { hasRefill: true, badgeLabel: srv.badge };
  }

  // 4. Проверяем название услуги
  if (
    nameLower.includes('refill') || 
    nameLower.includes('с гарантией') || 
    nameLower.includes('гарантия') ||
    nameLower.includes('гарантией')
  ) {
    return { hasRefill: true, badgeLabel: '🛡️ Refill Гарантия' };
  }

  return { hasRefill: false, badgeLabel: null };
}
