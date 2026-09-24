/**
 * Route Handler: /api/admin/assistant/stream
 * Server-Sent Events (SSE) streaming endpoint for Admin AI Assistant
 */

import { NextRequest } from 'next/server';
import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { AdminAssistantQuerySchema } from '@/types/admin-ai-manual';
import { AdminAiAssistantService } from '@/services/admin/ai-manual/admin-ai-assistant.service';
import { KnowledgeRetrieverService } from '@/services/admin/ai-manual/knowledge-retriever.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SUPPORT'];

export async function POST(req: NextRequest) {
  console.log('>>> [SSE ROUTE] POST /api/admin/assistant/stream CALLED <<<');
  try {
    // 1. Authenticate Staff User
    const session = await verifySession();
    if (!session?.userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // tenant-isolation-ignore: session authentication verification by unique primary key
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { id: true, role: true },
    });

    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden: Staff access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Validate Request Body
    const body = await req.json();
    const parsed = AdminAssistantQuerySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'Validation failed', details: parsed.error.format() }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Initialize SSE TransformStream
    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    const writeSSE = async (data: Record<string, unknown>) => {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    };

    // 4. Run Assistant Streaming in Background
    (async () => {
      try {
        const memStatus = await KnowledgeRetrieverService.getMemoryStatus();
        await writeSSE({ type: 'status', memory: memStatus });

        const result = await AdminAiAssistantService.streamConsultation(
          parsed.data,
          user.id,
          user.role,
          async (token: string) => {
            await writeSSE({ type: 'token', text: token });
          }
        );

        await writeSSE({
          type: 'done',
          isFromCache: Boolean(result.isFromCache),
          chunksCount: result.chunksUsed.length,
          chunks: result.chunksUsed.map((c) => ({ title: c.title, filePath: c.filePath })),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Assistant stream error';
        await writeSSE({ type: 'error', error: message });
      } finally {
        await writer.close();
      }
    })();

    return new Response(responseStream.readable, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
