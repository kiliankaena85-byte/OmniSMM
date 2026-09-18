/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Test Suite: 2PC Async Order Cancellation and Escrow Protection (ADR-2026-19)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { adminOrderService } from '@/services/admin/order.service';
import { UniversalProvider } from '@/services/providers/universal.provider';
import { getStatusConfig } from '@/utils/status-helpers';

import { UniversalNetworkRouter } from '@/lib/network/network-router';

describe('ADR-2026-19: 2PC Async Order Cancellation and Escrow Protection Suite', () => {
  let testUserId: string;
  let cancelableServiceId: string;
  let nonCancelableServiceId: string;
  let providerId: string;

  beforeEach(async () => {
    // 1. Create or retrieve test user
    const email = `escrow-test-${Date.now()}@smmplan.pro`;
    const user = await db.user.create({
      data: {
        email,
        role: 'USER',
        balance: BigInt(50000), // 500.00 RUB
        totalSpent: BigInt(100000),
        tenantId: 'smmplan',
      },
    });
    testUserId = user.id;

    // 2. Create provider
    const provider = await db.provider.create({
      data: {
        name: `Vexboost_Mock_${Date.now()}`,
        apiUrl: 'https://api.vexboost.mock/v2',
        apiKey: 'test_secret_key',
        balanceCurrency: 'RUB',
        isActive: true,
      },
    });
    providerId = provider.id;

    // 3. Category
    const category = await db.category.create({
      data: {
        name: `Escrow Test Category ${Date.now()}`,
        slug: `escrow-cat-${Date.now()}`,
        tenantId: 'smmplan',
      },
    });

    // 4. Cancelable service
    const cancelableSrv = await db.service.create({
      data: {
        name: 'Telegram Subscribers [Cancelable]',
        slug: `tg-sub-cancelable-${Date.now()}`,
        categoryId: category.id,
        providerId: provider.id,
        externalId: '101',
        rate: 18.0,
        costPer1kRub: 18.0,
        pricePer1000Cents: 6000, // 60.00 RUB per 1k
        minQty: 10,
        maxQty: 1000,
        isCancelEnabled: true,
        tenantId: 'smmplan',
      },
    });
    cancelableServiceId = cancelableSrv.id;

    // 5. Non-cancelable service
    const nonCancelableSrv = await db.service.create({
      data: {
        name: 'Telegram Subscribers [Non-Cancelable]',
        slug: `tg-sub-non-cancelable-${Date.now()}`,
        categoryId: category.id,
        providerId: provider.id,
        externalId: '102',
        rate: 18.0,
        costPer1kRub: 18.0,
        pricePer1000Cents: 6000,
        minQty: 10,
        maxQty: 1000,
        isCancelEnabled: false,
        tenantId: 'smmplan',
      },
    });
    nonCancelableServiceId = nonCancelableSrv.id;
  });

  describe('1. UniversalProvider.cancelOrder API', () => {
    it('sends action: "cancel" with order id and parses successful response', async () => {
      const p = new UniversalProvider('https://api.vexboost.mock/v2', 'test_key');
      const fetchSpy = vi.spyOn(UniversalNetworkRouter, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify([{ order: 298641822, cancel: 1 }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await p.cancelOrder(298641822);
      expect(result.success).toBe(true);
      expect(fetchSpy).toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it('handles provider refusal or error gracefully', async () => {
      const p = new UniversalProvider('https://api.vexboost.mock/v2', 'test_key');
      const fetchSpy = vi.spyOn(UniversalNetworkRouter, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify([{ order: 298641822, cancel: { error: 'Order cannot be canceled' } }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await p.cancelOrder(298641822);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Order cannot be canceled');
      fetchSpy.mockRestore();
    });
  });

  describe('2. Status Helpers and Badge Styling', () => {
    it('configures CANCELING status with amber/warning badge and Russian label', () => {
      const config = getStatusConfig('CANCELING');
      expect(config.label).toBe('Отменяется');
      expect(config.badgeClass).toContain('amber');
    });
  });

  describe('3. adminOrderService.cancelOrder Lifecycle & Escrow Guard', () => {
    it('Case A: Order without externalId cancels immediately with 100% refund (safe)', async () => {
      const order = await db.order.create({
        data: {
          userId: testUserId,
          serviceId: cancelableServiceId,
          providerId,
          externalId: null, // NOT yet sent to provider
          link: 'https://t.me/testchannel',
          quantity: 10,
          charge: BigInt(60), // 0.60 RUB
          providerCost: BigInt(18),
          status: 'PENDING',
          tenantId: 'smmplan',
        },
      });

      const initialUser = await db.user.findUniqueOrThrow({ where: { id: testUserId } });
      const initialBalance = initialUser.balance;

      const res = await adminOrderService.cancelOrder(order.id, {
        id: testUserId,
        email: 'admin@smmplan.pro',
        tenantId: 'smmplan',
      });

      expect(res.status).toBe('CANCELED');
      expect(res.refundCents).toBe(60);

      const updatedOrder = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(updatedOrder.status).toBe('CANCELED');

      const updatedUser = await db.user.findUniqueOrThrow({ where: { id: testUserId } });
      expect(updatedUser.balance).toBe(initialBalance + BigInt(60));
    });

    it('Case B: Order with externalId and isCancelEnabled: false BLOCKS support cancel', async () => {
      const supportUser = await db.user.create({
        data: {
          email: `support-${Date.now()}@smmplan.pro`,
          role: 'SUPPORT',
          balance: BigInt(0),
          tenantId: 'smmplan',
        },
      });

      const order = await db.order.create({
        data: {
          userId: testUserId,
          serviceId: nonCancelableServiceId,
          providerId,
          externalId: '298641822',
          link: 'https://t.me/testchannel',
          quantity: 10,
          charge: BigInt(60),
          providerCost: BigInt(18),
          status: 'IN_PROGRESS',
          tenantId: 'smmplan',
        },
      });

      await expect(
        adminOrderService.cancelOrder(order.id, {
          id: supportUser.id,
          email: supportUser.email,
          tenantId: 'smmplan',
        })
      ).rejects.toThrow(/не поддерживает отмену/i);
    });

    it('Case C: Order with externalId and isCancelEnabled: true transitions to CANCELING without refunding user balance (Escrow Hold)', async () => {
      const order = await db.order.create({
        data: {
          userId: testUserId,
          serviceId: cancelableServiceId,
          providerId,
          externalId: '298641822',
          link: 'https://t.me/testchannel',
          quantity: 10,
          charge: BigInt(60),
          providerCost: BigInt(18),
          status: 'IN_PROGRESS',
          tenantId: 'smmplan',
        },
      });

      const initialUser = await db.user.findUniqueOrThrow({ where: { id: testUserId } });
      const initialBalance = initialUser.balance;

      // Mock provider cancelOrder
      const spy = vi.spyOn(UniversalProvider.prototype, 'cancelOrder').mockResolvedValueOnce({
        success: true,
      });

      const res = await adminOrderService.cancelOrder(order.id, {
        id: testUserId,
        email: 'admin@smmplan.pro',
        tenantId: 'smmplan',
      });

      expect(res.status).toBe('CANCELING');
      expect(res.refundCents).toBe(0); // ESCROW HOLD: 0 refund issued yet!

      const updatedOrder = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(updatedOrder.status).toBe('CANCELING');

      // Crucial: User balance must remain unchanged until provider confirms!
      const updatedUser = await db.user.findUniqueOrThrow({ where: { id: testUserId } });
      expect(updatedUser.balance).toBe(initialBalance);

      spy.mockRestore();
    });

    it('Case D: Manual or background sync transitions CANCELING -> CANCELED with refund when provider confirms cancellation', async () => {
      const order = await db.order.create({
        data: {
          userId: testUserId,
          serviceId: cancelableServiceId,
          providerId,
          externalId: '298641822',
          link: 'https://t.me/testchannel',
          quantity: 10,
          charge: BigInt(60),
          providerCost: BigInt(18),
          status: 'CANCELING',
          tenantId: 'smmplan',
        },
      });

      const initialUser = await db.user.findUniqueOrThrow({ where: { id: testUserId } });
      const initialBalance = initialUser.balance;

      const getStatusSpy = vi.spyOn(UniversalProvider.prototype, 'getOrderStatus').mockResolvedValueOnce({
        order: '298641822',
        status: 'Canceled',
        charge: '0.002',
        start_count: '0',
        remains: '10',
      });

      const syncRes = await adminOrderService.syncOrderStatusWithProvider(order.id, {
        id: testUserId,
        email: 'admin@smmplan.pro',
      });

      expect(syncRes.status).toBe('CANCELED');

      const updatedOrder = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(updatedOrder.status).toBe('CANCELED');

      // Escrow released: user gets refund
      const updatedUser = await db.user.findUniqueOrThrow({ where: { id: testUserId } });
      expect(updatedUser.balance).toBe(initialBalance + BigInt(60));

      getStatusSpy.mockRestore();
    });

    it('Case E: If provider completes order despite cancel request, CANCELING -> COMPLETED without refund (Double-drain prevented)', async () => {
      const order = await db.order.create({
        data: {
          userId: testUserId,
          serviceId: cancelableServiceId,
          providerId,
          externalId: '298641822',
          link: 'https://t.me/testchannel',
          quantity: 10,
          charge: BigInt(60),
          providerCost: BigInt(18),
          status: 'CANCELING',
          tenantId: 'smmplan',
        },
      });

      const initialUser = await db.user.findUniqueOrThrow({ where: { id: testUserId } });
      const initialBalance = initialUser.balance;

      const getStatusSpy = vi.spyOn(UniversalProvider.prototype, 'getOrderStatus').mockResolvedValueOnce({
        order: '298641822',
        status: 'Completed',
        charge: '0.018',
        start_count: '100',
        remains: '0',
      });

      const syncRes = await adminOrderService.syncOrderStatusWithProvider(order.id, {
        id: testUserId,
        email: 'admin@smmplan.pro',
      });

      expect(syncRes.status).toBe('COMPLETED');

      const updatedOrder = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(updatedOrder.status).toBe('COMPLETED');

      // Zero financial loss: customer is NOT refunded because order was delivered!
      const updatedUser = await db.user.findUniqueOrThrow({ where: { id: testUserId } });
      expect(updatedUser.balance).toBe(initialBalance);

      getStatusSpy.mockRestore();
    });
  });
});
