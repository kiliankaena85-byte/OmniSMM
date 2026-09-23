'use client';

import { useState, useEffect } from 'react';
import { 
  getQuarantineServiceApiDiffAction, 
  applyQuarantineResolutionAction 
} from '@/actions/admin/providers/sync-action';
import type { ServiceMutationResult } from '@/services/providers/service-mutation-detector';
import { formatPricePerUnit } from '@/utils/format-price';
import { toast } from 'sonner';

export interface QuarantineDiffTarget {
  id: string;
  numericId?: number | null;
  name: string;
  providerName: string;
  externalId?: string | null;
}

interface Props {
  item: QuarantineDiffTarget | null;
  onClose: () => void;
  onResolved: (serviceId: string) => void;
}

export function QuarantineDiffModal({ item, onClose, onResolved }: Props) {
  const [loading, setLoading] = useState(true);
  const [diff, setDiff] = useState<ServiceMutationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (!item) return;
    let isMounted = true;
    setLoading(true);
    setError(null);
    setDiff(null);

    getQuarantineServiceApiDiffAction(item.id)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.diff) {
          setDiff(res.diff);
        } else {
          setError(res.error || 'Не удалось получить данные из API провайдера');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Сбой сети при запросе API');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [item]);

  if (!item) return null;

  async function handleResolve(mode: 'PRICE_ONLY' | 'SYNC_ALL' | 'DEACTIVATE') {
    if (!item) return;
    setResolving(true);
    try {
      const res = await applyQuarantineResolutionAction({ serviceId: item.id, mode });
      if (res.success) {
        if (mode === 'PRICE_ONLY') {
          toast.success('✅ Новый тариф принят, услуга возвращена на витрину');
        } else if (mode === 'SYNC_ALL') {
          toast.success('🔄 Параметры синхронизированы, услуга активирована');
        } else {
          toast.success('🚫 Услуга отключена и выведена из карантина');
        }
        onResolved(item.id);
        onClose();
      } else {
        toast.error(res.error || 'Ошибка применения решения');
      }
    } catch {
      toast.error('Сбой при сохранении решения');
    } finally {
      setResolving(false);
    }
  }

  return (
    <div 
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-0 duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-card text-card-foreground border border-border/70 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-border flex items-start justify-between gap-4 bg-muted/20">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg">🔍</span>
              <h3 className="font-bold text-base text-foreground">Сверка с API поставщика</h3>
              {item.numericId ? (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold border border-border">
                  #{item.numericId}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {item.name} · <span className="font-semibold text-foreground/80">{item.providerName}</span>
              {item.externalId ? ` (ID поставщика: ${item.externalId})` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Закрыть окно"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {loading && (
            <div className="py-16 text-center space-y-3">
              <div className="inline-block w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">
                Запрашиваем актуальные данные из API <span className="font-semibold text-foreground">{item.providerName}</span>...
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                <span>⚠️</span>
                <span>Не удалось получить ответ от поставщика</span>
              </div>
              <p className="text-xs text-destructive/90">{error}</p>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  getQuarantineServiceApiDiffAction(item.id)
                    .then((res) => {
                      if (res.success && res.diff) setDiff(res.diff);
                      else setError(res.error || 'Ошибка');
                    })
                    .finally(() => setLoading(false));
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25 transition-all cursor-pointer"
              >
                🔄 Повторить запрос
              </button>
            </div>
          )}

          {diff && !loading && (
            <div className="space-y-5">
              {/* Verdict Banner */}
              {diff.verdict === 'SAFE_PRICE_ONLY' && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-emerald-800 dark:text-emerald-300 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <span>🟢</span>
                    <span>Безопасное изменение: Только тариф</span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-90">
                    Все технические параметры (название, лимиты, тип, гарантия) полностью соответствуют услуге в SMMplan. Изменилась только себестоимость у поставщика.
                  </p>
                </div>
              )}

              {diff.verdict === 'MUTATED_PARAMS' && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-amber-800 dark:text-amber-300 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <span>🟡</span>
                    <span>Внимание: Изменились параметры услуги</span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-90">
                    Поставщик изменил лимиты min/max, гарантию или тип услуги. Услуга автоматически отключена на витрине во избежание сбоев в заказах клиентов.
                  </p>
                </div>
              )}

              {diff.verdict === 'SERVICE_REPLACED' && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-destructive space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <span>🔴</span>
                    <span>КРИТИЧЕСКОЕ РАСХОЖДЕНИЕ: Возможно подмена услуги!</span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-90">
                    Сходство названий составляет всего {Math.round(diff.nameSimilarity * 100)}%. Поставщик, вероятно, назначил этот ID совершенно другой услуге. Рекомендуется отключить услугу.
                  </p>
                </div>
              )}

              {diff.verdict === 'NOT_FOUND_AT_PROVIDER' && (
                <div className="bg-muted border border-border rounded-xl p-4 text-muted-foreground space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                    <span>⚪</span>
                    <span>Услуга отсутствует в API поставщика</span>
                  </div>
                  <p className="text-xs leading-relaxed">
                    Поставщик удалил услугу из своего каталога или изменил её ID. Услуга переведена в деактивированное состояние.
                  </p>
                </div>
              )}

              {/* Reasons */}
              {diff.reasons.length > 0 && (
                <div className="bg-muted/40 border border-border/70 rounded-xl p-3.5 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Выявленные отклонения:
                  </span>
                  <ul className="space-y-1 text-xs">
                    {diff.reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-foreground/90">
                        <span className="text-muted-foreground shrink-0 mt-0.5">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Side-by-Side Diff Table */}
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Параметр</th>
                      <th className="py-2.5 px-3">В базе SMMplan</th>
                      <th className="py-2.5 px-3">В API поставщика</th>
                      <th className="py-2.5 px-3 text-right">Статус</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-mono">
                    {/* Name */}
                    <tr className={diff.diff.name.changed ? 'bg-warning/5' : ''}>
                      <td className="py-2.5 px-3 font-sans font-medium text-foreground">Название</td>
                      <td className="py-2.5 px-3 font-sans text-muted-foreground max-w-[200px] truncate" title={diff.diff.name.oldValue}>
                        {diff.diff.name.oldValue}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-foreground font-medium max-w-[200px] truncate" title={diff.diff.name.newValue}>
                        {diff.diff.name.newValue}
                      </td>
                      <td className="py-2.5 px-3 text-right font-sans">
                        {diff.diff.name.changed ? (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-warning/20 text-warning font-semibold">
                            {Math.round(diff.nameSimilarity * 100)}% сходство
                          </span>
                        ) : (
                          <span className="text-emerald-500 font-semibold">✓ Совпадает</span>
                        )}
                      </td>
                    </tr>

                    {/* Rate */}
                    <tr className="bg-muted/10">
                      <td className="py-2.5 px-3 font-sans font-medium text-foreground">Себестоимость</td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {formatPricePerUnit(diff.diff.rate.oldCostRub)} ₽
                      </td>
                      <td className="py-2.5 px-3 text-foreground font-bold">
                        {formatPricePerUnit(diff.diff.rate.newCostRub)} ₽
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {diff.diff.rate.deltaPercent !== 0 ? (
                          <span className={`text-[11px] font-bold ${diff.diff.rate.deltaPercent > 0 ? 'text-destructive' : 'text-emerald-500'}`}>
                            {diff.diff.rate.deltaPercent > 0 ? '▲ +' : '▼ '}
                            {(diff.diff.rate.deltaPercent * 100).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">без изменений</span>
                        )}
                      </td>
                    </tr>

                    {/* Min Qty */}
                    <tr className={diff.diff.minQty.changed ? 'bg-warning/5' : ''}>
                      <td className="py-2.5 px-3 font-sans font-medium text-foreground">Мин. заказ</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{diff.diff.minQty.oldValue} шт</td>
                      <td className="py-2.5 px-3 text-foreground font-bold">{diff.diff.minQty.newValue} шт</td>
                      <td className="py-2.5 px-3 text-right font-sans">
                        {diff.diff.minQty.changed ? (
                          <span className="text-warning font-semibold">Изменился</span>
                        ) : (
                          <span className="text-emerald-500">✓ Совпадает</span>
                        )}
                      </td>
                    </tr>

                    {/* Max Qty */}
                    <tr className={diff.diff.maxQty.changed ? 'bg-warning/5' : ''}>
                      <td className="py-2.5 px-3 font-sans font-medium text-foreground">Макс. заказ</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{diff.diff.maxQty.oldValue.toLocaleString('ru-RU')} шт</td>
                      <td className="py-2.5 px-3 text-foreground font-bold">{diff.diff.maxQty.newValue.toLocaleString('ru-RU')} шт</td>
                      <td className="py-2.5 px-3 text-right font-sans">
                        {diff.diff.maxQty.changed ? (
                          <span className="text-warning font-semibold">Изменился</span>
                        ) : (
                          <span className="text-emerald-500">✓ Совпадает</span>
                        )}
                      </td>
                    </tr>

                    {/* Refill Guarantee */}
                    <tr className={diff.diff.refill.changed ? (diff.diff.refill.worsened ? 'bg-destructive/5' : 'bg-warning/5') : ''}>
                      <td className="py-2.5 px-3 font-sans font-medium text-foreground">Гарантия (Refill)</td>
                      <td className="py-2.5 px-3 font-sans text-muted-foreground">
                        {diff.diff.refill.oldValue ? '♻️ Есть' : '— Нет'}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-foreground font-semibold">
                        {diff.diff.refill.newValue ? '♻️ Есть' : '— Нет'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-sans">
                        {diff.diff.refill.worsened ? (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-bold">
                            ⚠️ Снята гарантия!
                          </span>
                        ) : diff.diff.refill.changed ? (
                          <span className="text-emerald-500 font-semibold">Появилась</span>
                        ) : (
                          <span className="text-emerald-500">✓ Совпадает</span>
                        )}
                      </td>
                    </tr>

                    {/* Cancel */}
                    <tr className={diff.diff.cancel.changed ? 'bg-warning/5' : ''}>
                      <td className="py-2.5 px-3 font-sans font-medium text-foreground">Отмена (Cancel)</td>
                      <td className="py-2.5 px-3 font-sans text-muted-foreground">
                        {diff.diff.cancel.oldValue ? 'Да' : 'Нет'}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-foreground font-semibold">
                        {diff.diff.cancel.newValue ? 'Да' : 'Нет'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-sans">
                        {diff.diff.cancel.changed ? (
                          <span className="text-warning font-semibold">Изменилась</span>
                        ) : (
                          <span className="text-emerald-500">✓ Совпадает</span>
                        )}
                      </td>
                    </tr>

                    {/* Service Type */}
                    <tr className={diff.diff.type.changed ? 'bg-warning/5' : ''}>
                      <td className="py-2.5 px-3 font-sans font-medium text-foreground">Тип услуги</td>
                      <td className="py-2.5 px-3 font-sans text-muted-foreground">{diff.diff.type.oldValue || 'Default'}</td>
                      <td className="py-2.5 px-3 font-sans text-foreground font-semibold">{diff.diff.type.newValue || 'Default'}</td>
                      <td className="py-2.5 px-3 text-right font-sans">
                        {diff.diff.type.changed ? (
                          <span className="text-warning font-semibold">Изменился</span>
                        ) : (
                          <span className="text-emerald-500">✓ Совпадает</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={onClose}
            disabled={resolving}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-muted text-muted-foreground border border-border hover:bg-muted-foreground/10 transition-colors cursor-pointer"
          >
            ✕ Закрыть
          </button>

          {diff && !loading && (
            <div className="flex items-center gap-2 flex-wrap">
              {diff.verdict === 'SAFE_PRICE_ONLY' && (
                <>
                  <button
                    type="button"
                    onClick={() => handleResolve('PRICE_ONLY')}
                    disabled={resolving}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-primary-foreground hover:bg-emerald-700 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                  >
                    <span>✅ Принять новый тариф</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResolve('DEACTIVATE')}
                    disabled={resolving}
                    className="px-3 py-2 rounded-xl text-xs font-medium bg-destructive/15 text-destructive border border-destructive/25 hover:bg-destructive/25 transition-all cursor-pointer disabled:opacity-50"
                  >
                    🚫 Отключить услугу
                  </button>
                </>
              )}

              {diff.verdict === 'MUTATED_PARAMS' && (
                <>
                  <button
                    type="button"
                    onClick={() => handleResolve('SYNC_ALL')}
                    disabled={resolving}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                  >
                    <span>🔄 Синхронизировать всё и включить</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResolve('PRICE_ONLY')}
                    disabled={resolving}
                    className="px-3 py-2 rounded-xl text-xs font-medium bg-muted text-foreground border border-border hover:bg-muted/80 transition-all cursor-pointer disabled:opacity-50"
                    title="Обновить только цену, оставив услугу выключенной"
                  >
                    Только цена (без включения)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResolve('DEACTIVATE')}
                    disabled={resolving}
                    className="px-3 py-2 rounded-xl text-xs font-medium bg-destructive/15 text-destructive border border-destructive/25 hover:bg-destructive/25 transition-all cursor-pointer disabled:opacity-50"
                  >
                    🚫 Оставить отключенной
                  </button>
                </>
              )}

              {diff.verdict === 'SERVICE_REPLACED' && (
                <>
                  <button
                    type="button"
                    onClick={() => handleResolve('DEACTIVATE')}
                    disabled={resolving}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                  >
                    <span>🚫 Отключить (рекомендуется)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResolve('SYNC_ALL')}
                    disabled={resolving}
                    className="px-3 py-2 rounded-xl text-xs font-medium bg-warning/20 text-warning border border-warning/30 hover:bg-warning/30 transition-all cursor-pointer disabled:opacity-50"
                    title="Перезаписать все параметры из API нового поставщика"
                  >
                    ⚠️ Принудительно перезаписать
                  </button>
                </>
              )}

              {diff.verdict === 'NOT_FOUND_AT_PROVIDER' && (
                <button
                  type="button"
                  onClick={() => handleResolve('DEACTIVATE')}
                  disabled={resolving}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                >
                  <span>📦 Архивировать услугу</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
