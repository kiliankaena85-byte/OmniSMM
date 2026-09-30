/**
 * SSE Stream — DePIN Task Push
 * GET /api/depin/stream?nodeId=tg_12345
 *
 * Server-Sent Events: сервер пушит задачи в реальном времени.
 * Заменяет HTTP polling (каждые 7s) на постоянное соединение.
 *
 * Протокол:
 *   event: task    — новая задача для выполнения
 *   event: ping    — keepalive каждые 20s
 *   event: credits — обновление баланса после reportTask
 *
 * Next.js 16 App Router поддерживает ReadableStream нативно в Route Handlers.
 */

import { DePinTaskDispatcher } from '@/services/depin/task-dispatcher';
import { redis } from '@/lib/redis';

const PING_INTERVAL_MS  = 20_000; // keepalive каждые 20 секунд
const TASK_INTERVAL_MS  = 8_000;  // проверка новых задач каждые 8 секунд
const MAX_STREAM_TTL_MS = 5 * 60 * 1000; // принудительно закрываем через 5 минут (TMA ограничение)

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Edge runtime не поддерживает ioredis

/**
 * GET /api/depin/stream?nodeId=tg_12345
 */
export async function GET(request: Request): Promise<Response> {
  const url    = new URL(request.url);
  const nodeId = url.searchParams.get('nodeId');

  if (!nodeId || nodeId.length < 3) {
    return new Response('nodeId is required', { status: 400 });
  }

  // Проверяем rate-limit перед открытием стрима
  const rateLimitKey = `depin:rate:${nodeId}`;
  const rateCount = await redis.incr(rateLimitKey);
  if (rateCount === 1) await redis.expire(rateLimitKey, 3600);
  if (rateCount > 400) {
    return new Response('RATE_LIMIT_EXCEEDED', { status: 429 });
  }

  const dispatcher = DePinTaskDispatcher.getInstance();
  const encoder    = new TextEncoder();

  // ── SSE helpers ──────────────────────────────────────────────────────────────
  const sseEvent = (event: string, data: unknown) =>
    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const stream = new ReadableStream({
    async start(controller) {
      const startedAt = Date.now();
      let pingTimer: ReturnType<typeof setInterval> | null  = null;
      let taskTimer: ReturnType<typeof setInterval> | null  = null;
      let ttlTimer:  ReturnType<typeof setTimeout>  | null  = null;
      let closed = false;

      const close = () => {
        if (closed) return;
        closed = true;
        if (pingTimer) clearInterval(pingTimer);
        if (taskTimer) clearInterval(taskTimer);
        if (ttlTimer)  clearTimeout(ttlTimer);
        try { controller.close(); } catch { /* already closed */ }
      };

      // Приветственное событие с текущим балансом
      try {
        const credits = await dispatcher.getNodeCredits(nodeId);
        controller.enqueue(sseEvent('connected', { nodeId, credits, ts: Date.now() }));
      } catch {
        controller.enqueue(sseEvent('connected', { nodeId, credits: 0, ts: Date.now() }));
      }

      // Keepalive ping
      pingTimer = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(sseEvent('ping', { ts: Date.now(), elapsed: Date.now() - startedAt }));
        } catch { close(); }
      }, PING_INTERVAL_MS);

      // Задачи — пуш каждые 8 секунд
      taskTimer = setInterval(async () => {
        if (closed) return;
        try {
          const tasks = await dispatcher.acquireTasks(nodeId, 1);
          if (tasks.length > 0) {
            controller.enqueue(sseEvent('task', tasks[0]));
          } else {
            controller.enqueue(sseEvent('idle', { ts: Date.now() }));
          }
        } catch { close(); }
      }, TASK_INTERVAL_MS);

      // Принудительное закрытие через MAX_STREAM_TTL_MS
      ttlTimer = setTimeout(() => {
        try {
          controller.enqueue(sseEvent('close', { reason: 'TTL_EXPIRED', reconnect: true }));
        } catch { /* ignore */ }
        close();
      }, MAX_STREAM_TTL_MS);

      // Клиент закрыл соединение (abort signal)
      request.signal.addEventListener('abort', close);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no', // отключаем nginx буферизацию
    },
  });
}
