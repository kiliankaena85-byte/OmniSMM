'use client';

/**
 * Balance Requests Management v3 — SMMplan Design System & 1-Click CSV
 */

import React, { useState, useEffect, useCallback, useTransition } from "react";
import { getBalanceAdjustmentsAction } from "@/actions/admin/balance-adjustments";
import { BalanceAdjustmentDrawer, BalanceAdjustmentItem } from "@/components/admin/balance/BalanceAdjustmentDrawer";
import { AdminBreadcrumbs } from "@/components/admin/AdminBreadcrumbs";
import { PlanTable, PlanTableHeader, PlanTableHeadCell, PlanTableRow, PlanTableCell } from "@/components/ui/plan";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Wallet, 
  RotateCcw, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  BarChart3,
  Settings2
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "ALL",              label: "Все статусы" },
  { value: "PENDING_APPROVAL", label: "На согласовании" },
  { value: "APPROVED",         label: "Одобрено" },
  { value: "EXECUTED",         label: "Исполнено" },
  { value: "REJECTED",         label: "Отклонено" },
  { value: "CANCELED",         label: "Отменено" },
] as const;

const DIRECTION_OPTIONS = [
  { value: "ALL",    label: "Все типы" },
  { value: "CREDIT", label: "Начисление (+)" },
  { value: "DEBIT",  label: "Списание (-)" },
] as const;

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  EXECUTED:         { label: "Исполнено",        className: "bg-success/15 text-success border-success/20" },
  APPROVED:         { label: "Одобрено",         className: "bg-primary/15 text-primary border-primary/20" },
  PENDING_APPROVAL: { label: "На согласовании",  className: "bg-warning/15 text-warning border-warning/20 animate-pulse" },
  REJECTED:         { label: "Отклонено",        className: "bg-destructive/15 text-destructive border-destructive/20" },
  CANCELED:         { label: "Отменено",         className: "bg-muted text-muted-foreground border-border/40" },
};

