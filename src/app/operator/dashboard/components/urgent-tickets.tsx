'use client';

import * as React from 'react';
import Link from 'next/link';
import { MessageSquare, ArrowRight, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TicketItem {
  id: string;
  subject: string;
  updatedAt: Date;
  user: { email: string };
}

interface UrgentTicketsProps {
  tickets: TicketItem[];
}

function getWaitingTimeStr(updatedAt: Date): string {
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  const diffMins = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMins < 60) {
    return `${diffMins} мин`;
  }
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return `${hours} ч ${mins} мин`;
}

export function UrgentTickets({ tickets }: UrgentTicketsProps) {
  return (
    <div className="bg-card border border-border/50 shadow-sm rounded-2xl p-6 ring-1 ring-border/5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
          Срочные обращения (SLA)
        </h3>
        <Link
          href="/operator/tickets"
          className="text-xs font-bold text-primary hover:text-primary/80 inline-flex items-center gap-1 hover:underline"
        >
          Все тикеты <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {tickets.length > 0 ? (
        <div className="divide-y divide-border/30">
          {tickets.map((ticket) => {
            const isCritical = Date.now() - new Date(ticket.updatedAt).getTime() > 15 * 60 * 1000;
            return (
              <div key={ticket.id} className="py-3 flex items-center justify-between text-xs first:pt-0 last:pb-0">
                <div className="space-y-1 truncate pr-4">
                  <Link
                    href={`/operator/tickets?ticketId=${ticket.id}`}
                    className="font-bold text-foreground hover:underline block truncate"
                  >
                    {ticket.subject}
                  </Link>
                  <span className="text-[10px] text-muted-foreground block truncate">
                    {ticket.user.email}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge
                    intent="outline"
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 ${
                      isCritical
                        ? 'bg-destructive/15 text-destructive border-transparent'
                        : 'bg-warning/15 text-warning-foreground border-transparent'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    {getWaitingTimeStr(ticket.updatedAt)}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6">
          <p className="text-muted-foreground text-xs leading-relaxed">
            Активных обращений, ожидающих ответа, нет.
          </p>
        </div>
      )}
    </div>
  );
}
