import type { AdminTicketItem, TicketStatsDTO, ActiveTicketDTO } from '../types';
import React from 'react';
import { Headphones, Search, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatEta } from '@/utils/format-eta';
import { getSupportSlaInfo } from '@/utils/support-sla';

const formatTicketDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    return '';
  }
};

const renderSourceBadge = (source: string) => {
  const s = source?.toUpperCase();
  if (s === 'TELEGRAM') {
    return (
      <span className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full border-2 border-card bg-background flex items-center justify-center shadow-xs" title="Telegram">
        <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-[#24A1DE] fill-current">
          <path d="M9.78 18.65c-.23 0-.38-.1-.47-.3L7.1 14.15l8.63-7.55c.1-.08.2-.08.26-.01.06.07.05.18-.03.26l-6.84 6.17-.02 4.69c.01.42.27.73.68.73.23 0 .42-.1.58-.26l2.19-2.1 4.22 3.12c.57.42 1.12.21 1.29-.48l3.15-14.85c.19-.79-.31-1.15-.99-.87L2.1 10.3c-.76.3-.75.73-.13.92l4.66 1.45 10.79-6.8c.51-.31.98-.14.6.2l-8.75 7.89-.34 4.29c-.04.26-.2.4-.45.4z" />
        </svg>
      </span>
    );
  }
  if (s === 'EMAIL') {
    return (
      <span className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full border-2 border-card bg-background flex items-center justify-center shadow-xs" title="Email">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5 text-rose-500">
          <rect width="20" height="16" x="2" y="4" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      </span>
    );
  }
  return (
    <span className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full border-2 border-card bg-background flex items-center justify-center shadow-xs" title="Web">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5 text-indigo-500">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
      </svg>
    </span>
  );
};

export interface TicketsSidebarProps {
  isMobile: boolean;
  activeTicket: ActiveTicketDTO | null;
  stats: TicketStatsDTO;
  searchVal: string;
  setSearchVal: (val: string) => void;
  handleSearchSubmit: (e: React.FormEvent) => void;
  currentStatus: string;
  handleStatusFilter: (status: string) => void;
  currentSource: string;
  handleSourceFilter: (source: string) => void;
  currentIsB2b: boolean;
  handleB2bToggle: (isB2b: boolean) => void;
  tickets: AdminTicketItem[];
  handleSelectTicket: (id: string) => void;
  totalPages: number;
  currentPage: number;
  handlePageChange: (page: number) => void;
}

export function TicketsSidebar({
  isMobile,
  activeTicket,
  stats,
  searchVal,
  setSearchVal,
  handleSearchSubmit,
  currentStatus,
  handleStatusFilter,
  currentSource,
  handleSourceFilter,
  currentIsB2b,
  handleB2bToggle,
  tickets,
  handleSelectTicket,
  totalPages,
  currentPage,
  handlePageChange
}: TicketsSidebarProps) {
  if (isMobile && activeTicket) {
    return null;
  }

  const slaInfo = getSupportSlaInfo();

  return (
    <div 
      className="w-full lg:w-[300px] xl:w-[340px] shrink-0 border-r border-border flex flex-col h-full overflow-hidden min-h-0 select-none bg-background min-w-0"
    >
      {/* List Header */}
      <div className="p-3.5 border-b border-border space-y-2.5 bg-card text-card-foreground shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="font-black text-base flex items-center gap-2">
            <Headphones className="w-5 h-5 text-primary" />
            <span>Список диалогов</span>
          </h1>
          {stats.open > 0 && (
            <div className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20 animate-pulse">
              {stats.open} требуют ответа
            </div>
          )}
        </div>

        {/* ── LIVE SLA & SHIFT STATUS PILL ── */}
        <div className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] font-bold ${slaInfo.bgClass} ${slaInfo.borderClass}`}>
          <div className="flex items-center gap-1.5">
            <Clock className={`w-3.5 h-3.5 ${slaInfo.colorClass}`} />
            <span className={slaInfo.colorClass}>{slaInfo.badgeShort}</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">{slaInfo.timeStringMsk}</span>
        </div>

        {/* Status Filter Row */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {[
            { label: 'Все', value: 'ALL', count: stats.total },
            { label: 'В работе', value: 'OPEN', count: stats.open },
            { label: 'Ждут клиента', value: 'PENDING', count: stats.pending },
            { label: 'Закрытые', value: 'CLOSED', count: stats.closed }
          ].map((pill) => {
            const isActive = currentStatus === pill.value;
            return (
              <button
                key={pill.value}
                type="button"
                onClick={() => handleStatusFilter(pill.value)}
                className={`px-3 text-[11px] font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer min-h-[36px] h-[36px] flex items-center justify-center gap-1.5 ${
                  isActive 
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs' 
                    : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
                }`}
              >
                <span>{pill.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  isActive
                    ? 'bg-primary-foreground/20 text-primary-foreground font-black'
                    : 'bg-background text-foreground font-bold border border-border/40'
                }`}>
                  {pill.count || 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Inline Search & B2B / Source Row */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="relative flex-grow min-w-0">
            <input
              type="text"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              placeholder="Поиск по диалогам..."
              className="w-full pl-9 pr-3 h-10 text-xs border border-border rounded-lg text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-transparent transition-all bg-background placeholder:text-muted-foreground"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          </form>

          {/* B2B Filter Toggle */}
          <button
            type="button"
            onClick={() => handleB2bToggle(!currentIsB2b)}
            className={`px-3 h-10 text-xs font-black rounded-lg transition-all border whitespace-nowrap cursor-pointer select-none uppercase shrink-0 flex items-center justify-center ${
              currentIsB2b
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 shadow-xs'
                : 'bg-muted text-muted-foreground hover:text-foreground border-border'
            }`}
          >
            B2B
          </button>

          {/* Source Filter Dropdown */}
          <select
            value={currentSource}
            onChange={(e) => handleSourceFilter(e.target.value)}
            className="h-10 bg-background border border-border rounded-lg px-2 text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer select-none min-w-[90px] shrink-0"
            aria-label="Фильтр по источнику"
          >
            <option value="ALL">Все сети</option>
            <option value="TELEGRAM">Telegram</option>
            <option value="EMAIL">Email</option>
            <option value="WEB">Web</option>
          </select>
        </div>

        {/* SLA stats */}
        {stats?.avgFRTMin !== undefined && (stats.avgFRTMin > 0 || stats.avgTTRMin > 0) && (
          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-bold px-1 py-0.5 border-t border-border/40 pt-1.5">
            {stats.avgFRTMin > 0 && (
              <span className="flex items-center gap-1">⚡ Ответ: <span className="text-foreground">{formatEta(stats.avgFRTMin * 60)}</span></span>
            )}
            {stats.avgTTRMin > 0 && (
              <span className="flex items-center gap-1">✅ Закрытие: <span className="text-foreground">{formatEta(stats.avgTTRMin * 60)}</span></span>
            )}
          </div>
        )}
      </div>

      {/* Cards List container */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 p-2 custom-scrollbar bg-background">
        {tickets.map((ticket) => {
          const isActive = activeTicket?.id === ticket.id;
          const lastMsg = (ticket.messages && ticket.messages.length > 0) ? ticket.messages[0].text : "Нет сообщений";
          const croppedMsg = lastMsg.length > 55 ? `${lastMsg.substring(0, 55)}...` : lastMsg;

          return (
            <div 
              key={ticket.id}
              onClick={() => handleSelectTicket(ticket.id)}
              className={`mx-1 my-0.5 p-3 rounded-lg cursor-pointer transition-all duration-200 flex flex-col select-none border ${
                isActive 
                  ? 'bg-primary/10 text-foreground border-primary/40 shadow-xs ring-1 ring-primary/20' 
                  : 'bg-card text-foreground border-border/70 hover:border-border hover:bg-muted/40 shadow-xs'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Premium Circular Avatar */}
                <div className="relative w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-black text-primary text-xs shrink-0 select-none">
                  {(ticket.user?.email || "Аноним").substring(0, 2).toUpperCase()}
                  {/* Social Network Icon Badge based on ticket source */}
                  {renderSourceBadge(ticket.source)}
                </div>
                
                {/* Content Block */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[11px] font-bold text-foreground truncate max-w-[100px] sm:max-w-[145px]" title={ticket.user.email || "Аноним"}>
                        {ticket.user.email || "Аноним"}
                      </span>
                      {ticket.user.b2bConfig?.isB2b && (
                        <span className="px-1.5 py-0.5 bg-warning/10 text-warning-text border border-warning/20 rounded text-[8px] font-black uppercase shrink-0 select-none">
                          Priority B2B
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={ticket.status} className="h-4 px-1.5 text-[8px]" />
                      <span className="text-[9px] font-medium text-muted-foreground">
                        {formatTicketDate(typeof ticket.updatedAt === "string" ? ticket.updatedAt : ticket.updatedAt.toISOString())}
                      </span>
                    </div>
                  </div>
                  
                  <span className="block text-xs font-bold text-foreground truncate mb-0.5" title={ticket.subject}>
                    {ticket.subject}
                  </span>
                  
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-[11px] text-muted-foreground truncate leading-normal flex-1">
                      {croppedMsg}
                    </p>
                    
                    {/* Circular Unread Badge */}
                    {ticket.status === 'OPEN' && (
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[9px] font-black shrink-0 shadow-sm animate-pulse" title="Ожидает ответа оператора">
                        !
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {tickets.length === 0 && (
          <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-3 my-auto">
            <div className="w-12 h-12 rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground border border-border/70 shadow-xs">
              <Headphones className="w-6 h-6 opacity-60 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground text-sm">В этой категории нет диалогов</p>
              <p className="text-[11px] text-muted-foreground">
                {currentStatus === 'PENDING' ? 'Все ожидающие тикеты были отвечены или закрыты.' : 'Нет тикетов, соответствующих выбранному фильтру.'}
              </p>
            </div>
            {currentStatus !== 'ALL' && (
              <button
                type="button"
                onClick={() => handleStatusFilter('ALL')}
                className="mt-1 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold rounded-lg text-xs transition-colors cursor-pointer border border-primary/20 shadow-xs"
              >
                Показать все диалоги ({stats.total})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-border/50 flex items-center justify-between shrink-0 bg-card/60 backdrop-blur-md select-none">
          <Button
            intent="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => handlePageChange(currentPage - 1)}
            className="h-8 min-h-[44px] min-w-[44px] touch-target-expand"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-[10px] font-bold text-muted-foreground uppercase">
            {currentPage} / {totalPages}
          </span>
          <Button
            intent="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
            className="h-8 min-h-[44px] min-w-[44px] touch-target-expand"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
