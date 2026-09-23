import { verifySession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { ticketService } from '@/services/support/ticket.service';

export const dynamic = 'force-dynamic';

export default async function ClientTicketsPage() {
  const session = await verifySession();
  if (!session) redirect('/login');

  // Retrieve or create active (non-CLOSED) support live-chat session for the client
  const ticket = await ticketService.getOrCreateTicket(
    session.userId,
    'Чат с поддержкой',
    'WEB'
  );

  // Instantly redirect client to the active chat room
  redirect(`/dashboard/tickets/${ticket.id}`);
}
