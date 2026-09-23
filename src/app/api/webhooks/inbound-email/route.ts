import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ticketService } from '@/services/support/ticket.service';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { SettingsProvider } from '@/lib/settings';
import { getMimeType } from '@/lib/mime';
import { RateLimitService } from '@/services/core/rate-limit.service';

export const dynamic = 'force-dynamic';

function slugifyFileName(name: string): string {
  // Extract base and extension separately
  const extIndex = name.lastIndexOf('.');
  let base = extIndex !== -1 ? name.substring(0, extIndex) : name;
  const ext = extIndex !== -1 ? name.substring(extIndex + 1) : '';

  // Safe slugify map for Russian (Cyrillic) to Latin characters
  const charMap: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
    'я': 'ya',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo', 'Ж': 'Zh',
    'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O',
    'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts',
    'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu',
    'Я': 'Ya'
  };

  // Convert Cyrillic to Latin
  base = base.split('').map(char => charMap[char] || char).join('');

  // Replace invalid filename characters with hyphens
  base = base
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!base) {
    base = 'attachment';
  }

  // Cap base length to fit path limits
  base = base.substring(0, 50);

  return ext ? `${base}.${ext.toLowerCase()}` : base;
}

export async function POST(req: NextRequest) {
  try {
    const isAllowed = await RateLimitService.check('inboundEmailWebhook', 30, 60);
    if (!isAllowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const webhookSecret = await SettingsProvider.getInboundEmailWebhookSecret();
    if (!webhookSecret) {
      console.error('[CRITICAL] Inbound email webhook secret is not configured. Rejecting request.');
      return NextResponse.json({ error: 'Inbound email webhook not configured' }, { status: 503 });
    }

    // 1. Content Length Check to prevent memory exhaustion DoS (OOM)
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) { // 10MB limit
      console.error('[CRITICAL] Webhook request body too large (Content-Length). Rejected to prevent OOM.');
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }

    // Streaming body consumption to protect against spoofed Content-Length header DoS (OOM mitigation)
    let rawBody = '';
    const bodyStream = req.body;
    if (!bodyStream) {
      console.error('[CRITICAL] Webhook request body stream is null or unavailable.');
      return NextResponse.json({ error: 'Request body unavailable' }, { status: 400 });
    }

    const reader = bodyStream.getReader();
    const decoder = new TextDecoder('utf-8');
    let totalBytes = 0;
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.length;
          if (totalBytes > 10 * 1024 * 1024) { // 10MB Hard Limit
            console.error('[CRITICAL] Webhook request body too large during stream consumption (spoof protection). Rejected.');
            reader.releaseLock();
            return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
          }
          rawBody += decoder.decode(value, { stream: true });
        }
      }
      rawBody += decoder.decode(); // flush remaining bytes
    } catch (streamError) {
      console.error('Error reading webhook body stream:', streamError);
      reader.releaseLock();
      return NextResponse.json({ error: 'Failed to read request stream' }, { status: 400 });
    }

    // 2. Replay attack protection (timestamp verification)
    const timestampHeader = req.headers.get('x-webhook-timestamp') || 
                            req.headers.get('x-postmark-timestamp') || 
                            req.headers.get('x-timestamp');
    if (timestampHeader) {
      const timestampMs = isNaN(Number(timestampHeader)) 
        ? Date.parse(timestampHeader) 
        : Number(timestampHeader);
        
      if (!isNaN(timestampMs)) {
        const ageSeconds = Math.abs(Date.now() - timestampMs) / 1000;
        if (ageSeconds > 300) { // 5 minutes window (replay attack mitigation)
          console.error('[CRITICAL] Webhook request expired (replay protection check failed).');
          return NextResponse.json({ error: 'Webhook request expired (replay protection)' }, { status: 400 });
        }
      }
    }

    // SD-10 SECURITY FIX: Content-hash idempotency guard.
    // Prevents replay attacks even when no timestamp header is present.
    // Uses SHA-256 hash of the raw body stored in Redis with 5-min TTL.
    const { redis } = await import('@/lib/redis');
    const bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');
    const idempotencyKey = `inbound-email:dedup:${bodyHash}`;
    const isDuplicate = await redis.set(idempotencyKey, '1', 'EX', 300, 'NX');
    if (!isDuplicate) {
      // NX returns null if key already exists → this is a duplicate
      console.warn('[Inbound Email] Duplicate webhook payload rejected (idempotency guard).');
      return NextResponse.json({ success: true, deduplicated: true });
    }

    // 3. HMAC or direct token webhook signature validation (C3)
    if (webhookSecret) {
      const signature = req.headers.get('x-webhook-signature') || 
                        req.headers.get('x-postmark-secret') || 
                        req.headers.get('authorization');
                        
      if (!signature) {
        console.error('[CRITICAL] Webhook authorization/signature header missing.');
        return NextResponse.json({ error: 'Signature header missing' }, { status: 401 });
      }

      // Strip Bearer prefix if sent in Authorization header
      let cleanSig = signature.trim();
      if (cleanSig.toLowerCase().startsWith('bearer ')) {
        cleanSig = cleanSig.substring(7).trim();
      }

      // Normalise signature to strip standard prefixes (e.g. "sha256=", "sha256-") and lowercase
      let normalisedSignature = cleanSig;
      if (normalisedSignature.startsWith('sha256=')) {
        normalisedSignature = normalisedSignature.substring(7);
      } else if (normalisedSignature.startsWith('sha256-')) {
        normalisedSignature = normalisedSignature.substring(7);
      }
      normalisedSignature = normalisedSignature.toLowerCase();

      // Check 1: Direct secret match (timing-safe comparison to prevent side-channel leaks)
      let isDirectMatch = false;
      try {
        const sigBuffer = Buffer.from(cleanSig, 'utf-8');
        const secretBuffer = Buffer.from(webhookSecret, 'utf-8');
        if (sigBuffer.length === secretBuffer.length) {
          isDirectMatch = crypto.timingSafeEqual(sigBuffer, secretBuffer);
        }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        // Safe ignore
      }

      // Check 2: HMAC SHA-256 validation (timing-safe comparison of lowercase hex hash)
      let isHmacMatch = false;
      try {
        const computedHmac = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
        const sigBuffer = Buffer.from(normalisedSignature, 'utf-8');
        const computedBuffer = Buffer.from(computedHmac, 'utf-8');
        if (sigBuffer.length === computedBuffer.length) {
          isHmacMatch = crypto.timingSafeEqual(sigBuffer, computedBuffer);
        }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        // Safe fallback if matching fails
      }

      if (!isDirectMatch && !isHmacMatch) {
        let extractedFrom = 'unknown';
        let extractedTicketId = 'unknown';
        try {
          const tempBody = JSON.parse(rawBody);
          extractedFrom = tempBody.From || tempBody.from || 'unknown';
          const toAddress = tempBody.To || tempBody.to || '';
          const match = toAddress.match(/support\+(.+)@/i);
          if (match) extractedTicketId = match[1];
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
          // ignore parsing error
        }

        console.error(`[CRITICAL] [ACTION REQUIRED] Webhook validation failed. Possible lost email from customer. Signature mismatch. Sender: ${extractedFrom}, TicketID: ${extractedTicketId}`);
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
    }

    const body = JSON.parse(rawBody);
    
    // Support Postmark, Cloudflare Email Worker, SendGrid, Mailgun, and generic JSON formats
    const parseAddressString = (addr: any): string => {
      if (!addr) return '';
      if (typeof addr === 'string') return addr;
      if (Array.isArray(addr)) return addr.map(a => (typeof a === 'string' ? a : (a.address || a.email || ''))).join(', ');
      if (typeof addr === 'object') return addr.address || addr.email || addr.value || '';
      return String(addr);
    };

    const toAddress = parseAddressString(body.To || body.to || body.recipient || '');
    const fromAddress = parseAddressString(body.From || body.from || body.sender || '');
    const subject = body.Subject || body.subject || '';
    let textBody = body.TextBody || body.text || body.plain || body.body || '';
    const htmlBody = body.HtmlBody || body.html || '';

    // Extract pure email from From address: "John Doe" <john@example.com> -> john@example.com
    const extractEmail = (addr: string): string => {
      const match = addr.match(/<([^>]+)>/);
      return (match ? match[1] : addr).trim().toLowerCase();
    };

    const extractName = (addr: string): string | undefined => {
      const match = addr.match(/^"?([^"<]+)"?\s*</);
      if (match && match[1].trim()) return match[1].trim();
      return undefined;
    };

    const extractedFrom = extractEmail(fromAddress);
    const extractedFromName = body.FromName || body.fromName || extractName(fromAddress);

    if (!extractedFrom || !extractedFrom.includes('@')) {
      console.error(`[CRITICAL] Inbound email webhook failed: Invalid or missing From address. From: "${fromAddress}"`);
      return NextResponse.json({ error: 'Invalid From address' }, { status: 400 });
    }

    // ── STEP A: Check if this email is a reply to an existing ticket ──
    let targetTicketId: string | null = null;

    // 1. Direct support+<ticketId>@domain in To
    const toMatch = toAddress.match(/support\+([a-zA-Z0-9_-]+)@/i);
    if (toMatch) {
      targetTicketId = toMatch[1];
    }

    // 2. Check Subject for [#<ticketId>] or [TICK-<ticketId>] or [Тикет #<ticketId>]
    if (!targetTicketId && subject) {
      const subjectMatch = subject.match(/\[(?:Тикет\s*#?|TICK-|#)?([a-zA-Z0-9]{15,32})\]/i);
      if (subjectMatch) {
        targetTicketId = subjectMatch[1];
      }
    }

    // Comprehensive email reply stripping (removes quoted history for English and Russian clients)
    textBody = textBody.split(/\r?\nOn .+ wrote:/i)[0]            // English generic
                       .split(/\r?\n> /)[0]                      // Standard quote
                       .split('--- \r\n')[0]                     // Standard dashes
                       .split(/\r?\n--- Исходное сообщение ---/i)[0] // Mail.ru / Yandex
                       .split(/\r?\n-------- Пересылаемое сообщение --------/i)[0] // Mail.ru forwarding
                       .split(/\r?\n\d{2}\.\d{2}\.\d{4}.+от.+:/i)[0] // Yandex date format (e.g. 20.05.2026, 12:54 от...)
                       .split(/\r?\n\d{4}-\d{2}-\d{2}.+<.+>:/i)[0] // Alternate Yandex date format
                       .trim();

    if (!textBody && htmlBody) {
      // Fallback: strip basic html tags if plain text is empty
      textBody = htmlBody.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                         .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                         .replace(/<[^>]+>/g, ' ')
                         .replace(/\s+/g, ' ')
                         .trim();
    }

    if (!textBody) {
      textBody = '[Пустое сообщение]';
    }

    // Process and save attachments
    const rawAttachments = body.Attachments || body.attachments || [];
    const attachmentsToSave: Array<{ url: string; type: string; mimeType: string; name: string; size?: number }> = [];

    const saveIncomingAttachments = async (folderId: string) => {
      const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'zip', 'csv']);
      for (const att of rawAttachments) {
        const content = att.Content || att.content || att.data; // base64
        const originalName = att.Name || att.name || att.filename || 'attachment';
        const mimeType = att.ContentType || att.contentType || getMimeType(originalName);
        
        if (content) {
          try {
            const buffer = Buffer.from(content, 'base64');
            const cleanName = slugifyFileName(originalName);
            
            const extIndex = cleanName.lastIndexOf('.');
            const baseName = extIndex !== -1 ? cleanName.substring(0, extIndex) : cleanName;
            const rawExt = extIndex !== -1 ? cleanName.substring(extIndex + 1) : 'bin';
            const actualExt = ALLOWED_EXTENSIONS.has(rawExt.toLowerCase()) ? rawExt.toLowerCase() : 'bin';
            
            const fileName = `${baseName}-${crypto.randomBytes(6).toString('hex')}.${actualExt}`;
            
            const uploadBase = path.resolve(process.cwd(), 'private', 'uploads', 'tickets');
            const dir = path.resolve(uploadBase, folderId);
            
            if (!dir.startsWith(uploadBase)) {
              console.error(`[CRITICAL] Path traversal attempt blocked! Dir: ${dir}, Base: ${uploadBase}`);
              continue;
            }
            
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(path.join(dir, fileName), buffer);
            
            const fileUrl = `/tickets/${folderId}/${fileName}`;
            let extractedType = 'document';
            if (mimeType.startsWith('image/')) extractedType = 'image';
            else if (mimeType.startsWith('video/')) extractedType = 'video';
            else if (mimeType.startsWith('audio/')) extractedType = 'audio';
            
            attachmentsToSave.push({
              url: fileUrl,
              type: extractedType,
              mimeType,
              name: originalName,
              size: buffer.length
            });
          } catch (fsError) {
            console.error(`[CRITICAL] File system write failed for attachment ${originalName}:`, fsError);
          }
        }
      }
    };

    // ── CASE 1: Appending to an existing ticket ──
    if (targetTicketId) {
      const ticket = await db.ticket.findUnique({
        where: { id: targetTicketId },
        include: { user: true }
      });

      if (ticket) {
        // Verify sender authorization
        if (ticket.user.email && extractedFrom !== ticket.user.email.toLowerCase()) {
          console.warn(`[Inbound Email] Sender ${extractedFrom} does not match ticket owner ${ticket.user.email}. Creating separate message with note.`);
        }

        await saveIncomingAttachments(ticket.id);

        await ticketService.addMessage(
          ticket.id, 
          'USER', 
          textBody, 
          undefined, 
          undefined, 
          undefined, 
          undefined, 
          attachmentsToSave
        );

        return NextResponse.json({ success: true, ticketId: ticket.id, action: 'appended' });
      }
    }

    // ── CASE 2: Creating a NEW Ticket from direct customer email ──
    const tenantId = toAddress.toLowerCase().includes('flux') ? 'flux' : 'smmplan';
    const tempFolderId = `temp-${crypto.randomBytes(8).toString('hex')}`;
    await saveIncomingAttachments(tempFolderId);

    const newTicket = await ticketService.createInboundEmailTicket({
      fromEmail: extractedFrom,
      fromName: extractedFromName,
      toEmail: toAddress,
      subject: subject || 'Новое обращение по Email',
      text: textBody,
      html: htmlBody,
      tenantId,
      attachments: attachmentsToSave
    });

    return NextResponse.json({ 
      success: true, 
      ticketId: newTicket.id, 
      action: 'created',
      tenantId 
    });
  } catch (e) {
    console.error('[Inbound Email Webhook] Error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

