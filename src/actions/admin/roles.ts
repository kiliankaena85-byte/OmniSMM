'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { requireStaffPermission } from '@/lib/server/rbac';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { RBAC_SECTIONS, RbacSectionId } from '@/lib/rbac-sections';
import { revalidatePath } from 'next/cache';

const SECTION_IDS = RBAC_SECTIONS.map(s => s.id) as [RbacSectionId, ...RbacSectionId[]];

const permissionItemSchema = z.object({
  section: z.enum(SECTION_IDS),
  canView: z.boolean(),
  canEdit: z.boolean(),
});

const createRoleSchema = z.object({
  name: z.string().min(1, 'Название роли обязательно').max(64, 'Максимальная длина 64 символа').trim(),
  description: z.string().max(255, 'Максимальная длина 255 символов').optional().nullable(),
  permissions: z.array(permissionItemSchema).default([]),
  allowedTenants: z.array(z.string()).optional().default(['smmplan']),
});

const updateRoleSchema = z.object({
  id: z.string().min(1, 'ID роли обязателен'),
  name: z.string().min(1, 'Название роли обязательно').max(64, 'Максимальная длина 64 символа').trim(),
  description: z.string().max(255, 'Максимальная длина 255 символов').optional().nullable(),
  permissions: z.array(permissionItemSchema).default([]),
  allowedTenants: z.array(z.string()).optional(),
});

const cloneRoleSchema = z.object({
  id: z.string().min(1, 'ID роли обязателен'),
  newName: z.string().min(1, 'Название новой роли обязательно').max(64, 'Максимальная длина 64 символа').trim(),
});

const deleteRoleSchema = z.object({
  id: z.string().min(1, 'ID роли обязателен'),
});

/**
 * List all roles with their granular permissions and assigned users count
 */
export async function listRolesWithPermissionsAction() {
  return requireStaffPermission('settings', 'view', async () => {
    const roles = await db.staffRole.findMany({
      include: {
        permissions: true,
        _count: {
          select: { users: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    return { success: true, roles };
  });
}

/**
 * Create a new custom StaffRole
 */
export async function createRoleAction(input: z.input<typeof createRoleSchema>) {
  return requireStaffPermission('settings', 'edit', async (staffUser) => {
    const parsed = createRoleSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Невалидные данные' };
    }

    const { name, description, permissions } = parsed.data;

    // Check unique name
    const existing = await db.staffRole.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } }
    });

    if (existing) {
      return { success: false, error: 'Роль с таким названием существует' };
    }

    // Privilege escalation prevention: staff cannot grant permissions they do not possess
    if (staffUser.role !== 'OWNER' && staffUser.staffRoleId) {
      const creatorRole = await db.staffRole.findUnique({
        where: { id: staffUser.staffRoleId },
        include: { permissions: true },
      });
      const creatorPermKeys = new Set(creatorRole?.permissions.map(p => `${p.section}:${p.canEdit ? 'edit' : 'view'}`) || []);
      for (const p of permissions) {
        if (p.canView && !creatorPermKeys.has(`${p.section}:view`) && !creatorPermKeys.has(`${p.section}:edit`)) {
          return { success: false, error: `Нельзя предоставить право ${p.section}:view, которым вы не обладаете` };
        }
        if (p.canEdit && !creatorPermKeys.has(`${p.section}:edit`)) {
          return { success: false, error: `Нельзя предоставить право ${p.section}:edit, которым вы не обладаете` };
        }
      }
    }

    // Normalize permissions: canEdit implies canView
    const normalizedPermissions = permissions.map(p => ({
      section: p.section,
      canView: p.canEdit ? true : p.canView,
      canEdit: p.canEdit,
    }));

    const newRole = await db.$transaction(async (tx) => {
      const role = await tx.staffRole.create({
        data: {
          name,
          description: description || '',
          isSystem: false,
          allowedTenants: parsed.data.allowedTenants || ['smmplan'],
          permissions: {
            create: normalizedPermissions.map(p => ({
              section: p.section,
              canView: p.canView,
              canEdit: p.canEdit,
            }))
          }
        },
        include: {
          permissions: true,
          _count: { select: { users: true } }
        }
      });
      return role;
    });

    await auditAdminAwaitable({
      adminId: staffUser.id,
      adminEmail: staffUser.email,
      action: 'ROLE_CREATE',
      target: newRole.id,
      targetType: 'StaffRole',
      oldValue: null,
      newValue: {
        id: newRole.id,
        name: newRole.name,
        permissions: newRole.permissions.map(p => ({ section: p.section, canView: p.canView, canEdit: p.canEdit }))
      }
    });

    revalidatePath('/admin/settings');
    revalidatePath('/admin/settings/roles');
    return { success: true, role: newRole };
  });
}

