'use server';

import { requireOperatorPermission } from '@/lib/operator/rbac';
import { adminUserService } from '@/services/admin/user.service';
import { z } from 'zod';

const inputSchema = z.object({
  search: z.string().optional(),
  cursor: z.string().optional(),
  pageSize: z.number().int().positive().optional(),
});

export async function getUsersListAction(params: {
  search?: string;
  cursor?: string;
  pageSize?: number;
} = {}) {
  const parsed = inputSchema.safeParse(params);
  if (!parsed.success) {
    throw new Error('Некорректные параметры запроса');
  }

  return requireOperatorPermission('orders', 'view', async () => {
    return adminUserService.listUsers({
      search: parsed.data.search,
      cursor: parsed.data.cursor,
      pageSize: parsed.data.pageSize || 50,
    });
  });
}
