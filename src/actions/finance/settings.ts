'use server';

import { accountingService } from '@/services/financial/accounting.service';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaffPermission } from '@/lib/server/rbac';

import { auditAdminAwaitable } from '@/lib/admin-audit';
import { getClientIp } from '@/utils/ip';

const financeSettingsSchema = z.object({
  taxRate: z.coerce.number().min(0, "Налоговая ставка не может быть отрицательной").max(100, "Налоговая ставка не может превышать 100%").optional().default(6.0),
  opexMonthly: z.coerce.number().min(0, "OPEX не может быть отрицательным").max(10000000, "Максимальный лимит OPEX - 10,000,000 ₽").optional().default(0)
});

export async function updateSystemSettings(formData: FormData) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const result = await requireStaffPermission('finance', 'edit', async (admin) => {
    const parsed = financeSettingsSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) throw new Error('Validation error');
    const { taxRate, opexMonthly: opexRubles } = parsed.data;
    const opexMonthly = Math.round(opexRubles * 100);

    const oldSettings = await db.systemSettings.findUnique({
      where: { id: 'global' }
    });

    await accountingService.updateSettings(taxRate, opexMonthly);
  
    const ipAddress = await getClientIp('unknown');
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'UPDATE_FINANCE_SETTINGS',
      target: 'global',
      targetType: 'SETTINGS',
      oldValue: oldSettings,
      newValue: { taxRate, opexMonthly },
      ipAddress
    });

    revalidatePath('/admin/finance');
  });
}
