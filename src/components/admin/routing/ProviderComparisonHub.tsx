'use client';
// audit-disable STR-002

import React from 'react';
import { Card, Button, Chip } from '@heroui/react';
import type { RoutingComparisonItem, RoutingServiceRoute } from './RoutingPanelClient';

interface ComparisonHubProps {
  comparisonData: RoutingComparisonItem[];
  service: Record<string, unknown>;
  onSwap: (route: RoutingServiceRoute) => void;
  routes: RoutingServiceRoute[];
}

export function ProviderComparisonHub({ comparisonData, onSwap, routes }: ComparisonHubProps) {
  const formatDuration = (sec: number) => {
    if (!sec || sec === 0) return '—';
    if (sec < 60) return `${sec} сек`;
    const mins = Math.floor(sec / 60);
    if (mins < 60) return `${mins} мин ${sec % 60} сек`;
    const hrs = Math.floor(mins / 60);
    return `${hrs} ч ${mins % 60} мин`;
  };

  const getSlaIndicator = (sla: number) => {
    if (sla > 95) return { icon: '🟢', text: 'Высокий SLA', className: 'text-success' };
    if (sla >= 80) return { icon: '🟡', text: 'Средний SLA', className: 'text-warning' };
    return { icon: '🔴', text: 'Низкий SLA', className: 'text-danger' };
  };

  if (!comparisonData || comparisonData.length === 0) {
    return (
      <div className="p-6 rounded-[var(--radius)] flex flex-col items-center justify-center border border-border bg-card text-center">
        <p className="text-muted-foreground font-medium">Сравнительные данные провайдеров отсутствуют.</p>
        <p className="text-xs text-muted-foreground mt-1">Добавьте хотя бы один маршрут для сравнения.</p>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-[var(--radius)] space-y-4 bg-background">
      <div className="flex justify-between items-center px-1">
        <div>
          <h3 className="text-base font-bold text-foreground uppercase tracking-wider">Матрица сравнения провайдеров</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Сравнение цен за единицу услуги, SLA за последние 7 дней и лимитов</p>
        </div>
        <Chip size="sm" variant="soft" className="font-semibold text-xs border border-border bg-card text-muted-foreground">
          {comparisonData.length} МАРШРУТА
        </Chip>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {comparisonData.map((item) => {
          const slaInfo = getSlaIndicator(item.sla || 0);
          const targetRoute = routes.find((r) => r.id === item.routeId);

          return (
            <Card
              key={item.routeId}
              className={`relative flex flex-col justify-between p-5 bg-card transition-all duration-200 select-none overflow-visible rounded-[var(--radius)] border ${
                item.isPrimary ? 'border-primary border-2 shadow-[0_4px_16px_rgba(51,144,236,0.15)]' : 'border-border'
              }`}
            >
              {item.isPrimary && (
                <div className="absolute -top-2.5 right-4 px-2 py-0.5 rounded text-[10px] font-bold text-primary-foreground uppercase tracking-wider bg-primary">
                  АКТИВНЫЙ (PRIMARY)
                </div>
              )}

              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-foreground text-sm tracking-tight">{item.providerName}</h4>
                    <span className="text-[11px] text-muted-foreground font-mono">ID: {item.providerServiceId || '—'}</span>
                  </div>
                  <Chip
                    size="sm"
                    variant="soft"
                    className={`text-[10px] uppercase font-bold border border-border ${
                      item.isActive ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {item.isActive ? 'Активен' : 'Отключен'}
                  </Chip>
                </div>

                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg border border-border/60 bg-muted/30">
                  <div>
                    <span className="text-[10px] text-muted-foreground block uppercase font-medium">Закупка</span>
                    <span className="text-xs font-bold text-foreground">
                      {item.procurementCostPerUnitRub ? `${item.procurementCostPerUnitRub.toFixed(4)} ₽` : '—'}
                    </span>
                    {item.procurementCostPerUnitUsd && (
                      <span className="text-[10px] text-muted-foreground block font-mono">
                        (${item.procurementCostPerUnitUsd.toFixed(4)})
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block uppercase font-medium">Маржа</span>
                    <span className={`text-xs font-bold ${(item.marginPerUnitRub || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                      {item.marginPerUnitRub ? `${item.marginPerUnitRub.toFixed(4)} ₽` : '—'}
                    </span>
                    {item.markupPercent && (
                      <span className="text-[10px] text-muted-foreground block">
                        (+{item.markupPercent.toFixed(0)}%)
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2 pt-1 border-t border-border/40 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Надежность (SLA):</span>
                    <span className={`font-bold ${slaInfo.className}`}>
                      {slaInfo.icon} {item.sla || 0}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Среднее время:</span>
                    <span className="font-mono text-foreground">{formatDuration(item.avgEtaSeconds || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Лимиты (Min / Max):</span>
                    <span className="font-mono text-foreground">
                      {item.providerMinQty ?? '—'} / {item.providerMaxQty ?? '—'}
                    </span>
                  </div>
                  {item.limitsMismatch && (
                    <div className="p-1.5 rounded bg-warning/10 border border-warning/20 text-[10px] text-warning-text flex items-center gap-1">
                      ⚠️ Лимиты отличаются от глобальных
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-border/50">
                {item.isPrimary ? (
                  <Button size="sm" variant="outline" isDisabled className="w-full text-xs font-semibold">
                    Текущий активный маршрут
                  </Button>
                ) : (
                  <Button size="sm" variant="primary" className="w-full text-xs font-bold transition-all duration-200" isDisabled={!item.isActive || !targetRoute} onClick={() => targetRoute && onSwap(targetRoute)}>
                    Переключить на этот маршрут
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
