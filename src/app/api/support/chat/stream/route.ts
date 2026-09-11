/**
 * SSE Stream for Live Chat — Real-time message delivery to client cabinet.
 *
 * Security:
 * - Authenticated via httpOnly session cookie (verifySession)
 * - Authorization: user must own the ticket
 * - Rate-limited by max concurrent connections per ticket (implicit via browser EventSource)
 *
 * Anti-buffering headers:
 * - X-Accel-Buffering: no (Nginx/Cloudflare proxy compatibility)
 * - Cache-Control: no-cache, no-transform
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sseBroadcaster } from '@/lib/sse-broadcaster';
import { jwtVerify } from 'jose';

import { getEncodedKey, readSessionTokenFromCookies } from '@/lib/session';

// Max SSE connections per ticket to prevent resource exhaustion (VQ2)
const MAX_CONNECTIONS_PER_TICKET = 10;

export async function GET(req: NextRequest) {
  // 1. Authentication via httpOnly cookie
  let userId: string;
  try {
    const token = readSessionTokenFromCookies(req.cookies);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { payload } = await jwtVerify(token, getEncodedKey(), { algorithms: ['HS256'] });
    userId = payload.userId as string;
  } catch (err) {
    console.warn('[SSE] Unauthorized access attempt:', err);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Extract and validate ticketId
  const ticketId = req.nextUrl.searchParams.get('ticketId');
  if (!ticketId) {
    return NextResponse.json({ error: 'ticketId required' }, { status: 400 });
  }

  // 3. Authorization: user must own the ticket OR be staff
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isStaff = ['ADMIN', 'SUPPORT', 'OWNER'].includes(user.role);

  if (isStaff) {
    const ticket = await db.ticket.findFirst({ where: { id: ticketId, tenantId: user.tenantId } });
    if (!ticket) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  } else {
    const ticket = await db.ticket.findFirst({
      where: { id: ticketId, userId, tenantId: user.tenantId }
    });
    if (!ticket) {
      return new Response('Forbidden', { status: 403 });
    }
  }

  // 4. Connection limit guard (VQ2: prevents 10-tab resource exhaustion)
  if (sseBroadcaster.getConnectionCount(ticketId) >= MAX_CONNECTIONS_PER_TICKET) {
    return new Response('Too many connections for this chat', { status: 429 });
  }

  // 5. Construct SSE ReadableStream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`));

      // Message listener — pushes new messages to SSE stream
            const listener = (message: unknown) => {
    const msg = message as { ticketId: string; [key: string]: unknown };
        try {
          if (msg.sender === 'INTERNAL' && !isStaff) {
            return; // Skip sending internal notes to normal clients
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
        } catch {
          // Stream already closed, cleanup will handle
        }
      };

      // Subscribe to broadcaster
      const unsubscribe = sseBroadcaster.subscribe(ticketId, listener);

      // Heartbeat: keep-alive ping every 25s to prevent proxy/CDN timeout (C1)
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      // Cleanup on client disconnect (C2)
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // C1: Prevents Nginx/Cloudflare buffering
      'Content-Encoding': 'none', // Prevents Cloudflare/Nginx compression buffering
    },
  });
}
