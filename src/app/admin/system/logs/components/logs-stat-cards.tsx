'use client';

import { LogCategory, LogStatsDTO } from '@/types/system-logs.dto';
import { ShieldAlert, LogIn, History, Bot } from 'lucide-react';

interface LogsStatCardsProps {
  stats: LogStatsDTO;
  activeCategory: LogCategory;
  onSelectCategory: (category: LogCategory) => void;
}

export function LogsStatCards({ stats, activeCategory, onSelectCategory }: LogsStatCardsProps) {
  const STATS_CONFIG = [
    { id: 'security' as const, label: 'Безопасность', count: stats.securityCount, icon: ShieldAlert, color: 'text-rose-500' },
    { id: 'logins' as const, label: 'Сбои входа', count: stats.failedLoginsCount, icon: LogIn, color: 'text-amber-500' },
    { id: 'audit' as const, label: 'Аудит действий', count: stats.auditCount, icon: History, color: 'text-blue-500' },
    { id: 'telegram' as const, label: 'Ошибки Telegram', count: stats.telegramErrorsCount, icon: Bot, color: 'text-violet-500' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {STATS_CONFIG.map((stat) => {
        const Icon = stat.icon;
        const isActive = activeCategory === stat.id;
        return (
          <button
            key={stat.id}
            onClick={() => onSelectCategory(stat.id)}
            className={`p-3.5 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
              isActive
                ? 'border-primary/50 bg-primary/5 shadow-sm'
                : 'border-border bg-card/60 hover:bg-card hover:border-border/80'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
              <Icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <div className="text-xl font-bold text-foreground mt-1.5 font-mono">
              {stat.count}
            </div>
          </button>
        );
      })}
    </div>
  );
}
