'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Users, MousePointerClick, CheckCircle2, Coins } from 'lucide-react';
import type { DePinAnalyticsData } from '@/actions/admin/depin/depin-analytics-actions';

interface DePinAnalyticsKpiCardsProps {
  kpis?: DePinAnalyticsData['kpis'];
}

export function DePinAnalyticsKpiCards({ kpis }: DePinAnalyticsKpiCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Карточка 1: DAU / WAU */}
      <Card className="p-4 rounded-2xl bg-card/80 border border-border/80 shadow-sm space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-400" />
            DAU (Активность 24ч)
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
            {kpis?.totalUsers ? Math.round((kpis.dau / kpis.totalUsers) * 100) : 0}% базы
          </span>
        </div>
        <div className="text-2xl font-black text-foreground font-mono">
          {kpis?.dau ?? 0}
          <span className="text-xs font-normal text-muted-foreground ml-2">/ {kpis?.totalUsers ?? 0} всего</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          WAU (за 7 дней): <strong className="text-foreground font-mono">{kpis?.wau ?? 0} чел.</strong>
        </p>
      </Card>

      {/* Карточка 2: Тап-клики */}
      <Card className="p-4 rounded-2xl bg-card/80 border border-border/80 shadow-sm space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <MousePointerClick className="w-4 h-4 text-amber-400" />
            Всего натапано
          </span>
          <span className="text-[10px] font-bold text-amber-400">Тапы</span>
        </div>
        <div className="text-2xl font-black text-amber-400 font-mono">
          {kpis?.totalTaps?.toLocaleString('ru') ?? 0}
        </div>
        <p className="text-[11px] text-muted-foreground">
          В среднем: <strong className="text-foreground font-mono">~{kpis?.avgTapsPerUser ?? 0} тапов</strong> на игрока
        </p>
      </Card>

      {/* Карточка 3: Выполнено микро-задач */}
      <Card className="p-4 rounded-2xl bg-card/80 border border-border/80 shadow-sm space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Закрыто заданий
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
            100% успех
          </span>
        </div>
        <div className="text-2xl font-black text-emerald-400 font-mono">
          {kpis?.totalTasksCompleted?.toLocaleString('ru') ?? 0}
        </div>
        <p className="text-[11px] text-muted-foreground">
          На сумму: <strong className="text-emerald-400 font-mono">{kpis?.totalCreditsIssued ?? 0} PTS</strong>
        </p>
      </Card>

      {/* Карточка 4: Выведено рублей в систему */}
      <Card className="p-4 rounded-2xl bg-card/80 border border-border/80 shadow-sm space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-purple-400" />
            Выведено балансов
          </span>
          <span className="text-[10px] font-bold text-purple-400">1 PTS = 0.05 ₽</span>
        </div>
        <div className="text-2xl font-black text-emerald-400 font-mono">
          {kpis?.totalRublesWithdrawn?.toLocaleString('ru') ?? 0} ₽
        </div>
        <p className="text-[11px] text-muted-foreground">
          На балансах узлов: <strong className="text-amber-400 font-mono">{kpis?.totalCreditsIssued ?? 0} PTS</strong>
        </p>
      </Card>
    </div>
  );
}
