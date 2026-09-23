'use server';

import { requireOwnerPermission, requireStaffPermission } from '@/lib/server/rbac';
import { roleSchema } from '@/validators/admin.validators';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { settingsService } from '@/services/admin/settings.service';
import { VaultService } from '@/lib/vault';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { getClientIp } from '@/utils/ip';
import { sendAdminAlert } from '@/lib/notifications';

// ── User Role Update ──
export async function updateUserRole(formData: FormData) {
  return requireOwnerPermission(async (admin) => {
    const parsed = roleSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { success: false as const, error: 'Некорректные данные' };
    const { userId: targetUserId, role: newRole, staffRoleId } = parsed.data;

    if (targetUserId === admin.id) {
      return { success: false as const, error: 'Нельзя изменить собственную роль' };
    }

    // SECURITY: Only OWNER can assign high-level administrative roles
    if (['ADMIN', 'OWNER'].includes(newRole) && admin.role !== 'OWNER') {
      return { success: false as const, error: 'Только Владелец может назначать роли Админ или Владелец' };
    }

    const targetUser = await db.user.findUnique({ where: { id: targetUserId }, select: { role: true, email: true } });
    if (!targetUser) return { success: false as const, error: 'Пользователь не найден' };

    // SECURITY: OWNER role cannot be demoted by anyone
    if (targetUser.role === 'OWNER' && newRole !== 'OWNER') {
      return { success: false as const, error: 'Запрещено понижать роль Владельца платформы' };
    }

    // SECURITY: Only OWNER can change roles of existing ADMINs or OWNERs
    if (['ADMIN', 'OWNER'].includes(targetUser.role) && admin.role !== 'OWNER') {
      return { success: false as const, error: 'Только Владелец может изменять права администраторов' };
    }

    const finalStaffRoleId = staffRoleId === 'NONE' || !staffRoleId ? null : staffRoleId;
    await settingsService.updateUserRole(targetUserId, newRole, finalStaffRoleId);

    const ipAddress = await getClientIp();

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'USER_ROLE_CHANGE',
      target: targetUserId,
      targetType: 'USER',
      oldValue: { email: targetUser.email, role: targetUser.role },
      newValue: { role: newRole },
      ipAddress
    });

    const isHighPrivilege = ['ADMIN', 'OWNER'].includes(newRole) || ['ADMIN', 'OWNER'].includes(targetUser.role);
    sendAdminAlert(
      `${isHighPrivilege ? '🚨' : '⚠️'} <b>СМЕНА РОЛИ СОТРУДНИКА / ПОЛЬЗОВАТЕЛЯ</b>\n` +
      `<b>Администратор:</b> ${admin.email} (IP: ${ipAddress || 'unknown'})\n` +
      `<b>Пользователь:</b> ${targetUser.email} (ID: <code>${targetUserId}</code>)\n` +
      `<b>Старая роль:</b> <code>${targetUser.role}</code>\n` +
      `<b>Новая роль:</b> <code>${newRole}</code>`,
      isHighPrivilege ? 'CRITICAL' : 'WARNING'
    );

    revalidatePath('/admin/settings');
    return { success: true as const };
  });
}

// ── Staff Personal Gemini API Key Update ──
export async function updateStaffGeminiApiKeyAction(targetUserId: string, apiKey: string | null) {
  return requireStaffPermission('settings', 'view', async (admin) => {
    // Only owner/admin or the staff user themselves can change their key
    if (admin.role !== 'OWNER' && admin.role !== 'ADMIN' && admin.id !== targetUserId) {
      return { success: false, error: 'Недостаточно прав для изменения ключа сотрудника' };
    }

    const encryptedKey = apiKey && apiKey.trim().length > 5 ? VaultService.encrypt(apiKey.trim()) : null;

    await db.user.update({
      where: { id: targetUserId },
      data: { geminiApiKey: encryptedKey }
    });

    const ipAddress = await getClientIp();

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'USER_ROLE_CHANGE',
      target: targetUserId,
      targetType: 'USER',
      oldValue: { action: 'UPDATE_PERSONAL_GEMINI_KEY' },
      newValue: { hasKey: Boolean(encryptedKey) },
      ipAddress
    });

    revalidatePath('/admin/settings');
    return { success: true };
  });
}
