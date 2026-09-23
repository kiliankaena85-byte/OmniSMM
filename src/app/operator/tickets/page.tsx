import * as React from 'react';
import { enforceOperatorAccess } from '@/lib/operator/rbac';
import { adminTicketService } from '@/services/admin/ticket.service';
import { TicketsWorkspace } from './components/tickets-workspace';
import { MessageSquare } from 'lucide-react';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
    ticketId?: string;
  }>;
};

export default async function OperatorTicketsPage({ searchParams }: Props) {
  // Enforce staff/operator session
  await enforceOperatorAccess();

  const params = await searchParams;
  const search = params.q || '';
  const statusFilter = params.status || 'ALL';
  const currentPage = Math.max(1, parseInt(params.page || '1', 10));
  const activeTicketId = params.ticketId || null;

  // Retrieve matching tickets list
  const ticketsResult = await adminTicketService.listTickets({
    search: search || undefined,
    status: statusFilter,
    pageSize: 20, // compact size for two-panel layouts
    page: currentPage,
  });

  // Retrieve ticket messages detail if selected
    let activeTicket: Awaited<ReturnType<typeof adminTicketService.getTicketDetails>> = null;
  if (activeTicketId) {
    activeTicket = await adminTicketService.getTicketDetails(activeTicketId);
  }

  // Safe structures serialization mapping
  const tickets = ticketsResult.items.map((t) => ({
    id: t.id,
    subject: t.subject,
    status: t.status,
    source: t.source,
    updatedAt: t.updatedAt,
    user: { email: t.user.email },
    messages: t.messages.map((m) => ({
      text: m.text,
      createdAt: m.createdAt,
      sender: m.sender,
    })),
  }));

  const cleanedActiveTicket = activeTicket
    ? {
        id: activeTicket.id,
        subject: activeTicket.subject,
        status: activeTicket.status,
        user: {
          id: activeTicket.user.id,
          email: activeTicket.user.email,
        },
        messages: activeTicket.messages.map((m: { id: string; sender: string; text: string; createdAt: Date | string }) => ({
          id: m.id,
          sender: m.sender,
          text: m.text,
          createdAt: typeof m.createdAt === 'string' ? m.createdAt : new Date(m.createdAt).toISOString(),
        })),
      }
    : null;

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out pb-4">
      {/* Header section with icon */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/40 backdrop-blur-md border border-border/40 p-6 rounded-2xl ring-1 ring-border/5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-xl text-primary">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground font-sans">
              Обращения в поддержку
            </h2>
            <p className="text-muted-foreground text-xs mt-0.5 font-medium leading-relaxed">
              Диалоговая область для ведения переписок с клиентами и координации решений тикетов.
            </p>
          </div>
        </div>
      </div>

      {/* Main split workspace */}
      <TicketsWorkspace
        tickets={tickets}
        currentPage={currentPage}
        totalPages={ticketsResult.totalPages}
        activeTicket={cleanedActiveTicket}
      />
    </div>
  );
}
