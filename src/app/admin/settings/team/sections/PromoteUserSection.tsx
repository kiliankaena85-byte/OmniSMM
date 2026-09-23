'use client';

import React from 'react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserPlus, Search } from 'lucide-react';
import type { StaffRole, StaffPermission } from '@prisma/client';
import type { RegularUser } from '../types';
import { RoleBadge, EmailAvatar, SearchButton, getAllowedRoles } from '../ui-helpers';

interface PromoteUserSectionProps {
  regularUsers: RegularUser[];
  searchQuery: string;
  currentAdminRole?: string;
  staffRoles?: (StaffRole & { permissions: StaffPermission[] })[];
  onUpdateRole: (formData: FormData) => Promise<void>;
}

export function PromoteUserSection({
  regularUsers,
  searchQuery,
  currentAdminRole,
  staffRoles = [],
  onUpdateRole,
}: PromoteUserSectionProps) {
  return (
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
              type="text"
              name="q"
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
                      <form action={onUpdateRole} className="flex items-center gap-2 justify-end flex-wrap">
                        <input type="hidden" name="userId" value={u.id} />

                        <Select name="role" defaultValue={u.role}>
                          <SelectTrigger className="w-28 h-9 bg-background text-[11px] font-bold rounded-lg">
                            <SelectValue>{(v: string) => v || 'Роль'}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {getAllowedRoles(currentAdminRole).map(r => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select name="staffRoleId" defaultValue={u.staffRoleId || 'NONE'}>
                          <SelectTrigger className="w-36 h-9 bg-background text-[11px] font-bold rounded-lg">
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

                        <Button type="submit" size="sm" variant="outline" className="h-9 px-3 text-[10px] font-black uppercase tracking-wider cursor-pointer">
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
  );
}
