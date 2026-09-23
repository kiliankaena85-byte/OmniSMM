import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import { notFound, redirect } from 'next/navigation';
import { addTicketMessage } from '@/actions/support/ticket';
import Link from 'next/link';
import { ArrowLeft, Clock } from 'lucide-react';
import ChatWindow from '@/components/support/ChatWindow';
import { getSupportSlaInfo } from '@/utils/support-sla';
import { DashboardBreadcrumbs } from '@/components/dashboard/DashboardBreadcrumbs';

import { headers } from 'next/headers';
import { resolveTenantFromRequest } from '@/lib/tenant-resolver-edge';

export const dynamic = 'force-dynamic';

export default async function ClientTicketChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const reqHeaders = await headers();
  const tenantId = resolveTenantFromRequest(reqHeaders);

  const session = await verifySession(tenantId);
  if (!session) redirect('/login');

  const { id } = await params;

  const ticket = await db.ticket.findUnique({
    where: { id },
    select: {
      id: true,
      subject: true,
      status: true,
      userId: true,
      orderId: true,
      tenantId: true,
      user: {
        select: {
          email: true,
        },
      },
      order: {
        select: {
          id: true,
          numericId: true,
          status: true,
          charge: true,
          createdAt: true,
          service: { select: { name: true } }
        }
      }
    },
  });

  if (!ticket || ticket.userId !== session.userId || (ticket.tenantId && ticket.tenantId !== tenantId)) {
    redirect('/dashboard/tickets');
  }

  // 1. Fetch user's 3 most recent CLOSED tickets (excluding the active one, strictly within this tenant)
  const historicalTickets = await db.ticket.findMany({
    where: {
      userId: session.userId,
      tenantId,
      status: 'CLOSED',
      id: { not: id }
    },
    orderBy: { updatedAt: 'desc' },
    take: 3,
    include: {
      messages: {
        where: { sender: { not: 'INTERNAL' } },
        orderBy: { createdAt: 'asc' },
        include: { 
          replyTo: true, 
          attachments: true,
          order: {
            select: {
              id: true,
              numericId: true,
              status: true,
              charge: true,
              createdAt: true,
              service: { select: { name: true } }
            }
          }
        }
      }
    }
  });

  // Prepend historical messages, oldest closed ticket first
  const mappedHistoricalMessages = [];
  const reversedHistorical = [...historicalTickets].reverse();

  for (const hTicket of reversedHistorical) {
    for (const m of hTicket.messages) {
      mappedHistoricalMessages.push({
        id: m.id,
        sender: m.sender,
        text: m.text,
        mediaUrl: m.mediaUrl,
        mediaType: m.mediaType,
        createdAt: m.createdAt.toISOString(),
        isDeleted: m.isDeleted,
        isEdited: m.isEdited,
        originalText: m.originalText,
        orderId: m.orderId,
        order: m.order ? {
          id: m.order.id,
          numericId: m.order.numericId,
          status: m.order.status,
          charge: Number(m.order.charge),
          createdAt: m.order.createdAt.toISOString(),
          serviceName: m.order.service?.name || 'Услуга'
        } : null,
        replyTo: m.replyTo ? {
          id: m.replyTo.id,
          text: m.replyTo.text,
          sender: m.replyTo.sender
        } : null,
        attachments: m.attachments.map(a => ({
          id: a.id,
          url: a.url,
          type: a.type,
          mimeType: a.mimeType,
          name: a.name,
          size: a.size ? Number(a.size) : null,
          createdAt: a.createdAt.toISOString()
        })),
        isHistorical: true,
        historicalTicketId: hTicket.id,
        historicalSubject: hTicket.subject
      });
    }
  }

  // Fetch only the latest 50 messages of the active ticket
  const rawMessages = await db.ticketMessage.findMany({
    where: { 
      ticketId: id,
      sender: { not: 'INTERNAL' }
    },
    orderBy: { createdAt: 'desc' },
    take: 51,
    include: { 
      replyTo: true, 
      attachments: true,
      order: {
        select: {
          id: true,
          numericId: true,
          status: true,
          charge: true,
          createdAt: true,
          service: { select: { name: true } }
        }
      }
    }
  });

  let nextCursor: string | null = null;
  const activeMessages = [...rawMessages];
  if (activeMessages.length > 50) {
    const extraItem = activeMessages.pop();
    nextCursor = extraItem?.id || null;
  }
  activeMessages.reverse();

  const initialActiveMessages = activeMessages.map(m => ({
    id: m.id,
    sender: m.sender,
    text: m.text,
    mediaUrl: m.mediaUrl,
    mediaType: m.mediaType,
    createdAt: m.createdAt.toISOString(),
    isDeleted: m.isDeleted,
    isEdited: m.isEdited,
    originalText: m.originalText,
    orderId: m.orderId,
    order: m.order ? {
      id: m.order.id,
      numericId: m.order.numericId,
      status: m.order.status,
      charge: Number(m.order.charge),
      createdAt: m.order.createdAt.toISOString(),
      serviceName: m.order.service?.name || 'Услуга'
    } : null,
    replyTo: m.replyTo ? {
      id: m.replyTo.id,
      text: m.replyTo.text,
      sender: m.replyTo.sender
    } : null,
    attachments: m.attachments.map(a => ({
      id: a.id,
      url: a.url,
      type: a.type,
      mimeType: a.mimeType,
      name: a.name,
      size: a.size ? Number(a.size) : null,
      createdAt: a.createdAt.toISOString()
    }))
  }));

  // Stitch historical and active messages together
  const initialMessages = [...mappedHistoricalMessages, ...initialActiveMessages];

  // 2. Fetch client's 5 most recent orders for context mapping dropdown
  const initialOrders = await db.order.findMany({
    where: { userId: session.userId },
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      numericId: true,
      createdAt: true,
      status: true,
      charge: true,
      service: { select: { name: true } }
    }
  });

  const formattedOrders = initialOrders.map(o => ({
    id: o.id,
    numericId: o.numericId,
    createdAt: o.createdAt.toISOString(),
    status: o.status,
    charge: Number(o.charge),
    serviceName: o.service?.name || 'Услуга'
  }));

  const isClosed = ticket.status === 'CLOSED';

      const sla = getSupportSlaInfo();

      return (
        <div className="space-y-4 animate-in fade-in duration-500 flex flex-col h-[calc(100dvh-13rem)] md:h-[calc(100dvh-7rem)] min-h-[350px] md:min-h-[500px]">
          {/* Header / breadcrumb */}
          <div className="flex flex-col gap-2 shrink-0">
            <DashboardBreadcrumbs
              items={[
                { label: 'Поддержка', href: '/dashboard/tickets' },
                { label: `Тикет #${ticket.id.slice(-6)}` },
              ]}
              className="mb-1"
            />
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/tickets"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-all duration-200 min-h-[44px]"
                aria-label="Назад к списку тикетов"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>К списку тикетов</span>
              </Link>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground leading-tight truncate">
                {ticket.subject}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${sla.bgClass} ${sla.borderClass} ${sla.colorClass}`}>
                  <Clock className="w-3 h-3" />
                  {sla.badgeLabel}
                </span>
                <span className="text-[11px] text-muted-foreground hidden sm:inline">• Работаем 24/7</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
          <a
            href="/api/support/telegram"
            className="inline-flex items-center gap-2 text-xs font-semibold bg-brand-telegram hover:opacity-90 text-primary-foreground px-4 h-11 rounded-xl shadow-sm transition-all duration-200 active:scale-95 touch-manipulation min-h-[44px]"
            aria-label="Перейти в Telegram-бот"
          >
            <svg 
              viewBox="0 0 24 24" 
              className="w-4 h-4 fill-current"
              aria-hidden="true"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-2 .12-5.63 2.57-.53.36-1 .54-1.43.53-.47-.01-1.37-.27-2.04-.49-.82-.27-1.47-.41-1.42-.87.03-.24.37-.49 1.02-.74 3.99-1.73 6.66-2.88 8-3.43 3.8-1.56 4.59-1.83 5.11-1.84.11 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.16-.02.22z"/>
            </svg>
            Написать в Telegram
          </a>
          <span
            className={`shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border uppercase ${
              ticket.status === 'OPEN'
                ? 'text-status-error bg-status-error-bg border-status-error/20'
                : ticket.status === 'PENDING'
                ? 'text-status-warning bg-status-warning-bg border-status-warning/20'
                : 'text-muted-foreground bg-muted border-border'
            }`}
          >
            {ticket.status === 'OPEN'    ? 'Открыт'
             : ticket.status === 'PENDING' ? 'Ожидает вас'
             : 'Закрыт'}
          </span>
        </div>
      </div>

      {ticket.order && (
        <div className="bg-status-info-bg border border-status-info/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm shrink-0 animate-in fade-in duration-300">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-status-info-bg text-status-info flex items-center justify-center font-bold text-lg shrink-0">
              📦
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground">Привязанный заказ #{ticket.order.numericId}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                  ticket.order.status === 'COMPLETED' ? 'bg-status-success-bg text-status-success' :
                  ticket.order.status === 'IN_PROGRESS' ? 'bg-primary/10 text-primary' :
                  ticket.order.status === 'PENDING' ? 'bg-status-warning-bg text-status-warning' :
                  'bg-default-200 text-default-600'
                }`}>
                  {ticket.order.status === 'COMPLETED' ? 'Выполнен' :
                   ticket.order.status === 'IN_PROGRESS' ? 'Выполняется' :
                   ticket.order.status === 'PENDING' ? 'В очереди' : ticket.order.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{ticket.order.service?.name || 'Услуга'}</p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
            <span>Дата: {new Date(ticket.order.createdAt).toLocaleDateString('ru-RU')}</span>
            <span className="font-bold text-foreground">{(Number(ticket.order.charge) / 100).toFixed(2)} ₽</span>
          </div>
        </div>
      )}

      {/* Chat messages using premium ChatWindow */}
      <div className="flex-1 bg-card border border-border rounded-2xl overflow-hidden flex flex-col min-h-0 shadow-sm">
        <ChatWindow
          ticketId={ticket.id}
          initialMessages={initialMessages}
          isStaff={false}
          onSendMessage={addTicketMessage}
          initialNextCursor={nextCursor}
          isClosed={isClosed}
          initialOrders={formattedOrders}
          clientEmail={ticket.user.email}
        />
      </div>
    </div>
  );
}
