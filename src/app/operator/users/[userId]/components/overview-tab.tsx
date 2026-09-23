import * as React from 'react';
import Link from 'next/link';
import { FinancialSummary } from '@/services/operator/users/client-financial-summary.query';
import { Badge } from '@/components/ui/badge';
import { Package, MessageSquare, FileText, ArrowRight, User } from 'lucide-react';

interface OverviewTabProps {
  user: {
    id: string;
    email: string;
    role: string;
    telegramId: string | null;
    createdAt: Date;
    personalDiscount: number;
  };
  financials: FinancialSummary;
  recentOrders: {
    id: string;
    numericId: number;
    status: string;
    charge: number;
    createdAt: Date;
    service: { name: string };
  }[];
  recentTickets: {
    id: string;
    subject: string;
    status: string;
    createdAt: Date;
  }[];
  recentNotes: {
    id: string;
    content: string;
    createdAt: Date;
    author: { email: string; role: string } | null;
  }[];
}

const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING:    'bg-warning/15 text-warning border-transparent',
  PROCESSING: 'bg-primary/10 text-primary border-transparent',
  COMPLETED:  'bg-success/15 text-success border-transparent',
  FAILED:     'bg-destructive/15 text-destructive border-transparent',
  CANCELLED:  'bg-muted text-muted-foreground border-transparent',
  PARTIAL:    'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-transparent',
};

const TICKET_STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-success/15 text-success border-transparent',
  PENDING: 'bg-warning/15 text-warning border-transparent',
  CLOSED: 'bg-muted text-muted-foreground border-transparent',
};

