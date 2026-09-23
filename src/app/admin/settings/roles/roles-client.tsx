'use client';

import React, { useState, useTransition, useMemo } from 'react';
import { 
  createRoleAction, 
  updateRoleAction, 
  cloneRoleAction, 
  deleteRoleAction 
} from '@/actions/admin/roles';
import { RbacSectionId } from '@/lib/rbac-sections';
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Users, 
  Plus, 
  Copy, 
  Pencil, 
  Trash2, 
  Check, 
  X, 
  AlertTriangle, 
  Lock,
  Eye,
  Edit3,
  CheckSquare,
  Square
} from 'lucide-react';
import { toast } from 'sonner';

interface PermissionEntry {
  section: string;
  canView: boolean;
  canEdit: boolean;
}

interface StaffRoleWithData {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  permissions: PermissionEntry[];
  _count: {
    users: number;
  };
}

interface SectionMeta {
  id: RbacSectionId;
  label: string;
  group: string;
  description: string;
}

interface RolesClientProps {
  initialRoles: any[];
  sections: ReadonlyArray<SectionMeta>;
}

export function RolesClient({ initialRoles, sections }: RolesClientProps) {
  const [roles, setRoles] = useState<StaffRoleWithData[]>(initialRoles as StaffRoleWithData[]);
  const [isPending, startTransition] = useTransition();

  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<StaffRoleWithData | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    permissions: Record<string, { canView: boolean; canEdit: boolean }>;
  }>({
    name: '',
    description: '',
    permissions: {},
  });

  // Clone Modal state
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [cloningRole, setCloningRole] = useState<StaffRoleWithData | null>(null);
  const [cloneNewName, setCloneNewName] = useState('');

  // Delete Confirm Modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingRole, setDeletingRole] = useState<StaffRoleWithData | null>(null);

  // Group sections by group
  const groupedSections = useMemo(() => {
    const groups: Record<string, SectionMeta[]> = {};
    for (const section of sections) {
      if (!groups[section.group]) {
        groups[section.group] = [];
      }
      groups[section.group].push(section);
    }
    return groups;
  }, [sections]);

  // Open Create Modal
  function handleOpenCreate() {
    setEditingRole(null);
    const initialPerms: Record<string, { canView: boolean; canEdit: boolean }> = {};
    for (const sec of sections) {
      initialPerms[sec.id] = { canView: false, canEdit: false };
    }
    setFormData({
      name: '',
      description: '',
      permissions: initialPerms,
    });
    setIsEditModalOpen(true);
  }

  // Open Edit Modal
  function handleOpenEdit(role: StaffRoleWithData) {
    setEditingRole(role);
    const initialPerms: Record<string, { canView: boolean; canEdit: boolean }> = {};
    for (const sec of sections) {
      const existing = role.permissions.find(p => p.section.toLowerCase() === sec.id.toLowerCase());
      initialPerms[sec.id] = {
        canView: existing ? existing.canView || existing.canEdit : false,
        canEdit: existing ? existing.canEdit : false,
      };
    }
    setFormData({
      name: role.name,
      description: role.description || '',
      permissions: initialPerms,
    });
    setIsEditModalOpen(true);
  }

  // Toggle View Permission
  function handleToggleView(sectionId: string) {
    setFormData(prev => {
      const current = prev.permissions[sectionId] || { canView: false, canEdit: false };
      const nextView = !current.canView;
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [sectionId]: {
            canView: nextView,
            canEdit: nextView ? current.canEdit : false, // if view is turned off, edit must be turned off
          }
        }
      };
    });
  }

  // Toggle Edit Permission
  function handleToggleEdit(sectionId: string) {
    setFormData(prev => {
      const current = prev.permissions[sectionId] || { canView: false, canEdit: false };
      const nextEdit = !current.canEdit;
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [sectionId]: {
            canView: nextEdit ? true : current.canView, // if edit is enabled, view must be enabled
            canEdit: nextEdit,
          }
        }
      };
    });
  }

  // Toggle Entire Group
  function handleToggleGroup(groupName: string, enable: boolean) {
    const groupSecs = groupedSections[groupName] || [];
    setFormData(prev => {
      const updatedPerms = { ...prev.permissions };
      for (const s of groupSecs) {
        updatedPerms[s.id] = { canView: enable, canEdit: enable };
      }
      return { ...prev, permissions: updatedPerms };
    });
  }

  // Toggle All Permissions
  function handleToggleAll(enable: boolean) {
    setFormData(prev => {
      const updatedPerms = { ...prev.permissions };
      for (const s of sections) {
        updatedPerms[s.id] = { canView: enable, canEdit: enable };
      }
      return { ...prev, permissions: updatedPerms };
    });
  }

  // Save Role
  async function handleSaveRole(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Введите название роли');
      return;
    }

    const permissionsArray = Object.entries(formData.permissions)
      .filter(([_, perms]) => perms.canView || perms.canEdit)
      .map(([section, perms]) => ({
        section: section as RbacSectionId,
        canView: perms.canView || perms.canEdit,
        canEdit: perms.canEdit,
      }));

    startTransition(async () => {
      if (editingRole) {
        const res = await updateRoleAction({
          id: editingRole.id,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          permissions: permissionsArray,
        });

        if (res.success && res.role) {
          toast.success(`Роль "${res.role.name}" успешно обновлена`);
          setRoles(prev => prev.map(r => r.id === res.role!.id ? (res.role as StaffRoleWithData) : r));
          setIsEditModalOpen(false);
        } else {
          toast.error(res.error || 'Ошибка при сохранении роли');
        }
      } else {
        const res = await createRoleAction({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          permissions: permissionsArray,
        });

        if (res.success && res.role) {
          toast.success(`Роль "${res.role.name}" успешно создана`);
          setRoles(prev => [...prev, res.role as unknown as StaffRoleWithData]);
          setIsEditModalOpen(false);
        } else {
          toast.error(res.error || 'Ошибка при создании роли');
        }
      }
    });
  }

  // Open Clone Modal
  function handleOpenClone(role: StaffRoleWithData) {
    setCloningRole(role);
    setCloneNewName(`${role.name} (Копия)`);
    setIsCloneModalOpen(true);
  }

  // Execute Clone
  async function handleExecuteClone(e: React.FormEvent) {
    e.preventDefault();
    if (!cloningRole || !cloneNewName.trim()) return;

    startTransition(async () => {
      const res = await cloneRoleAction({
        id: cloningRole.id,
        newName: cloneNewName.trim(),
      });

      if (res.success && res.role) {
        toast.success(`Роль скопирована как "${res.role.name}"`);
        setRoles(prev => [...prev, res.role as StaffRoleWithData]);
        setIsCloneModalOpen(false);
      } else {
        toast.error(res.error || 'Ошибка при клонировании роли');
      }
    });
  }

  // Open Delete Modal
  function handleOpenDelete(role: StaffRoleWithData) {
    setDeletingRole(role);
    setIsDeleteModalOpen(true);
  }

  // Execute Delete
  async function handleExecuteDelete() {
    if (!deletingRole) return;

    startTransition(async () => {
      const res = await deleteRoleAction({ id: deletingRole.id });

      if (res.success) {
        toast.success(`Роль "${deletingRole.name}" удалена`);
        setRoles(prev => prev.filter(r => r.id !== deletingRole.id));
        setIsDeleteModalOpen(false);
      } else {
        toast.error(res.error || 'Ошибка при удалении роли');
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border/70 rounded-lg p-4 shadow-xs">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Реестр ролей персонала
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Всего настроено {roles.length} ролей. Системные роли защищены от удаления.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 shadow-xs shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Создать роль
        </button>
      </div>

      {/* Roles List Table */}
      <div className="bg-card border border-border/70 rounded-lg shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground uppercase font-medium border-b border-border text-[11px]">
              <tr>
                <th className="px-4 py-3">Название роли</th>
                <th className="px-4 py-3">Описание</th>
                <th className="px-4 py-3">Сотрудники</th>
                <th className="px-4 py-3">Права доступа</th>
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {roles.map(role => {
                const viewPermsCount = role.permissions.filter(p => p.canView || p.canEdit).length;
                const editPermsCount = role.permissions.filter(p => p.canEdit).length;
                const isAdminRole = role.name === 'Admin' && role.isSystem;

                return (
                  <tr key={role.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{role.name}</span>
                        {role.isSystem ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <Lock className="w-2.5 h-2.5" />
                            Системная
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                            Пользовательская
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate" title={role.description || ''}>
                      {role.description || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-muted font-medium text-foreground">
                        <Users className="w-3.5 h-3.5 text-muted-foreground" />
                        {role._count?.users || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Eye className="w-3 h-3 text-sky-500" />
                          {viewPermsCount} просм.
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Edit3 className="w-3 h-3 text-emerald-500" />
                          {editPermsCount} правка
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        {!isAdminRole && (
                          <button
                            onClick={() => handleOpenEdit(role)}
                            title="Редактировать права"
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenClone(role)}
                          title="Клонировать роль"
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        {!role.isSystem && (
                          <button
                            onClick={() => handleOpenDelete(role)}
                            title="Удалить роль"
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / Create Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border/70 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {editingRole ? `Редактирование роли: ${editingRole.name}` : 'Создание новой роли'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Настройте гранулярные права доступа для всех модулей платформы
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveRole} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {/* Basic Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      Название роли <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      disabled={editingRole?.isSystem}
                      value={formData.name}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Например: Оператор каталога"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
                      required
                    />
                    {editingRole?.isSystem && (
                      <p className="text-[11px] text-amber-500 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Системное название роли заблокировано от изменений
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      Описание роли
                    </label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Краткое назначение и зоны ответственности"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                {/* Master quick toggles */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/70 text-xs">
                  <span className="font-medium text-foreground">Быстрое управление всей матрицей:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleAll(true)}
                      className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      Выбрать все права
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleAll(false)}
                      className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                    >
                      Снять все
                    </button>
                  </div>
                </div>

                {/* Permission Matrix grouped */}
                <div className="space-y-6">
                  {Object.entries(groupedSections).map(([groupName, groupSecs]) => (
                    <div key={groupName} className="border border-border/70 rounded-lg overflow-hidden shadow-xs">
                      {/* Group Header */}
                      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50 border-b border-border">
                        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                          Группа: {groupName}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleGroup(groupName, true)}
                            className="text-[11px] text-primary hover:underline"
                          >
                            Включить группу
                          </button>
                          <span className="text-muted-foreground">•</span>
                          <button
                            type="button"
                            onClick={() => handleToggleGroup(groupName, false)}
                            className="text-[11px] text-muted-foreground hover:underline"
                          >
                            Сбросить
                          </button>
                        </div>
                      </div>

                      {/* Section rows */}
                      <div className="divide-y divide-border/60">
                        {groupSecs.map(sec => {
                          const perms = formData.permissions[sec.id] || { canView: false, canEdit: false };
                          return (
                            <div key={sec.id} className="grid grid-cols-12 items-center px-4 py-2.5 hover:bg-muted/20 transition-colors text-xs gap-3">
                              <div className="col-span-6 sm:col-span-7">
                                <div className="font-medium text-foreground">{sec.label}</div>
                                <div className="text-[11px] text-muted-foreground leading-tight">{sec.description}</div>
                              </div>
                              <div className="col-span-3 sm:col-span-2.5 flex items-center justify-end sm:justify-center">
                                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={perms.canView}
                                    onChange={() => handleToggleView(sec.id)}
                                    className="rounded border-border text-primary focus:ring-primary/20 h-4 w-4"
                                  />
                                  <span className="text-xs text-foreground">Просмотр</span>
                                </label>
                              </div>
                              <div className="col-span-3 sm:col-span-2.5 flex items-center justify-end sm:justify-center">
                                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={perms.canEdit}
                                    onChange={() => handleToggleEdit(sec.id)}
                                    className="rounded border-border text-primary focus:ring-primary/20 h-4 w-4"
                                  />
                                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Правка</span>
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 shadow-sm disabled:opacity-60"
                >
                  {isPending ? 'Сохранение...' : editingRole ? 'Сохранить изменения' : 'Создать роль'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clone Modal */}
      {isCloneModalOpen && cloningRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border/70 rounded-lg shadow-2xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-foreground font-semibold text-base">
              <Copy className="w-5 h-5 text-primary" />
              Клонирование роли
            </div>
            <p className="text-xs text-muted-foreground">
              Будет создана новая пользовательская роль с точной копией матрицы прав роли «{cloningRole.name}».
            </p>
            <form onSubmit={handleExecuteClone} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Название новой роли <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={cloneNewName}
                  onChange={e => setCloneNewName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCloneModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {isPending ? 'Копирование...' : 'Клонировать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {isDeleteModalOpen && deletingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border/70 rounded-lg shadow-2xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-destructive font-semibold text-base">
              <AlertTriangle className="w-5 h-5" />
              Удаление роли
            </div>
            <p className="text-xs text-muted-foreground">
              Вы уверены, что хотите удалить роль «{deletingRole.name}»? Это действие необратимо.
            </p>

            {deletingRole._count?.users > 0 && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                К этой роли привязано сотрудников: <strong>{deletingRole._count.users}</strong>. Сначала переназначьте их в разделе «Персонал».
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={isPending || deletingRole._count?.users > 0}
                onClick={handleExecuteDelete}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? 'Удаление...' : 'Удалить роль'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
