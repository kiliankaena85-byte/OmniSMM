import React from 'react';
import Link from 'next/link';
import { Users, ArrowRight, ExternalLink, Award } from 'lucide-react';
import { formatKopecks } from '@/utils/format-kopecks';
import { TenantBrandBadge } from '@/app/admin/orders/components/columns';

interface TopSpender {
  id: string;
  email: string;
  role: string;
  balance: bigint | number;
  totalSpent: bigint | number;
  tenantId: string;
  createdAt: Date;
  _count: { orders: number };
}

interface Props {
  clients: TopSpender[];
}

export function TopSpendersWidget({ clients }: Props) {
  return (
    <div className="bg-card text-card-foreground rounded-lg p-5 border border-border/70 shadow-sm flex flex-col justify-between space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">
              Ключевые клиенты платформы (VIP)
            </h4>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Топ пользователей по суммарному объему расходов (LTV)
            </p>
          </div>
        </div>
        <Link
          href="/admin/clients"
          className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
        >
          <span>Все клиенты</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Content Table / List */}
      {clients.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          Клиенты за выбранный период не найдены
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {clients.map((c, idx) => (
            <div
              key={c.id}
              className="py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-muted/30 px-2 rounded-md transition-colors"
            >
              {/* Rank & Client Info */}
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="font-mono font-bold text-muted-foreground w-4 text-center shrink-0">
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Link
                      href={`/admin/clients?q=${encodeURIComponent(c.email)}`}
                      className="font-semibold text-foreground hover:text-primary transition-colors truncate max-w-[180px] sm:max-w-[220px]"
                      title={c.email}
                    >
                      {c.email}
                    </Link>
                  </div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span>Заказов: <strong className="text-foreground">{c._count.orders}</strong></span>
                    <span>•</span>
                    <span>Баланс: <span className="font-mono font-semibold text-foreground">{formatKopecks(c.balance)}</span></span>
                  </div>
                </div>
              </div>

              {/* Total Spend Badge */}
              <div className="text-right shrink-0">
                <div className="font-mono font-extrabold text-foreground tabular-nums text-sm">
                  {formatKopecks(c.totalSpent)}
                </div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  Расходы (LTV)
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
