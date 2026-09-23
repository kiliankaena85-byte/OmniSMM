import * as React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { adminUserService } from '@/services/admin/user.service';
import { getClientFinancialSummary } from '@/services/operator/users/client-financial-summary.query';
import { getUserNotes } from '@/services/operator/users/user-notes.query';
import { enforceOperatorAccess } from '@/lib/operator/rbac';
import { OverviewTab } from './components/overview-tab';
import { NotesTab } from './components/notes-tab';
import { ArrowLeft, User, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ tab?: string }>;
};

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  OWNER:   { label: 'Владелец', color: 'bg-warning/15 text-warning border-transparent' },
  ADMIN:   { label: 'Администратор', color: 'bg-primary/10 text-primary border-transparent' },
  MANAGER: { label: 'Менеджер', color: 'bg-success/15 text-success border-transparent' },
  SUPPORT: { label: 'Поддержка', color: 'bg-muted text-muted-foreground border-transparent' },
  USER:    { label: 'Клиент', color: 'bg-secondary text-secondary-foreground border-transparent' },
  BANNED:  { label: 'Забанен', color: 'bg-destructive/15 text-destructive border-transparent' },
};

export default async function OperatorUserDetailPage({ params, searchParams }: Props) {
  // Enforce operator access
  await enforceOperatorAccess();

  const { userId } = await params;
  const { tab = 'overview' } = await searchParams;

  // Retrieve user full card details safely
  const userCard = await adminUserService.getUserCard(userId).catch(() => null);
  if (!userCard) {
    notFound();
  }

  // Fetch financial aggregates from ledger and operator notes
  const [financials, notes] = await Promise.all([
    getClientFinancialSummary(userId),
    getUserNotes(userId),
  ]);

  // Clean data structure for component props mapping
  const cleanedUser = {
    id: userCard.id,
    email: userCard.email,
    role: userCard.role,
    telegramId: userCard.telegramId,
    createdAt: userCard.createdAt,
    personalDiscount: userCard.personalDiscount,
  };

  const roleInfo = ROLE_LABELS[userCard.role] || { label: userCard.role, color: 'bg-muted text-muted-foreground' };

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out pb-10">
      {/* Back Button */}
      <div>
        <Link
          href="/operator/users"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Назад к списку клиентов
        </Link>
      </div>

      {/* User Title & Role Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/40 backdrop-blur-md border border-border/40 p-6 rounded-2xl ring-1 ring-border/5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/10">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground font-sans break-all">
              {userCard.email}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Badge intent="outline" className={`font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 ${roleInfo.color}`}>
                {roleInfo.label}
              </Badge>
              <span className="text-[11px] text-muted-foreground font-mono">
                ID: {userCard.id}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-border/40 gap-6 text-sm">
        <Link
          href={`/operator/users/${userId}?tab=overview`}
          className={`pb-3 font-bold border-b-2 transition-all flex items-center gap-2 ${
            tab === 'overview'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <User className="w-4 h-4" />
          Обзор (Overview)
        </Link>
        <Link
          href={`/operator/users/${userId}?tab=notes`}
          className={`pb-3 font-bold border-b-2 transition-all flex items-center gap-2 ${
            tab === 'notes'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileText className="w-4 h-4" />
          Заметки ({notes.length})
        </Link>
      </div>

      {/* Tab Contents */}
      <div>
        {tab === 'overview' && (
          <OverviewTab
            user={cleanedUser}
            financials={financials}
            recentOrders={userCard.orders}
            recentTickets={userCard.tickets}
            recentNotes={notes.map((n) => ({
              id: n.id,
              content: n.content,
              createdAt: n.createdAt,
              author: n.author ? { email: n.author.email, role: n.author.role } : null,
            }))}
          />
        )}

        {tab === 'notes' && (
          <NotesTab
            userId={userId}
            notes={notes.map((n) => ({
              id: n.id,
              content: n.content,
              orderId: n.orderId,
              ticketId: n.ticketId,
              createdAt: n.createdAt,
              author: n.author ? { email: n.author.email, role: n.author.role } : null,
            }))}
          />
        )}
      </div>
    </div>
  );
}
