/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Payment dispatcher and error handling for Checkout Orchestrator.
 */
import { toast } from 'sonner';
import { executePaymentRedirect } from '@/utils/payment-redirect';
import { parseActionableError } from '@/lib/errors/actionable-error';
import type { OrderCheckoutResultData } from './types';

export function saveGuestOrderToken(orderId?: string, guestOrderToken?: string): void {
  if (!orderId || !guestOrderToken || typeof window === 'undefined') return;
  try {
    localStorage.setItem(`guest_order_${orderId}`, guestOrderToken);
    const existing: string[] = JSON.parse(localStorage.getItem('guest_orders') || '[]');
    if (!existing.includes(orderId)) {
      existing.unshift(orderId);
      localStorage.setItem('guest_orders', JSON.stringify(existing.slice(0, 10)));
    }
  } catch {
    /* ignore storage error */
  }
}

export function handlePaymentSuccess(
  data: OrderCheckoutResultData | undefined,
  gateway: string,
  isDirect: boolean
): boolean {
  if (!data) return false;

  saveGuestOrderToken(data.orderId, data.guestOrderToken);

  if (data.paymentUrl) {
    const redirected = executePaymentRedirect(data.paymentUrl);
    if (!redirected) {
      if (isDirect) {
        toast.error('Не удалось открыть платежный шлюз');
      } else {
        const errorMessage = 'Ошибка: не удалось открыть платёжный шлюз.';
        window.location.href = `/support/payment-error?error=${encodeURIComponent(errorMessage)}&gateway=${gateway}`;
      }
      return false;
    }
    return true;
  }

  if (gateway === 'balance' || data.redirectUrl) {
    toast.success(`Заказ #${data.numericId || data.orderId || ''} успешно запущен!`, {
      description: 'Оплата произведена с вашего баланса.'
    });
    window.location.href = data.redirectUrl || `/dashboard/orders?success=1&orderId=${data.orderId}&payment=balance`;
    return true;
  }

  if (data.orderId) {
    const tokenQuery = data.guestOrderToken ? `&token=${data.guestOrderToken}` : '';
    window.location.href = `/success?orderId=${data.orderId}${tokenQuery}`;
    return true;
  }

  if (data.paymentId) {
    window.location.href = `/success?paymentId=${data.paymentId}`;
    return true;
  }

  return true;
}

export function handlePaymentFailure(
  err: unknown,
  code: string | undefined,
  serviceId: string | undefined,
  gateway: string,
  isDirect: boolean,
  onAccountExists: () => void,
  onActionableRetry?: (targetGateway?: string, redirectUrl?: string) => void
): void {
  const errMessage = err instanceof Error ? err.message : String(err || '');

  if (code === 'ACCOUNT_EXISTS' || errMessage.includes('уже зарегистрирован')) {
    onAccountExists();
    return;
  }

  if (errMessage.includes("Telegram-аккаунт") || errMessage.includes("привяжите ваш Telegram-аккаунт")) {
    toast.error(errMessage, {
      position: 'top-center',
      duration: 8000,
      action: {
        label: 'Привязать',
        onClick: () => window.location.href = '/dashboard/settings'
      }
    });
    return;
  }

  if (errMessage.startsWith('VOUCHER_USE_BALANCE:')) {
    toast.error('Это ваучер на пополнение баланса. Перейдите в раздел «Мой баланс» для активации.', {
      position: 'top-center',
      duration: 6000,
      action: {
        label: 'Мой баланс',
        onClick: () => window.location.href = '/dashboard/add-funds'
      }
    });
    return;
  }

  if (isDirect) {
    const actionable = parseActionableError(errMessage, { serviceId });
    toast.error(actionable.message, {
      position: 'top-center',
      duration: 8000,
      action: actionable.action ? {
        label: actionable.action.label,
        onClick: () => {
          if (onActionableRetry) {
            onActionableRetry(actionable.action?.targetGateway, actionable.action?.redirectUrl);
          }
        }
      } : undefined
    });
  } else {
    window.location.href = `/support/payment-error?error=${encodeURIComponent(errMessage || 'Ошибка платежного шлюза.')}&serviceId=${serviceId || ''}&gateway=${gateway}`;
  }
}
