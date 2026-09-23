'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ShieldCheck, Loader2, Check } from 'lucide-react';
import { RBAC_SECTIONS } from '@/lib/rbac-sections';
import type { RolePermissionsState } from '../types';

interface RolePermissionsModalProps {
  editingRolePermissions: RolePermissionsState | null;
  onClose: () => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
  setEditingRolePermissions: React.Dispatch<React.SetStateAction<RolePermissionsState | null>>;
}

const RBAC_GROUPS = ['Общее', 'Операции', 'Каталог', 'Рост', 'Деньги', 'Аналитика', 'Система'];

export function RolePermissionsModal({
  editingRolePermissions,
  onClose,
  onSave,
  isSaving,
  setEditingRolePermissions,
}: RolePermissionsModalProps) {
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

  return (
    <Dialog open={!!editingRolePermissions} onOpenChange={(open) => !open && onClose()}>
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
                variant="outline"
                size="sm"
                onClick={() => setAllPermissions('view')}
                className="h-7 text-[10px] font-bold px-2 rounded-lg"
              >
                Все: Просмотр
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAllPermissions('full')}
                className="h-7 text-[10px] font-bold px-2 rounded-lg text-primary border-primary/30"
              >
                Все: Полный доступ
              </Button>
              <Button
                type="button"
                variant="ghost"
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
            {RBAC_GROUPS.map(groupName => {
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
                                        },
                                      },
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
                                        },
                                      },
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
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
            Отмена
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={isSaving}
            className="font-bold gap-1.5 min-w-[120px]"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Сохранить права
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
