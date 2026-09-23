'use client';

import React, { useState, useTransition, useCallback } from 'react';
import {
  updateSupportLimit,
  createStaffRoleAction,
  updateStaffRolePermissionsAction,
  deleteStaffRoleAction,
  removeStaffMemberAction,
} from '@/actions/admin/team';
import { updateUserRole, updateStaffGeminiApiKeyAction } from '@/actions/admin/settings';
import { updateRoleAction } from '@/actions/admin/roles';
import { toast } from 'sonner';
import type { StaffRole, StaffPermission } from '@prisma/client';
import { RBAC_SECTIONS, type RbacSectionId } from '@/lib/rbac-sections';
import {
  type StaffUser,
  type RegularUser,
  type TeamManagementProps,
  type RolePermissionsState,
  DeleteRoleModal,
  DemoteStaffModal,
  EditStaffModal,
  RolePermissionsModal,
  StaffTableSection,
  CustomRolesSection,
  PromoteUserSection,
} from './team';

export type { StaffUser, RegularUser, TeamManagementProps };

export function TeamManagement({
  staffUsers,
  regularUsers,
  searchQuery,
  currentAdminRole,
  staffRoles = [],
}: TeamManagementProps) {
  const [isPending, startTransition] = useTransition();

  // Modals state (hoisted to component top level per AGENTS.md Modal Hoisting rule)
  const [roleToDelete, setRoleToDelete] = useState<{ id: string; name: string } | null>(null);
  const [staffToRemove, setStaffToRemove] = useState<{ id: string; email: string; role: string } | null>(null);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);

  // Edit modal local state
  const [editRole, setEditRole] = useState('');
  const [editStaffRoleId, setEditStaffRoleId] = useState('NONE');
  const [editGeminiKey, setEditGeminiKey] = useState('');
  const [editLimit, setEditLimit] = useState('');
  const [isSavingEdit, setSavingEdit] = useState(false);

  // Full 16-section permissions editor modal state
  const [editingRolePermissions, setEditingRolePermissions] = useState<RolePermissionsState | null>(null);
  const [isSavingRolePerms, setIsSavingRolePerms] = useState(false);

  const isOwner = currentAdminRole === 'OWNER';

  const canDemote = useCallback((targetRole: string) => {
    if (!isOwner && ['OWNER', 'ADMIN'].includes(targetRole)) return false;
    if (!['OWNER', 'ADMIN'].includes(currentAdminRole || '')) return false;
    return true;
  }, [isOwner, currentAdminRole]);

  const openEdit = useCallback((u: StaffUser) => {
    setEditingUser(u);
    setEditRole(u.role);
    setEditStaffRoleId(u.staffRoleId || 'NONE');
    setEditGeminiKey('');
    setEditLimit(String((u.supportLimitCents || 0) / 100));
  }, []);

  const openRolePermissionsModal = useCallback((role: StaffRole & { permissions: StaffPermission[] }) => {
    const permMap: Record<string, { canView: boolean; canEdit: boolean }> = {};
    for (const s of RBAC_SECTIONS) {
      const p = role.permissions?.find(x => x.section === s.id);
      permMap[s.id] = {
        canView: p?.canView || false,
        canEdit: p?.canEdit || false,
      };
    }
    setEditingRolePermissions({
      id: role.id,
      name: role.name,
      description: role.description || '',
      isSystem: role.isSystem,
      permissions: permMap,
    });
  }, []);

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setSavingEdit(true);
    try {
      const roleForm = new FormData();
      roleForm.append('userId', editingUser.id);
      roleForm.append('role', editRole);
      roleForm.append('staffRoleId', editStaffRoleId === 'NONE' ? '' : editStaffRoleId);
      await updateUserRole(roleForm);

      const limitCents = Math.round(parseFloat(editLimit || '0') * 100);
      const limitForm = new FormData();
      limitForm.append('userId', editingUser.id);
      limitForm.append('limit', String(limitCents));
      await updateSupportLimit(limitForm);

      if (editGeminiKey.trim()) {
        const res = await updateStaffGeminiApiKeyAction(editingUser.id, editGeminiKey.trim());
        if (!res.success) toast.error(res.error || 'Ошибка сохранения Gemini ключа');
      }

      toast.success(`Сотрудник ${editingUser.email} обновлён`);
      setEditingUser(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmRemoveStaff = () => {
    if (!staffToRemove) return;
    setStaffToRemove(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append('userId', staffToRemove.id);
      const res = await removeStaffMemberAction(fd);
      if (res?.success) toast.success(`Сотрудник ${staffToRemove.email} разжалован`);
      else toast.error(res?.error || 'Ошибка при разжаловании');
    });
  };

  const confirmDeleteRole = () => {
    if (!roleToDelete) return;
    const { id } = roleToDelete;
    setRoleToDelete(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append('roleId', id);
      const res = await deleteStaffRoleAction(fd);
      if (res?.success) toast.success('Роль удалена');
      else toast.error(res?.error || 'Ошибка удаления роли');
    });
  };

  const handleCreateRole = async (name: string, description: string) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('description', description);
      const res = await createStaffRoleAction(fd);
      if (res?.success) {
        toast.success('Кастомная роль создана');
      } else {
        toast.error(res?.error || 'Ошибка создания роли');
      }
    });
  };

  const handleTogglePermission = (roleId: string, section: string, currentVal: boolean, type: 'view' | 'edit') => {
    startTransition(async () => {
      const existing = staffRoles.find(r => r.id === roleId);
      const perm = existing?.permissions?.find(p => p.section === section);
      const nextView = type === 'view' ? !currentVal : (perm?.canView || false);
      const nextEdit = type === 'edit' ? !currentVal : (perm?.canEdit || false);
      const finalView = nextEdit ? true : nextView;
      const fd = new FormData();
      fd.append('roleId', roleId);
      fd.append('section', section);
      fd.append('canView', finalView ? 'true' : 'false');
      fd.append('canEdit', nextEdit ? 'true' : 'false');
      const res = await updateStaffRolePermissionsAction(fd);
      if (res?.success) toast.success(`Права «${section.toUpperCase()}» обновлены`);
      else toast.error(res?.error || 'Ошибка');
    });
  };

  const handleSaveRolePermissions = async () => {
    if (!editingRolePermissions) return;
    setIsSavingRolePerms(true);
    try {
      const permsArray = Object.entries(editingRolePermissions.permissions).map(([sec, p]) => ({
        section: sec as RbacSectionId,
        canView: p.canView || p.canEdit,
        canEdit: p.canEdit,
      }));
      const res = await updateRoleAction({
        id: editingRolePermissions.id,
        name: editingRolePermissions.name,
        description: editingRolePermissions.description,
        permissions: permsArray,
      });
      if (res.success) {
        toast.success(`Права роли «${editingRolePermissions.name}» успешно сохранены`);
        setEditingRolePermissions(null);
      } else {
        toast.error(res.error || 'Ошибка сохранения прав роли');
      }
    } catch {
      toast.error('Произошла ошибка при сохранении прав');
    } finally {
      setIsSavingRolePerms(false);
    }
  };

  const handleUpdateRole = async (formData: FormData) => {
    try {
      await updateUserRole(formData);
      toast.success('Роль пользователя обновлена');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка при обновлении роли');
    }
  };

  return (
    <div className="space-y-6">
      {/* ── MODALS ── */}
      <DeleteRoleModal
        roleToDelete={roleToDelete}
        onClose={() => setRoleToDelete(null)}
        onConfirm={confirmDeleteRole}
        isPending={isPending}
      />

      <DemoteStaffModal
        staffToRemove={staffToRemove}
        onClose={() => setStaffToRemove(null)}
        onConfirm={confirmRemoveStaff}
        isPending={isPending}
      />

      <EditStaffModal
        editingUser={editingUser}
        onClose={() => setEditingUser(null)}
        editRole={editRole}
        setEditRole={setEditRole}
        editStaffRoleId={editStaffRoleId}
        setEditStaffRoleId={setEditStaffRoleId}
        editGeminiKey={editGeminiKey}
        setEditGeminiKey={setEditGeminiKey}
        editLimit={editLimit}
        setEditLimit={setEditLimit}
        isSavingEdit={isSavingEdit}
        onSave={handleSaveEdit}
        staffRoles={staffRoles}
        currentAdminRole={currentAdminRole}
        canDemote={canDemote}
        onDemoteClick={(u) => {
          setEditingUser(null);
          setStaffToRemove({ id: u.id, email: u.email, role: u.role });
        }}
        onOpenRolePermissions={openRolePermissionsModal}
      />

      <RolePermissionsModal
        editingRolePermissions={editingRolePermissions}
        onClose={() => setEditingRolePermissions(null)}
        onSave={handleSaveRolePermissions}
        isSaving={isSavingRolePerms}
        setEditingRolePermissions={setEditingRolePermissions}
      />

      {/* ── SECTION 1: Staff Table ── */}
      <StaffTableSection
        staffUsers={staffUsers}
        staffRoles={staffRoles}
        onOpenEdit={openEdit}
        onOpenDemote={(u) => setStaffToRemove({ id: u.id, email: u.email, role: u.role })}
        canDemote={canDemote}
        isPending={isPending}
      />

      {/* ── SECTION 2: Custom Roles & Permissions Matrix (Owner-only) ── */}
      {isOwner && (
        <CustomRolesSection
          staffRoles={staffRoles}
          onOpenRolePermissions={openRolePermissionsModal}
          onOpenDeleteRole={setRoleToDelete}
          onTogglePermission={handleTogglePermission}
          onCreateRole={handleCreateRole}
          isPending={isPending}
        />
      )}

      {/* ── SECTION 3: Promote User ── */}
      <PromoteUserSection
        regularUsers={regularUsers}
        searchQuery={searchQuery}
        currentAdminRole={currentAdminRole}
        staffRoles={staffRoles}
        onUpdateRole={handleUpdateRole}
      />
    </div>
  );
}
