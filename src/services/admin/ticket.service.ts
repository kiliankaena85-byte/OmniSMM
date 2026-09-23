import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import type { MessageAttachment } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { paginatedQuery, type PaginatedResult } from '@/lib/pagination';
import { extractOrderIds } from '@/utils/ticket-parser';

// ── Types ──

type AdminTicketRow = {
  id: string;
  subject: string;
  status: string;
  source: string;
  updatedAt: Date;
  createdAt: Date;
  user: { id: string; email: string };
  _count: { messages: number };
  messages: { text: string; createdAt: Date; sender: string }[];
};

type TicketSearchParams = {
  page?: number;
  status?: string;
  source?: string;
  search?: string;
  pageSize?: number;
  isApiEnabled?: boolean;
  tenantId?: string;
  allowedTenants?: string[];
};

// ── Service ──

class AdminTicketService {

  /**
   * Paginated ticket list with filters.
   */
  async listTickets(params: TicketSearchParams): Promise<{ items: AdminTicketRow[], totalPages: number, page: number, totalCount: number }> {
    const where: Record<string, unknown> = {};

    if (params.tenantId && params.tenantId !== 'all') {
      where.tenantId = params.tenantId;
    } else if (params.allowedTenants && params.allowedTenants.length > 0) {
      where.tenantId = { in: params.allowedTenants };
    }

    if (params.status && params.status !== 'ALL') {
      where.status = params.status;
    }
    if (params.source && params.source !== 'ALL') {
      where.source = params.source;
    }
    if (params.isApiEnabled) {
      where.user = {
        apiConfig: {
          isApiEnabled: true
        }
      };
    }
    if (params.search?.trim()) {
      const q = params.search.trim();
      const orConditions: Prisma.TicketWhereInput[] = [
        { subject: { contains: q, mode: 'insensitive' } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { messages: { some: { text: { contains: q, mode: 'insensitive' } } } }
      ];

      // Exact ticket ID search if length matches CUID/UUID
      if (q.length >= 10) {
        orConditions.push({ id: q });
      }

      // Exact order UUID/CUID if pasted
      if (q.length > 20) {
        orConditions.push({ orderId: q });
      }

      // Linked order numeric ID if integer
      const numId = parseInt(q, 10);
      if (!isNaN(numId) && String(numId) === q) {
        orConditions.push({
          order: {
            numericId: numId
          }
        });
      }

      where.OR = orConditions;
    }

    const pageSize = params.pageSize || 50;
    const page = params.page || 1;
    const skip = (page - 1) * pageSize;

    const [totalCount, items] = await Promise.all([
      db.ticket.count({ where }),
      db.ticket.findMany({
        where,
        take: pageSize,
        skip,
        orderBy: { updatedAt: 'desc' },
        include: {
          user: { 
            select: { 
              id: true, 
              email: true,
              apiConfig: {
                select: {
                  isApiEnabled: true,
                  prioritySupport: true
                }
              }
            } 
          },
          _count: { select: { messages: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      })
    ]);

    // Priority API sorting: Float API tickets with prioritySupport flag to the top of the queue
    items.sort((a, b) => {
      const aPri = a.user?.apiConfig?.prioritySupport ? 1 : 0;
      const bPri = b.user?.apiConfig?.prioritySupport ? 1 : 0;
      return bPri - aPri;
    });

    const totalPages = Math.ceil(totalCount / pageSize);

    return {
      items: items as unknown as AdminTicketRow[],
      totalPages,
      page,
      totalCount
    };
  }

  /**
   * Close a ticket.
   */
  async closeTicket(ticketId: string) {
    await db.ticket.update({
      where: { id: ticketId },
      data: { status: 'CLOSED' },
    });
  }

  /**
   * Reopen a closed ticket.
   */
  async reopenTicket(ticketId: string) {
    await db.ticket.update({
      where: { id: ticketId },
      data: { status: 'OPEN' },
    });
  }

  /**
   * Ticket statistics for the header, including support SLA metrics.
   */
  async getTicketStats(startDate?: Date, endDate?: Date, tenantId?: string) {
    const where: Record<string, unknown> = {};
    if (startDate && endDate) {
      where.createdAt = { gte: startDate, lte: endDate };
    }
    if (tenantId) {
      where.tenantId = tenantId;
    }
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const [total, open, pending, closed, criticalOpen] = await Promise.all([
      db.ticket.count({ where }),
      db.ticket.count({ where: { ...where, status: 'OPEN' } }),
      db.ticket.count({ where: { ...where, status: 'PENDING' } }),
      db.ticket.count({ where: { ...where, status: 'CLOSED' } }),
      db.ticket.count({
        where: {
          ...where,
          status: 'OPEN',
          updatedAt: { lte: fifteenMinsAgo }
        }
      })
    ]);

    // Calculate support SLA metrics
    const resolvedTickets = await db.ticket.findMany({
      where: {
        ...where,
        status: 'CLOSED',
        resolvedAt: { not: null },
      },
      select: {
        createdAt: true,
        resolvedAt: true,
      }
    });

    const respondedTickets = await db.ticket.findMany({
      where: {
        ...where,
        firstRespondedAt: { not: null },
      },
      select: {
        createdAt: true,
        firstRespondedAt: true
      }
    });

    let avgFRTMin = 0;
    if (respondedTickets.length > 0) {
      const totalFRT = respondedTickets.reduce((acc, t) => {
        const diff = Math.max(0, t.firstRespondedAt!.getTime() - t.createdAt.getTime());
        return acc + diff;
      }, 0);
      avgFRTMin = Math.round(totalFRT / respondedTickets.length / 60000);
    }

    let avgTTRMin = 0;
    if (resolvedTickets.length > 0) {
      const totalTTR = resolvedTickets.reduce((acc, t) => {
        const diff = Math.max(0, t.resolvedAt!.getTime() - t.createdAt.getTime());
        return acc + diff;
      }, 0);
      avgTTRMin = Math.round(totalTTR / resolvedTickets.length / 60000);
    }

    return { total, open, pending, closed, criticalOpen, avgFRTMin, avgTTRMin };
  }

  /**
   * Get full ticket detail with messages and user profile (DTO-safe & Tenant-Isolated).
   */
  async getTicketDetails(ticketId: string, tenantOrAllowed?: string | string[]) {
    const whereClause: Prisma.TicketWhereInput = { id: ticketId };
    if (typeof tenantOrAllowed === 'string') {
      if (tenantOrAllowed !== 'all') {
        whereClause.tenantId = tenantOrAllowed;
      }
    } else if (Array.isArray(tenantOrAllowed) && tenantOrAllowed.length > 0) {
      whereClause.tenantId = { in: tenantOrAllowed };
    }
    const ticket = await db.ticket.findFirst({
      where: whereClause,
      include: {
        order: {
          select: {
            id: true,
            numericId: true,
            status: true,
            charge: true,
            createdAt: true,
            service: { select: { name: true, isCancelEnabled: true } },
          }
        },
        user: {
          select: {
            id: true,
            email: true,
            balance: true,
            totalSpent: true,
            createdAt: true,
            apiConfig: {
              select: {
                isApiEnabled: true,
                prioritySupport: true,
                webhookUrl: true
              }
            },
            orders: {
              take: 10,
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                numericId: true,
                status: true,
                quantity: true,
                charge: true,
                createdAt: true,
                service: { select: { name: true } },
              },
            },
            payments: {
              take: 3,
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                amount: true,
                status: true,
                gateway: true,
                createdAt: true,
              },
            },
          },
        },
        messages: { 
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
                service: { select: { name: true } },
              }
            }
          }
        },
      },
    });

