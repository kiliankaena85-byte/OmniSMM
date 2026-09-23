import * as React from 'react';
import { adminUserService } from '@/services/admin/user.service';
import { enforceOperatorAccess } from '@/lib/operator/rbac';
import { UsersTable, OperatorUserRow } from './users-table';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{
    q?: string;
    cursor?: string;
  }>;
};

export default async function OperatorUsersPage({ searchParams }: Props) {
  // Enforce staff/operator session
  await enforceOperatorAccess();

  const params = await searchParams;
  const search = params.q || '';
  const cursor = params.cursor || undefined;

  // Retrieve user list and stats via existing service layer
  const { items: rawUsers } = await adminUserService.listUsers({
    search: search || undefined,
    cursor,
    pageSize: 50,
  });

  const stats = await adminUserService.getUserStats();

  // Safely map values for client-side table rendering
  const users: OperatorUserRow[] = rawUsers.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    balance: Number(u.balance),
    quarantineBalance: Number(u.quarantineBalance),
    totalSpent: Number(u.totalSpent),
    createdAt: u.createdAt,
    _count: {
      orders: u._count.orders,
      tickets: u._count.tickets,
    },
  }));

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out pb-10">
      {/* Header section with Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/40 backdrop-blur-md border border-border/40 p-6 rounded-2xl ring-1 ring-border/5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-xl text-primary">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground font-sans">
              Клиенты платформы
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-muted-foreground font-medium text-xs">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span>
                Всего: {stats.total}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-success rounded-full"></span>
                Активные: {stats.active}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-destructive rounded-full"></span>
                Забанены: {stats.banned}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Search Filter */}
      <div className="bg-card/60 backdrop-blur-md border border-border/50 shadow-sm rounded-2xl p-6 ring-1 ring-border/5">
        <form className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground flex items-center justify-center">
              🔍
            </span>
            <input
              type="text"
              name="q"
              defaultValue={search}
              placeholder="Поиск клиентов по email..."
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-background/50 border border-border/60 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm text-foreground"
            />
          </div>
          <Button type="submit" className="sm:w-auto w-full rounded-xl active:scale-95 transition-transform shadow-sm">
            Найти
          </Button>
        </form>
      </div>

      {/* Users Table */}
      <div className="bg-card/60 backdrop-blur-md border border-border/50 shadow-sm rounded-2xl ring-1 ring-border/5 overflow-hidden">
        <div className="p-6">
          {users.length > 0 ? (
            <UsersTable data={users} />
          ) : (
            <div className="text-center py-12">
              <h3 className="text-sm font-bold text-foreground mb-1 font-sans">
                Пользователи не найдены
              </h3>
              <p className="text-muted-foreground text-xs font-sans max-w-xs mx-auto leading-relaxed">
                Попробуйте изменить поисковый запрос или сбросить фильтры.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
