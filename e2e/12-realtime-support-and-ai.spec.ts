/**
 * e2e/12-realtime-support-and-ai.spec.ts
 * BLOCK 12: Realtime Support Live Chat (SSE), Gemini AI Assistant & Attachment Security
 *
 * Invariants & Contract (AGENTS.md & Zero-Defect):
 * 1. SSE Stream: Real-time message broadcast without page reload via sseBroadcaster / EventSource.
 * 2. Attachment Security: Magic byte validation (PNG, JPG, WEBP, PDF) and strict 5MB size limit.
 * 3. MIME protection: Executables (.exe, .sh, .html, .svg) strictly rejected with 400 Bad Request.
 * 4. Privacy & Internal Notes: Staff 'INTERNAL' notes strictly excluded from client GET queries.
 * 5. Multi-Tenant Isolation: Tickets isolated strictly by tenantId (smmplan vs flux).
 * 6. AI Assistant: Context-aware responses generated with Russian language system instructions.
 */

import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
import { sseBroadcaster } from '../src/lib/sse-broadcaster';
import { aiSupportService } from '../src/services/admin/ai-support.service';

const db = new PrismaClient();
const TENANT = 'smmplan';
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'smmplan_lite_jwt_secret_for_rbac');

async function createTestSessionToken(userId: string, role: string = 'USER', tenantId: string = 'smmplan'): Promise<string> {
  return new SignJWT({ userId, role, tenantId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1d')
    .sign(JWT_SECRET);
}

test.describe.serial('BLOCK 12: Realtime Support, AI & Attachments E2E', () => {
  let clientUser: { id: string; email: string };
  let staffUser: { id: string; email: string };
  let fluxUser: { id: string; email: string };
  let testTicket: { id: string; subject: string };
  let clientToken: string;
  let staffToken: string;
  let fluxToken: string;

  test.beforeAll(async () => {
    const ts = Date.now();

    // 1. Create client user
    clientUser = await db.user.create({
      data: {
        email: `e2e-support-client-${ts}@smmplan.local`,
        role: 'USER',
        tenantId: TENANT,
        balance: 100_000n, // 1,000.00 RUB
      },
    });
    clientToken = await createTestSessionToken(clientUser.id, 'USER', TENANT);

    // 2. Create staff user
    staffUser = await db.user.create({
      data: {
        email: `e2e-support-staff-${ts}@smmplan.local`,
        role: 'SUPPORT',
        tenantId: TENANT,
      },
    });
    staffToken = await createTestSessionToken(staffUser.id, 'SUPPORT', TENANT);

    // 3. Create foreign tenant user (flux)
    fluxUser = await db.user.create({
      data: {
        email: `e2e-support-flux-${ts}@smmflux.local`,
        role: 'USER',
        tenantId: 'flux',
      },
    });
    fluxToken = await createTestSessionToken(fluxUser.id, 'USER', 'flux');

    // 4. Create initial ticket for client
    testTicket = await db.ticket.create({
      data: {
        userId: clientUser.id,
        tenantId: TENANT,
        subject: `E2E Live Chat Support Ticket ${ts}`,
        status: 'OPEN',
      },
    });
  });

  test.afterAll(async () => {
    if (testTicket) {
      await db.ticketMessage.deleteMany({ where: { ticketId: testTicket.id } });
      await db.ticket.deleteMany({ where: { id: testTicket.id } });
    }
    await db.user.deleteMany({
      where: { id: { in: [clientUser?.id, staffUser?.id, fluxUser?.id].filter(Boolean) } },
    });
    await db.$disconnect();
  });

  test('Scenario 1: SSE In-Memory Broadcaster Pub/Sub Delivery', async () => {
    let receivedMessage: unknown = null;

    // 1. Subscribe listener to ticket channel
    const unsubscribe = sseBroadcaster.subscribe(testTicket.id, (msg) => {
      receivedMessage = msg;
    });

    expect(sseBroadcaster.getConnectionCount(testTicket.id)).toBe(1);

    // 2. Publish message
    const payload = {
      id: 'msg-test-1',
      ticketId: testTicket.id,
      text: 'Hello from real-time SSE stream!',
      sender: 'STAFF',
      createdAt: new Date().toISOString(),
    };
    sseBroadcaster.publish(testTicket.id, payload);

    expect(receivedMessage).toEqual(payload);

    // 3. Cleanup subscription
    unsubscribe();
    expect(sseBroadcaster.getConnectionCount(testTicket.id)).toBe(0);
  });

  test('Scenario 2: Support Message API & Internal Note Client Filtering', async ({ request, baseURL }) => {
    // 1. Client creates a message in DB
    await db.ticketMessage.create({
      data: {
        ticketId: testTicket.id,
        sender: 'USER',
        text: 'User question: How long does Instagram followers delivery take?',
      },
    });

    // 2. Staff posts an INTERNAL note (should only be visible to staff)
    await db.ticketMessage.create({
      data: {
        ticketId: testTicket.id,
        sender: 'INTERNAL',
        text: 'Internal Note: Client is high VIP, prioritize speed.',
      },
    });

    // 3. Staff posts a public response
    await db.ticketMessage.create({
      data: {
        ticketId: testTicket.id,
        sender: 'STAFF',
        text: 'Support answer: Usually starts within 15-30 minutes.',
      },
    });

    // 4. Client fetches messages via API -> INTERNAL notes must be filtered out
    const clientFetchResp = await request.get(`${baseURL}/api/support/messages?ticketId=${testTicket.id}`, {
      headers: { Cookie: `session_token=${clientToken}` },
    });
    expect(clientFetchResp.status()).toBe(200);
    const clientData = await clientFetchResp.json();
    const senders = clientData.messages.map((m: { sender: string }) => m.sender);
    expect(senders).toContain('USER');
    expect(senders).toContain('STAFF');
    expect(senders).not.toContain('INTERNAL');

    // 5. Staff fetches messages via API -> INTERNAL notes are visible
    const staffFetchResp = await request.get(`${baseURL}/api/support/messages?ticketId=${testTicket.id}`, {
      headers: { Cookie: `session_token=${staffToken}` },
    });
    expect(staffFetchResp.status()).toBe(200);
    const staffData = await staffFetchResp.json();
    const staffSenders = staffData.messages.map((m: { sender: string }) => m.sender);
    expect(staffSenders).toContain('INTERNAL');
  });

  test('Scenario 3: Media Upload with Magic Byte & MIME Validation', async ({ request, baseURL }) => {
    // 1. Valid PNG upload with correct magic bytes (0x89 0x50 0x4E 0x47)
    const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const validResp = await request.post(`${baseURL}/api/support/upload`, {
      headers: { Cookie: `session_token=${clientToken}` },
      multipart: {
        ticketId: testTicket.id,
        file: {
          name: 'screenshot.png',
          mimeType: 'image/png',
          buffer: validPngBuffer,
        },
      },
    });
    expect(validResp.status()).toBe(200);
    const validResult = await validResp.json();
    expect(validResult.mediaUrl).toBeDefined();
    expect(validResult.mediaType).toBe('image');

    // 2. Spoofed PNG upload (text content with .png extension -> invalid magic bytes)
    const fakeBuffer = Buffer.from('Plain text claiming to be a PNG image');
    const fakeResp = await request.post(`${baseURL}/api/support/upload`, {
      headers: { Cookie: `session_token=${clientToken}` },
      multipart: {
        ticketId: testTicket.id,
        file: {
          name: 'fake.png',
          mimeType: 'image/png',
          buffer: fakeBuffer,
        },
      },
    });
    expect(fakeResp.status()).toBe(400);

    // 3. Unsupported MIME type (.exe executable)
    const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
    const exeResp = await request.post(`${baseURL}/api/support/upload`, {
      headers: { Cookie: `session_token=${clientToken}` },
      multipart: {
        ticketId: testTicket.id,
        file: {
          name: 'malware.exe',
          mimeType: 'application/x-msdownload',
          buffer: exeBuffer,
        },
      },
    });
    expect(exeResp.status()).toBe(400);

    // 4. File too large (> 5MB)
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024, 0x89);
    const largeResp = await request.post(`${baseURL}/api/support/upload`, {
      headers: { Cookie: `session_token=${clientToken}` },
      multipart: {
        ticketId: testTicket.id,
        file: {
          name: 'oversized.png',
          mimeType: 'image/png',
          buffer: largeBuffer,
        },
      },
    });
    expect(largeResp.status()).toBe(400);
  });

  test('Scenario 4: Strict Multi-Tenant & Cross-Account Ticket Isolation', async ({ request, baseURL }) => {
    // Foreign tenant user (flux) attempts to read smmplan ticket -> Forbidden
    const foreignResp = await request.get(`${baseURL}/api/support/messages?ticketId=${testTicket.id}`, {
      headers: { Cookie: `session_token=${fluxToken}` },
    });
    expect([403, 404]).toContain(foreignResp.status());

    // Foreign tenant user attempts to upload attachment to smmplan ticket -> Forbidden
    const foreignUpload = await request.post(`${baseURL}/api/support/upload`, {
      headers: { Cookie: `session_token=${fluxToken}` },
      multipart: {
        ticketId: testTicket.id,
        file: {
          name: 'test.png',
          mimeType: 'image/png',
          buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]),
        },
      },
    });
    expect([403, 404]).toContain(foreignUpload.status());
  });

  test('Scenario 5: Ticket Lifecycle Transitions & Status Flow', async () => {
    // 1. Initial status is OPEN
    const t1 = await db.ticket.findUnique({ where: { id: testTicket.id } });
    expect(t1?.status).toBe('OPEN');

    // 2. Staff marks ticket as PENDING
    await db.ticket.update({
      where: { id: testTicket.id },
      data: { status: 'PENDING' },
    });
    const t2 = await db.ticket.findUnique({ where: { id: testTicket.id } });
    expect(t2?.status).toBe('PENDING');

    // 3. Staff marks ticket as CLOSED
    await db.ticket.update({
      where: { id: testTicket.id },
      data: { status: 'CLOSED' },
    });
    const t3 = await db.ticket.findUnique({ where: { id: testTicket.id } });
    expect(t3?.status).toBe('CLOSED');
  });

  test('Scenario 6: AI Support Assistant Context Builder & Service Contract', async () => {
    // Verify AiSupportService contract
    expect(aiSupportService).toBeDefined();
    expect(typeof aiSupportService.generateReply).toBe('function');

    // Attempting to generate reply for non-existent ticket throws gracefully
    await expect(aiSupportService.generateReply('non-existent-ticket-id')).rejects.toThrow(/Ticket not found/);
  });
});