/**
 * Update an existing StaffRole and its permissions matrix
 */
export async function updateRoleAction(input: z.input<typeof updateRoleSchema>) {
  return requireStaffPermission('settings', 'edit', async (staffUser) => {
    const parsed = updateRoleSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Невалидные данные' };
    }

    const { id, name, description, permissions } = parsed.data;

    const existingRole = await db.staffRole.findUnique({
      where: { id },
      include: { permissions: true }
    });

    if (!existingRole) {
      return { success: false, error: 'Роль не найдена' };
    }

    // Protection 1: Admin bootstrap role is view-only (no edit/delete)
    if (existingRole.name === 'Admin' && existingRole.isSystem) {
      return { success: false, error: 'Системную роль Admin нельзя изменять или удалять' };
    }

    // Protection 3: Lockout guard for non-owner/non-admin editing their own role
    const isGlobalAdmin = ['OWNER', 'ADMIN'].includes(staffUser.role);
    if (!isGlobalAdmin && staffUser.staffRoleId === existingRole.id) {
      const settingsPerm = permissions.find(p => p.section === 'settings');
      if (!settingsPerm || !settingsPerm.canEdit) {
        return { success: false, error: 'Нельзя снять права settings:edit с собственной роли' };
      }
    }

    // Check unique name if changed
    if (name.toLowerCase() !== existingRole.name.toLowerCase()) {
      const duplicateName = await db.staffRole.findFirst({
        where: {
          id: { not: id },
          name: { equals: name, mode: 'insensitive' }
        }
      });
      if (duplicateName) {
        return { success: false, error: 'Роль с таким названием существует' };
      }
    }

    // Normalize permissions: canEdit implies canView
    const normalizedPermissions = permissions.map(p => ({
      section: p.section,
      canView: p.canEdit ? true : p.canView,
      canEdit: p.canEdit,
    }));

    const updatedRole = await db.$transaction(async (tx) => {
      // 1. Update basic role properties (preserve isSystem)
      await tx.staffRole.update({
        where: { id },
        data: {
          name: existingRole.isSystem ? existingRole.name : name,
          description: description || '',
          ...(parsed.data.allowedTenants ? { allowedTenants: parsed.data.allowedTenants } : {}),
        }
      });

      // 2. Atomically replace permission matrix
      await tx.staffPermission.deleteMany({
        where: { roleId: id }
      });

      if (normalizedPermissions.length > 0) {
        await tx.staffPermission.createMany({
          data: normalizedPermissions.map(p => ({
            roleId: id,
            section: p.section,
            canView: p.canView,
            canEdit: p.canEdit,
          }))
        });
      }

      return tx.staffRole.findUnique({
        where: { id },
        include: {
          permissions: true,
          _count: { select: { users: true } }
        }
      });
    });

    await auditAdminAwaitable({
      adminId: staffUser.id,
      adminEmail: staffUser.email,
      action: 'ROLE_UPDATE',
      target: id,
      targetType: 'StaffRole',
      oldValue: {
        name: existingRole.name,
        permissions: existingRole.permissions.map(p => ({ section: p.section, canView: p.canView, canEdit: p.canEdit }))
      },
      newValue: {
        name: updatedRole?.name,
        permissions: updatedRole?.permissions.map(p => ({ section: p.section, canView: p.canView, canEdit: p.canEdit }))
      }
    });

    revalidatePath('/admin/settings');
    revalidatePath('/admin/settings/roles');
    return { success: true, role: updatedRole };
  });
}

