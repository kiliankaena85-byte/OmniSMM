'use server';

import { verifySession } from '@/lib/session';
import { orderService } from '@/services/core/order.service';
import { revalidatePath } from 'next/cache';
import { RateLimitService } from '@/services/core/rate-limit.service';

export async function cancelOrderCoolingOffAction(orderId: string) {
  try {
    const session = await verifySession();
    if (!session) {
      return { success: false, error: 'Unauthorized' };
    }

    const tenant = session.tenantId || 'smmplan';
    const isAllowed = await RateLimitService.check(`cancel-order:${tenant}:${session.userId}`, 20, 60);
    if (!isAllowed) {
      return { success: false, error: 'Слишком частые запросы на отмену. Подождите.' };
    }

    const result = await orderService.cancelPendingOrderClient(orderId, session.userId, session.tenantId);

    if (result.success) {
      revalidatePath('/dashboard/orders');
      revalidatePath('/dashboard/orders/[id]', 'page');
      revalidatePath('/dashboard'); // To update balance
      return { success: true };
    }

    return { success: false, error: result.error || 'Failed to cancel the order' };
  } catch (error: unknown) {
    console.error('[cancelOrderAction] Action error:', error);
    return { success: false, error: 'Сеть или серверная ошибка при отмене' };
  }
}
