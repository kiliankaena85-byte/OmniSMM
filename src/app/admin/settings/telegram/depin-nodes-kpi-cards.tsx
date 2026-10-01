'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Users, Coins, ShieldCheck, CheckCircle2 } from 'lucide-react';
import type { DePinAdminStats } from '@/actions/admin/depin/depin-admin-actions';

interface DePinNodesKpiCardsProps {
  stats: DePinAdminStats | null;
}

export function DePinNodesKpiCards({ stats }: DePinNodesKpiCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Карточка 1: Узлы */}
      <Card className="p-4 rounded-2xl bg-card/80 border border-border/80 shadow-sm space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-400" />
            Всего узлов DePIN
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
            {stats?.activeNodes24h ?? 0} онлайн 24ч
          </span>
        </div>
        <div className="text-2xl font-black text-foreground font-mono">
          {stats?.totalNodes ?? 0}
        </div>
        <p className="text-[11px] text-muted-foreground">Клиенты с установленным Mini App</p>
      </Card>

      {/* Карточка 2: Начислено PTS */}
      <Card className="p-4 rounded-2xl bg-card/80 border border-border/80 shadow-sm space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-amber-400" />
            Баланс кредитов (PTS)
          </span>
          <span className="text-[10px] font-bold text-amber-400">
            100 PTS = 1 ₽
          </span>
        </div>
        <div className="text-2xl font-black text-amber-400 font-mono">
          {stats?.totalCreditsIssued?.toLocaleString('ru') ?? 0}{' '}
          <span className="text-xs font-semibold text-muted-foreground">PTS</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Эквивалент: <strong className="text-foreground font-mono">{stats?.totalRublesEquivalent ?? 0} ₽</strong>
        </p>
      </Card>

      {/* Карточка 3: Эскроу залог */}
      <Card className="p-4 rounded-2xl bg-card/80 border border-border/80 shadow-sm space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            В Эскроу (Залог)
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">72ч холд</span>
        </div>
        <div className="text-2xl font-black text-foreground font-mono">
          {stats?.totalEscrowCredits?.toLocaleString('ru') ?? 0}{' '}
          <span className="text-xs font-semibold text-muted-foreground">PTS</span>
        </div>
        <p className="text-[11px] text-muted-foreground">Заморозка за подписки против отписок</p>
      </Card>

      {/* Карточка 4: Задачи и надежность */}
      <Card className="p-4 rounded-2xl bg-card/80 border border-border/80 shadow-sm space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Выполнено микро-задач
          </span>
          {stats && stats.totalTasksFailed > 0 ? (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
              {stats.totalTasksFailed} сбоев
            </span>
          ) : (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
              100% успех
            </span>
          )}
        </div>
        <div className="text-2xl font-black text-foreground font-mono">
          {stats?.totalTasksCompleted?.toLocaleString('ru') ?? 0}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Очередь заданий: <strong className="text-foreground">{stats?.activeTargetsCount ?? 0} активных</strong>
        </p>
      </Card>
    </div>
  );
}
