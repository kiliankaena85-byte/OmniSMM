'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SidebarTicket {
  id: string;
  subject: string;
  status: string;
  source: string;
  updatedAt: Date;
  user: { email: string };
  messages: { text: string; createdAt: Date; sender: string }[];
}

interface TicketsSidebarProps {
  tickets: SidebarTicket[];
  currentPage: number;
  totalPages: number;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-success/15 text-success border-transparent',
  PENDING: 'bg-warning/15 text-warning border-transparent',
  CLOSED: 'bg-muted text-muted-foreground border-transparent',
};

export function TicketsSidebar({ tickets, currentPage, totalPages }: TicketsSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTicketId = searchParams.get('ticketId') || '';
  const currentSearch = searchParams.get('q') || '';
  const currentStatus = searchParams.get('status') || 'ALL';

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page'); // Reset page index on search

    const q = String(fd.get('q')).trim();
    if (q) {
      params.set('q', q);
    } else {
      params.delete('q');
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page'); // Reset page
    const status = e.target.value;
    if (status && status !== 'ALL') {
      params.set('status', status);
    } else {
      params.delete('status');
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const navigatePage = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="w-full md:w-[320px] lg:w-[380px] border-r border-border/40 bg-card flex flex-col h-full shrink-0">
      {/* Header Filters */}
      <div className="p-4 border-b border-border/40 bg-muted/10 space-y-3">
        <form onSubmit={handleSearchSubmit}>
          <input
            type="text"
            name="q"
            defaultValue={currentSearch}
            placeholder="Поиск тикетов..."
            className="w-full px-3 py-2 text-xs bg-background border border-border/60 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground transition-all"
          />
        </form>

        <div className="flex gap-2 items-center">
          <select
            value={currentStatus}
            onChange={handleStatusChange}
            className="w-full px-3 py-1.5 text-[11px] bg-background border border-border/60 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
          >
            <option value="ALL">Все статусы</option>
            <option value="OPEN">Открытые</option>
            <option value="PENDING">В очереди (Pending)</option>
            <option value="CLOSED">Закрытые</option>
          </select>
        </div>
      </div>

      {/* Tickets Scroll List */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/20 p-2 space-y-1">
        {tickets.length > 0 ? (
          tickets.map((t) => {
            const isActive = activeTicketId === t.id;
            const lastMsg = t.messages?.[0]?.text || 'Сообщений нет';

            const params = new URLSearchParams(searchParams.toString());
            params.set('ticketId', t.id);

            return (
              <Link
                key={t.id}
                href={`${pathname}?${params.toString()}`}
                className={`block p-3.5 rounded-xl transition-all duration-200 text-left border ${
                  isActive
                    ? 'bg-primary/5 border-primary/20 text-primary shadow-sm'
                    : 'bg-transparent border-transparent hover:bg-muted/30 text-foreground'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-bold text-xs truncate max-w-[180px] lg:max-w-[220px]">
                    {t.subject}
                  </span>
                  <Badge
                    intent="outline"
                    className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 ${
                      STATUS_COLORS[t.status] || 'bg-muted'
                    }`}
                  >
                    {t.status}
                  </Badge>
                </div>
                <div className="text-[10px] text-muted-foreground font-medium mb-1 truncate">
                  {t.user.email}
                </div>
                <div className="text-[11px] text-muted-foreground truncate leading-relaxed">
                  {lastMsg}
                </div>
                <div className="text-[9px] text-muted-foreground font-mono mt-2 text-right">
                  {new Date(t.updatedAt).toLocaleDateString('ru-RU')}
                </div>
              </Link>
            );
          })
        ) : (
          <div className="text-center py-12 text-muted-foreground text-xs leading-relaxed">
            Тикеты не найдены
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-border/40 bg-muted/10 flex items-center justify-between text-xs">
          <button
            disabled={currentPage <= 1}
            onClick={() => navigatePage(currentPage - 1)}
            className="p-1.5 border border-border/50 rounded-lg hover:bg-background/80 disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-bold text-muted-foreground select-none">
            {currentPage} / {totalPages}
          </span>
          <button
            disabled={currentPage >= totalPages}
            onClick={() => navigatePage(currentPage + 1)}
            className="p-1.5 border border-border/50 rounded-lg hover:bg-background/80 disabled:opacity-40 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
