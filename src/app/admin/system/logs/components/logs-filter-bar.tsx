'use client';

import { LogCategory } from '@/types/system-logs.dto';
import { Search, RotateCw } from 'lucide-react';

interface LogsFilterBarProps {
  category: LogCategory;
  search: string;
  severity: string;
  isPending: boolean;
  onCategoryChange: (cat: LogCategory) => void;
  onSearchChange: (val: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  onSeverityChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onRefresh: () => void;
}

export function LogsFilterBar({
  category,
  search,
  severity,
  isPending,
  onCategoryChange,
  onSearchChange,
  onSearchSubmit,
  onSeverityChange,
  onRefresh,
}: LogsFilterBarProps) {
  const CATEGORIES = [
    { id: 'security' as const, label: 'Безопасность' },
    { id: 'logins' as const, label: 'Авторизации' },
    { id: 'audit' as const, label: 'Аудит персонала' },
    { id: 'telegram' as const, label: 'Telegram ошибки' },
  ];

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between p-3 rounded-xl border border-border bg-card">
      {/* Category Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/60 border border-border/40 overflow-x-auto">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150 whitespace-nowrap ${
              category === cat.id
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Search, Filter, Refresh */}
      <div className="flex items-center gap-2">
        <form onSubmit={onSearchSubmit} className="relative flex-1 sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Поиск по IP, email, тексту..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-hidden focus:ring-1 focus:ring-primary"
          />
        </form>

        <select
          value={severity}
          onChange={onSeverityChange}
          aria-label="Фильтр по уровню важности"
          className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-hidden"
        >
          <option value="ALL">Все статусы</option>
          {category === 'security' && (
            <>
              <option value="CRITICAL">Только CRITICAL</option>
              <option value="WARNING">Только WARNING</option>
            </>
          )}
          {category === 'logins' && (
            <>
              <option value="FAILED">Только сбои</option>
              <option value="SUCCESS">Только успешные</option>
            </>
          )}
          {category === 'telegram' && (
            <>
              <option value="FATAL">Только FATAL</option>
              <option value="ERROR">Только ERROR</option>
              <option value="WARN">Только WARN</option>
            </>
          )}
        </select>

        <button
          onClick={onRefresh}
          disabled={isPending}
          className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-all duration-150 disabled:opacity-50"
          title="Обновить журнал"
        >
          <RotateCw className={`w-4 h-4 ${isPending ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
        </button>
      </div>
    </div>
  );
}
