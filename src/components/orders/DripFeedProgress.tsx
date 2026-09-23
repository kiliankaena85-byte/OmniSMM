'use client';

import React from 'react';
import { Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DripFeedProgressProps {
  isDripFeed?: boolean;
  runs?: number | null;
  interval?: number | null;
  currentRun?: number;
  nextRunAt?: Date | string | null;
  className?: string;
  showNextRunCountdown?: boolean;
}

export function DripFeedProgress({
  isDripFeed,
  runs,
  interval,
  currentRun = 0,
  nextRunAt,
  className,
  showNextRunCountdown = false,
}: DripFeedProgressProps) {
  if (!isDripFeed && (!runs || runs <= 1)) {
    return null;
  }

  const totalRuns = runs || 1;
  const current = Math.min(Math.max(0, currentRun), totalRuns);

  let scheduleInfo = '';
  if (nextRunAt) {
    const nextDate = new Date(nextRunAt);
    const diffMs = nextDate.getTime() - Date.now();
    const diffMins = Math.max(0, Math.ceil(diffMs / 60000));
    scheduleInfo = diffMins > 0 ? `(следующий через ${diffMins} мин)` : '(запуск...)';
  } else if (interval) {
    scheduleInfo = `(каждые ${interval} мин)`;
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <div
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 rounded-lg whitespace-nowrap',
          className
        )}
        title="Информация о выполнении Drip-Feed"
      >
        <Repeat className="w-3 h-3 shrink-0 text-primary" />
        <span>
          🌊 Drip-Feed: {current} / {totalRuns} запусков {scheduleInfo}
        </span>
      </div>
      {showNextRunCountdown && nextRunAt && (
        <div className="text-[10px] font-medium text-muted-foreground">
          Следующий запуск:{' '}
          {new Date(nextRunAt).toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      )}
    </div>
  );
}

