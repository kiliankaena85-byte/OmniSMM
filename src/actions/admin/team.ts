'use server';

import { db } from '@/lib/db';
import { auditAdmin, auditAdminAwaitable } from '@/lib/admin-audit';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaffPermission } from '@/lib/server/rbac';
import { createRoleSchema } from '@/validators/admin.validators';
import { getClientIp } from '@/utils/ip';

const limitSchema = z.object({
  userId: z.string().min(1),
  limit: z.coerce.number().int().min(0, "Лимит не может быть отрицательным").max(10000000, "Превышен максимальный лимит доверия (100 тыс. рублей)"),
});

// ── Update Trust Budget Cents ──
export async function updateSupportLimit(formData: FormData) {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    // Only OWNER and ADMIN can change limits
    if (!['OWNER', 'ADMIN'].includes(admin.role)) {
      return { success: false as const, error: 'Только Владелец или Админ могут менять лимиты доверия' };
    }

    const payload = Object.fromEntries(formData.entries());
    const parsed = limitSchema.safeParse(payload);
    
    if (!parsed.success) {
      return { success: false as const, error: 'Некорректные параметры' };
    }

    const { userId, limit: limitCents } = parsed.data;

    // Self-modification guard
    if (userId === admin.id) {
      return { success: false as const, error: 'Запрещено изменять собственный лимит доверия' };
    }

    const target = await db.user.findUnique({ where: { id: userId } });
    if (!target) return { success: false as const, error: 'Пользователь не найден' };

    // Hierarchy Guard: Non-OWNER cannot change parameters of OWNER or ADMIN
    if (target.role === 'OWNER' && admin.role !== 'OWNER') {
      return { success: false as const, error: 'Запрещено изменять параметры Владельца' };
    }
    if (target.role === 'ADMIN' && admin.role !== 'OWNER') {
      return { success: false as const, error: 'Только Владелец может изменять параметры Администратора' };
    }

    await db.user.update({
      where: { id: userId },
      data: { supportLimitCents: limitCents },
    });

    const ipAddress = await getClientIp('unknown');
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'UPDATE_TRUST_BUDGET',
      target: userId,
      targetType: 'USER',
      oldValue: { limit: target.supportLimitCents },
      newValue: { limit: limitCents },
      ipAddress
    });

    revalidatePath('/admin/settings');
    return { success: true as const };
  });
}

// ── Create Custom Staff Role ──
export async function createStaffRoleAction(formData: FormData) {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    // SECURITY: Only OWNER can manage roles definitions
    if (admin.role !== 'OWNER') {
      return { success: false as const, error: 'Только Владелец может создавать кастомные роли' };
    }

    const payload = Object.fromEntries(formData.entries());
    const parsed = createRoleSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.errors[0]?.message || 'Некорректные параметры' };
    }

    const { name, description } = parsed.data;

    // Check unique name
    const existing = await db.staffRole.findUnique({ where: { name } });
    if (existing) {
      return { success: false as const, error: 'Роль с таким названием уже существует' };
    }

    const ipAddress = await getClientIp('unknown');

    // Create Role + Default empty Permissions (Fail-Safe Defaults)
    const newRole = await db.$transaction(async (tx) => {
      const role = await tx.staffRole.create({
        data: {
          name,
          description: description || '',
          isSystem: false,
        }
      });

      const sections = ['orders', 'finance', 'catalog', 'settings'];
      await tx.staffPermission.createMany({
        data: sections.map(sec => ({
          roleId: role.id,
          section: sec,
          canView: false,
          canEdit: false,
        }))
      });

      return role;
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'CREATE_STAFF_ROLE',
      target: newRole.id,
      targetType: 'ROLE',
      newValue: { name: newRole.name, description: newRole.description },
      ipAddress
    });

    revalidatePath('/admin/settings');
    return { success: true as const };
  });
}

// ── Toggle Granular Section Permissions ──
const updatePermissionsSchema = z.object({
  roleId: z.string().min(1, 'roleId обязателен'),
  section: z.string().min(1, 'section обязателен'),
  canView: z.boolean().default(false),
  canEdit: z.boolean().default(false),
});

