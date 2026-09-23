'use client';

import * as React from 'react';
import { CreditCard, CheckCircle2, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface GatewayStatus {
  name: string;
  code: string;
  latencyAvg: string;
  p99: string;
  status: 'normal' | 'lag' | 'down';
  successRate: number;
}

const GATEWAYS: GatewayStatus[] = [
  { name: 'ЮKassa (СБП)', code: 'yookassa_sbp', latencyAvg: '2.4 сек', p99: '18 сек', status: 'normal', successRate: 99.4 },
  { name: 'ЮKassa (Банковские карты)', code: 'yookassa_cards', latencyAvg: '4.2 сек', p99: '45 сек', status: 'normal', successRate: 98.8 },
  { name: 'Robokassa (СБП)', code: 'robokassa', latencyAvg: '18.5 сек', p99: '3.2 мин', status: 'normal', successRate: 97.5 },
  { name: 'CryptoBot (USDT)', code: 'cryptobot', latencyAvg: '12 сек', p99: '1.8 мин', status: 'normal', successRate: 99.9 },
];

export function WebhookLatencyWidget() {
  return (
    <div className="bg-card text-card-foreground border border-border/70 rounded-lg p-5 flex flex-col justify-between space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">Скорость платежных шлюзов</h4>
            <p className="text-[10px] text-muted-foreground">Телеметрия задержек вебхуков (Latency Radar)</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Все шлюзы в норме
        </span>
      </div>

      {/* Gateways List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {GATEWAYS.map((gw) => (
          <div
            key={gw.code}
            className="p-2.5 rounded-md border border-border/50 bg-muted/20 flex items-center justify-between"
          >
            <div className="space-y-0.5 min-w-0">
              <div className="font-semibold text-foreground truncate text-[11px]">{gw.name}</div>
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <span>Лаг:</span>
                <strong className="font-mono text-foreground">{gw.latencyAvg}</strong>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {gw.successRate}%
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">Авто-опрос API при задержках:</span>
        <span className="font-semibold text-foreground">Активен (Active Polling)</span>
      </div>
    </div>
  );
}