export function OverviewTab({
  user,
  financials,
  recentOrders,
  recentTickets,
  recentNotes,
}: OverviewTabProps) {
  const diffDetected = BigInt(financials.currentBalanceCents) !== BigInt(financials.netFlowCents);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Financial & Profile Info Column (Takes 2 cols) */}
      <div className="lg:col-span-2 space-y-6">
        {/* Ledger Financial Block */}
        <div className="bg-card border border-border/50 shadow-sm rounded-2xl p-6 ring-1 ring-border/5">
          <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider text-muted-foreground">
            Финансовый баланс (Ledger)
          </h3>

          {diffDetected && (
            <div className="mb-4 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed font-medium">
              ⚠️ Обнаружено расхождение! Баланс в профиле ({(financials.currentBalanceCents / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽) не совпадает с суммой транзакций по Ledger ({(financials.netFlowCents / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽).
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-muted/10 border border-border/40 rounded-xl p-4">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Баланс (БД)</span>
              <span className="font-mono font-extrabold text-xl text-foreground tabular-nums tracking-tight">
                {(financials.currentBalanceCents / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
              </span>
            </div>
            <div className="bg-muted/10 border border-border/40 rounded-xl p-4">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Всего пополнений</span>
              <span className="font-mono font-extrabold text-xl text-success tabular-nums tracking-tight">
                +{(financials.totalDepositsCents / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
              </span>
            </div>
            <div className="bg-muted/10 border border-border/40 rounded-xl p-4">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Всего списаний</span>
              <span className="font-mono font-extrabold text-xl text-foreground tabular-nums tracking-tight">
                -{(financials.totalChargesCents / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-border/40 pt-4 text-xs">
            <div className="flex justify-between sm:flex-col gap-2">
              <span className="text-muted-foreground font-medium">Возвраты (Refunds):</span>
              <span className="font-mono font-bold text-warning-foreground">
                {(financials.totalRefundsCents / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
              </span>
            </div>
            <div className="flex justify-between sm:flex-col gap-2">
              <span className="text-muted-foreground font-medium">Компенсации (Goodwill):</span>
              <span className="font-mono font-bold text-primary">
                {(financials.totalGoodwillCents / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
              </span>
            </div>
            <div className="flex justify-between sm:flex-col gap-2">
              <span className="text-muted-foreground font-medium">Корректировки:</span>
              <span className="font-mono font-bold text-foreground">
                {(financials.totalCorrectionsCents / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
              </span>
            </div>
          </div>
        </div>

        {/* Recent Orders Snippet */}
        <div className="bg-card border border-border/50 shadow-sm rounded-2xl p-6 ring-1 ring-border/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              Последние заказы
            </h3>
            <Link
              href={`/operator/orders?userId=${user.id}`}
              className="text-xs font-bold text-primary hover:text-primary/80 inline-flex items-center gap-1 hover:underline"
            >
              Все заказы <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentOrders.length > 0 ? (
            <div className="divide-y divide-border/30">
              {recentOrders.slice(0, 5).map((order) => (
                <div key={order.id} className="py-3 flex items-center justify-between text-xs first:pt-0 last:pb-0">
                  <div className="space-y-1">
                    <span className="font-mono font-bold text-foreground block">
                      ID {order.numericId || order.id.slice(0, 8)}
                    </span>
                    <span className="text-muted-foreground block truncate max-w-[200px] sm:max-w-[320px]">
                      {order.service?.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-foreground whitespace-nowrap">
                      {(order.charge / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
                    </span>
                    <Badge intent="outline" className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 ${ORDER_STATUS_COLORS[order.status] || 'bg-muted'}`}>
                      {order.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs py-2">Заказы отсутствуют.</p>
          )}
        </div>

        {/* Recent Tickets Snippet */}
        <div className="bg-card border border-border/50 shadow-sm rounded-2xl p-6 ring-1 ring-border/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              Активные обращения (Тикеты)
            </h3>
            <Link
              href={`/operator/tickets?userId=${user.id}`}
              className="text-xs font-bold text-primary hover:text-primary/80 inline-flex items-center gap-1 hover:underline"
            >
              Все обращения <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentTickets.length > 0 ? (
            <div className="divide-y divide-border/30">
              {recentTickets.slice(0, 5).map((ticket) => (
                <div key={ticket.id} className="py-3 flex items-center justify-between text-xs first:pt-0 last:pb-0">
                  <div className="space-y-1 truncate pr-4">
                    <span className="font-bold text-foreground hover:underline block truncate cursor-pointer">
                      {ticket.subject}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {new Date(ticket.createdAt).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                  <Badge intent="outline" className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 whitespace-nowrap ${TICKET_STATUS_COLORS[ticket.status] || 'bg-muted'}`}>
                    {ticket.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs py-2">Тикеты отсутствуют.</p>
          )}
        </div>
      </div>

      {/* Identity & Notes Column (Takes 1 col) */}
      <div className="space-y-6">
        {/* User Identity Info Card */}
        <div className="bg-card border border-border/50 shadow-sm rounded-2xl p-6 ring-1 ring-border/5">
          <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            Учетные данные
          </h3>

          <div className="space-y-4 text-xs">
            <div>
              <span className="text-muted-foreground block mb-0.5">Email / Логин</span>
              <span className="font-mono font-bold text-foreground text-sm break-all">{user.email}</span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">Роль в системе</span>
              <Badge intent="outline" className="font-bold text-[10px] uppercase tracking-wider">
                {user.role}
              </Badge>
            </div>
            {user.telegramId && (
              <div>
                <span className="text-muted-foreground block mb-0.5">Telegram ID</span>
                <span className="font-mono font-medium text-foreground">{user.telegramId}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground block mb-0.5">Скидка клиента</span>
              <span className="font-bold text-foreground">
                {user.personalDiscount > 0 ? `${user.personalDiscount}%` : 'Индивидуальная скидка отсутствует'}
              </span>
            </div>
            <div className="border-t border-border/30 pt-3">
              <span className="text-muted-foreground block mb-0.5">Регистрация</span>
              <span className="font-mono text-muted-foreground">
                {new Date(user.createdAt).toLocaleDateString('ru-RU')}
              </span>
            </div>
          </div>
        </div>

        {/* Notes Preview Block */}
        <div className="bg-card border border-border/50 shadow-sm rounded-2xl p-6 ring-1 ring-border/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              Лог заметок
            </h3>
            <span className="text-[10px] uppercase font-bold text-muted-foreground">
              Всего: {recentNotes.length}
            </span>
          </div>

          {recentNotes.length > 0 ? (
            <div className="space-y-4">
              {recentNotes.slice(0, 3).map((note) => (
                <div key={note.id} className="bg-muted/10 border border-border/30 rounded-xl p-3.5 text-xs space-y-1.5">
                  <p className="text-foreground leading-relaxed break-words font-sans">{note.content}</p>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono pt-1 border-t border-border/20">
                    <span>{note.author?.email.split('@')[0] || 'Система'}</span>
                    <span>{new Date(note.createdAt).toLocaleDateString('ru-RU')}</span>
                  </div>
                </div>
              ))}
              <div className="pt-1">
                <Link
                  href={`/operator/users/${user.id}?tab=notes`}
                  className="text-xs font-bold text-primary hover:text-primary/80 inline-flex items-center gap-1 hover:underline w-full justify-center py-2 bg-muted/10 hover:bg-muted/20 rounded-xl border border-border/40 transition-colors"
                >
                  Управление всеми заметками
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-muted-foreground text-xs mb-3">Заметки операторов отсутствуют.</p>
              <Link
                href={`/operator/users/${user.id}?tab=notes`}
                className="text-xs font-bold text-primary hover:text-primary/80 hover:underline py-1.5 px-3 bg-primary/5 hover:bg-primary/10 rounded-xl border border-primary/10 transition-colors inline-block"
              >
                Написать первую
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
