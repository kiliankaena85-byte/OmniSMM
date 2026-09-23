'use client';

import React from 'react';
import { Package, Sparkles, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SummaryDashboardProps {
  totalInCache: number;
  newServices: number;
  aiReady: number;
  needsAttention: number;
  alreadyImported: number;
  selectedCount: number;
  markup: string;
  onMarkupChange: (val: string) => void;
  onImport: () => void;
  onResync: () => void;
  importDisabled: boolean;
  syncing: boolean;
  importProgress: { current: number; total: number } | null;
  providerName: string;
  /* PATCH P0-2: tab switching props */
  activeTab?: 'ready' | 'attention';
  onTabChange?: (tab: 'ready' | 'attention') => void;
}

/** PATCH P1-7: unified markup label */
function formatMarkupHint(markupStr: string): string {
  const p = parseFloat(markupStr);
  if (isNaN(p) || p < 0) return '×3.0';
  if (p === 0) return 'авто';
  const m = Math.round((1 + p / 100) * 100) / 100;
  return '×' + m.toFixed(2).replace(/.?0+$/, '');
}

export function SummaryDashboard({
  totalInCache,
  newServices,
  aiReady,
  needsAttention,
  alreadyImported,
  selectedCount,
  markup,
  onMarkupChange,
  onImport,
  onResync,
  importDisabled,
  syncing,
  importProgress,
  providerName,
  activeTab = 'ready',
  onTabChange,
}: SummaryDashboardProps) {
  const stats = [
    {
      label: 'Всего в каталоге',
      value: totalInCache,
      icon: <Package className="w-4 h-4" />,
      color: 'text-foreground',
      bg: 'bg-muted/50',
    },
    {
      label: 'Новых услуг',
      value: newServices,
      icon: <Sparkles className="w-4 h-4" />,
      color: 'text-primary',
      bg: 'bg-primary/5',
    },
  ];

  return (
    <div className="relative overflow-hidden bg-card/60 backdrop-blur-md border border-border/50 rounded-[24px] p-6 shadow-sm space-y-6 ring-1 ring-border/5">
      <div className="absolute inset-0 z-0 opacity-70 premium-dot-grid pointer-events-none" />
      {/* Provider Name + Resync */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <Package className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">{providerName}</h3>
            <p className="text-[11px] text-muted-foreground">
              {alreadyImported > 0 && `${alreadyImported} услуг уже импортировано`}
            </p>
          </div>
        </div>
        <Button
          intent="outline"
          size="sm"
          onClick={onResync}
          disabled={syncing}
          className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Синхронизация...' : 'Обновить каталог'}
        </Button>
      </div>

      {/* PATCH P0-2: Stats Grid with clickable tab cards */}
      <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`${stat.bg} rounded-[10px] px-4 py-3 border border-border/50 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200`}
          >
            <div className={`flex items-center gap-1.5 ${stat.color} mb-1`}>
              {stat.icon}
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{stat.label}</span>
            </div>
            <span className={`text-2xl font-bold tabular-nums ${stat.color}`}>{stat.value}</span>
          </div>
        ))}
        {/* PATCH P0-2: clickable ready card */}
        <div
          onClick={() => onTabChange?.('ready')}
          title={onTabChange ? 'Показать готовые к импорту' : undefined}
          className={`rounded-[10px] px-4 py-3 border hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200 cursor-pointer ${
            activeTab === 'ready'
              ? 'bg-success/10 ring-1 ring-success/30'
              : 'bg-success/5 hover:bg-success/10'
          }`}
        >
          <div className={`flex items-center gap-1.5 ${activeTab === 'ready' ? 'text-success' : 'text-success/70'} mb-1`}>
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">AI распределил</span>
          </div>
          <span className={`text-2xl font-bold tabular-nums ${activeTab === 'ready' ? 'text-success' : 'text-success/70'}`}>{aiReady}</span>
        </div>
        {/* PATCH P0-2: clickable attention card */}
        <div
          onClick={() => onTabChange?.('attention')}
          title={onTabChange ? 'Показать требующих внимания' : undefined}
          className={`rounded-[10px] px-4 py-3 border hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200 cursor-pointer ${
            activeTab === 'attention'
              ? 'bg-warning/10 ring-1 ring-warning/30'
              : 'bg-warning/5 hover:bg-warning/10'
          }`}
        >
          <div className={`flex items-center gap-1.5 ${activeTab === 'attention' ? 'text-warning' : 'text-warning/70'} mb-1`}>
            <AlertTriangle className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">Требуют внимания</span>
          </div>
          <span className={`text-2xl font-bold tabular-nums ${activeTab === 'attention' ? 'text-warning' : 'text-warning/70'}`}>{needsAttention}</span>
        </div>
      </div>

      {/* Action Bar */}
      <div className="relative z-10 flex flex-wrap items-end gap-4 pt-2 border-t border-border/50">
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-0.5">
            Наценка (%)
          </label>
          <Input
            type="number"
            step="1"
            min="0"
            max="900"
            value={markup}
            onChange={(e) => onMarkupChange(e.target.value)}
            className="w-28 h-10 text-sm tabular-nums"
          />
          {/* PATCH P1-7: unified display */}
          <p className="text-[10px] text-muted-foreground">
            {formatMarkupHint(markup)} · 0 = авто
          </p>
        </div>

        <Button
          intent="primary"
          onClick={onImport}
          disabled={importDisabled}
          className="h-10 px-6 font-semibold text-sm cursor-pointer"
        >
          {importProgress !== null ? (
            <>
              <span className="animate-spin text-sm">⏳</span>
              Импорт: {importProgress.current} / {importProgress.total}
            </>
          ) : (
            <>📥 Импортировать выбранные ({selectedCount})</>
          )}
        </Button>
      </div>
    </div>
  );
}
