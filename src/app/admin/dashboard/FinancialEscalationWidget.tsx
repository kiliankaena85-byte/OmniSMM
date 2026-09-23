'use client';

import * as React from 'react';
import { ShieldCheck, AlertTriangle, ArrowRight, RotateCcw, MessageSquare } from 'lucide-react';
import Link from 'next/link';

interface FinancialEscalationWidgetProps {
  errorOrdersCount: number;
  openTicketsCount: number;
  pendingBalanceRequestsCount?: number;
}

export function FinancialEscalationWidget({
  errorOrdersCount,
  openTicketsCount,
  pendingBalanceRequestsCount = 0,
}: FinancialEscalationWidgetProps) {
  return (
    <div className="bg-card text-card-foreground border border-border/70 rounded-lg p-5 flex flex-col justify-between space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">Оперативный диспетчер</h4>
            <p className="text-[10px] text-muted-foreground">Очередь алертов и финансовых сверок чеков</p>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/50">
          SLA 15 мин
        </span>
      </div>

      {/* Action Items List */}
      <div className="space-y-2 text-xs">
        {/* Error Orders */}
        <div className="p-2.5 rounded-md border border-border/50 bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${errorOrdersCount > 0 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
            <div>
              <div className="font-semibold text-foreground text-[11px]">Заказы со сбоями провайдера</div>
              <div className="text-[10px] text-muted-foreground">Требуют перезапуска или смены маршрута</div>
            </div>
          </div>
          <Link
            href="/admin/orders?status=ERROR"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1 rounded-md border border-rose-500/20 transition-colors"
          >
            <span>{errorOrdersCount} сбоев</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Tickets Queue */}
        <div className="p-2.5 rounded-md border border-border/50 bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${openTicketsCount > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            <div>
              <div className="font-semibold text-foreground text-[11px]">Тикеты поддержки в очереди</div>
              <div className="text-[10px] text-muted-foreground">Ожидают ответа оператора первой линии</div>
            </div>
          </div>
          <Link
            href="/admin/tickets"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-md border border-amber-500/20 transition-colors"
          >
            <span>{openTicketsCount} тикетов</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">Сверка чеков (2-й контур):</span>
        <Link
          href="/admin/finance/balance-requests"
          className="font-semibold text-primary hover:underline flex items-center gap-1"
        >
          <span>Журнал сверок ({pendingBalanceRequestsCount})</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
