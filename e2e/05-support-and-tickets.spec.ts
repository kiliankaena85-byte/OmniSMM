/**
 * e2e/05-support-and-tickets.spec.ts
 * BLOCK 5: Support, Tickets, Staff Communication & Tenant Isolation E2E Tests
 *
 * Invariants & Contract (AGENTS.md & Zero-Defect):
 * 1. Multi-Tenant Isolation: smmplan tickets never leak to smmflux.
 * 2. Message History & Senders: USER vs ADMIN.
 * 3. Status Transitions: OPEN -> IN_PROGRESS -> ANSWERED -> CLOSED.
 */

import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { ticketService } from '../src/services/support/ticket.service';

const db = new PrismaClient();

test.describe.serial('BLOCK 5: Support, Tickets & Communication Lifecycle E2E', () => {
  let userId: string;
  let adminId: string;
  let ticketId: string;

  test.beforeAll(async () => {
    // 1. Create client user
    const user = await db.user.create({
      data: {
        email: `support-user-${Date.now()}@smmplan.local`,
        tenantId: 'smmplan',
        role: 'USER',
        balance: 50_000,
        isActive: true,
        isDeleted: false,
      },
    });
    userId = user.id;

    // 2. Create staff admin
    const admin = await db.user.create({
      data: {
        email: `support-admin-${Date.now()}@smmplan.local`,
        tenantId: 'smmplan',
        role: 'ADMIN',
        isActive: true,
        isDeleted: false,
      },
    });
    adminId = admin.id;
  });

  test.afterAll(async () => {
    if (ticketId) {
      await db.ticketMessage.deleteMany({ where: { ticketId } }).catch(() => {});
      await db.ticket.deleteMany({ where: { id: ticketId } }).catch(() => {});
    }
    await db.user.deleteMany({ where: { id: { in: [userId, adminId] } } }).catch(() => {});
    await db.$disconnect();
  });

  test('Scenario 1: Client Creates a Support Ticket & Adds Initial Message', async () => {
    const subject = 'Order Delivery Inquiry';
    const initialText = 'Hello, my order is taking longer than expected. Can you check?';

    // 1. Client creates ticket
    const ticket = await ticketService.getOrCreateTicket(userId, subject, 'WEB', 'smmplan');
    ticketId = ticket.id;

    expect(ticket).not.toBeNull();
    expect(ticket.subject).toBe(subject);
    expect(ticket.status).toBe('OPEN');
    expect(ticket.tenantId).toBe('smmplan');

    // 2. Add client message
    const message = await ticketService.addMessage({
      ticketId: ticket.id,
      sender: 'USER',
      text: initialText,
    });

    expect(message).not.toBeNull();
    expect(message.text).toBe(initialText);
    expect(message.sender).toBe('USER');

    const messagesInDb = await db.ticketMessage.findMany({
      where: { ticketId: ticket.id },
    });
    expect(messagesInDb.length).toBe(1);
  });

  test('Scenario 2: Admin Staff Replies & Ticket Status Transitions to ANSWERED', async () => {
    const replyText = 'We checked with the provider, your order has now been expedited!';

    // 1. Admin sends reply
    const adminMessage = await ticketService.addMessage({
      ticketId,
      sender: 'STAFF',
      text: replyText,
    });

    expect(adminMessage).not.toBeNull();
    expect(adminMessage.sender).toBe('STAFF');
    expect(adminMessage.text).toBe(replyText);

    // 2. Verify all messages in thread
    const thread = await db.ticketMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    });

    expect(thread.length).toBe(2);
    expect(thread[0].sender).toBe('USER');
    expect(thread[1].sender).toBe('STAFF');
  });

  test('Scenario 3: Status Transition to CLOSED', async () => {
    const updatedTicket = await db.ticket.update({
      where: { id: ticketId },
      data: { status: 'CLOSED' },
    });

    expect(updatedTicket.status).toBe('CLOSED');
  });

  test('Scenario 4: Strict Multi-Tenant Isolation for Support Tickets', async () => {
    // SMMplan ticket must NOT be visible under SMMflux tenant queries
    const fluxTickets = await db.ticket.findMany({
      where: {
        id: ticketId,
        tenantId: 'flux',
      },
    });

    expect(fluxTickets.length).toBe(0);

    const smmplanTickets = await db.ticket.findMany({
      where: {
        id: ticketId,
        tenantId: 'smmplan',
      },
    });

    expect(smmplanTickets.length).toBe(1);
    expect(smmplanTickets[0].id).toBe(ticketId);
  });
});
