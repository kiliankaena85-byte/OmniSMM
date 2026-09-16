'use client';

import React, { useState, useTransition, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  updateSupportLimit,
  createStaffRoleAction,
  updateStaffRolePermissionsAction,
  deleteStaffRoleAction,
  removeStaffMemberAction,
} from '@/actions/admin/team';
import { updateUserRole, updateStaffGeminiApiKeyAction } from '@/actions/admin/settings';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Link from 'next/link';
import {
  Search, ShieldAlert, UserPlus, UserMinus, Loader2, Trash2,
  Plus, Check, ShieldCheck, AlertTriangle, Settings2, Key,
  DollarSign, Users, Package, ExternalLink, Lock, CheckSquare, Square
} from 'lucide-react';
import { useFormStatus } from 'react-dom';
import type { StaffRole, StaffPermission } from '@prisma/client';
import { RBAC_SECTIONS, type RbacSectionId } from '@/lib/rbac-sections';
import { updateRoleAction } from '@/actions/admin/roles';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StaffUser {
  id: string;
  email: string;
  role: string;
  balance: bigint;
  supportLimitCents: number;
  geminiApiKey: string | null;
  createdAt: Date;
  staffRoleId: string | null;
  staffRole?: { id: string; name: string } | null;
  _count: { orders: number; tickets: number };
}

export interface RegularUser {
  id: string;
  email: string;
  role: string;
  balance: bigint;
  supportLimitCents: number;
  createdAt: Date;
  staffRoleId?: string | null;
  _count: { orders: number; tickets: number };
}

