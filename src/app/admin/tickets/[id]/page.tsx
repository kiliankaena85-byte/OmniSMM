import { redirect } from 'next/navigation';

export default async function AdminOldTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/tickets?ticketId=${id}`);
}
