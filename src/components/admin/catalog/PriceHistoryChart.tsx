'use client';

import React from 'react';

type PriceHistoryPoint = {
  date: string;
  rate: number;
};

interface PriceHistoryChartProps {
  data: PriceHistoryPoint[];
}

export function PriceHistoryChart({ data }: PriceHistoryChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-default-100 rounded-lg text-default-500">
        Нет данных для отображения графика
      </div>
    );
  }

  // Handle single data point
  if (data.length === 1) {
    return (
      <div className="flex items-center justify-center h-48 bg-default-100 rounded-lg">
        <div className="text-center">
          <p className="text-sm text-default-500">Единственная запись:</p>
          <p className="text-2xl font-bold text-primary">${data[0].rate.toFixed(4)}</p>
          <p className="text-xs text-default-400 mt-1">
            {new Date(data[0].date).toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      </div>
    );
  }

  // Calculate min and max for scaling
  const rates = data.map((d) => d.rate);
  const maxRate = Math.max(...rates);
  // Optional: Make minRate 0 to show absolute scale, or min - 10% to show variance better
  const minRate = Math.min(...rates) * 0.9;
  const range = maxRate - minRate || 1; // Prevent division by zero

  return (
    <div className="w-full flex flex-col pt-6 pb-2 h-64 border border-default-200 rounded-xl p-4 bg-background">
      <div className="flex-1 flex items-end justify-between gap-1 relative">
        {data.map((point, idx) => {
          // Calculate height percentage (min 5% to show at least a small bar)
          let heightPercent = ((point.rate - minRate) / range) * 100;
          heightPercent = Math.max(5, Math.min(100, heightPercent));

          const dateObj = new Date(point.date);
          const formattedDate = dateObj.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
          });

          // Show only a few dates on the X axis to avoid clutter
          const showLabel =
            idx === 0 ||
            idx === data.length - 1 ||
            (data.length > 10 && idx % Math.ceil(data.length / 5) === 0);

          return (
            <div key={idx} className="relative group flex flex-col items-center flex-1 h-full justify-end">
              {/* Tooltip */}
              <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 bg-default-900 text-default-50 text-xs py-1 px-2 rounded whitespace-nowrap z-10 transition-opacity pointer-events-none">
                <div className="font-bold">${point.rate.toFixed(4)}</div>
                <div className="text-default-400">
                  {dateObj.toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>

              {/* Bar */}
              <div
                className="w-full max-w-[20px] bg-primary/60 group-hover:bg-primary transition-all duration-300 rounded-t-sm"
                style={{ height: `${heightPercent}%` }}
              />

              {/* X Axis Label */}
              <div className="absolute top-full mt-2 text-[10px] text-default-400 whitespace-nowrap overflow-hidden text-ellipsis">
                {showLabel ? formattedDate : ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
