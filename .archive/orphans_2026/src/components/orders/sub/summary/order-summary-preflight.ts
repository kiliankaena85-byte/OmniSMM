import { toast } from 'sonner';
import type { PublicService } from '@/actions/order/catalog';

interface PreflightCheckParams {
  isCalculating: boolean;
  pricing: unknown;
  finalTotalCents: number;
  selectedService: PublicService | null;
  quantity: number;
  url: string;
  customData: string;
  validate: (showErrors?: boolean) => boolean;
}

export function checkOrderPreflight({
  isCalculating,
  pricing,
  finalTotalCents,
  selectedService,
  quantity,
  url,
  customData,
  validate,
}: PreflightCheckParams): boolean {
  if (isCalculating) {
    toast.warning('Пожалуйста, подождите, идёт расчёт стоимости заказа...', { id: 'checkout-err' });
    return false;
  }

  if (!pricing || finalTotalCents <= 0) {
    toast.error('Ошибка расчёта стоимости. Пожалуйста, проверьте количество.', { id: 'checkout-err' });
    return false;
  }

  if (!selectedService) {
    toast.error('Пожалуйста, сначала выберите тариф/услугу из каталога ниже ↓', { id: 'checkout-err' });
    document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
    return false;
  }

  if (quantity < selectedService.minQty) {
    toast.error(`Минимальный заказ для выбранного тарифа: ${selectedService.minQty} шт.`, { id: 'checkout-err' });
    return false;
  }

  if (quantity > selectedService.maxQty) {
    toast.error(`Максимальный заказ для выбранного тарифа: ${selectedService.maxQty} шт.`, { id: 'checkout-err' });
    return false;
  }

  if (!url.trim()) {
    toast.error('Пожалуйста, укажите ссылку для продвижения.', { id: 'checkout-err' });
    document.getElementById('order-url')?.focus();
    return false;
  }

  const sName = selectedService.name.toLowerCase();
  const cType = selectedService.customDataType;
  const needsPayload =
    (cType && cType !== 'NONE') ||
    sName.includes('свои') ||
    sName.includes('свой текст') ||
    sName.includes('ключево') ||
    (sName.includes('опрос') && !sName.includes('просмотр')) ||
    sName.includes('голосование');

  if (needsPayload && !customData.trim()) {
    toast.error('Пожалуйста, заполните необходимые дополнительные данные для выбранного тарифа.', {
      id: 'checkout-err',
    });
    return false;
  }

  if (!validate(true)) {
    toast.error('Пожалуйста, проверьте правильность введённых данных.', { id: 'checkout-err' });
    return false;
  }

  return true;
}
