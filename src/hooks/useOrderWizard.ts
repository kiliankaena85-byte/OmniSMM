import { useState } from 'react';
import { checkoutAction } from '@/actions/order/checkout';
import { FluxCategory } from '@/types/flux';

export const MAX_DRIP_FEED_DURATION_MINUTES = 43200; // 30 days
export const DRIP_FEED_MAX_ERROR_MESSAGE = "Слишком большая длительность drip-feed (максимально 30 дней)";

export function validateDripFeedDuration(runs: number, interval: number): boolean {
  return runs * interval <= MAX_DRIP_FEED_DURATION_MINUTES;
}

/**
 * CRITICAL Drip-Feed Floor Invariant (AGENTS.md Rule 4):
 * Portion per run must be >= minQty.
 * Total order volume must be >= minQty * runs.
 */
export function getDripFeedFloor(minQty: number, runs: number): number {
  const safeMin = Math.max(1, minQty || 1);
  const safeRuns = Math.max(1, runs || 1);
  return safeMin * safeRuns;
}

export function validateDripFeedLimits(
  portionQty: number,
  runs: number,
  minQty: number,
  maxQty: number
): { isValid: boolean; error?: string } {
  if (runs < 2) {
    return { isValid: false, error: 'Количество запусков для Drip-feed должно быть не менее 2' };
  }
  if (portionQty < minQty) {
    return { isValid: false, error: `Количество на один запуск (${portionQty} шт.) не может быть меньше минимального (${minQty} шт.)` };
  }
  const total = portionQty * runs;
  if (total > maxQty) {
    return { isValid: false, error: `Общий объем заказа с учетом ${runs} запусков (${total} шт.) превышает максимум услуги (${maxQty} шт.)` };
  }
  return { isValid: true };
}


export interface CatalogNetworkItem {
  id: string;
  name: string;
  slug: string;
  categories?: FluxCategory[];
}

export interface OrderWizardServiceItem {
  id: string;
  name: string;
  pricePerUnitRub: number;
  minQty: number;
  maxQty: number;
  customDataType?: string | null;
  customDataLabel?: string | null;
  clientRequirement?: string | null;
  clientConfirmation?: boolean;
  requireWarning?: boolean;
}

export interface UseOrderWizardOptions {
  initialCatalog?: CatalogNetworkItem[];
  initialEmail?: string;
}

export function detectNetworkByUrl<T extends { slug: string; name: string }>(url: string, catalog: T[]): T | null {
  try {
    const host = new URL(url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`)
      .hostname.toLowerCase().replace(/^www\./, '');
    const rules: Array<[string[], string]> = [
      [['t.me', 'telegram.org', 'telegram.me'], 'telegram'],
      [['instagram.com', 'instagr.am'], 'instagram'],
      [['vk.com', 'vk.ru', 'm.vk.com'], 'vk'],
      [['youtube.com', 'youtu.be'], 'youtube'],
      [['tiktok.com'], 'tiktok'],
      [['x.com', 'twitter.com'], 'twitter'],
    ];
    for (const [hosts, key] of rules) {
      if (hosts.some(h => host === h || host.endsWith('.' + h))) {
        return catalog.find(n => (n.slug || n.name).toLowerCase().includes(key)) ?? null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function useOrderWizard(options: UseOrderWizardOptions = {}) {
  const { initialCatalog = [], initialEmail = '' } = options;

  const [link, setLink] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [quantity, setQuantity] = useState<number>(100);
  const [gateway, setGateway] = useState<'yookassa' | 'cryptobot' | 'balance'>('yookassa');
  const [selectedService, setSelectedService] = useState<OrderWizardServiceItem | null>(null);

  const [isDripFeedEnabled, setIsDripFeedEnabled] = useState(false);
  const [dripRuns, setDripRuns] = useState(5);
  const [dripInterval, setDripInterval] = useState(60);

  const [customData, setCustomData] = useState('');
  const [isRequirementsConfirmed, setIsRequirementsConfirmed] = useState(false);

  // Validate drip-feed duration (P2-4 constraint: runs * interval <= 43200 min = 30 days)
  const dripFeedDurationMinutes = dripRuns * dripInterval;
  const isDripFeedValid = !isDripFeedEnabled || dripFeedDurationMinutes <= 43200;

  const numericQuantity = typeof quantity === 'string' ? (parseInt(quantity) || 0) : quantity;
  const effectiveQuantity = numericQuantity;
  const priceRub = selectedService ? (selectedService.pricePerUnitRub * effectiveQuantity).toFixed(2) : '0.00';

  const analyzeLink = (url: string) => {
    return detectNetworkByUrl(url, initialCatalog);
  };

  return {
    link, setLink,
    email, setEmail,
    quantity, setQuantity,
    gateway, setGateway,
    selectedService, setSelectedService,
    isDripFeedEnabled, setIsDripFeedEnabled,
    dripRuns, setDripRuns,
    dripInterval, setDripInterval,
    customData, setCustomData,
    isRequirementsConfirmed, setIsRequirementsConfirmed,
    isDripFeedValid,
    dripFeedDurationMinutes,
    effectiveQuantity,
    priceRub,
    analyzeLink,
    checkoutAction,
  };
}
