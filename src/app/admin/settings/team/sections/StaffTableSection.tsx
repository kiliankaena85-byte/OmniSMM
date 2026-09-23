'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ShieldAlert, Search, Settings2, UserMinus, Package, Users } from 'lucide-react';
import type { StaffRole, StaffPermission } from '@prisma/client';
import type { StaffUser } from '../types';
import { RoleBadge, EmailAvatar } from '../ui-helpers';

interface StaffTableSectionProps {
  staffUsers: StaffUser[];
  staffRoles?: (StaffRole & { permissions: StaffPermission[] })[];
  onOpenEdit: (u: StaffUser) => void;
  onOpenDemote: (u: StaffUser) => void;
  canDemote: (role: string) => boolean;
  isPending: boolean;
}

export function StaffTableSection({
  staffUsers,
  staffRoles = [],
  onOpenEdit,
  onOpenDemote,
  canDemote,
  isPending,
}: StaffTableSectionProps) {
  const [searchEmail, setSearchEmail] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const filteredStaff = staffUsers.filter((u) => {
    const matchEmail = u.email.toLowerCase().includes(searchEmail.toLowerCase().trim());
    const matchRole = filterRole === 'ALL' || u.role === filterRole || u.staffRoleId === filterRole;
    return matchEmail && matchRole;
  });

  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedStaff = filteredStaff.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

  return (
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
              variant="ghost"
              size="sm"
              onClick={() => { setSearchEmail(''); setFilterRole('ALL'); setCurrentPage(1); }}
              className="text-xs text-muted-foreground hover:text-foreground h-9 px-3 cursor-pointer shrink-0"
            >
              Сбросить
            </Button>
          )}
        </div>

        {/* Desktop Table */}
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
                        <span className="font-mono text-xs text-foreground truncate" title={u.email}>
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
                          onClick={() => onOpenEdit(u)}
                          title="Настройки сотрудника"
                          className="h-8 w-8 flex items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-primary hover:bg-primary/10 hover:border-primary/30 transition-colors cursor-pointer"
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                        </button>
                        {canDemote(u.role) && (
                          <button
                            type="button"
                            onClick={() => onOpenDemote(u)}
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
                type="button" variant="outline" size="sm"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="h-8 px-3 text-xs font-bold"
              >
                ← Назад
              </Button>
              <span className="px-2 text-xs font-mono font-bold text-foreground">{safePage}/{totalPages}</span>
              <Button
                type="button" variant="outline" size="sm"
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
  );
}
