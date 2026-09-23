'use client';

import React, { useState, useTransition } from 'react';
import {
  applyAiRecommendationAction,
  bulkApplyAiRecommendationsAction,
  rejectAiRecommendationAction,
} from '@/actions/admin/economics/recommendations';
import { toast } from 'sonner';
import { 
  Sparkles, 
  Check, 
  X, 
  ArrowRight, 
  TrendingUp, 
  AlertTriangle, 
  CheckCheck, 
  Clock, 
  ShieldCheck 
} from 'lucide-react';

interface RecommendationItem {
  id: string;
  serviceId: string;
  serviceName: string;
  categoryName?: string;
  currentPriceRub: number;
  proposedPriceRub: number;
  currentMarkup: number;
  proposedMarkup: number;
  projectedMonthlyGainRub: number;
  confidenceScore: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'AUTO_APPLIED';
  rejectionReason?: string | null;
}

interface SnapshotData {
  id: string;
  tenantId: string;
  totalLeakageRub: number;
  leakingServicesCount: number;
  executiveSummary: string;
  status: string;
  createdAt: string;
  recommendations: RecommendationItem[];
}

interface Props {
  initialSnapshot: SnapshotData | null;
  allSnapshots: Array<{ id: string; createdAt: string; totalLeakageRub: number; leakingServicesCount: number; status: string }>;
}

