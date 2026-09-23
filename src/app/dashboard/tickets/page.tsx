import { verifySession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { ticketService } from '@/services/support/ticket.service';
import { headers } from 'next/headers';
import { resolveTenantFromRequest } from '@/lib/tenant-resolver-edge';

export const dynamic = 'force-dynamic';

export default async function ClientTicketsPage() {
  const reqHeaders = await headers();
  const tenantId = resolveTenantFromRequest(reqHeaders);

  const session = await verifySession(tenantId);
  if (!session) redirect('/login');

  // Retrieve or create active (non-CLOSED) support live-chat session for the client scoped to this tenant
  const ticket = await ticketService.getOrCreateTicket(
    session.userId,
    'Чат с поддержкой',
    'WEB',
    tenantId
  );

  // Instantly redirect client to the active chat room
  redirect(`/dashboard/tickets/${ticket.id}`);
}
