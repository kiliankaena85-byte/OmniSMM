import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import { memoryOrderEmitter, OrderStatusPayload } from '@/lib/orders/realtime-status';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;

  const session = await verifySession();
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true, status: true, updatedAt: true },
  });

  if (!order) {
    return new Response(JSON.stringify({ error: 'Order not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Authorization check: User must own the order or be Staff/Admin
  const isOwner = order.userId === session.userId;
  const isStaff = ['ADMIN', 'OWNER', 'SUPPORT', 'OPERATOR'].includes((session.role as string) || '');

  if (!isOwner && !isStaff) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const channel = `order:${orderId}:status`;

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send initial state
      const initialPayload = `data: ${JSON.stringify({
        orderId: order.id,
        status: order.status,
        updatedAt: order.updatedAt.toISOString(),
      })}\n\n`;
      controller.enqueue(new TextEncoder().encode(initialPayload));

      // 2. Listener for live updates
      const listener = (payload: OrderStatusPayload) => {
        try {
          const chunk = `data: ${JSON.stringify(payload)}\n\n`;
          controller.enqueue(new TextEncoder().encode(chunk));
        } catch {
          // Stream might be closed
        }
      };

      memoryOrderEmitter.on(channel, listener);

      // 3. Heartbeat every 25s
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25_000);

      // Clean up on disconnect
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        memoryOrderEmitter.off(channel, listener);
        try {
          controller.close();
        } catch {
          // audit-ignore: stream controller may already be closed on client abort
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
