'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, ExternalLink } from 'lucide-react';
import type { DePinAnalyticsData } from '@/actions/admin/depin/depin-analytics-actions';

interface DePinAnalyticsLeaderboardViewProps {
  leaderboards?: DePinAnalyticsData['leaderboards'];
}

export function DePinAnalyticsLeaderboardView({ leaderboards }: DePinAnalyticsLeaderboardViewProps) {
  const [leaderboardTab, setLeaderboardTab] = React.useState<'tappers' | 'performers' | 'earners'>('tappers');

  const list =
    leaderboardTab === 'tappers'
      ? leaderboards?.topTappers
      : leaderboardTab === 'performers'
      ? leaderboards?.topPerformers
      : leaderboards?.topEarners;

  return (
    <Card className="rounded-2xl border border-border/80 shadow-sm p-5 bg-card/80 space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h4 className="text-sm font-extrabold text-foreground">Турнирная таблица активности (Leaderboards)</h4>
        </div>

        <div className="flex p-1 bg-muted/40 rounded-xl border border-border/60 text-xs">
          <button
            type="button"
            onClick={() => setLeaderboardTab('tappers')}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              leaderboardTab === 'tappers'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            👆 Топ кликеров
          </button>
          <button
            type="button"
            onClick={() => setLeaderboardTab('performers')}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              leaderboardTab === 'performers'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            🎯 Топ по заданиям
          </button>
          <button
            type="button"
            onClick={() => setLeaderboardTab('earners')}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              leaderboardTab === 'earners'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            💎 Топ по доходу
          </button>
        </div>
      </div>

      {/* Таблица Лидеров */}
      <div className="overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30 text-muted-foreground font-semibold">
              <th className="py-2.5 px-3 w-12 text-center">Ранг</th>
              <th className="py-2.5 px-3">Узел (Node ID)</th>
              <th className="py-2.5 px-3">Telegram Профиль</th>
              <th className="py-2.5 px-3 text-right">
                {leaderboardTab === 'tappers' ? 'Натапано кликов' : leaderboardTab === 'performers' ? 'Выполнено задач' : 'Заработано PTS'}
              </th>
              <th className="py-2.5 px-3 text-right">
                {leaderboardTab === 'earners' ? 'В рублях' : 'Баланс PTS'}
              </th>
              <th className="py-2.5 px-3 text-center">Репутация</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {!list || list.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted-foreground">
                  Нет данных активности за выбранный период.
                </td>
              </tr>
            ) : (
              list.map((user, index) => {
                const rankBadge =
                  index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;

                return (
                  <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2 px-3 text-center font-bold text-sm">
                      {rankBadge}
                    </td>
                    <td className="py-2 px-3 font-mono font-semibold text-foreground">
                      {user.id}
                    </td>
                    <td className="py-2 px-3">
                      {user.telegramId ? (
                        <a
                          href={`https://t.me/${user.telegramId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <span>ID: {user.telegramId}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground italic">Аноним</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                      {user.value.toLocaleString('ru')}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-amber-400">
                      {leaderboardTab === 'earners'
                        ? `${user.secondaryValue?.toFixed(2)} ₽`
                        : `${user.secondaryValue?.toLocaleString('ru')} PTS`}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <Badge
                        intent="outline"
                        className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      >
                        {user.reputation}%
                      </Badge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
