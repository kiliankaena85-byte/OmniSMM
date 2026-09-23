'use client';

import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { useState, useEffect, useCallback } from 'react';
import {
  Activity, Users, MessageSquare, ShoppingCart, AlertTriangle,
  TrendingUp, TrendingDown, Minus, BarChart3, Calendar,
} from 'lucide-react';
import { getTelegramStatsAction } from '@/actions/admin/telegram-bot';
import type { TelegramStatsOverview, TelegramDailyStat } from '@/types/telegram';

export function StatisticsPanel() {
  const [stats, setStats] = useState<TelegramStatsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | '90d'>('7d');

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTelegramStatsAction(period);
      if (res.success && res.data) { setStats(res.data); }
      else { toast.error(res.error || 'Ошибка загрузки статистики'); }
    } catch (err) { toast.error(String(err)); }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const DeltaIcon = ({ today, yesterday, field }: { today: number; yesterday: number; field: string }) => {
    if (!yesterday) return <Minus className="w-3 h-3 text-zinc-500" />;
    const diff = today - yesterday;
    if (diff > 0) return <><TrendingUp className="w-3 h-3 text-emerald-400" /><span className="text-[10px] text-emerald-400">+{diff}</span></>;
    if (diff < 0) return <><TrendingDown className="w-3 h-3 text-rose-400" /><span className="text-[10px] text-rose-400">{diff}</span></>;
    return <Minus className="w-3 h-3 text-zinc-500" />;
  };

  const t = stats?.today;
  const y = stats?.yesterday;

  const metricCards = [
    { label: 'Получено сообщений', value: t?.messagesReceived ?? 0, icon: MessageSquare, color: 'text-blue-400', bg: 'bg-blue-500/10', yesterday: y?.messagesReceived },
    { label: 'Отправлено сообщений', value: t?.messagesSent ?? 0, icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-500/10', yesterday: y?.messagesSent },
    { label: 'Обработано команд', value: t?.commandsHandled ?? 0, icon: BarChart3, color: 'text-purple-400', bg: 'bg-purple-500/10', yesterday: y?.commandsHandled },
    { label: 'Коллбэки', value: t?.callbacksHandled ?? 0, icon: Activity, color: 'text-cyan-400', bg: 'bg-cyan-500/10', yesterday: y?.callbacksHandled },
    { label: 'Новых пользователей', value: t?.newUsers ?? 0, icon: Users, color: 'text-amber-400', bg: 'bg-amber-500/10', yesterday: y?.newUsers },
    { label: 'Заказов из бота', value: t?.ordersCreated ?? 0, icon: ShoppingCart, color: 'text-pink-400', bg: 'bg-pink-500/10', yesterday: y?.ordersCreated },
    { label: 'Тикетов из TG', value: t?.ticketsCreated ?? 0, icon: MessageSquare, color: 'text-indigo-400', bg: 'bg-indigo-500/10', yesterday: y?.ticketsCreated },
    { label: 'Ошибок за 24ч', value: stats?.errorsLast24h ?? 0, icon: AlertTriangle, color: 'text-rose-400', bg: 'bg-rose-500/10', yesterday: null },
  ];

  return (
    <div className="space-y-6">
      {/* Period Selector & Overview */}
      <Card className="rounded-3xl border border-border/80 shadow-sm bg-card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-1 px-2.5 bg-emerald-500/10 text-emerald-400 rounded-md text-[10px] font-bold">STATS</span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Статистика бота</h3>
          </div>
          <div className="flex gap-1">
            {([['today', 'Сегодня'], ['7d', '7 дней'], ['30d', '30 дней'], ['90d', '90 дней']] as const).map(([val, label]) => (
              <button key={val} type="button" onClick={() => setPeriod(val)} className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${period === val ? 'bg-primary/10 text-primary border-primary/30' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Cumulative Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-muted/20 border border-border/60">
            <p className="text-[10px] text-muted-foreground font-bold uppercase">Привязано юзеров</p>
            <p className="text-lg font-extrabold font-mono">{stats?.linkedUsersCount ?? 0}</p>
          </div>
          <div className="p-3 rounded-xl bg-muted/20 border border-border/60">
            <p className="text-[10px] text-muted-foreground font-bold uppercase">Всего TG-тикетов</p>
            <p className="text-lg font-extrabold font-mono">{stats?.telegramTicketsCount ?? 0}</p>
          </div>
          <div className="p-3 rounded-xl bg-muted/20 border border-border/60">
            <p className="text-[10px] text-muted-foreground font-bold uppercase">Активных кнопок</p>
            <p className="text-lg font-extrabold font-mono">{stats?.activeButtonsCount ?? 0}</p>
          </div>
          <div className="p-3 rounded-xl bg-muted/20 border border-border/60">
            <p className="text-[10px] text-muted-foreground font-bold uppercase">Нерешённых ошибок</p>
            <p className={`text-lg font-extrabold font-mono ${(stats?.unresolvedErrorsCount ?? 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{stats?.unresolvedErrorsCount ?? 0}</p>
          </div>
        </div>
      </Card>

      {/* Daily Metrics */}
      {loading ? (
        <Card className="rounded-2xl p-8 text-center"><p className="text-xs text-muted-foreground">Загрузка...</p></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {metricCards.map(m => (
              <Card key={m.label} className="rounded-2xl border border-border/60 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`p-1.5 rounded-lg ${m.bg}`}><m.icon className={`w-4 h-4 ${m.color}`} /></span>
                  {m.yesterday != null && <DeltaIcon today={m.value} yesterday={m.yesterday} field={m.label} />}
                </div>
                <p className="text-xl font-extrabold font-mono">{m.value.toLocaleString('ru-RU')}</p>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{m.label}</p>
              </Card>
            ))}
          </div>

          {/* Latency Info */}
          {(t?.avgLatencyMs || t?.p99LatencyMs) && (
            <Card className="rounded-2xl border border-border/60 p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">Avg Latency</p>
                  <p className="text-sm font-extrabold font-mono">{t.avgLatencyMs ?? 0} ms</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">P99 Latency</p>
                  <p className="text-sm font-extrabold font-mono">{t.p99LatencyMs ?? 0} ms</p>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}