import { db } from '@/lib/db';
import { sendMail } from '@/lib/smtp';
import { SettingsProvider } from '@/lib/settings';
import { publishMessageSSE } from './sse.service';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { TicketSource, TicketStatus, MessageSender } from '@prisma/client';
import { getMimeType } from '@/lib/mime';

interface AddMessageOptions {
  ticketId: string;
  sender: MessageSender;
  text: string;
  mediaUrl?: string;
  mediaType?: string;
  replyToId?: string;
  incomingTelegramMsgId?: string;
  attachments?: Array<{ url: string; type: string; mimeType: string; name: string; size?: number }>;
  orderId?: string;
}

export interface InboundAttachment {
  url: string;
  type: string;
  mimeType: string;
  name: string;
  size?: number;
}

export interface CreateInboundEmailTicketParams {
  fromEmail: string;
  fromName?: string;
  toEmail?: string;
  subject: string;
  text: string;
  html?: string;
  tenantId?: string;
  attachments?: InboundAttachment[];
}

class TicketService {
  /**
   * Create a new ticket from an incoming customer email.
   * Auto-provisions customer user profile if email does not exist yet.
   */
  async createInboundEmailTicket(params: CreateInboundEmailTicketParams) {
    const normalizedEmail = params.fromEmail.trim().toLowerCase();
    
    // Resolve tenant from toEmail or parameter
    let resolvedTenant = params.tenantId;
    if (!resolvedTenant && params.toEmail) {
      resolvedTenant = params.toEmail.toLowerCase().includes('flux') ? 'flux' : 'smmplan';
    }
    if (!resolvedTenant) {
      resolvedTenant = 'smmplan';
    }

    // Find or create customer
    let user = await db.user.findFirst({
      where: { 
        email: { equals: normalizedEmail, mode: 'insensitive' },
        tenantId: resolvedTenant
      }
    });

    if (!user) {
      user = await db.user.create({
        data: {
          email: normalizedEmail,
          role: 'USER',
          tenantId: resolvedTenant,
          isEmailVerified: true,
          isActive: true,
        }
      });
    }

    const cleanSubject = params.subject?.trim() || 'Новое обращение по Email';
    const cleanText = params.text?.trim() || (params.attachments && params.attachments.length > 0 ? '[Вложенные файлы]' : '[Пустое сообщение]');

    const ticket = await db.ticket.create({
      data: {
        userId: user.id,
        subject: cleanSubject,
        source: 'EMAIL',
        status: 'OPEN',
        tenantId: resolvedTenant,
        messages: {
          create: {
            sender: 'USER',
            text: cleanText,
            attachments: params.attachments && params.attachments.length > 0 ? {
              create: params.attachments.map(att => ({
                url: att.url,
                type: att.type || 'document',
                mimeType: att.mimeType || 'application/octet-stream',
                name: att.name || 'attachment',
                size: att.size || null
              }))
            } : undefined
          }
        }
      },
      include: {
        user: true,
        messages: {
          include: {
            attachments: true
          }
        }
      }
    });

    // Send confirmation auto-reply to customer
    try {
      const { sendTicketCreatedMail } = await import('@/lib/smtp');
      await sendTicketCreatedMail(user.email, ticket.id, ticket.subject, resolvedTenant);
    } catch (mailErr) {
      console.error('[TicketService] Failed to send email confirmation for new ticket:', mailErr);
    }

    // Realtime broadcast for active admin ticket workspace
    try {
      const initialMessageId = ticket.messages?.[0]?.id;
      if (initialMessageId) {
        void publishMessageSSE(ticket.id, initialMessageId);
      }
    } catch (sseErr) {
      console.error('[TicketService] Failed to publish SSE for new ticket:', sseErr);
    }

    return ticket;
  }

