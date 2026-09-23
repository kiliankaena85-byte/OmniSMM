'use server';

import { requireOperatorPermission, getOperatorContext } from '@/lib/operator/rbac';
import { addUserNote } from '@/services/operator/users/user-notes.query';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const schema = z.object({
  userId: z.string().min(1),
  content: z.string().min(1, 'Текст заметки не может быть пустым').max(2000, 'Заметка слишком длинная (макс. 2000 символов)'),
  orderId: z.string().nullable().optional(),
  ticketId: z.string().nullable().optional(),
});

export async function createUserNoteAction(data: {
  userId: string;
  content: string;
  orderId?: string | null;
  ticketId?: string | null;
}) {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const errorMsg = parsed.error.errors[0]?.message || 'Некорректные входные данные';
    return { success: false, error: errorMsg };
  }

  try {
    const result = await requireOperatorPermission('orders', 'edit', async () => {
      const context = await getOperatorContext();
      const authorId = context?.user?.id || null;

      await addUserNote(
        parsed.data.userId,
        authorId,
        parsed.data.content,
        parsed.data.orderId,
        parsed.data.ticketId
      );

      return { success: true };
    });

    if (result.success) {
      revalidatePath(`/operator/users/${parsed.data.userId}`);
    }

    return result;
  } catch (err) {
    console.error('[createUserNoteAction] Error creating note:', err);
    const message = err instanceof Error ? err.message : 'Ошибка сервера при создании заметки';
    return { success: false, error: message };
  }
}