export function RecommendationsClient({ initialSnapshot, allSnapshots }: Props) {
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(initialSnapshot);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  if (!snapshot) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-card rounded-xl border border-border">
        <Sparkles className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
        <h2 className="text-lg font-semibold text-foreground">Нет доступных оптимизационных снимков</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Ночной фоновый оптимизатор еще не создал снимков либо все рекомендации обработаны.
        </p>
      </div>
    );
  }

  const pendingItems = snapshot.recommendations.filter((r) => r.status === 'PENDING');

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === pendingItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingItems.map((p) => p.id)));
    }
  };

  const handleApplySingle = (recId: string) => {
    startTransition(async () => {
      const res = await applyAiRecommendationAction(recId);
      if (res.success) {
        toast.success('Цена успешно обновлена');
        setSnapshot((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            recommendations: prev.recommendations.map((r) =>
              r.id === recId ? { ...r, status: 'APPROVED' } : r
            ),
          };
        });
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(recId);
          return next;
        });
      } else {
        toast.error(res.error || 'Ошибка применения');
      }
    });
  };

  const handleBulkApply = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    startTransition(async () => {
      const res = await bulkApplyAiRecommendationsAction(snapshot.id, ids);
      if (res.success) {
        toast.success(`Успешно применено ${res.data?.appliedCount} рекомендаций`);
        setSnapshot((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            recommendations: prev.recommendations.map((r) =>
              ids.includes(r.id) ? { ...r, status: 'APPROVED' } : r
            ),
          };
        });
        setSelectedIds(new Set());
      } else {
        toast.error(res.error || 'Ошибка пакетного применения');
      }
    });
  };

  const handleRejectConfirm = () => {
    if (!rejectModalId || !rejectReason.trim()) {
      toast.error('Укажите причину отклонения');
      return;
    }

    startTransition(async () => {
      const res = await rejectAiRecommendationAction(rejectModalId, rejectReason);
      if (res.success) {
        toast.info('Рекомендация отклонена');
        setSnapshot((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            recommendations: prev.recommendations.map((r) =>
              r.id === rejectModalId ? { ...r, status: 'REJECTED', rejectionReason: rejectReason } : r
            ),
          };
        });
        setRejectModalId(null);
        setRejectReason('');
      } else {
        toast.error(res.error || 'Ошибка отклонения');
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border p-4 rounded-xl shadow-xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            Выявленная утечка маржи
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-500 mt-2">
            +{Math.round(snapshot.totalLeakageRub).toLocaleString('ru-RU')} ₽ <span className="text-xs font-normal text-muted-foreground">/ мес</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Потенциальный прирост чистой прибыли при устранении демпинга
          </p>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl shadow-xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Услуг к оптимизации
          </div>
          <div className="text-2xl font-bold font-mono text-amber-500 mt-2">
            {snapshot.leakingServicesCount} <span className="text-xs font-normal text-muted-foreground">позиций</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Осталось на утверждении: {pendingItems.length}
          </p>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl shadow-xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Инвариантный фильтр маржи
          </div>
          <div className="text-2xl font-bold font-mono text-primary mt-2">
            15.0% <span className="text-xs font-normal text-muted-foreground">Gross Floor</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Все цены проверены на отсутствие продажи в минус
          </p>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-primary/10 border border-primary/20 p-3 rounded-lg animate-fade-in">
          <div className="text-sm font-medium text-primary flex items-center gap-2">
            <CheckCheck className="w-4 h-4" />
            Выбрано позиций: {selectedIds.size} из {pendingItems.length}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md transition-colors"
            >
              Сбросить
            </button>
            <button
              onClick={handleBulkApply}
              disabled={isPending}
              className="bg-primary text-primary-foreground font-medium text-xs px-4 py-1.5 rounded-md shadow-xs hover:bg-primary/90 transition-all flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Применить выбранные (+{selectedIds.size})
            </button>
          </div>
        </div>
      )}

      {/* Main Table — Viewport 100% Fit & Zero Horizontal Scroll */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-hidden w-full">
          <table className="w-full text-left text-xs table-fixed border-collapse">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
              <tr>
                <th className="w-8 px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.size > 0 && selectedIds.size === pendingItems.length}
                    onChange={toggleSelectAll}
                    className="rounded border-border"
                  />
                </th>
                <th className="w-48 px-2 py-2">Услуга</th>
                <th className="w-28 px-2 py-2">Текущая цена</th>
                <th className="w-32 px-2 py-2">Новая цена</th>
                <th className="w-24 px-2 py-2">Прирост</th>
                <th className="w-20 px-2 py-2">AI Score</th>
                <th className="w-24 px-2 py-2">Статус</th>
                <th className="w-24 px-2 py-2 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {snapshot.recommendations.map((rec) => {
                const isSelected = selectedIds.has(rec.id);
                const isPendingItem = rec.status === 'PENDING';

                return (
                  <tr
                    key={rec.id}
                    className={`hover:bg-muted/20 transition-colors ${
                      isSelected ? 'bg-primary/5' : ''
                    }`}
                  >
                    <td className="px-2 py-2 text-center">
                      {isPendingItem && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(rec.id)}
                          className="rounded border-border"
                        />
                      )}
                    </td>

                    <td className="px-2 py-2 truncate max-w-[190px]" title={rec.serviceName}>
                      <span className="font-medium text-foreground">{rec.serviceName}</span>
                    </td>

                    <td className="px-2 py-2 font-mono tabular-nums text-muted-foreground">
                      {rec.currentPriceRub.toFixed(2)} ₽ <span className="text-[10px]">({rec.currentMarkup}x)</span>
                    </td>

                    <td className="px-2 py-2 font-mono tabular-nums">
                      <span className="font-bold text-foreground bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        {rec.proposedPriceRub.toFixed(2)} ₽
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-1">({rec.proposedMarkup}x)</span>
                    </td>

                    <td className="px-2 py-2 font-mono tabular-nums text-emerald-500 font-semibold">
                      +{Math.round(rec.projectedMonthlyGainRub)} ₽
                    </td>

                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-[11px] font-medium">
                          {(rec.confidenceScore * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>

                    <td className="px-2 py-2">
                      {rec.status === 'PENDING' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3" /> Ожидает
                        </span>
                      )}
                      {rec.status === 'APPROVED' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3" /> Принято
                        </span>
                      )}
                      {rec.status === 'REJECTED' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-full" title={rec.rejectionReason || ''}>
                          <X className="w-3 h-3" /> Отклонено
                        </span>
                      )}
                    </td>

                    <td className="px-2 py-2 text-right">
                      {isPendingItem ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleApplySingle(rec.id)}
                            disabled={isPending}
                            title="Применить цену в 1 клик"
                            className="h-7 w-7 rounded bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setRejectModalId(rec.id)}
                            disabled={isPending}
                            title="Отклонить рекомендацию"
                            className="h-7 w-7 rounded bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all flex items-center justify-center"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Modal */}
      {rejectModalId && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-5 space-y-4 shadow-lg">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Отклонение рекомендации
            </h3>
            <p className="text-xs text-muted-foreground">
              Укажите причину для сохранения в журнале аудита и обучения будущих моделей.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Например: Позиция участвует в сезонной промо-акции..."
              className="w-full h-24 text-xs bg-muted/30 border border-border rounded-lg p-2.5 focus:outline-hidden focus:ring-1 focus:ring-primary text-foreground"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setRejectModalId(null);
                  setRejectReason('');
                }}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={isPending || !rejectReason.trim()}
                className="px-4 py-1.5 text-xs bg-destructive text-destructive-foreground font-medium rounded-md hover:bg-destructive/90 transition-all"
              >
                Подтвердить отклонение
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
