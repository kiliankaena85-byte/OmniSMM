'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  Star, 
  RotateCcw, 
  Loader2, 
  MessageSquare, 
  Users, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  Filter
} from 'lucide-react';
import { 
  getTicketFeedbackStatsAction, 
  getTicketFeedbackListAction 
} from '@/actions/admin/telegram-bot';
import type { 
  TicketFeedbackStats, 
  TicketFeedbackItem, 
} from '@/types/telegram';
import Link from 'next/link';

export function TelegramFeedbackListTab() {
  const [stats, setStats] = React.useState<TicketFeedbackStats | null>(null);
  const [items, setItems] = React.useState<TicketFeedbackItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedScore, setSelectedScore] = React.useState<number | undefined>(undefined);
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const fetchData = async (scoreFilter = selectedScore, pageNum = page) => {
    setLoading(true);
    try {
      const [statsRes, listRes] = await Promise.all([
        getTicketFeedbackStatsAction(),
        getTicketFeedbackListAction({ page: pageNum, pageSize: 10, score: scoreFilter })
      ]);

      if (statsRes.success && statsRes.stats) {
        setStats(statsRes.stats);
      }
      if (listRes.success && listRes.items) {
        setItems(listRes.items);
        setTotal(listRes.total || 0);
        setPage(listRes.page || 1);
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData(selectedScore, 1);
  }, [selectedScore]);

  const handleScoreFilter = (score?: number) => {
    setSelectedScore(score);
  };

  const getScoreBadgeClass = (score: number) => {
    if (score >= 4) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    if (score === 3) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
  };

  return (
    <div className="space-y-6">
      {/* ── 1. AGGREGATE CSAT METRICS ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card: Avg Score */}
        <Card className="p-5 rounded-3xl bg-card border border-border/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Индекс удовлетворенности (CSAT)</span>
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-black text-foreground font-mono">
              {stats ? stats.avgScore.toFixed(2) : '5.00'}
            </span>
            <div className="flex items-center text-amber-400 text-sm">
              {'★'.repeat(Math.round(stats?.avgScore || 5))}
              <span className="text-xs text-muted-foreground ml-1.5 font-sans font-bold">/ 5.0</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Всего получено оценок: <strong className="text-foreground">{stats?.totalCount ?? 0}</strong>
          </p>
        </Card>

        {/* Card: Score Breakdown */}
        <Card className="p-5 rounded-3xl bg-card border border-border/80 shadow-sm space-y-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Распределение оценок</span>
          
          <div className="space-y-1.5 pt-1">
            {[5, 4, 3, 2, 1].map(stars => {
              const count = stats?.scoreBreakdown[stars as 1|2|3|4|5] || 0;
              const pct = stats?.totalCount ? Math.round((count / stats.totalCount) * 100) : 0;
              return (
                <div key={stars} className="flex items-center gap-2 text-[11px]">
                  <span className="w-6 font-mono font-bold text-muted-foreground">{stars} ★</span>
                  <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        stars >= 4 ? 'bg-emerald-500' : stars === 3 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-mono text-[10px] text-muted-foreground">{count}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Card: Top Reasons Cloud */}
        <Card className="p-5 rounded-3xl bg-card border border-border/80 shadow-sm space-y-3">
          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Частые факторы оценки</span>

          <div className="flex flex-wrap gap-1.5 min-h-[90px] content-start">
            {stats?.topReasons && stats.topReasons.length > 0 ? (
              stats.topReasons.map((r, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-muted/30 border border-border/80 text-foreground"
                >
                  <span>{r.reason}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-bold">
                    {r.count}
                  </span>
                </span>
              ))
            ) : (
              <p className="text-xs text-muted-foreground py-4">Отзывов с указанием причин пока нет.</p>
            )}
          </div>
        </Card>
      </div>

      {/* ── 2. FEEDBACK LOG & CRM TABLE ── */}
      <Card className="rounded-3xl border border-border/80 shadow-sm bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-foreground">Журнал отзывов пользователей</h4>
            <span className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-2 py-0.5 rounded">
              Всего: {total}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl border border-border/60 text-xs">
              <button
                type="button"
                onClick={() => handleScoreFilter(undefined)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  selectedScore === undefined ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Все
              </button>
              {[5, 4, 3, 2, 1].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleScoreFilter(s)}
                  className={`px-2 py-1 rounded-lg font-bold font-mono transition-all cursor-pointer ${
                    selectedScore === s ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s}★
                </button>
              ))}
            </div>

            <Button
              type="button"
              intent="secondary"
              size="sm"
              onClick={() => fetchData(selectedScore, page)}
              disabled={loading}
              className="h-8 px-2.5 text-xs font-bold gap-1 cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Table / List */}
        {loading ? (
          <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Загрузка отзывов...
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <MessageSquare className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className="text-xs text-muted-foreground font-medium">Отзывов с выбранным фильтром не найдено.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/60">
            <div className="divide-y divide-border/40">
              {items.map(item => (
                <div key={item.id} className="p-4 hover:bg-muted/10 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-black border ${getScoreBadgeClass(item.score)}`}>
                        {item.score} ★
                      </span>
                      <Link
                        href={`/admin/tickets/${item.ticketId}`}
                        className="font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1 truncate max-w-[280px]"
                      >
                        <span>{item.ticketSubject}</span>
                        <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                      </Link>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        ({item.userEmail})
                      </span>
                    </div>

                    {/* Reasons list */}
                    {item.reasons.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {item.reasons.map((r, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-muted/40 text-muted-foreground border border-border/60"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    )}

                    {item.comment && (
                      <p className="text-xs text-foreground/90 italic pt-1 pl-2 border-l-2 border-primary/40">
                        «{item.comment}»
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground shrink-0 sm:text-right">
                    <span className="font-mono px-2 py-0.5 rounded bg-muted/30 border border-border/40">
                      {item.source}
                    </span>
                    <span className="font-mono text-[10px]">
                      {new Date(item.createdAt).toLocaleDateString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