    if (!ticket) return null;

    // Fetch 3 most recent historical closed tickets for Intercom Model
    const historicalTickets = await db.ticket.findMany({
      where: {
        userId: ticket.user.id,
        status: 'CLOSED',
        id: { not: ticket.id },
        ...(ticket.tenantId ? { tenantId: ticket.tenantId } : {})
      },
      orderBy: { updatedAt: 'desc' },
      take: 3,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' }, // Get newest first
          take: 15, // Limit to 15 per ticket to prevent DOM OOM
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
                service: { select: { name: true } },
              }
            }
          }
        }
      }
    });

    // Sort historical messages back to chronological order
    historicalTickets.forEach(t => {
      t.messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    });

    // Sort historical oldest first to prepend correctly
    historicalTickets.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // Map Message DTO helper
    const mapMessage = (m: Record<string, unknown> & { id: string; sender: string; text: string; mediaUrl?: string | null; mediaType?: string | null; createdAt: Date; isDeleted?: boolean; isEdited?: boolean; originalText?: string | null; orderId?: string | null; telegramMsgId?: string | null; order?: { id: string; numericId: number; status: string; charge: bigint | number; createdAt: Date; service?: { name: string } | null } | null; replyTo?: { id: string; text: string; sender: string } | null; attachments?: Array<{ id: string; url: string; type: string; mimeType?: string | null; name?: string | null; size?: number | null; createdAt: Date }> }, isHistorical = false, histTicketId?: string, histSubject?: string) => ({
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
      telegramMsgId: (m.telegramMsgId as string | null | undefined) ?? null,
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
      attachments: m.attachments ? (m.attachments as Array<{ id: string; url: string; type: string; mimeType?: string | null; name?: string | null; size?: number | null; createdAt: Date }>).map((a) => ({
        id: a.id,
        url: a.url,
        type: a.type,
        mimeType: a.mimeType,
        name: a.name,
        size: a.size,
        createdAt: a.createdAt.toISOString()
      })) : [],
      isHistorical,
      historicalTicketId: histTicketId,
      historicalSubject: histSubject
    });

    const stitchedMessages: ReturnType<typeof mapMessage>[] = [];
    
    // 1. Add historical messages
    for (const hist of historicalTickets) {
      if (hist.messages.length > 0) {
        stitchedMessages.push(...hist.messages.map(m => mapMessage(m, true, hist.id, hist.subject)));
      }
    }
    
    let nextCursor: string | null = null;
    const activeMessages = [...ticket.messages];
    if (activeMessages.length > 50) {
      const extraItem = activeMessages.pop();
      nextCursor = extraItem?.id || null;
    }
    activeMessages.reverse();

    // 2. Add current ticket messages
    stitchedMessages.push(...activeMessages.map(m => mapMessage(m)));

    // 3. Extract API attached order IDs on the fly from subject and message texts
    const allText = [ticket.subject, ...ticket.messages.map(m => m.text)].join(' ');
    const extractedIds = extractOrderIds(allText);

    let attachedOrders: Array<{ id: string; numericId: number; status: import("@prisma/client").OrderStatus; charge: number; remains: number; quantity: number; link: string; createdAt: string; serviceName: string }> = [];
    if (extractedIds.length > 0) {
      const orders = await db.order.findMany({
        where: {
          userId: ticket.user.id,
          OR: [
            { id: { in: extractedIds } },
            { numericId: { in: extractedIds.map((id: string) => parseInt(id, 10)).filter((id: number) => !isNaN(id)) } }
          ]
        },
        include: {
          service: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
      
      attachedOrders = orders.map(o => ({
        id: o.id,
        numericId: o.numericId,
        status: o.status,
        charge: Number(o.charge),
        remains: o.remains,
        quantity: o.quantity,
        link: o.link,
        createdAt: o.createdAt.toISOString(),
        serviceName: o.service?.name || 'Услуга'
      }));
    }

    return {
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      source: ticket.source,
      orderId: ticket.orderId,
      order: ticket.order ? {
        id: ticket.order.id,
        numericId: ticket.order.numericId,
        status: ticket.order.status,
        charge: Number(ticket.order.charge),
        createdAt: ticket.order.createdAt.toISOString(),
        serviceName: ticket.order.service?.name || 'Услуга',
        isCancelEnabled: ticket.order.service?.isCancelEnabled ?? false,
      } : null,
      attachedOrders,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      nextCursor,
      user: {
        id: ticket.user.id,
        email: ticket.user.email,
        balance: ticket.user.balance,
        totalSpent: ticket.user.totalSpent,
        createdAt: ticket.user.createdAt.toISOString(),
        apiConfig: ticket.user.apiConfig ? {
          isApiEnabled: ticket.user.apiConfig.isApiEnabled,
          prioritySupport: ticket.user.apiConfig.prioritySupport,
          webhookUrl: ticket.user.apiConfig.webhookUrl
        } : null,
        orders: ticket.user.orders.map(o => ({
          id: o.id,
          numericId: o.numericId,
          status: o.status,
          quantity: o.quantity,
          charge: Number(o.charge),
          createdAt: o.createdAt.toISOString(),
          serviceName: o.service?.name || 'Услуга',
          service: { name: o.service?.name || 'Услуга' },
        })),
        payments: ticket.user.payments.map(p => ({
          id: p.id,
          amount: p.amount,
          status: p.status,
          gateway: p.gateway,
          createdAt: p.createdAt.toISOString(),
        })),
      },
      messages: stitchedMessages,
    };
  }
}

export const adminTicketService = new AdminTicketService();