interface TeamManagementProps {
  staffUsers: StaffUser[];
  regularUsers: RegularUser[];
  searchQuery: string;
  currentAdminRole?: string;
  staffRoles?: (StaffRole & { permissions: StaffPermission[] })[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SearchButton() {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} type="submit" className="font-bold text-xs h-10 px-6 cursor-pointer">
      {pending && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
      Найти
    </Button>
  );
}

const getAllowedRoles = (adminRole?: string) => {
  const base = ['USER', 'SUPPORT', 'MANAGER', 'BANNED'];
  if (adminRole === 'OWNER') return [...base, 'ADMIN', 'OWNER'];
  return base;
};

const ROLE_COLORS: Record<string, string> = {
  OWNER:   'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-400',
  ADMIN:   'bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400',
  MANAGER: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
  SUPPORT: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400',
  BANNED:  'bg-rose-500/10 text-rose-500 border-rose-500/20',
  USER:    'bg-muted/60 text-muted-foreground border-border',
};

function RoleBadge({ role }: { role: string }) {
  const cls = ROLE_COLORS[role] || ROLE_COLORS.USER;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${cls}`}>
      {role}
    </span>
  );
}

function EmailAvatar({ email }: { email: string }) {
  const letter = email?.[0]?.toUpperCase() ?? '?';
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary text-xs font-black border border-primary/20 shrink-0">
      {letter}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function TeamManagement({
  staffUsers,
  regularUsers,
  searchQuery,
  currentAdminRole,
  staffRoles = [],
}: TeamManagementProps) {
  const [isPending, startTransition] = useTransition();
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Search & filter
  const [searchEmail, setSearchEmail] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Modals (hoisted to component top level per AGENTS.md Modal Hoisting rule)
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
  const [editingRolePermissions, setEditingRolePermissions] = useState<{
    id: string;
    name: string;
    description: string;
    isSystem: boolean;
    permissions: Record<string, { canView: boolean; canEdit: boolean }>;
  } | null>(null);
  const [isSavingRolePerms, setIsSavingRolePerms] = useState(false);

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

  const setAllPermissions = (mode: 'view' | 'full' | 'none') => {
    if (!editingRolePermissions) return;
    const next: Record<string, { canView: boolean; canEdit: boolean }> = {};
    for (const s of RBAC_SECTIONS) {
      if (mode === 'full') {
        next[s.id] = { canView: true, canEdit: true };
      } else if (mode === 'view') {
        next[s.id] = { canView: true, canEdit: false };
      } else {
        next[s.id] = { canView: false, canEdit: false };
      }
    }
    setEditingRolePermissions(prev => prev ? { ...prev, permissions: next } : null);
  };

  const isOwner = currentAdminRole === 'OWNER';

  const filteredStaff = staffUsers.filter((u) => {
    const matchEmail = u.email.toLowerCase().includes(searchEmail.toLowerCase().trim());
    const matchRole = filterRole === 'ALL' || u.role === filterRole || u.staffRoleId === filterRole;
    return matchEmail && matchRole;
  });
  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedStaff = filteredStaff.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

  // ── Open Edit Modal ──────────────────────────────────────────────────────────

  const openEdit = useCallback((u: StaffUser) => {
    setEditingUser(u);
    setEditRole(u.role);
    setEditStaffRoleId(u.staffRoleId || 'NONE');
    setEditGeminiKey('');
    setEditLimit(String((u.supportLimitCents || 0) / 100));
  }, []);

  // ── Save Edit Modal ──────────────────────────────────────────────────────────

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setSavingEdit(true);
    try {
      // 1. Role
      const roleForm = new FormData();
      roleForm.append('userId', editingUser.id);
      roleForm.append('role', editRole);
      roleForm.append('staffRoleId', editStaffRoleId === 'NONE' ? '' : editStaffRoleId);
      await updateUserRole(roleForm);

      // 2. Limit
      const limitCents = Math.round(parseFloat(editLimit || '0') * 100);
      const limitForm = new FormData();
      limitForm.append('userId', editingUser.id);
      limitForm.append('limit', String(limitCents));
      await updateSupportLimit(limitForm);

      // 3. Gemini key (only if provided)
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

  // ── Demote ───────────────────────────────────────────────────────────────────

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

  // ── Delete Role ──────────────────────────────────────────────────────────────

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

  // ── Create Role ──────────────────────────────────────────────────────────────

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.append('name', newRoleName.trim());
      fd.append('description', newRoleDesc.trim());
      const res = await createStaffRoleAction(fd);
      if (res?.success) {
        toast.success('Кастомная роль создана');
        setNewRoleName('');
        setNewRoleDesc('');
        setShowCreateForm(false);
      } else {
        toast.error(res?.error || 'Ошибка создания роли');
      }
    });
  };

  // ── Permission Toggle ─────────────────────────────────────────────────────────

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

  // ── Update Role (Promote) ─────────────────────────────────────────────────────

  async function handleUpdateRole(formData: FormData) {
    try {
      await updateUserRole(formData);
      toast.success('Роль пользователя обновлена');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка при обновлении роли');
    }
  }

  const canDemote = (targetRole: string) => {
    if (!isOwner && ['OWNER', 'ADMIN'].includes(targetRole)) return false;
    if (!['OWNER', 'ADMIN'].includes(currentAdminRole || '')) return false;
    return true;
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── MODAL: Delete Role ── */}
      <Dialog open={!!roleToDelete} onOpenChange={(open) => !open && setRoleToDelete(null)}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <div className="flex items-center gap-3 text-rose-500 pb-1">
              <AlertTriangle className="w-5 h-5" />
              <DialogTitle className="text-base font-bold">Удалить роль</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Роль <strong className="text-foreground">«{roleToDelete?.name}»</strong> будет удалена.
              Все сотрудники с этой ролью потеряют её доступы.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setRoleToDelete(null)}>Отмена</Button>
            <Button variant="destructive" size="sm" onClick={confirmDeleteRole} className="font-bold gap-1.5">
              <Trash2 className="w-3.5 h-3.5" />
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: Demote Staff ── */}
      <Dialog open={!!staffToRemove} onOpenChange={(open) => !open && setStaffToRemove(null)}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <div className="flex items-center gap-3 text-amber-500 pb-1">
              <UserMinus className="w-5 h-5" />
              <DialogTitle className="text-base font-bold">Разжаловать сотрудника</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground font-mono">{staffToRemove?.email}</strong> будет переведён в роль{' '}
              <strong className="text-foreground">USER</strong>. Аккаунт и история сохраняются.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setStaffToRemove(null)}>Отмена</Button>
            <Button variant="destructive" size="sm" onClick={confirmRemoveStaff} disabled={isPending} className="font-bold gap-1.5">
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />}
              Разжаловать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: Edit Staff Member ── */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader>
            <div className="flex items-center gap-3 pb-1">
              <div className="p-2 bg-primary/10 rounded-xl border border-primary/20">
                <Settings2 className="w-4 h-4 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">Настройки сотрудника</DialogTitle>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate max-w-[300px]">
                  {editingUser?.email}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Row 1: Role + Staff Role Group */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Системная роль
                </label>
                <Select value={editRole} onValueChange={(v: string | null) => setEditRole(v || '')}>
                  <SelectTrigger className="h-10 bg-background text-xs font-bold rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getAllowedRoles(currentAdminRole).map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Группа прав (RBAC)
                </label>
                {editRole === 'OWNER' ? (
                  <div className="h-10 px-3 flex items-center bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold">
                    Полный доступ (OWNER)
                  </div>
                ) : (
                  <>
                    <Select value={editStaffRoleId} onValueChange={(v: string | null) => setEditStaffRoleId(v || 'NONE')}>
                      <SelectTrigger className="h-10 bg-background text-xs font-bold rounded-xl">
                        <SelectValue>
                          {editStaffRoleId === 'NONE'
                            ? `Базовые права (${editRole || 'роли'})`
                            : (staffRoles.find(r => r.id === editStaffRoleId)?.name ?? editStaffRoleId)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">Базовые права ({editRole || 'роли'})</SelectItem>
                        {staffRoles.map(role => (
                          <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {editStaffRoleId !== 'NONE' && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const selected = staffRoles.find(r => r.id === editStaffRoleId);
                          if (selected) openRolePermissionsModal(selected);
                        }}
                        className="w-full h-8 text-[11px] font-bold gap-1.5 border-primary/30 text-primary hover:bg-primary/10 mt-1 cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Настроить права группы
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Row 2: Gemini Key */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                <Key className="w-3 h-3" />
                Персональный Gemini API ключ
                {editingUser?.geminiApiKey && (
                  <span className="ml-1 text-emerald-500 font-medium normal-case tracking-normal text-[9px]">
                    🟢 Сохранён
                  </span>
                )}
              </label>
              <Input
                type="password"
                placeholder={editingUser?.geminiApiKey ? '••••••••••••••••••••' : 'AIzaSy... (оставьте пустым — будет общий пул)'}
                value={editGeminiKey}
                onChange={e => setEditGeminiKey(e.target.value)}
                className="h-10 font-mono text-xs rounded-xl"
              />
            </div>

            {/* Row 3: Daily Limit */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                <DollarSign className="w-3 h-3" />
                Дневной лимит компенсаций (₽)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={editLimit}
                onChange={e => setEditLimit(e.target.value)}
                className="h-10 font-mono text-xs rounded-xl"
              />
              <p className="text-[10px] text-muted-foreground">
                Максимальная сумма, которую сотрудник может зачислить клиенту за день.
              </p>
            </div>

            {/* Row 4: Danger zone */}
            {editingUser && canDemote(editingUser.role) && (
              <div className="pt-2 border-t border-border/60">
                <p className="text-[10px] text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Опасная зона</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingUser(null);
                    setStaffToRemove({ id: editingUser.id, email: editingUser.email, role: editingUser.role });
                  }}
                  className="h-9 text-xs font-bold border-amber-500/30 text-amber-600 hover:bg-amber-500/10 gap-1.5"
                >
                  <UserMinus className="w-3.5 h-3.5" />
                  Разжаловать до USER
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setEditingUser(null)}>Отмена</Button>
            <Button
              size="sm"
              onClick={handleSaveEdit}
              disabled={isSavingEdit}
              className="font-bold gap-1.5 min-w-[110px]"
            >
              {isSavingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: Granular 16-Section RBAC Permissions Editor ── */}
      <Dialog open={!!editingRolePermissions} onOpenChange={(open) => !open && setEditingRolePermissions(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col bg-card border-border overflow-hidden">
          <DialogHeader className="pb-2 border-b border-border/60">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl border border-primary/20">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <span>Матрица прав: {editingRolePermissions?.name}</span>
                  {editingRolePermissions?.isSystem && (
                    <Badge className="text-[9px] font-black uppercase bg-primary/15 text-primary border border-primary/25">
                      Системная
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Гранулярная настройка 16 разделов платформы (просмотр и редактирование).
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 py-4 px-1 space-y-5 pr-2">
            {/* Role Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-muted/20 border border-border/60">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Название роли</label>
                <Input
                  value={editingRolePermissions?.name || ''}
                  disabled={editingRolePermissions?.isSystem}
                  onChange={e => setEditingRolePermissions(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="h-9 text-xs font-bold rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Описание</label>
                <Input
                  value={editingRolePermissions?.description || ''}
                  onChange={e => setEditingRolePermissions(prev => prev ? { ...prev, description: e.target.value } : null)}
                  placeholder="Назначение роли..."
                  className="h-9 text-xs font-semibold rounded-lg"
                />
              </div>
            </div>

            {/* Quick Bulk Actions */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-1">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">Разделы системы ({RBAC_SECTIONS.length})</span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  intent="outline"
                  size="sm"
                  onClick={() => setAllPermissions('view')}
                  className="h-7 text-[10px] font-bold px-2 rounded-lg"
                >
                  Все: Просмотр
                </Button>
                <Button
                  type="button"
                  intent="outline"
                  size="sm"
                  onClick={() => setAllPermissions('full')}
                  className="h-7 text-[10px] font-bold px-2 rounded-lg text-primary border-primary/30"
                >
                  Все: Полный доступ
                </Button>
                <Button
                  type="button"
                  intent="ghost"
                  size="sm"
                  onClick={() => setAllPermissions('none')}
                  className="h-7 text-[10px] font-bold px-2 rounded-lg text-muted-foreground"
                >
                  Снять все
                </Button>
              </div>
            </div>

            {/* 16 Sections Grouped */}
            <div className="space-y-4">
              {['Общее', 'Операции', 'Каталог', 'Рост', 'Деньги', 'Аналитика', 'Система'].map(groupName => {
                const groupSections = RBAC_SECTIONS.filter(s => s.group === groupName);
                if (groupSections.length === 0) return null;

                return (
                  <div key={groupName} className="space-y-2">
                    <div className="text-[11px] font-black uppercase tracking-widest text-muted-foreground px-1 flex items-center gap-2">
                      <span>{groupName}</span>
                      <div className="h-px bg-border/60 flex-1" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {groupSections.map(sec => {
                        const perm = editingRolePermissions?.permissions[sec.id] || { canView: false, canEdit: false };
                        return (
                          <div key={sec.id} className="p-3 rounded-xl border border-border/70 bg-card hover:bg-muted/10 transition-colors space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-xs font-bold text-foreground">{sec.label}</div>
                                <div className="text-[10px] text-muted-foreground line-clamp-1">{sec.description}</div>
                              </div>
                              <Badge className="text-[8px] font-mono shrink-0 bg-muted/60 text-muted-foreground border border-border">
                                {sec.id}
                              </Badge>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px]">
                              {/* Can View */}
                              <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                                <input
                                  type="checkbox"
                                  checked={perm.canView}
                                  onChange={e => {
                                    const nextView = e.target.checked;
                                    setEditingRolePermissions(prev => {
                                      if (!prev) return null;
                                      return {
                                        ...prev,
                                        permissions: {
                                          ...prev.permissions,
                                          [sec.id]: {
                                            canView: nextView,
                                            canEdit: nextView ? perm.canEdit : false,
                                          }
                                        }
                                      };
                                    });
                                  }}
                                  className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary accent-primary"
                                />
                                <span>Просмотр</span>
                              </label>

                              {/* Can Edit */}
                              <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                                <input
                                  type="checkbox"
                                  checked={perm.canEdit}
                                  onChange={e => {
                                    const nextEdit = e.target.checked;
                                    setEditingRolePermissions(prev => {
                                      if (!prev) return null;
                                      return {
                                        ...prev,
                                        permissions: {
                                          ...prev.permissions,
                                          [sec.id]: {
                                            canView: nextEdit ? true : perm.canView,
                                            canEdit: nextEdit,
                                          }
                                        }
                                      };
                                    });
                                  }}
                                  className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary accent-primary"
                                />
                                <span className={perm.canEdit ? 'text-primary font-bold' : ''}>Запись</span>
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="flex justify-between items-center gap-2 pt-3 border-t border-border/60">
            <Button variant="outline" size="sm" onClick={() => setEditingRolePermissions(null)} disabled={isSavingRolePerms}>
              Отмена
            </Button>
            <Button
              size="sm"
              onClick={handleSaveRolePermissions}
              disabled={isSavingRolePerms}
              className="font-bold gap-1.5 min-w-[120px]"
            >
              {isSavingRolePerms ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Сохранить права
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ SECTION 1: Staff Table ══════════════════════════════════════════════ */}
      <Card className="rounded-2xl border-border shadow-sm bg-card">
        <CardContent className="p-5 sm:p-7 space-y-5">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/15 text-destructive rounded-xl border border-destructive/20 shrink-0">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Команда и Escrow Guard</h3>
                <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                  Системные роли, лимиты компенсаций и наборы прав.
                </p>
              </div>
            </div>
            <Badge intent="outline" className="text-xs font-mono font-bold px-3 py-1 self-start sm:self-auto">
              Сотрудников: {filteredStaff.length}
            </Badge>
          </div>

          {/* Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-muted/20 rounded-xl border border-border/60">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Поиск по email..."
                value={searchEmail}
                onChange={e => { setSearchEmail(e.target.value); setCurrentPage(1); }}
                className="pl-9 h-9 text-xs bg-background"
              />
            </div>
            <select
              value={filterRole}
              onChange={e => { setFilterRole(e.target.value); setCurrentPage(1); }}
              className="h-9 bg-background border border-border rounded-xl px-3 text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none sm:w-48 w-full"
            >
              <option value="ALL">Все роли</option>
              <option value="OWNER">OWNER</option>
              <option value="ADMIN">ADMIN</option>
              <option value="MANAGER">MANAGER</option>
              <option value="SUPPORT">SUPPORT</option>
              {staffRoles.map(r => (
                <option key={r.id} value={r.id}>Группа: {r.name}</option>
              ))}
            </select>
            {(searchEmail || filterRole !== 'ALL') && (
              <Button
                type="button"
                intent="ghost"
                size="sm"
                onClick={() => { setSearchEmail(''); setFilterRole('ALL'); setCurrentPage(1); }}
                className="text-xs text-muted-foreground hover:text-foreground h-9 px-3 cursor-pointer shrink-0"
              >
                Сбросить
              </Button>
            )}
          </div>

          {/* ── Desktop Table ── */}
          <div className="rounded-xl border border-border overflow-hidden w-full">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/20">
                  <TableHead className="px-4 py-2.5 text-[10px] font-black uppercase tracking-wider w-[38%]">
                    Сотрудник
                  </TableHead>
                  <TableHead className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider w-[16%]">
                    Системная роль
                  </TableHead>
                  <TableHead className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider w-[22%]">
                    Группа прав
                  </TableHead>
                  <TableHead className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-center w-[12%]">
                    Заказы / Тикеты
                  </TableHead>
                  <TableHead className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-center w-[12%]">
                    Действия
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedStaff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-xs text-muted-foreground">
                      Сотрудники не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedStaff.map(u => (
                    <TableRow key={u.id} className="hover:bg-muted/10 transition-colors">

                      {/* Email */}
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <EmailAvatar email={u.email} />
                          <span
                            className="font-mono text-xs text-foreground truncate"
                            title={u.email}
                          >
                            {u.email}
                          </span>
                        </div>
                      </TableCell>

                      {/* System Role */}
                      <TableCell className="px-3 py-3">
                        <RoleBadge role={u.role} />
                      </TableCell>

                      {/* Custom Group */}
                      <TableCell className="px-3 py-3">
                        {u.staffRole ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary/8 text-primary border border-primary/20 truncate max-w-full" title={u.staffRole.name}>
                            {u.staffRole.name}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">— все права</span>
                        )}
                      </TableCell>

                      {/* Stats */}
                      <TableCell className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground font-medium">
                          <span className="flex items-center gap-1" title="Заказы">
                            <Package className="w-3 h-3" />
                            {u._count.orders}
                          </span>
                          <span className="flex items-center gap-1" title="Тикеты">
                            <Users className="w-3 h-3" />
                            {u._count.tickets}
                          </span>
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            title="Настройки сотрудника"
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-primary hover:bg-primary/10 hover:border-primary/30 transition-colors cursor-pointer"
                          >
                            <Settings2 className="w-3.5 h-3.5" />
                          </button>
                          {canDemote(u.role) && (
                            <button
                              type="button"
                              onClick={() => setStaffToRemove({ id: u.id, email: u.email, role: u.role })}
                              disabled={isPending}
                              title="Разжаловать"
                              className="h-8 w-8 flex items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/30 transition-colors disabled:opacity-40 cursor-pointer"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-1">
              <p className="text-xs text-muted-foreground font-medium">
                {(safePage - 1) * itemsPerPage + 1}–{Math.min(safePage * itemsPerPage, filteredStaff.length)} из {filteredStaff.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button" intent="outline" size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="h-8 px-3 text-xs font-bold"
                >
                  ← Назад
                </Button>
                <span className="px-2 text-xs font-mono font-bold text-foreground">{safePage}/{totalPages}</span>
                <Button
                  type="button" intent="outline" size="sm"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="h-8 px-3 text-xs font-bold"
                >
                  Вперёд →
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ══ SECTION 2: Custom Roles & Permissions Matrix (Owner-only) ══════════ */}
      {isOwner && (
        <Card className="rounded-2xl border-border shadow-sm bg-card">
          <CardContent className="p-5 sm:p-7 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/15 text-primary rounded-xl border border-primary/20">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Роли и Права Доступа</h3>
                  <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                    Тонкая настройка чтения и записи разделов боковой панели.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  asChild
                  intent="outline"
                  size="sm"
                  className="h-9 text-xs font-bold rounded-xl gap-1.5 cursor-pointer"
                >
                  <Link href="/admin/settings/roles">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                    Матрица прав RBAC
                    <ExternalLink className="w-3 h-3 text-muted-foreground ml-0.5" />
                  </Link>
                </Button>
                <Button
                  onClick={() => setShowCreateForm(v => !v)}
                  intent="outline" size="sm"
                  className="h-9 text-xs font-bold rounded-xl gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Создать роль
                </Button>
              </div>
            </div>

            {showCreateForm && (
              <form onSubmit={handleCreateRole} className="p-5 rounded-xl border border-border/80 bg-muted/20 space-y-4 animate-in slide-in-from-top-2 duration-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Новая роль поддержки</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase">Название</span>
                    <Input
                      value={newRoleName} onChange={e => setNewRoleName(e.target.value)}
                      placeholder="Младший саппорт" className="h-10 rounded-xl text-xs font-semibold" required
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase">Описание</span>
                    <Input
                      value={newRoleDesc} onChange={e => setNewRoleDesc(e.target.value)}
                      placeholder="Доступ только к тикетам" className="h-10 rounded-xl text-xs font-semibold"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" intent="ghost" onClick={() => setShowCreateForm(false)} className="h-9 text-xs font-bold rounded-xl cursor-pointer">Отмена</Button>
                  <Button type="submit" disabled={isPending} className="h-9 px-5 text-xs font-bold rounded-xl cursor-pointer gap-1.5">
                    {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                    Сохранить
                  </Button>
                </div>
              </form>
            )}

            <div className="space-y-4">
              {staffRoles.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                  Нет кастомных ролей. Нажмите «Создать роль», чтобы добавить.
                </div>
              ) : (
                staffRoles.map(role => (
                  <div key={role.id} className="p-5 rounded-xl border border-border/80 space-y-4 bg-muted/10">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">{role.name}</h4>
                          {role.isSystem && (
                            <Badge className="text-[8px] font-black uppercase bg-primary/10 text-primary border border-primary/20 rounded-md">Системная</Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">{role.description || 'Описание отсутствует'}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          type="button"
                          intent="outline"
                          size="sm"
                          onClick={() => openRolePermissionsModal(role)}
                          className="h-8 text-[11px] font-bold rounded-lg gap-1.5 border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                          Все 16 прав
                        </Button>
                        {!role.isSystem && (
                          <button
                            onClick={() => setRoleToDelete({ id: role.id, name: role.name })}
                            disabled={isPending}
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40 cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Permissions Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {['orders', 'finance', 'catalog', 'settings'].map(sec => {
                        const perm = role.permissions?.find(p => p.section === sec) || { canView: false, canEdit: false };
                        const labels: Record<string, string> = { orders: 'Заказы', finance: 'Финансы', catalog: 'Каталог', settings: 'Настройки' };
                        return (
                          <div key={sec} className="p-3 rounded-lg border border-border/50 bg-background space-y-2.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-foreground/80 border-b border-border/30 pb-1.5 block">
                              📁 {labels[sec]}
                            </span>
                            {(['view', 'edit'] as const).map(type => {
                              const active = type === 'view' ? perm.canView : perm.canEdit;
                              const label = type === 'view' ? 'Просмотр' : 'Редактирование';
                              return (
                                <div key={type} className="flex justify-between items-center">
                                  <span className="text-[10px] text-muted-foreground">{label}</span>
                                  <button
                                    type="button"
                                    disabled={isPending}
                                    onClick={() => handleTogglePermission(role.id, sec, active, type)}
                                    className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer border ${active ? 'bg-primary border-primary/80' : 'bg-muted/80 border-border'}`}
                                  >
                                    <div className={`w-3.5 h-3.5 rounded-full bg-background shadow-sm transition-transform duration-200 flex items-center justify-center ${active ? 'translate-x-[18px]' : 'translate-x-0'}`}>
                                      {active && <Check className="w-2 h-2 text-primary" />}
                                    </div>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══ SECTION 3: Promote User ════════════════════════════════════════════ */}
      <Card className="rounded-2xl border-border shadow-sm bg-card">
        <CardContent className="p-5 sm:p-7 space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/15 text-primary rounded-xl border border-primary/20">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Назначение ролей</h3>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                Поиск и перевод клиентов в категорию персонала.
              </p>
            </div>
          </div>

          {/* Search Form */}
          <form className="flex gap-3" action="/admin/settings" method="GET">
            <input type="hidden" name="tab" value="team" />
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text" name="q"
                placeholder="Введите email для поиска..."
                defaultValue={searchQuery}
                className="pl-10 h-10 rounded-xl text-xs font-semibold"
              />
            </div>
            <SearchButton />
          </form>

          {/* Results Table */}
          <div className="rounded-xl border border-border overflow-hidden w-full">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/20">
                  <TableHead className="px-4 py-2.5 text-[10px] font-black uppercase tracking-wider w-[45%]">Клиент</TableHead>
                  <TableHead className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider w-[18%]">Текущая роль</TableHead>
                  <TableHead className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider w-[37%] text-right">Назначить</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regularUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-xs text-muted-foreground">
                      {searchQuery ? 'Пользователь не найден' : 'Начните поиск по email'}
                    </TableCell>
                  </TableRow>
                ) : (
                  regularUsers.map(u => (
                    <TableRow key={u.id} className="hover:bg-muted/10 transition-colors">
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <EmailAvatar email={u.email} />
                          <span className="font-mono text-xs text-foreground truncate" title={u.email}>{u.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-3">
                        <RoleBadge role={u.role} />
                      </TableCell>
                      <TableCell className="px-3 py-3">
                        <form action={handleUpdateRole} className="flex items-center gap-2 justify-end flex-wrap">
                          <input type="hidden" name="userId" value={u.id} />

                          <Select name="role" defaultValue={u.role}>
                            <SelectTrigger className="w-28 h-9 bg-background text-[11px] font-bold rounded-lg" size="default">
                              <SelectValue>{(v: string) => v || 'Роль'}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {getAllowedRoles(currentAdminRole).map(r => (
                                <SelectItem key={r} value={r}>{r}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select name="staffRoleId" defaultValue={u.staffRoleId || 'NONE'}>
                            <SelectTrigger className="w-36 h-9 bg-background text-[11px] font-bold rounded-lg" size="default">
                              <SelectValue>
                                {(v: string) => !v || v === 'NONE' ? 'Базовые права' : (staffRoles.find(r => r.id === v)?.name ?? v)}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NONE">Базовые права роли</SelectItem>
                              {staffRoles.map(role => (
                                <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Button type="submit" size="sm" intent="outline" className="h-9 px-3 text-[10px] font-black uppercase tracking-wider cursor-pointer">
                            Назначить
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
