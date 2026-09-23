'use client';

import React from 'react';
import { Layers, RefreshCw, Search, X } from 'lucide-react';
import { PreviewService } from '../types';

interface ProviderCatalogPreviewModalProps {
  isOpen: boolean;
  loading: boolean;
  services: PreviewService[];
  total: number;
  search: string;
  currency: string;
  onSearchChange: (search: string) => void;
  onClose: () => void;
}

export function ProviderCatalogPreviewModal({
  isOpen,
  loading,
  services,
  total,
  search,
  currency,
  onSearchChange,
  onClose,
}: ProviderCatalogPreviewModalProps) {
  if (!isOpen) return null;

  const filtered = services.filter(s =>
    !search ||
    (s.name && String(s.name).toLowerCase().includes(search.toLowerCase())) ||
    (s.service !== undefined && String(s.service).includes(search)) ||
    (s.category && String(s.category).toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[85vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <div>
              <h3 className="text-base font-extrabold text-foreground">
                Каталог провайдера ({total} услуг)
              </h3>
              <p className="text-xs text-muted-foreground">
                Первые 50 услуг из реального API для сверки цен и категорий
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Закрыть предпросмотр"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-border bg-background/50">
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск по названию или ID услуги..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary" />
              <p className="text-sm">Загрузка каталога из API провайдера...</p>
            </div>
          ) : services.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <p className="text-sm">Услуги не найдены или каталог пуст.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-2 font-bold w-16">ID</th>
                    <th className="pb-2 font-bold">Название услуги</th>
                    <th className="pb-2 font-bold">Категория</th>
                    <th className="pb-2 font-bold text-right">Тариф (за 1k)</th>
                    <th className="pb-2 font-bold text-right">Лимиты (Min / Max)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filtered.map((s, idx) => (
                    <tr key={idx} className="hover:bg-muted/40 transition-colors">
                      <td className="py-2.5 font-mono text-muted-foreground">{s.service}</td>
                      <td className="py-2.5 font-medium text-foreground max-w-xs truncate">{s.name}</td>
                      <td className="py-2.5 text-muted-foreground max-w-[150px] truncate">{s.category}</td>
                      <td className="py-2.5 text-right font-mono font-bold text-primary">
                        {s.rate} <span className="text-[10px] text-muted-foreground">{currency}</span>
                      </td>
                      <td className="py-2.5 text-right font-mono text-muted-foreground">
                        {s.min} – {s.max}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-border bg-muted/20 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть предпросмотр"
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
