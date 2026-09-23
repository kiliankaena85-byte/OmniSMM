import { PrismaClient } from '@prisma/client';
import { getSupportSlaInfo } from '../src/utils/support-sla';

const db = new PrismaClient();

async function reproduceTicketPageRender() {
  console.log('🔍 [DEBUG] Testing ClientTicketChatPage data fetching and mapping for ticket cmt35p5iu001113438m0g832o...');

  const id = 'cmt35p5iu001113438m0g832o';
  const userId = 'cmsz4qh8e0000k57dddl9kdk2'; // admin user

  const ticket = await db.ticket.findUnique({
    where: { id },
    select: {
      id: true,
      subject: true,
      status: true,
      userId: true,
      orderId: true,
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

  if (!ticket || ticket.userId !== userId) {
    console.error('❌ Ticket not found or userId mismatch!');
    return;
  }

  console.log('✅ Ticket loaded:', { id: ticket.id, subject: ticket.subject, status: ticket.status });

  // 1. Fetch user's 3 most recent CLOSED tickets
  const historicalTickets = await db.ticket.findMany({
    where: {
      userId,
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

  console.log('✅ Historical tickets count:', historicalTickets.length);

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

  console.log('✅ Active messages count:', rawMessages.length);

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

  const initialMessages = [...mappedHistoricalMessages, ...initialActiveMessages];
  console.log('✅ Total stitched initialMessages count:', initialMessages.length);

  // 2. Fetch client's 5 most recent orders for context mapping dropdown
  const initialOrders = await db.order.findMany({
    where: { userId },
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

  console.log('✅ Formatted orders count:', formattedOrders.length);

  const sla = getSupportSlaInfo();
  console.log('✅ SLA Info:', sla);

  console.log('\n🎉 [SUCCESS] All backend data for ClientTicketChatPage fetched and mapped without any error!');
}

reproduceTicketPageRender()
  .catch(console.error)
  .finally(() => db.$disconnect());
