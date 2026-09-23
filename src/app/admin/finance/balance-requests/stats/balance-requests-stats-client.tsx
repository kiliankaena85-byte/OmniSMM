'use client';

import React, { useState, useEffect } from "react";
import { getBalanceAdjustmentStatsAction } from "@/actions/admin/balance-adjustments";
import Link from "next/link";

interface StatsData {
  summary: {
    totalCount: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    executedCount: number;
    creditSum: string;
    debitSum: string;
    netSum: string;
  };
  byStaff: { id: string; email: string; count: number; creditSum: string; debitSum: string }[];
  byReason: { code: string; count: number; creditSum: string; debitSum: string }[];
  byDay: { day: string; count: number; creditSum: string; debitSum: string }[];
}

import { AdminBreadcrumbs } from "@/components/admin/AdminBreadcrumbs";

export function BalanceAdjustmentStatsClient() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await getBalanceAdjustmentStatsAction(new FormData());
      if (res.success && res.summary) {
        setStats(res as unknown as StatsData);
      }
    } catch (err) {
      console.error("Failed to fetch balance stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return <div className="p-12 text-center text-muted-foreground text-sm">Загрузка статистики...</div>;
  }

  if (!stats) {
    return <div className="p-12 text-center text-muted-foreground text-sm">Не удалось загрузить данные</div>;
  }

  const creditRub = (Number(stats.summary.creditSum) / 100).toFixed(2);
  const debitRub = (Number(stats.summary.debitSum) / 100).toFixed(2);
  const netRub = (Number(stats.summary.netSum) / 100).toFixed(2);

  return (
    <div className="space-y-4 w-full max-w-full pb-8">
      <AdminBreadcrumbs
        items={[
          { label: 'Финансы', href: '/admin/finance' },
          { label: 'Заявки баланса', href: '/admin/finance/balance-requests' },
          { label: 'Статистика заявок' },
        ]}
      />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Статистика и отчёты по заявкам</h1>
          <p className="text-sm text-muted-foreground">
            Сводные финансовые показатели корректировок баланса и лимитов
          </p>
        </div>

        <Link
          href="/admin/finance/balance-requests"
          className="py-2 px-4 bg-muted hover:bg-muted/80 text-foreground font-medium rounded-lg text-xs"
        >
          ← Назад к заявкам
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-card/70 border border-border/80 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Всего заявок</span>
          <div className="text-2xl font-black font-mono text-foreground">{stats.summary.totalCount}</div>
          <div className="text-xs text-warning font-medium">{stats.summary.pendingCount} на утверждении</div>
        </div>

        <div className="p-4 bg-card/70 border border-border/80 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Начислено (CREDIT)</span>
          <div className="text-2xl font-black font-mono text-success">+{creditRub} ₽</div>
          <div className="text-xs text-muted-foreground font-medium">{stats.summary.executedCount} исполнено</div>
        </div>

        <div className="p-4 bg-card/70 border border-border/80 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Списано (DEBIT)</span>
          <div className="text-2xl font-black font-mono text-destructive">-{debitRub} ₽</div>
          <div className="text-xs text-muted-foreground font-medium">{stats.summary.rejectedCount} отклонено</div>
        </div>

        <div className="p-4 bg-card/70 border border-border/80 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Чистый баланс (NET)</span>
          <div className={`text-2xl font-black font-mono ${Number(stats.summary.netSum) >= 0 ? 'text-success' : 'text-destructive'}`}>
            {Number(stats.summary.netSum) >= 0 ? `+${netRub}` : `${netRub}`} ₽
          </div>
          <div className="text-xs text-muted-foreground font-medium">Итоговое сальдо</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Staff Table */}
        <div className="bg-card/70 border border-border/80 rounded-2xl p-5 shadow-xs space-y-3">
          <h3 className="font-bold text-foreground text-xs uppercase tracking-wider">Статистика по операторам (Staff)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground font-medium border-b border-border/60">
                <tr>
                  <th className="p-2.5">Оператор</th>
                  <th className="p-2.5">Заявок</th>
                  <th className="p-2.5 text-right">Начислено</th>
                  <th className="p-2.5 text-right">Списано</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {stats.byStaff.map((staff) => (
                  <tr key={staff.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-2.5 font-medium font-mono text-xs text-foreground">{staff.email}</td>
                    <td className="p-2.5 font-mono">{staff.count}</td>
                    <td className="p-2.5 text-right text-success font-mono font-bold">+{(Number(staff.creditSum) / 100).toFixed(2)} ₽</td>
                    <td className="p-2.5 text-right text-destructive font-mono font-bold">-{(Number(staff.debitSum) / 100).toFixed(2)} ₽</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* By Reason Table */}
        <div className="bg-card/70 border border-border/80 rounded-2xl p-5 shadow-xs space-y-3">
          <h3 className="font-bold text-foreground text-xs uppercase tracking-wider">Статистика по причинам (Reason Code)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground font-medium border-b border-border/60">
                <tr>
                  <th className="p-2.5">Код причины</th>
                  <th className="p-2.5">Заявок</th>
                  <th className="p-2.5 text-right">Сумма начислений</th>
                  <th className="p-2.5 text-right">Сумма списаний</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {stats.byReason.map((reason) => (
                  <tr key={reason.code} className="hover:bg-muted/20 transition-colors">
                    <td className="p-2.5 font-mono font-medium text-foreground">{reason.code}</td>
                    <td className="p-2.5 font-mono">{reason.count}</td>
                    <td className="p-2.5 text-right text-success font-mono font-bold">+{(Number(reason.creditSum) / 100).toFixed(2)} ₽</td>
                    <td className="p-2.5 text-right text-destructive font-mono font-bold">-{(Number(reason.debitSum) / 100).toFixed(2)} ₽</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