export async function updateStaffRolePermissionsAction(formData: FormData) {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    // SECURITY: Only OWNER can edit permissions
    if (admin.role !== 'OWNER') {
      return { success: false as const, error: 'Только Владелец может изменять права ролей' };
    }

    const rawPayload = {
      roleId: formData.get('roleId'),
      section: formData.get('section'),
      canView: formData.get('canView') === 'true' || formData.get('canView') === 'on',
      canEdit: formData.get('canEdit') === 'true' || formData.get('canEdit') === 'on',
    };
    const parsed = updatePermissionsSchema.safeParse(rawPayload);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.errors[0]?.message || 'Некорректные параметры' };
    }

    const { roleId, section, canView: canViewVal, canEdit: canEditVal } = parsed.data;

    const role = await db.staffRole.findUnique({ where: { id: roleId } });
    if (!role) {
      return { success: false as const, error: 'Роль не найдена' };
    }

    const ipAddress = await getClientIp('unknown');

    const existingPermission = await db.staffPermission.findUnique({
      where: { roleId_section: { roleId, section } }
    });

    await db.staffPermission.upsert({
      where: { roleId_section: { roleId, section } },
      update: {
        canView: canViewVal,
        canEdit: canEditVal
      },
      create: {
        roleId,
        section,
        canView: canViewVal,
        canEdit: canEditVal
      }
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'UPDATE_STAFF_ROLE_PERMISSIONS',
      target: roleId,
      targetType: 'ROLE',
      oldValue: existingPermission ? { canView: existingPermission.canView, canEdit: existingPermission.canEdit } : {},
      newValue: { section, canView: canViewVal, canEdit: canEditVal },
      ipAddress
    });

    revalidatePath('/admin/settings');
    return { success: true as const };
  });
}

// ── Delete Custom Staff Role ──
const deleteRoleSchema = z.object({
  roleId: z.string().min(1, 'roleId обязателен'),
});

export async function deleteStaffRoleAction(formData: FormData) {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    // SECURITY: Only OWNER can delete roles
    if (admin.role !== 'OWNER') {
      return { success: false as const, error: 'Только Владелец может удалять роли' };
    }

    const parsed = deleteRoleSchema.safeParse({ roleId: formData.get('roleId') });
    if (!parsed.success) return { success: false as const, error: parsed.error.errors[0]?.message || 'Некорректные параметры' };
    const { roleId } = parsed.data;

    const role = await db.staffRole.findUnique({ where: { id: roleId } });
    if (!role) return { success: false as const, error: 'Роль не найдена' };

    if (role.isSystem) {
      return { success: false as const, error: 'Нельзя удалять системные роли' };
    }

    const ipAddress = await getClientIp('unknown');

    await db.staffRole.delete({ where: { id: roleId } });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'DELETE_STAFF_ROLE',
      target: roleId,
      targetType: 'ROLE',
      oldValue: { name: role.name },
      newValue: {},
      ipAddress
    });

    revalidatePath('/admin/settings');
    return { success: true as const };
  });
}

// ── Remove Staff Member (Demote to USER) ──
const removeStaffSchema = z.object({
  userId: z.string().min(1, 'userId обязателен'),
});

export async function removeStaffMemberAction(formData: FormData) {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    const parsed = removeStaffSchema.safeParse({ userId: formData.get('userId') });
    if (!parsed.success) {
      return { success: false as const, error: 'Некорректные параметры' };
    }

    const { userId } = parsed.data;

    // SECURITY: Cannot demote yourself
    if (userId === admin.id) {
      return { success: false as const, error: 'Нельзя разжаловать самого себя' };
    }

    const target = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, staffRoleId: true },
    });

    if (!target) {
      return { success: false as const, error: 'Пользователь не найден' };
    }

    // SECURITY: Grant Ceiling — ADMIN cannot demote OWNERs or other ADMINs
    if (['OWNER', 'ADMIN'].includes(target.role) && admin.role !== 'OWNER') {
      return { success: false as const, error: 'Только Владелец может разжаловать Администраторов и Владельцев' };
    }

    // SECURITY: Only OWNER or ADMIN can demote staff
    if (!['OWNER', 'ADMIN'].includes(admin.role)) {
      return { success: false as const, error: 'Недостаточно прав для разжалования сотрудника' };
    }

    const ipAddress = await getClientIp('unknown');

    await db.user.update({
      where: { id: userId },
      data: {
        role: 'USER',
        staffRoleId: null,
      },
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'STAFF_DEMOTED',
      target: userId,
      targetType: 'USER',
      oldValue: { role: target.role, staffRoleId: target.staffRoleId, email: target.email },
      newValue: { role: 'USER', staffRoleId: null },
      ipAddress,
    });

    revalidatePath('/admin/settings');
    return { success: true as const };
  });
}
