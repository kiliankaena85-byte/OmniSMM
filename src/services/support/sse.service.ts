import { db } from '@/lib/db';
import { sseBroadcaster } from '@/lib/sse-broadcaster';

export async function publishMessageSSE(ticketId: string, messageId: string) {
  const fullMsg = await db.ticketMessage.findUnique({
    where: { id: messageId },
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

  if (fullMsg) {
    sseBroadcaster.publish(ticketId, {
      id: fullMsg.id,
      sender: fullMsg.sender,
      text: fullMsg.text,
      mediaUrl: fullMsg.mediaUrl || (fullMsg.attachments[0]?.url ?? null),
      mediaType: fullMsg.mediaType || (fullMsg.attachments[0]?.type ?? null),
      createdAt: fullMsg.createdAt.toISOString(),
      telegramMsgId: fullMsg.telegramMsgId ?? null,
      replyTo: fullMsg.replyTo ? {
        id: fullMsg.replyTo.id,
        text: fullMsg.replyTo.text,
        sender: fullMsg.replyTo.sender
      } : null,
      attachments: fullMsg.attachments.map(att => ({
        id: att.id,
        url: att.url,
        type: att.type,
        mimeType: att.mimeType,
        name: att.name,
        size: att.size,
        createdAt: att.createdAt.toISOString()
      })),
      order: fullMsg.order ? {
        id: fullMsg.order.id,
        numericId: fullMsg.order.numericId,
        status: fullMsg.order.status,
        charge: Number(fullMsg.order.charge),
        createdAt: fullMsg.order.createdAt.toISOString(),
        serviceName: fullMsg.order.service?.name || 'Услуга'
      } : null,
      type: 'new_message'
    });
  }
}
