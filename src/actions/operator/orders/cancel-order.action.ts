'use server';

import { requireOperatorPermission } from '@/lib/operator/rbac';
import { adminOrderService } from '@/services/admin/order.service';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const schema = z.object({
  orderId: z.string().min(1),
});

export async function cancelOrderAction(orderId: string) {
  const parsed = schema.safeParse({ orderId });
  if (!parsed.success) {
    return { success: false as const, error: 'Некорректный ID заказа' };
  }

  try {
    const result = await requireOperatorPermission('orders', 'edit', async (admin) => {
      await adminOrderService.cancelOrder(parsed.data.orderId, {
        id: admin.id,
        email: admin.email,
      });

      // Await audit for compliance & non-repudiation
      await auditAdminAwaitable({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'ORDER_CANCEL',
        target: parsed.data.orderId,
        targetType: 'ORDER',
      });

      return { success: true as const };
    });

    if (result.success) {
      revalidatePath('/operator/orders');
    }

    return result;
  } catch (err) {
    console.error('[cancelOrderAction] Failed to cancel order:', err);
    const message = err instanceof Error ? err.message : 'Ошибка сервера при отмене заказа';
    return { success: false as const, error: message };
  }
}
