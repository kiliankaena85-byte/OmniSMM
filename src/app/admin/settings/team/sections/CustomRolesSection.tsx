'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import {
  ShieldCheck,
  ExternalLink,
  Plus,
  Settings2,
  Trash2,
  Check,
  Loader2,
} from 'lucide-react';
import type { StaffRole, StaffPermission } from '@prisma/client';

interface CustomRolesSectionProps {
  staffRoles?: (StaffRole & { permissions: StaffPermission[] })[];
  onOpenRolePermissions: (role: StaffRole & { permissions: StaffPermission[] }) => void;
  onOpenDeleteRole: (role: { id: string; name: string }) => void;
  onTogglePermission: (roleId: string, section: string, currentVal: boolean, type: 'view' | 'edit') => void;
  onCreateRole: (name: string, desc: string) => Promise<void>;
  isPending: boolean;
}

const QUICK_SECTIONS = [
  { id: 'orders', label: 'Заказы' },
  { id: 'finance', label: 'Финансы' },
  { id: 'catalog', label: 'Каталог' },
  { id: 'settings', label: 'Настройки' },
];

export function CustomRolesSection({
  staffRoles = [],
  onOpenRolePermissions,
  onOpenDeleteRole,
  onTogglePermission,
  onCreateRole,
  isPending,
}: CustomRolesSectionProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    await onCreateRole(newRoleName.trim(), newRoleDesc.trim());
    setNewRoleName('');
    setNewRoleDesc('');
    setShowCreateForm(false);
  };

  return (
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
              variant="outline"
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
              variant="outline"
              size="sm"
              className="h-9 text-xs font-bold rounded-xl gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Создать роль
            </Button>
          </div>
        </div>

        {showCreateForm && (
          <form onSubmit={handleSubmit} className="p-5 rounded-xl border border-border/80 bg-muted/20 space-y-4 animate-in slide-in-from-top-2 duration-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Новая роль поддержки</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground font-bold uppercase">Название</span>
                <Input
                  value={newRoleName}
                  onChange={e => setNewRoleName(e.target.value)}
                  placeholder="Младший саппорт"
                  className="h-10 rounded-xl text-xs font-semibold"
                  required
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground font-bold uppercase">Описание</span>
                <Input
                  value={newRoleDesc}
                  onChange={e => setNewRoleDesc(e.target.value)}
                  placeholder="Доступ только к тикетам"
                  className="h-10 rounded-xl text-xs font-semibold"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={() => setShowCreateForm(false)} className="h-9 text-xs font-bold rounded-xl cursor-pointer">
                Отмена
              </Button>
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
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenRolePermissions(role)}
                      className="h-8 text-[11px] font-bold rounded-lg gap-1.5 border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                      Все 16 прав
                    </Button>
                    {!role.isSystem && (
                      <button
                        onClick={() => onOpenDeleteRole({ id: role.id, name: role.name })}
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
                  {QUICK_SECTIONS.map(sec => {
                    const perm = role.permissions?.find(p => p.section === sec.id) || { canView: false, canEdit: false };
                    return (
                      <div key={sec.id} className="p-3 rounded-lg border border-border/50 bg-background space-y-2.5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-foreground/80 border-b border-border/30 pb-1.5 block">
                          📁 {sec.label}
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
                                onClick={() => onTogglePermission(role.id, sec.id, active, type)}
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
  );
}
