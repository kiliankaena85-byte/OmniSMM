import React from 'react';
import { Card } from '@/components/ui/card';
import { Globe, CheckCircle, AlertTriangle, Link2, Radio, Zap } from 'lucide-react';
import type { ProxyHealthSummary } from '@/types/provider-proxy';

interface ProxyHealthSummaryCardProps {
  health: ProxyHealthSummary;
}

export function ProxyHealthSummaryCard({ health }: ProxyHealthSummaryCardProps) {
  const metrics = [
    { label: 'Всего прокси', value: health.total, icon: Globe, color: 'text-primary' },
    { label: 'Активных', value: health.active, icon: CheckCircle, color: 'text-emerald-500' },
    { label: 'С ошибками', value: health.withErrors, icon: AlertTriangle, color: 'text-rose-500' },
    { label: 'Провайдеров через прокси', value: health.providersUsingProxy, icon: Link2, color: 'text-primary' },
    { label: 'Прямое подкл.', value: health.providersDirect, icon: Radio, color: 'text-muted-foreground' },
    { label: 'Avg Latency', value: health.avgLatencyMs ? `${Math.round(health.avgLatencyMs)}ms` : '—', icon: Zap, color: 'text-amber-500' },
  ];

  return (
    <Card className="rounded-3xl border border-border/80 shadow-sm bg-card p-6">
      <div className="flex items-center gap-2.5 pb-4 border-b border-border/60">
        <span className="p-1 px-2.5 bg-primary/10 text-primary rounded-md text-[10px] font-bold">OVERVIEW</span>
        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Сводка по прокси и подпискам</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4">
        {metrics.map((m) => (
          <div key={m.label} className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1">
            <m.icon className={`w-3.5 h-3.5 ${m.color}`} />
            <p className="text-lg font-extrabold font-mono text-foreground">{m.value}</p>
            <p className="text-[10px] text-muted-foreground font-bold uppercase">{m.label}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