/**
 * Clone an existing StaffRole with its permissions
 */
export async function cloneRoleAction(input: z.infer<typeof cloneRoleSchema>) {
  return requireStaffPermission('settings', 'edit', async (staffUser) => {
    const parsed = cloneRoleSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Невалидные данные' };
    }

    const { id, newName } = parsed.data;

    const sourceRole = await db.staffRole.findUnique({
      where: { id },
      include: { permissions: true }
    });

    if (!sourceRole) {
      return { success: false, error: 'Исходная роль не найдена' };
    }

    const existingName = await db.staffRole.findFirst({
      where: { name: { equals: newName, mode: 'insensitive' } }
    });

    if (existingName) {
      return { success: false, error: 'Роль с таким названием существует' };
    }

    const cloned = await db.$transaction(async (tx) => {
      const created = await tx.staffRole.create({
        data: {
          name: newName,
          description: `Копия роли "${sourceRole.name}"${sourceRole.description ? ': ' + sourceRole.description : ''}`,
          isSystem: false,
          permissions: {
            create: sourceRole.permissions.map(p => ({
              section: p.section,
              canView: p.canView,
              canEdit: p.canEdit,
            }))
          }
        },
        include: {
          permissions: true,
          _count: { select: { users: true } }
        }
      });
      return created;
    });

    await auditAdminAwaitable({
      adminId: staffUser.id,
      adminEmail: staffUser.email,
      action: 'ROLE_CLONE',
      target: cloned.id,
      targetType: 'StaffRole',
      oldValue: { sourceRoleId: sourceRole.id, sourceRoleName: sourceRole.name },
      newValue: {
        id: cloned.id,
        name: cloned.name,
        permissions: cloned.permissions.map(p => ({ section: p.section, canView: p.canView, canEdit: p.canEdit }))
      }
    });

    revalidatePath('/admin/settings');
    revalidatePath('/admin/settings/roles');
    return { success: true, role: cloned };
  });
}

/**
 * Delete a custom StaffRole
 */
export async function deleteRoleAction(input: z.infer<typeof deleteRoleSchema>) {
  return requireStaffPermission('settings', 'edit', async (staffUser) => {
    const parsed = deleteRoleSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Невалидные данные' };
    }

    const { id } = parsed.data;

    const role = await db.staffRole.findUnique({
      where: { id },
      include: {
        permissions: true,
        users: { select: { id: true, email: true } },
        _count: { select: { users: true } }
      }
    });

    if (!role) {
      return { success: false, error: 'Роль не найдена' };
    }

    // Protection: isSystem cannot be deleted
    if (role.isSystem) {
      return { success: false, error: 'Системные роли нельзя удалять' };
    }

    // Protection: assigned users must be reassigned first
    if (role._count.users > 0) {
      return {
        success: false,
        error: `Сначала переназначьте ${role._count.users} сотрудников, привязанных к этой роли`,
        userCount: role._count.users
      };
    }

    await db.$transaction(async (tx) => {
      await tx.staffPermission.deleteMany({ where: { roleId: id } });
      await tx.staffRole.delete({ where: { id } });
    });

    await auditAdminAwaitable({
      adminId: staffUser.id,
      adminEmail: staffUser.email,
      action: 'ROLE_DELETE',
      target: id,
      targetType: 'StaffRole',
      oldValue: {
        id: role.id,
        name: role.name,
        permissions: role.permissions.map(p => ({ section: p.section, canView: p.canView, canEdit: p.canEdit }))
      },
      newValue: null
    });

    revalidatePath('/admin/settings');
    revalidatePath('/admin/settings/roles');
    return { success: true, id };
  });
}
