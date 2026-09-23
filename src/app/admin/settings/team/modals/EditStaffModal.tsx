'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Settings2, ShieldCheck, Key, DollarSign, UserMinus, Loader2, Check } from 'lucide-react';
import type { StaffRole, StaffPermission } from '@prisma/client';
import type { StaffUser } from '../types';
import { getAllowedRoles } from '../ui-helpers';

interface EditStaffModalProps {
  editingUser: StaffUser | null;
  onClose: () => void;
  editRole: string;
  setEditRole: (v: string) => void;
  editStaffRoleId: string;
  setEditStaffRoleId: (v: string) => void;
  editGeminiKey: string;
  setEditGeminiKey: (v: string) => void;
  editLimit: string;
  setEditLimit: (v: string) => void;
  isSavingEdit: boolean;
  onSave: () => Promise<void>;
  staffRoles: (StaffRole & { permissions: StaffPermission[] })[];
  currentAdminRole?: string;
  canDemote: (role: string) => boolean;
  onDemoteClick: (u: StaffUser) => void;
  onOpenRolePermissions: (role: StaffRole & { permissions: StaffPermission[] }) => void;
}

export function EditStaffModal({
  editingUser,
  onClose,
  editRole,
  setEditRole,
  editStaffRoleId,
  setEditStaffRoleId,
  editGeminiKey,
  setEditGeminiKey,
  editLimit,
  setEditLimit,
  isSavingEdit,
  onSave,
  staffRoles,
  currentAdminRole,
  canDemote,
  onDemoteClick,
  onOpenRolePermissions,
}: EditStaffModalProps) {
  return (
    <Dialog open={!!editingUser} onOpenChange={(open) => !open && onClose()}>
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
                        if (selected) onOpenRolePermissions(selected);
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
                onClick={() => onDemoteClick(editingUser)}
                className="h-9 text-xs font-bold border-amber-500/30 text-amber-600 hover:bg-amber-500/10 gap-1.5"
              >
                <UserMinus className="w-3.5 h-3.5" />
                Разжаловать до USER
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Отмена</Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={isSavingEdit}
            className="font-bold gap-1.5 min-w-[110px]"
          >
            {isSavingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
