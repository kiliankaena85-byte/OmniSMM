'use client';

import * as React from 'react';
import { TicketsSidebar } from './tickets-sidebar';
import { TicketChat } from './ticket-chat';
import { MessageSquare } from 'lucide-react';

interface SidebarTicket {
  id: string;
  subject: string;
  status: string;
  source: string;
  updatedAt: Date;
  user: { email: string };
  messages: { text: string; createdAt: Date; sender: string }[];
}

interface TicketDetail {
  id: string;
  subject: string;
  status: string;
  user: { id: string; email: string };
  messages: { id: string; sender: string; text: string; createdAt: string }[];
}

interface TicketsWorkspaceProps {
  tickets: SidebarTicket[];
  currentPage: number;
  totalPages: number;
  activeTicket: TicketDetail | null;
}

export function TicketsWorkspace({
  tickets,
  currentPage,
  totalPages,
  activeTicket,
}: TicketsWorkspaceProps) {
  return (
    <div className="flex-1 flex flex-col md:flex-row h-[calc(100vh-140px)] gap-4 overflow-hidden">
      {/* Sidebar List */}
      <TicketsSidebar
        tickets={tickets}
        currentPage={currentPage}
        totalPages={totalPages}
      />

      {/* Main Chat Panel */}
      <div className="flex-1 h-full min-w-0">
        {activeTicket ? (
          <TicketChat ticket={activeTicket} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center border border-border/40 rounded-2xl bg-card/40 backdrop-blur-sm ring-1 ring-border/5 text-center p-8">
            <div className="p-4 bg-primary/10 rounded-full text-primary mb-4">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-foreground mb-1.5 font-sans">
              Обращение не выбрано
            </h3>
            <p className="text-muted-foreground text-xs max-w-xs leading-relaxed font-medium">
              Выберите интересующий тикет в левом меню для просмотра полной переписки и отправки ответов клиенту.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
