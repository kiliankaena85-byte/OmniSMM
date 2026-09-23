export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { RateLimitService } from '@/services/core/rate-limit.service';
import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';

/**
 * SD-05 SECURITY FIX: Added rate limiting, event allowlist, Zod validation, and HTML sanitization.
 * Previously this endpoint had NO auth, NO rate limiting, and accepted arbitrary writes
 * to the database — a textbook DoS amplification vector.
 */

const ALLOWED_EVENTS = new Set([
  'page_view',
  'order_started',
  'order_completed',
  'payment_initiated',
  'payment_clicked',
  'service_selected',
  'category_viewed',
  'checkout_initiated',
  'link_pasted',
  'search_performed',
  'promo_applied',
  'signup',
  'login',
  'referral_click',
  'faq_opened',
]);

const MAX_METADATA_LENGTH = 2048; // 2 KB cap

// Strict Zod schema to block command/SQL injection patterns in event names & session IDs
const analyticsSchema = z.object({
  event: z.string().max(128).regex(/^[a-z0-9_]+$/i, "Event name must be alphanumeric and underscores only"),
  metadata: z.record(z.unknown()).optional().or(z.string().max(MAX_METADATA_LENGTH).optional()),
  sessionId: z.string().max(128).regex(/^[a-z0-9_-]+$/i, "Session ID must be alphanumeric, dashes, and underscores only").optional(),
}).strict();

function containsDisallowedHtml(value: unknown): boolean {
  if (typeof value === 'string') {
    if (value.includes('<') || value.includes('>') || /javascript:/i.test(value)) {
      const sanitized = sanitizeHtml(value, {
        allowedTags: [],
        allowedAttributes: {},
      });
      if (sanitized !== value) {
        return true;
      }
    }
    const sqlInjectionPattern = /(' OR '?\d+'?='?\d+'?)|(UNION\s+SELECT)|(;\s*DROP\s+TABLE)/i;
    if (sqlInjectionPattern.test(value)) {
      return true;
    }
  } else if (Array.isArray(value)) {
    return value.some(containsDisallowedHtml);
  } else if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (containsDisallowedHtml(key) || containsDisallowedHtml(obj[key])) {
        return true;
      }
    }
  }
  return false;
}

function sanitizeInput(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeHtml(value, {
      allowedTags: [],
      allowedAttributes: {},
    });
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeInput);
  }
  if (value !== null && typeof value === 'object') {
    const sanitizedObj: Record<string, unknown> = {};
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      sanitizedObj[key] = sanitizeInput(obj[key]);
    }
    return sanitizedObj;
  }
  return value;
}


/** @public Client telemetry ingestion with CSRF protection and rate limiting */
export async function POST(req: Request) {
  try {
    // CSRF Protection: Verify Origin matches Host header if present
    const origin = req.headers.get('origin');
    const host = req.headers.get('host');
    if (origin) {
      try {
        const originUrl = new URL(origin);
        if (originUrl.host !== host) {
          return NextResponse.json({ error: 'Forbidden (CSRF)' }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: 'Invalid Origin' }, { status: 400 });
      }
    }

    // SD-05 FIX 1: IP-based rate limiting lowered to 10 requests per minute
    const isAllowed = await RateLimitService.check('analytics:ip', 10, 60);
    if (!isAllowed) {
      return NextResponse.json({ success: false }, { status: 429 });
    }

    const rawBody = await req.text();

    // VULN-030: Pre-flight check to block Prototype Pollution
    if (rawBody.includes('__proto__') || rawBody.includes('constructor') || rawBody.includes('prototype')) {
      return NextResponse.json({ error: 'Malicious payload detected' }, { status: 400 });
    }

    const body = JSON.parse(rawBody);

    if (containsDisallowedHtml(body)) {
      return NextResponse.json({ error: 'Malicious payload detected' }, { status: 400 });
    }
    
    // Zod validation (blocks SQL / Command Injection indicators)
    const parsed = analyticsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { event, metadata, sessionId } = parsed.data;

    // SD-05 FIX 2: Event allowlist validation — reject unknown event types with 400 Bad Request
    if (!ALLOWED_EVENTS.has(event)) {
      return NextResponse.json({ error: 'Event name is not allowed' }, { status: 400 });
    }

    // Recursive sanitization of all inputs
    const safeEvent = sanitizeInput(event) as string;
    const safeSessionId = sessionId ? (sanitizeInput(sessionId) as string) : undefined;

    // SD-05 FIX 3: Metadata size cap and sanitization
    let safeMetadata: unknown = undefined;
    if (metadata) {
      const sanitizedMeta = sanitizeInput(metadata);
      const metadataStr = typeof sanitizedMeta === 'string' ? sanitizedMeta : JSON.stringify(sanitizedMeta);
      if (metadataStr.length > MAX_METADATA_LENGTH) {
        return NextResponse.json({ error: 'Metadata size limit exceeded' }, { status: 400 });
      }
      safeMetadata = sanitizedMeta;
    }

    await db.analyticsEvent.create({
      data: {
        event: safeEvent,
        metadata: (safeMetadata || undefined) as Prisma.InputJsonValue,
        sessionId: safeSessionId || undefined,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to log analytics event:', error);
    // Don't fail the client for general parsing errors, return generic error
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }
}