function fmt(cents: number, showSign = false): string {
  const sign = showSign && cents > 0 ? '+' : '';
  return `${sign}${(cents / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
}

export function BalanceRequestsClient({ 
  currentUserId, 
  currentUserRole 
}: { 
  currentUserId?: string; 
  currentUserRole?: string; 
}) {
  const [items, setItems] = useState<BalanceAdjustmentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [directionFilter, setDirectionFilter] = useState<string>("ALL");
  const [selectedItem, setSelectedItem] = useState<BalanceAdjustmentItem | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchAdjustments = useCallback(() => {
    startTransition(async () => {
      try {
        const formData = new FormData();
        if (statusFilter && statusFilter !== "ALL") formData.append("status", statusFilter);
        if (directionFilter && directionFilter !== "ALL") formData.append("direction", directionFilter);
        formData.append("page", page.toString());
        formData.append("pageSize", String(pageSize));

        const res = await getBalanceAdjustmentsAction(formData);
        if (res.success && res.items) {
          setItems(res.items as BalanceAdjustmentItem[]);
          setTotal(res.total || 0);
        } else if ('error' in res) {
          toast.error(res.error || 'Ошибка загрузки заявок');
        }
      } catch {
        toast.error("Не удалось загрузить заявки на корректировку");
      }
    });
  }, [page, statusFilter, directionFilter]);

  useEffect(() => {
    fetchAdjustments();
  }, [fetchAdjustments]);

  const handleExportCsv = () => {
    const query = new URLSearchParams({
      type: 'balance_adjustments',
    });
    if (statusFilter && statusFilter !== 'ALL') query.set('status', statusFilter);
    if (directionFilter && directionFilter !== 'ALL') query.set('direction', directionFilter);
    
    toast.info('Экспорт реестра заявок в CSV...');
    const link = document.createElement('a');
    link.href = `/api/admin/export?${query.toString()}`;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-12">
      <AdminBreadcrumbs
        items={[
          { label: 'Финансы', href: '/admin/finance' },
          { label: 'Заявки на корректировку' },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary border border-primary/20 rounded-2xl">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight">Заявки на корректировку баланса</h1>
              <p className="text-xs text-muted-foreground font-medium">
                Входящие заявки от службы поддержки на начисление и списание средств
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            asChild
            intent="outline"
            size="sm"
            className="h-9 px-3.5 text-xs font-bold bg-card hover:bg-muted shadow-xs transition-all flex items-center gap-1.5 border-border/80"
          >
            <Link href="/admin/finance/balance-requests/stats">
              <BarChart3 className="w-3.5 h-3.5 text-primary" />
              <span>Аналитика & Отчёты</span>
            </Link>
          </Button>

          <Button
            asChild
            intent="outline"
            size="sm"
            className="h-9 px-3.5 text-xs font-bold bg-card hover:bg-muted shadow-xs transition-all flex items-center gap-1.5 border-border/80"
          >
            <Link href="/admin/settings/balance-policies">
              <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Политики</span>
            </Link>
          </Button>

          <Button
            intent="outline"
            size="sm"
            onClick={handleExportCsv}
            className="h-9 px-3.5 text-xs font-bold bg-card hover:bg-muted shadow-xs transition-all flex items-center gap-1.5 border-border/80"
          >
            <Download className="w-3.5 h-3.5 text-primary" />
            <span>Экспорт в CSV</span>
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl border border-border/70 bg-card/60 backdrop-blur-md shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Статус:</span>
            <Select 
              value={statusFilter} 
              onValueChange={(v) => { 
                if (v) { setStatusFilter(v); setPage(1); } 
              }}
            >
              <SelectTrigger className="w-[160px] h-9 text-xs" size="sm">
                <SelectValue placeholder="Статус">
                  {(val: string) => STATUS_OPTIONS.find(s => s.value === val)?.label ?? val}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(s => (
                  <SelectItem key={s.value} value={s.value} label={s.label}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Тип:</span>
            <Select 
              value={directionFilter} 
              onValueChange={(v) => { 
                if (v) { setDirectionFilter(v); setPage(1); } 
              }}
            >
              <SelectTrigger className="w-[150px] h-9 text-xs" size="sm">
                <SelectValue placeholder="Тип">
                  {(val: string) => DIRECTION_OPTIONS.find(d => d.value === val)?.label ?? val}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DIRECTION_OPTIONS.map(d => (
                  <SelectItem key={d.value} value={d.value} label={d.label}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            intent="ghost"
            size="sm"
            onClick={fetchAdjustments}
            disabled={isPending}
            className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            title="Обновить данные"
            aria-label="Обновить список заявок"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="text-xs text-muted-foreground font-medium">
          Всего заявок: <span className="font-mono font-bold text-foreground">{total}</span>
        </div>
      </div>

      {/* PlanTable */}
      <div className="space-y-4">
        <PlanTable>
          <PlanTableHeader>
            <tr>
              <PlanTableHeadCell className="w-[140px]">ID / Дата</PlanTableHeadCell>
              <PlanTableHeadCell>Клиент</PlanTableHeadCell>
              <PlanTableHeadCell>Оператор</PlanTableHeadCell>
              <PlanTableHeadCell>Тип / Причина</PlanTableHeadCell>
              <PlanTableHeadCell className="text-right">Сумма</PlanTableHeadCell>
              <PlanTableHeadCell className="text-center w-[90px]">Тикет</PlanTableHeadCell>
              <PlanTableHeadCell className="w-[130px]">Статус</PlanTableHeadCell>
              <PlanTableHeadCell className="text-right w-[100px]">Действия</PlanTableHeadCell>
            </tr>
          </PlanTableHeader>
          <tbody>
            {isPending && items.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-12 text-center text-muted-foreground text-xs font-medium">
                  Загрузка заявок...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-12 text-center text-muted-foreground text-xs font-medium">
                  Заявки по выбранным фильтрам не найдены.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const isCredit = item.direction === 'CREDIT';
                const badgeInfo = STATUS_BADGES[item.status] || {
                  label: item.status,
                  className: 'bg-muted text-muted-foreground border-border',
                };

                return (
                  <PlanTableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                    {/* ID / Date */}
                    <PlanTableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono font-bold text-xs text-foreground">
                          #{item.id.slice(-6)}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                          {new Date(item.createdAt).toLocaleDateString("ru-RU", {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    </PlanTableCell>

                    {/* Client */}
                    <PlanTableCell>
                      <Link
                        href={`/admin/clients?q=${encodeURIComponent(item.user?.email || item.userId)}`}
                        className="text-primary hover:text-primary/80 hover:underline font-mono text-xs font-semibold truncate block max-w-[200px]"
                        title={item.user?.email || item.userId}
                      >
                        {item.user?.email || item.userId}
                      </Link>
                    </PlanTableCell>

                    {/* Requester / Staff */}
                    <PlanTableCell>
                      <span className="text-xs text-muted-foreground font-medium truncate block max-w-[180px]" title={item.requester?.email || item.requestedBy}>
                        {item.requester?.email || item.requestedBy}
                      </span>
                    </PlanTableCell>

                    {/* Direction & Reason */}
                    <PlanTableCell>
                      <div className="flex flex-col gap-0.5">
                        {item.reasonCode === 'REFUND_TO_CARD' ? (
                          <span className="text-xs font-bold font-mono text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            💳 ВОЗВРАТ НА КАРТУ
                          </span>
                        ) : (
                          <span className={`text-xs font-bold font-mono ${isCredit ? 'text-success' : 'text-destructive'}`}>
                            {isCredit ? '+ CREDIT (Начисление)' : '- DEBIT (Списание)'}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[220px]" title={item.reasonNote || item.reasonCode}>
                          {item.reasonCode === 'REFUND_TO_CARD' 
                            ? (item.reasonNote || (item.payment?.gateway ? `Возврат через ${item.payment.gateway.toUpperCase()}` : 'Возврат через эквайринг')) 
                            : item.reasonCode}
                        </span>
                      </div>
                    </PlanTableCell>

                    {/* Amount */}
                    <PlanTableCell className="text-right">
                      <span className={`font-mono font-bold tabular-nums text-xs ${isCredit ? 'text-success' : 'text-destructive'}`}>
                        {fmt(Number(item.amount), isCredit)}
                      </span>
                    </PlanTableCell>

                    {/* Ticket */}
                    <PlanTableCell className="text-center font-mono text-xs text-primary font-medium">
                      {item.ticketId ? `#${item.ticketId}` : '—'}
                    </PlanTableCell>

                    {/* Status */}
                    <PlanTableCell>
                      <Badge
                        intent="outline"
                        className={`text-[9px] font-bold uppercase py-0.5 px-2 rounded ${badgeInfo.className}`}
                      >
                        {badgeInfo.label}
                      </Badge>
                    </PlanTableCell>

                    {/* Actions */}
                    <PlanTableCell className="text-right">
                      <Button
                        intent="outline"
                        size="sm"
                        onClick={() => setSelectedItem(item)}
                        className="h-7 min-h-[28px] px-2.5 text-xs font-bold shadow-xs hover:bg-muted"
                      >
                        Детали
                      </Button>
                    </PlanTableCell>
                  </PlanTableRow>
                );
              })
            )}
          </tbody>
        </PlanTable>

        {/* Pagination */}
        {total > pageSize && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-2 text-xs text-muted-foreground">
            <div className="font-medium">
              Показано заявок: <span className="font-mono font-bold text-foreground">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}</span> из{' '}
              <span className="font-mono font-bold text-foreground">{total}</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                intent="outline"
                size="sm"
                disabled={page <= 1 || isPending}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 min-h-[32px] px-2.5 text-xs font-bold"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Назад
              </Button>

              <span className="font-mono text-xs px-2 font-bold text-foreground">
                {page} / {totalPages}
              </span>

              <Button
                intent="outline"
                size="sm"
                disabled={page >= totalPages || isPending}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 min-h-[32px] px-2.5 text-xs font-bold"
              >
                Вперёд
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {selectedItem && (
        <BalanceAdjustmentDrawer
          adjustment={selectedItem}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          onClose={() => setSelectedItem(null)}
          onActionComplete={fetchAdjustments}
        />
      )}
    </div>
  );
}

