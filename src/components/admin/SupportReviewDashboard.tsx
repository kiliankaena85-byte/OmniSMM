'use client';
interface SupportReviewItem {
  id: string;
  createdAt: string | Date;
  staff: { email: string; name?: string | null };
  ipAddress?: string | null;
  target: { email: string; name?: string | null };
  amountRub: number | string;
  ticketId?: string | null;
  reasonNote?: string | null;
  reviewStatus: string;
}


import React, { useState, useEffect } from 'react';
import { ShieldAlert, Download, Filter } from 'lucide-react';
import { getSupportActionsReviewListAction, reviewSupportFinancialAction, exportSupportActionsCSVAction } from '@/actions/admin/support-review';

export function SupportReviewDashboard() {
    const [items, setItems] = useState<SupportReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [reviewNoteMap, setReviewNoteMap] = useState<Record<string, string>>({});

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getSupportActionsReviewListAction({ reviewStatus: statusFilter });
      if (res.success) {
        setItems(res.items);
      }
    } catch (err) {
      console.error('Failed loading review list', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleReview = async (actionId: string, reviewStatus: string) => {
    const note = reviewNoteMap[actionId] || '';
    try {
      const fd = new FormData();
      fd.append('actionId', actionId);
      fd.append('reviewStatus', reviewStatus);
      fd.append('reviewNote', note);

      const res = await reviewSupportFinancialAction(fd);
      if (res.success) {
        loadData();
      } else {
        alert(res.error);
      }
    } catch (err: unknown) {
      alert((err instanceof Error ? err.message : String(err)) || 'Ошибка обновления статуса');
    }
  };

  const handleExportCSV = async () => {
    try {
      const res = await exportSupportActionsCSVAction();
      if (res.success && res.csv) {
        const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `support-financial-review-${new Date().toISOString().substring(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: unknown) {
      alert((err instanceof Error ? err.message : String(err)) || 'Ошибка экспорта CSV');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-primary shrink-0" />
            Постпроверка финансовых операций поддержки
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Аудит ручных компенсаций, списаний и докрутов баланса клиентам сотрудниками саппорта
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-3 py-1.5 bg-secondary text-secondary-foreground hover:opacity-90 rounded-md text-xs font-medium flex items-center gap-2 transition-opacity"
        >
          <Download className="w-4 h-4" />
          Экспорт в CSV (Защита OWASP)
        </button>
      </div>

      <div className="p-4 bg-card border border-border rounded-xl flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">Статус проверки:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-background border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Фильтр статуса проверки"
          >
            <option value="ALL">Все операции</option>
            <option value="PENDING">Ожидают проверки (PENDING)</option>
            <option value="FLAGGED">Подозрительные (FLAGGED)</option>
            <option value="VIOLATION">Нарушения (VIOLATION)</option>
            <option value="APPROVED">Одобрены (APPROVED)</option>
          </select>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider">
            <tr>
              <th className="p-3">ДАТА (МСК)</th>
              <th className="p-3">СОТРУДНИК</th>
              <th className="p-3">КЛИЕНТ</th>
              <th className="p-3">СУММА (₽)</th>
              <th className="p-3">ТИКЕТ / ПРИЧИНА</th>
              <th className="p-3">СТАТУС ПРОВЕРКИ</th>
              <th className="p-3">ДЕЙСТВИЯ СУПЕРВИЗОРА</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  {loading ? 'Загрузка данных...' : 'Операции не найдены'}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-3 font-mono">
                    {new Date(item.createdAt).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-foreground">{item.staff.email}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">IP: {item.ipAddress || '—'}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-foreground">{item.target.email}</div>
                  </td>
                  <td className="p-3 font-bold text-primary">
                    +{item.amountRub} ₽
                  </td>
                  <td className="p-3 max-w-xs">
                    <div className="font-medium text-foreground">Тикет #{item.ticketId || '—'}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{item.reasonNote}</div>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      item.reviewStatus === 'VIOLATION' ? 'bg-red-500/20 text-red-500' :
                      item.reviewStatus === 'FLAGGED' ? 'bg-amber-500/20 text-amber-500' :
                      item.reviewStatus === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-muted text-muted-foreground'
                    }`}>
                      {item.reviewStatus}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Заметка..."
                        className="w-32 px-2 py-1 bg-background border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        value={reviewNoteMap[item.id] || ''}
                        onChange={(e) => setReviewNoteMap({ ...reviewNoteMap, [item.id]: e.target.value })}
                      />
                      <button
                        onClick={() => handleReview(item.id, 'APPROVED')}
                        className="px-2.5 py-1 bg-success hover:bg-success/90 text-success-foreground rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        Одобрить
                      </button>
                      <button
                        onClick={() => handleReview(item.id, 'VIOLATION')}
                        className="px-2.5 py-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        Нарушение
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