  async getOrCreateTicket(userId: string, subject: string, source: TicketSource = 'WEB', tenantId?: string) {
    return await db.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { tenantId: true }
      });
      const resolvedTenant = tenantId || user.tenantId || 'smmplan';

      const existing = await tx.ticket.findFirst({
        where: { userId, tenantId: resolvedTenant, status: { not: 'CLOSED' } },
        orderBy: { updatedAt: 'desc' }
      });

      if (existing) return existing;

      return tx.ticket.create({
        data: { userId, subject, source, tenantId: resolvedTenant }
      });
    }, {
      isolationLevel: 'Serializable'
    });
  }

  /**
   * Add a message to a ticket.
   * Supports both options-object signature and legacy positional parameters.
   */
  async addMessage(
    optionsOrTicketId: string | AddMessageOptions,
    legacySender?: MessageSender,
    legacyText?: string,
    legacyMediaUrl?: string,
    legacyMediaType?: string,
    legacyReplyToId?: string,
    legacyIncomingTelegramMsgId?: string,
    legacyAttachments?: Array<{ url: string; type: string; mimeType: string; name: string; size?: number }>,
    legacyOrderId?: string
  ) {
    let opts: AddMessageOptions;
    if (typeof optionsOrTicketId === 'string') {
      opts = {
        ticketId: optionsOrTicketId,
        sender: legacySender!,
        text: legacyText!,
        mediaUrl: legacyMediaUrl,
        mediaType: legacyMediaType,
        replyToId: legacyReplyToId,
        incomingTelegramMsgId: legacyIncomingTelegramMsgId,
        attachments: legacyAttachments,
        orderId: legacyOrderId,
      };
    } else {
      opts = optionsOrTicketId;
    }

    const {
      ticketId,
      sender,
      text,
      mediaUrl,
      mediaType,
      replyToId,
      incomingTelegramMsgId,
      attachments,
      orderId
    } = opts;

    let telegramMsgId: string | undefined = incomingTelegramMsgId;
    
    // Fetch ticket and user info beforehand for Telegram sending
    const ticketToUpdate = await db.ticket.findUnique({ 
      where: { id: ticketId }, 
      include: { user: true } 
    });

    if (!ticketToUpdate) throw new Error('Ticket not found');

        // Build attachments to create with legacy support fallback
    const attachmentsToCreate: Array<{ url: string; type: string; mimeType: string; name: string; size?: number }> = [];
    if (attachments && attachments.length > 0) {
      attachmentsToCreate.push(...attachments);
    } else if (mediaUrl) {
      const name = mediaUrl.split('/').pop() || 'attachment';
      const mimeType = getMimeType(name);
      attachmentsToCreate.push({
        url: mediaUrl,
        type: (mediaType || 'document').toLowerCase(),
        mimeType,
        name
      });
    }

    const resolvedMediaUrl = mediaUrl || attachmentsToCreate[0]?.url || null;
    const resolvedMediaType = mediaType || attachmentsToCreate[0]?.type || null;

    if (sender === 'STAFF' && ticketToUpdate.user.telegramId) {
      try {
        const { supportBotService } = await import('@/services/support/support-bot.service');
        
        // Find the telegramMsgId of the replied message, if any
        let replyToTgMsgId: string | undefined = undefined;
        if (replyToId) {
          const repliedMsg = await db.ticketMessage.findUnique({ where: { id: replyToId } });
          if (repliedMsg?.telegramMsgId) replyToTgMsgId = repliedMsg.telegramMsgId;
        }

        const tgId = await supportBotService.sendSupportReply(
          ticketToUpdate.user.telegramId, 
          text, 
          replyToTgMsgId,
          resolvedMediaUrl || undefined,
          resolvedMediaType || undefined
        );
        if (tgId) telegramMsgId = tgId;
      } catch (e) {
        console.error('[TicketService] Error sending to telegram:', e);
      }
    }

    const message = await db.ticketMessage.create({
      data: { 
        ticketId, 
        sender, 
        text, 
        mediaUrl: resolvedMediaUrl, 
        mediaType: resolvedMediaType, 
        replyToId, 
        telegramMsgId,
        orderId: orderId || null,
        attachments: attachmentsToCreate.length > 0 ? {
          create: attachmentsToCreate.map(att => ({
            url: att.url,
            type: att.type,
            mimeType: att.mimeType,
            name: att.name, // original filename
            size: att.size || null
          }))
        } : undefined
      },
      include: {
        ticket: { include: { user: true } },
        attachments: true
      }
    });

    const newStatus = sender === 'STAFF' ? 'PENDING' : (sender === 'USER' ? 'OPEN' : ticketToUpdate.status);
    
    await db.ticket.update({
      where: { id: ticketId },
      data: { 
        status: newStatus,
        ...(sender === 'STAFF' && !ticketToUpdate.firstRespondedAt ? { firstRespondedAt: new Date() } : {})
      }
    });

    // Notify user if STAFF replied via Email (Omnichannel notification)
    if (sender === 'STAFF' && message.ticket.user.email && !message.ticket.user.telegramId) {
      const actionText = `
        <p style="color: #4f46e5; font-size: 14px; font-weight: bold; margin-top: 20px;">
          ✍️ Вы можете ответить на это сообщение прямо через почту — просто напишите ответное письмо.
        </p>
        <p style="color: #64748b; font-size: 12px; margin-top: 5px;">
          Или вы можете войти в панель управления (Dashboard) для просмотра всей переписки.
        </p>
      `;

      const supportDomain = await SettingsProvider.getSupportEmailDomain();
      const settings = await SettingsProvider.getContactAndLegalSettings();
      const companyName = settings.COMPANY_NAME || "SMMplan";
      const replyToAddress = `support+${message.ticket.id}@${supportDomain}`;
      
      const escapeHtml = (unsafe?: string | null) => (unsafe ?? '')
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/\n/g, "<br>");

      // Fetch recent message history for full context
      const previousMessages = await db.ticketMessage.findMany({
        where: { ticketId, sender: { in: ['USER', 'STAFF'] } }, // exclude internal notes for safety
        orderBy: { createdAt: 'desc' },
        take: 6 // get current + last 5 messages
      });

      // Filter out the current message to keep it as main block, reverse to chronological
      const historyMessages = previousMessages
        .filter(m => m.id !== message.id)
        .reverse();

      let historyHtml = '';
      if (historyMessages.length > 0) {
        historyHtml = `
          <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
            <h3 style="color: #475569; font-size: 13px; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 0.05em;">Предыдущие сообщения:</h3>
            ${historyMessages.map(m => {
              const senderLabel = m.sender === 'USER' ? 'Вы' : 'Поддержка';
              const isStaff = m.sender === 'STAFF';
              return `
                <div style="margin-bottom: 12px; padding: 12px; border-radius: 8px; background-color: ${isStaff ? '#f8fafc' : '#f0f9ff'}; border-left: 4px solid ${isStaff ? '#94a3b8' : '#38bdf8'};">
                  <div style="font-size: 11px; font-weight: bold; color: #64748b; margin-bottom: 5px;">
                    ${senderLabel} • ${new Date(m.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                  </div>
                  <div style="font-size: 13px; color: #334155; white-space: pre-wrap; line-height: 1.5;">${escapeHtml(m.text)}</div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }

      void sendMail(message.ticket.user.email, `Support Reply: ${message.ticket.subject}`, `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 25px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
          <h2 style="color: #4f46e5; margin-top: 0;">Новое сообщение от поддержки ${companyName}</h2>
          <p style="font-size: 14px; color: #475569;"><strong>Тема:</strong> ${escapeHtml(message.ticket.subject)}</p>
          <div style="background: #f8fafc; padding: 18px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4f46e5; font-size: 15px; color: #1e293b; line-height: 1.6; white-space: pre-wrap;">
            ${escapeHtml(text)}
          </div>
          ${actionText}
          ${historyHtml}
        </div>
      `, replyToAddress);
    }

    // Realtime SSE broadcast to all active live chat tabs
    void Promise.resolve(publishMessageSSE(ticketId, message.id)).catch((err) => {
      console.error('[TicketService] SSE broadcast error:', err);
    });

    return message;
  }
}

export const ticketService = new TicketService();
