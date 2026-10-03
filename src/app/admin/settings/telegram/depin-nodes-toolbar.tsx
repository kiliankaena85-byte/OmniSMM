'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Users,
  Radio,
  Search,
  Plus,
  RotateCcw,
  TrendingUp,
  BookmarkCheck,
} from 'lucide-react';

export type DePinSubView = 'analytics' | 'nodes' | 'targets' | 'info';

interface DePinNodesToolbarProps {
  currentView: DePinSubView;
  setCurrentView: (view: DePinSubView) => void;
  filteredNodesCount: number;
  targetsCount: number;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenCreateTarget: () => void;
  onRefresh: () => void;
  loading: boolean;
}

export function DePinNodesToolbar({
  currentView,
  setCurrentView,
  filteredNodesCount,
  targetsCount,
  searchQuery,
  setSearchQuery,
  onOpenCreateTarget,
  onRefresh,
  loading,
}: DePinNodesToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-2 p-1 bg-muted/30 rounded-xl border border-border/60">
        <button
          type="button"
          onClick={() => setCurrentView('analytics')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            currentView === 'analytics'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          <span>Аналитика и Воронка</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentView('nodes')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            currentView === 'nodes'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Реестр узлов ({filteredNodesCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentView('targets')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            currentView === 'targets'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Очередь заданий ({targetsCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentView('info')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            currentView === 'info'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <BookmarkCheck className="w-3.5 h-3.5" />
          <span>Леджер и Финансы</span>
        </button>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {currentView === 'nodes' && (
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по ID или Telegram..."
              className="h-8 pl-8 pr-3 text-xs rounded-xl"
            />
          </div>
        )}

        {currentView === 'targets' && (
          <Button
            type="button"
            size="sm"
            onClick={onOpenCreateTarget}
            className="h-8 text-xs font-bold gap-1.5 bg-primary cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Добавить задание</span>
          </Button>
        )}

        <Button
          type="button"
          intent="secondary"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="h-8 text-xs font-bold px-2.5 cursor-pointer"
          title="Обновить данные"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </div>
  );
}
