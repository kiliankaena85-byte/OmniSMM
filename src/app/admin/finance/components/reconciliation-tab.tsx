'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import { toast } from 'sonner';
import {
  getReconciliationSummaryAction,
  getReconciliationAccountsAction,
} from '@/actions/admin/finance/reconciliation';
import type {
  ReconciliationSummaryDTO,
  ReconciledAccountDTO,
} from '@/services/financial/ledger-reconciliation.service';
import { LedgerAuditDrawer } from './ledger-audit-drawer';
import { PlanTable, PlanTableHeader, PlanTableHeadCell, PlanTableRow, PlanTableCell } from '@/components/ui/plan';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  Search,
  RotateCcw,
  Scale,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  ExternalLink,
  Download,
} from 'lucide-react';
import Link from 'next/link';

interface ReconciliationTabProps {
  tenantId?: string;
  initialSummary?: ReconciliationSummaryDTO;
}

function fmt(cents: number, showSign = false): string {
  const sign = showSign && cents > 0 ? '+' : '';
  return `${sign}${(cents / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
}

function CopyIdButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('Failed to copy ID');
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 min-h-[36px] hover:bg-muted text-muted-foreground hover:text-foreground rounded transition-all duration-200 cursor-pointer shrink-0"
      title="Копировать ID"
      type="button"
      aria-label="Копировать ID пользователя"
    >
      {copied ? (
        <Check className="w-3 h-3 text-success animate-in fade-in duration-200" />
      ) : (
        <Copy className="w-3 h-3 transition-transform active:scale-90" />
      )}
    </button>
  );
}

export function ReconciliationTab({ tenantId, initialSummary }: ReconciliationTabProps) {
  const [summary, setSummary] = useState<ReconciliationSummaryDTO | null>(initialSummary || null);
  const [accounts, setAccounts] = useState<ReconciledAccountDTO[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [search, setSearch] = useState('');
  const [onlyAnomalies, setOnlyAnomalies] = useState(false);
  const [selectedAuditUserId, setSelectedAuditUserId] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  const loadData = useCallback(() => {
    startTransition(async () => {
      try {
        const [sumRes, accRes] = await Promise.all([
          getReconciliationSummaryAction(tenantId),
          getReconciliationAccountsAction({
            page,
            pageSize,
            search: search.trim() || undefined,
            onlyAnomalies,
            tenantId,
          }),
        ]);

        if (!('error' in sumRes)) {
          setSummary(sumRes);
        } else {
          toast.error(sumRes.error);
        }

        if (!('error' in accRes)) {
          setAccounts(accRes.items);
          setTotalCount(accRes.totalCount);
        } else {
          toast.error(accRes.error);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Ошибка обновления данных сверки');
      }
    });
  }, [tenantId, page, pageSize, search, onlyAnomalies]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const KPI_CARDS = summary
    ? [
        {
          label: 'Всего проверено',
          value: summary.totalUsersChecked.toLocaleString('ru-RU'),
          sub: 'Аккаунты платформы',
          icon: Users,
          colorClass: 'bg-primary/10 text-primary border-primary/20',
          valueColor: 'text-foreground',
        },
        {
          label: 'Целостность данных',
          value: `${summary.integrityPercentage.toFixed(2)}%`,
          sub: `${summary.reconciledUsersCount} сошедшихся счетов`,
          icon: ShieldCheck,
          colorClass: 'bg-success/10 text-success border-success/20',
          valueColor: 'text-success',
        },
        {
          label: 'Расхождения (Anomalies)',
          value: summary.discrepancyUsersCount.toString(),
          sub: summary.discrepancyUsersCount > 0 ? 'Требуют аудита' : 'Расхождений нет',
          icon: ShieldAlert,
          colorClass:
            summary.discrepancyUsersCount > 0
              ? 'bg-destructive/10 text-destructive border-destructive/20 animate-pulse'
              : 'bg-muted text-muted-foreground border-border/40',
          valueColor: summary.discrepancyUsersCount > 0 ? 'text-destructive' : 'text-muted-foreground',
        },
        {
          label: 'Нетто-разница (Net Diff)',
          value: fmt(summary.netDiscrepancyCents, true),
          sub: 'User.balance − Ledger.sum',
          icon: Scale,
          colorClass:
            summary.netDiscrepancyCents !== 0
              ? 'bg-destructive/10 text-destructive border-destructive/20'
              : 'bg-success/10 text-success border-success/20',
          valueColor: summary.netDiscrepancyCents !== 0 ? 'text-destructive' : 'text-success',
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* ── KPI Summary Cards ── */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {KPI_CARDS.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-2xl border border-border/80 bg-card/70 backdrop-blur-md p-5 shadow-sm space-y-3 transition-all hover:border-border"
            >
              <div className="flex justify-between items-start">
                <div className={`p-2.5 rounded-xl border ${kpi.colorClass}`}>
                  <kpi.icon className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    {kpi.label}
                  </span>
                  <div className={`text-xl font-black font-mono tabular-nums mt-0.5 ${kpi.valueColor}`}>
                    {kpi.value}
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5 pt-1 border-t border-border/40">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                <span>{kpi.sub}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Controls Bar: Search & Anomaly Filter ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Поиск по email или ID пользователя..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs bg-background h-10"
            />
          </div>
          <Button
            type="submit"
            intent="outline"
            size="sm"
            disabled={isPending}
            className="h-10 min-h-[40px] px-4 font-bold text-xs shrink-0"
          >
            Найти
          </Button>
        </form>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button
            intent="outline"
            size="sm"
            onClick={() => {
              const query = new URLSearchParams({
                type: 'reconciliation',
                onlyAnomalies: String(onlyAnomalies),
              });
              if (tenantId && tenantId !== 'all') query.set('tenant', tenantId);
              toast.info('Формирование отчёта сверки в CSV...');
              const link = document.createElement('a');
              link.href = `/api/admin/export?${query.toString()}`;
              link.setAttribute('download', '');
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="h-10 min-h-[40px] px-3.5 text-xs font-bold bg-background hover:bg-muted shadow-xs transition-all flex items-center gap-1.5 border-border/80"
          >
            <Download className="w-3.5 h-3.5 text-primary" />
            <span>Экспорт в CSV</span>
          </Button>

          <Button
            intent={onlyAnomalies ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => {
              setOnlyAnomalies(!onlyAnomalies);
              setPage(1);
            }}
            className={`h-10 min-h-[40px] px-3.5 text-xs font-bold transition-all ${
              onlyAnomalies ? 'shadow-destructive/20 shadow-md' : ''
            }`}
          >
            <Filter className="w-3.5 h-3.5 mr-1.5" />
            <span>Только аномалии</span>
            {summary && summary.discrepancyUsersCount > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                onlyAnomalies ? 'bg-destructive-foreground/20 text-destructive-foreground' : 'bg-destructive/15 text-destructive'
              }`}>
                {summary.discrepancyUsersCount}
              </span>
            )}
          </Button>

          <Button
            intent="ghost"
            size="sm"
            onClick={loadData}
            disabled={isPending}
            className="h-10 min-h-[40px] px-3 text-xs font-bold text-muted-foreground hover:text-foreground"
            title="Обновить данные"
            aria-label="Обновить таблицу сверки"
          >
            <RotateCcw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* ── Table of Reconciled Accounts ── */}
      <div className="space-y-4">
        <PlanTable compact={true} className="w-full table-fixed">
          <PlanTableHeader>
            <tr>
              <PlanTableHeadCell className="w-[24%] min-w-0">Пользователь</PlanTableHeadCell>
              <PlanTableHeadCell className="w-[85px]">Бренд</PlanTableHeadCell>
              <PlanTableHeadCell className="text-right w-[14%]">Баланс (User)</PlanTableHeadCell>
              <PlanTableHeadCell className="text-right w-[14%]">Сумма Ledger</PlanTableHeadCell>
              <PlanTableHeadCell className="text-right w-[14%]">Расхождение</PlanTableHeadCell>
              <PlanTableHeadCell className="text-center w-[75px]">Проводок</PlanTableHeadCell>
              <PlanTableHeadCell className="w-[100px]">Статус</PlanTableHeadCell>
              <PlanTableHeadCell className="text-right w-[80px]">Действия</PlanTableHeadCell>
            </tr>
          </PlanTableHeader>
          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground text-xs font-medium">
                  {isPending ? 'Загрузка счетов...' : 'Счетов по заданным фильтрам не найдено.'}
                </td>
              </tr>
            ) : (
              accounts.map((acc) => {
                const isDiscrepancy = acc.isDiscrepancy;
                const isSmmplan = acc.tenantId === 'smmplan';
                return (
                  <PlanTableRow
                    key={acc.userId}
                    className={`transition-colors ${
                      isDiscrepancy
                        ? 'bg-destructive/5 hover:bg-destructive/10 border-destructive/20'
                        : 'hover:bg-muted/30'
                    }`}
                  >
                    {/* User info */}
                    <PlanTableCell className="min-w-0 overflow-hidden">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-1 min-w-0">
                          <Link
                            href={`/admin/clients?q=${encodeURIComponent(acc.email)}`}
                            className="text-primary hover:text-primary/80 hover:underline font-mono text-xs font-semibold truncate block w-full transition-colors"
                            title={acc.email}
                          >
                            {acc.email}
                          </Link>
                          <ExternalLink className="w-2.5 h-2.5 text-muted-foreground opacity-50 shrink-0" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span
                            className="text-[10px] text-muted-foreground font-mono truncate"
                            title={acc.userId}
                          >
                            ID: {acc.userId.slice(0, 8)}...
                          </span>
                          <CopyIdButton value={acc.userId} />
                        </div>
                      </div>
                    </PlanTableCell>

                    {/* Brand / Tenant */}
                    <PlanTableCell className="whitespace-nowrap">
                      <Badge
                        intent="outline"
                        className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          isSmmplan
                            ? 'bg-primary/10 text-primary border-primary/20'
                            : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                        }`}
                      >
                        {isSmmplan ? 'SMMplan' : 'SMMflux'}
                      </Badge>
                    </PlanTableCell>

                    {/* User Balance */}
                    <PlanTableCell className="text-right whitespace-nowrap">
                      <span className="font-mono font-bold tabular-nums text-xs text-foreground">
                        {fmt(acc.userBalance)}
                      </span>
                    </PlanTableCell>

                    {/* Ledger Sum */}
                    <PlanTableCell className="text-right whitespace-nowrap">
                      <span className="font-mono font-bold tabular-nums text-xs text-foreground">
                        {fmt(acc.ledgerSum)}
                      </span>
                    </PlanTableCell>

                    {/* Discrepancy */}
                    <PlanTableCell className="text-right whitespace-nowrap">
                      <span
                        className={`font-mono font-black tabular-nums text-xs ${
                          isDiscrepancy ? 'text-destructive' : 'text-success'
                        }`}
                      >
                        {fmt(acc.discrepancy, true)}
                      </span>
                    </PlanTableCell>

                    {/* Entries Count */}
                    <PlanTableCell className="text-center font-mono text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                      {acc.entriesCount}
                    </PlanTableCell>

                    {/* Status */}
                    <PlanTableCell className="whitespace-nowrap">
                      <Badge
                        intent="outline"
                        className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          acc.isActive
                            ? 'bg-success/10 text-success border-success/20'
                            : 'bg-destructive/10 text-destructive border-destructive/20'
                        }`}
                      >
                        {acc.isActive ? 'Активен' : 'Заблокирован'}
                      </Badge>
                    </PlanTableCell>

                    {/* Actions */}
                    <PlanTableCell className="text-right whitespace-nowrap">
                      <Button
                        intent={isDiscrepancy ? 'destructive' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedAuditUserId(acc.userId)}
                        className="h-7 min-h-[28px] px-2 font-bold text-xs"
                      >
                        {isDiscrepancy ? '🚨 Аудит' : 'Аудит'}
                      </Button>
                    </PlanTableCell>
                  </PlanTableRow>
                );
              })
            )}
          </tbody>
        </PlanTable>

        {/* ── Pagination Controls ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-2 text-xs text-muted-foreground">
          <div className="font-medium">
            Показано счетов: <span className="font-mono font-bold text-foreground">{accounts.length}</span> из{' '}
            <span className="font-mono font-bold text-foreground">{totalCount}</span>
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
      </div>

      {/* ── Slide-over Ledger Audit Drawer ── */}
      <LedgerAuditDrawer
        userId={selectedAuditUserId}
        isOpen={Boolean(selectedAuditUserId)}
        onClose={() => setSelectedAuditUserId(null)}
        onRemediationComplete={() => {
          loadData();
        }}
      />
    </div>
  );
}
