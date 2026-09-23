import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { checkWebhookHealth } from '@/lib/alerts/webhook-health';
import { reconcileStalePayments } from '../payment-reconciliation';
import { reportPaymentIssueAction } from '@/actions/customer/payment-issue';
import * as ssrfGuard from '@/lib/security/ssrf-guard';
import * as sessionModule from '@/lib/session';

describe('PREM-03: Silent Checkout Failure & Payment Reconciliation', () => {
  let testUserId: string;

  beforeEach(async () => {
    vi.restoreAllMocks();
    const user = await db.user.upsert({
      where: { email_tenantId: { email: 'recon_test@smmplan.local', tenantId: 'smmplan' } },
      create: { email: 'recon_test@smmplan.local', tenantId: 'smmplan' },
      update: {},
    });
    testUserId = user.id;
    vi.spyOn(sessionModule, 'verifySession').mockResolvedValue({ userId: testUserId } as any);
  });

  describe('Webhook Health Monitor', () => {
    it('detects healthy state when succeeded payments exist in the hour', async () => {
      await db.payment.create({
        data: {
          userId: testUserId,
          amount: BigInt(50000),
          status: 'SUCCEEDED',
          gateway: 'yookassa',
          gatewayId: `yoo-succ-${Date.now()}-${Math.random()}`,
          createdAt: new Date(),
        },
      });

      const res = await checkWebhookHealth();
      expect(res.healthy).toBe(true);
      expect(res.alertSent).toBe(false);
    });

    it('flags silent failure when multiple payments are pending and 0 succeeded in the hour', async () => {
      // Create 3 pending payments within the last hour
      for (let i = 0; i < 3; i++) {
        await db.payment.create({
          data: {
            userId: testUserId,
            amount: BigInt(10000),
            status: 'PENDING',
            gateway: 'yookassa',
            gatewayId: `yoo-pending-${i}-${Date.now()}-${Math.random()}`,
            createdAt: new Date(Date.now() - 10 * 60 * 1000),
          },
        });
      }

      const res = await checkWebhookHealth();
      expect(res.pendingCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Payment Reconciliation Worker', () => {
    it('reconciles succeeded status from gateway and confirms payment', async () => {
      const payment = await db.payment.create({
        data: {
          userId: testUserId,
          amount: BigInt(30000),
          status: 'PENDING',
          gateway: 'yookassa',
          gatewayId: `yoo-recon-test-${Date.now()}-${Math.random()}`,
          createdAt: new Date(Date.now() - 40 * 60 * 1000), // 40 mins ago
        },
      });

      // Mock safeFetch returning succeeded payment
      vi.spyOn(ssrfGuard, 'safeFetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          status: 'succeeded',
          amount: { value: '300.00', currency: 'RUB' },
        }), { status: 200 })
      );

      const report = await reconcileStalePayments();
      expect(report.scanned).toBeGreaterThanOrEqual(1);

      const updated = await db.payment.findUnique({ where: { id: payment.id } });
      expect(updated?.status).toBe('SUCCEEDED');
    });

    it('reconciles canceled status from gateway and updates payment status', async () => {
      const payment = await db.payment.create({
        data: {
          userId: testUserId,
          amount: BigInt(20000),
          status: 'PENDING',
          gateway: 'yookassa',
          gatewayId: `yoo-recon-cancel-${Date.now()}-${Math.random()}`,
          createdAt: new Date(Date.now() - 45 * 60 * 1000), // 45 mins ago
        },
      });

      // Mock safeFetch returning canceled payment
      vi.spyOn(ssrfGuard, 'safeFetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          status: 'canceled',
          amount: { value: '200.00', currency: 'RUB' },
        }), { status: 200 })
      );

      await reconcileStalePayments();

      const updated = await db.payment.findUnique({ where: { id: payment.id } });
      expect(updated?.status).toBe('CANCELED');
    });
  });

  describe('Customer Self-Service Action: reportPaymentIssueAction', () => {
    it('returns immediate resolution if payment is already SUCCEEDED', async () => {
      const payment = await db.payment.create({
        data: {
          userId: testUserId,
          amount: BigInt(15000),
          status: 'SUCCEEDED',
          gateway: 'yookassa',
          gatewayId: `yoo-issue-succ-${Date.now()}-${Math.random()}`,
        },
      });

      const res = await reportPaymentIssueAction(payment.id);
      expect(res.success).toBe(true);
      expect(res.resolvedNow).toBe(true);
    });

    it('creates support ticket when payment is pending and unresolved', async () => {
      const payment = await db.payment.create({
        data: {
          userId: testUserId,
          amount: BigInt(25000),
          status: 'PENDING',
          gateway: 'yookassa',
          gatewayId: `yoo-issue-ticket-${Date.now()}-${Math.random()}`,
        },
      });

      // Mock safeFetch returning still pending
      vi.spyOn(ssrfGuard, 'safeFetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          status: 'pending',
          amount: { value: '250.00', currency: 'RUB' },
        }), { status: 200 })
      );

      const res = await reportPaymentIssueAction(payment.id);
      expect(res.success).toBe(true);
      expect(res.ticketId).toBeDefined();

      const ticket = await db.ticket.findUnique({
        where: { id: res.ticketId! },
        include: { messages: true },
      });
      expect(ticket).not.toBeNull();
      expect(ticket?.tags).toContain('PAYMENT');
      expect(ticket?.tags).toContain('URGENT');
    });
  });
});
