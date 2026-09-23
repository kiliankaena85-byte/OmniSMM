import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Edit3, ChevronDown, ChevronUp, RefreshCw, Zap } from 'lucide-react';
import type { ProviderProxyWithUsage } from '@/types/provider-proxy';
import type { Provider } from '@prisma/client';
import { formatTraffic, getDaysLeft } from './types';

interface ProxyCardItemProps {
  proxy: ProviderProxyWithUsage;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onStartEdit: (p: ProviderProxyWithUsage) => void;
  onDeleteRequest: (p: { id: string; label: string }) => void;
  onTest: (id: string) => void;
  onSyncSubscription: (id: string) => void;
  onAssignProvider: (providerId: string, proxyId: string | null) => void;
  testingId: string | null;
  syncingId: string | null;
  providers: Provider[];
}

export function ProxyCardItem({
  proxy,
  isExpanded,
  onToggleExpand,
  onStartEdit,
  onDeleteRequest,
  onTest,
  onSyncSubscription,
  onAssignProvider,
  testingId,
  syncingId,
  providers,
}: ProxyCardItemProps) {
  const p = proxy;
  const daysLeft = getDaysLeft(p.expiresAt);

  return (
    <Card className={`rounded-2xl border overflow-hidden transition-colors bg-card ${
      !p.isActive ? 'opacity-50' : p.consecutiveFailures > 3 ? 'border-rose-500/40' : 'border-border/80'
    }`}>
      <div className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0 ${
            p.category === 'PAID_PREMIUM' ? 'bg-primary' : p.category === 'FREE_PUBLIC' ? 'bg-emerald-600' : 'bg-muted-foreground'
          }`}>
            {p.category === 'PAID_PREMIUM' ? '💎' : p.category === 'FREE_PUBLIC' ? '🌿' : '🛡️'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs font-bold text-foreground">{p.label}</h4>
              <span className="text-[9px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/40">
                {p.protocol.toUpperCase()}
              </span>
              {daysLeft !== null && (
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                  daysLeft > 14 ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' : daysLeft > 2 ? 'bg-amber-500/15 text-amber-500 border-amber-500/30' : 'bg-rose-500/15 text-rose-500 border-rose-500/30'
                }`}>
                  {daysLeft > 0 ? `Осталось ${daysLeft} дн.` : 'Истекла'}
                </span>
              )}
              {p.geoCountry && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/40">
                  {p.geoCountry}
                </span>
              )}
              {p._count?.providers ? (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {p._count.providers} пров.
                </span>
              ) : null}
            </div>
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{p.host}:{p.port}</p>

            {p.trafficTotalBytes && p.trafficTotalBytes > BigInt(0) && (
              <div className="flex items-center gap-2 mt-1.5 max-w-xs">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{
                    width: `${Math.min(100, Math.round((Number(p.trafficUsedBytes || BigInt(0)) / Number(p.trafficTotalBytes)) * 100))}%`
                  }} />
                </div>
                <span className="text-[9px] font-mono text-muted-foreground">
                  {formatTraffic(p.trafficUsedBytes)} / {formatTraffic(p.trafficTotalBytes)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {p.lastTestAt && (
            <div className="text-right hidden sm:block">
              <span className={`text-[10px] font-mono font-bold ${p.lastTestSuccess ? 'text-emerald-500' : 'text-rose-500'}`}>
                {p.lastTestSuccess ? `${p.lastTestLatencyMs}ms` : 'FAIL'}
              </span>
              <p className="text-[9px] text-muted-foreground">{new Date(p.lastTestAt).toLocaleString('ru-RU')}</p>
            </div>
          )}
          {p.subscriptionUrl && (
            <button
              type="button"
              onClick={() => onSyncSubscription(p.id)}
              disabled={syncingId === p.id}
              className="p-1.5 rounded-lg hover:bg-muted cursor-pointer transition-colors"
              title="Синхронизировать подписку"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-primary ${syncingId === p.id ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button
            type="button"
            onClick={onToggleExpand}
            className="p-1.5 rounded-lg hover:bg-muted cursor-pointer transition-colors"
            title="Привязки провайдеров"
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>
          <button
            type="button"
            onClick={() => onTest(p.id)}
            disabled={testingId === p.id}
            className="p-1.5 rounded-lg hover:bg-muted cursor-pointer transition-colors"
            title="Тест подключения"
          >
            <Zap className={`w-3.5 h-3.5 text-amber-500 ${testingId === p.id ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => onStartEdit(p)}
            className="p-1.5 rounded-lg hover:bg-muted cursor-pointer transition-colors"
            title="Редактировать"
          >
            <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={() => onDeleteRequest({ id: p.id, label: p.label })}
            className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 cursor-pointer transition-colors"
            title="Удалить"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-border/40 p-4 bg-muted/10 space-y-3">
          <h5 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Привязка провайдеров услуг:</h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {providers.map((prov) => {
              const isAssigned = prov.proxyId === p.id;
              return (
                <div key={prov.id} className="flex items-center justify-between p-2 rounded-xl bg-card border border-border/60 text-xs">
                  <span className="font-semibold truncate mr-2">{prov.name}</span>
                  <Button
                    type="button"
                    variant={isAssigned ? 'destructive' : 'outline'}
                    size="sm"
                    onClick={() => onAssignProvider(prov.id, isAssigned ? null : p.id)}
                    className="h-7 text-[10px] font-bold"
                  >
                    {isAssigned ? 'Отвязать' : 'Привязать'}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
