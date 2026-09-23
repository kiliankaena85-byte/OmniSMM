import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { POST } from '@/app/api/v2/route';
import { NextRequest } from 'next/server';
import { revalidateTag } from 'next/cache';
import crypto from 'crypto';

import { type User, type Service } from '@prisma/client';

describe('B2B API v2: Zod & Compatibility', () => {
  let user: User;
  let service: Service;
  const rawKey = 'SUPER_SECRET_KEY_123';
  const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');

  beforeEach(async () => {
    // Relying on global setup to TRUNCATE DB
    await db.systemSettings.update({
      where: { id: 'global' },
      data: { isTestMode: true }
    });
    // @ts-expect-error: override for testing
    revalidateTag('settings');
    
    // 1. Seed user with balance
    user = await db.user.create({
      data: {
        email: `test-api-${Date.now()}@test.com`,
        apiKeyHash: hashedKey,
        balance: 500000, // 5000 RUB
      }
    });

    const category = await db.category.create({
      data: { name: 'Test API Services' }
    });

    // 2. Seed a service with fixed cost
    service = await db.service.create({
      data: {
        name: 'API Service 1',
        categoryId: category.id,
        rate: 100 / 95, // Rate in USD (1.0526 USD = 100 RUB per 1k)
        markup: 1.5, // Total cost per 1k should be 150 RUB
        minQty: 10,
        maxQty: 10000,
        isActive: true,
        numericId: 777
      }
    });
  });

  const makeRequest = async (payload: Record<string, string>) => {
    const searchParams = new URLSearchParams(payload);
    const req = new NextRequest('http://localhost/api/v2', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: searchParams
    });
    return POST(req);
  };

  it('Refuses requests without valid API key', async () => {
    const res = await makeRequest({ action: 'balance' });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('API key is required');
  });

  it('Computes services list mapping correctly (action: services)', async () => {
    const res = await makeRequest({ key: 'SUPER_SECRET_KEY_123', action: 'services' });
    expect(res.status).toBe(200);
    const data = await res.json();
    
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(1);
    expect(data[0].service).toBe(777); // the numericId
    expect(data[0].rate).toBe('467.8363'); // constrained by safety floor 3.0
  });

  it('Successfully creates order and deduces balance (action: add)', async () => {
    // 1k item at 150 RUB = 15000 cents
    const res = await makeRequest({ 
      key: 'SUPER_SECRET_KEY_123', 
      action: 'add',
      service: '777', // sent as string from PHP typically
      link: 'https://example.com',
      quantity: '1000' 
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    
    expect(data.order).toBeDefined();

    // Verify DB
    const checkDbUser = await db.user.findUnique({ where: { id: user.id } });
    expect(checkDbUser?.balance).toBe(BigInt(453216)); // Deduced 46784 cents due to safety floor 3.0
  });

  it('Loose Compatibility: Prevents attacks, but emits standard errors', async () => {
    // Sending empty string instead of number (A common B2B dirty bug)
    const res = await makeRequest({ 
      key: 'SUPER_SECRET_KEY_123', 
      action: 'add',
      service: '', // Empty service ID
      link: 'https://example.com',
      quantity: '100'
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    
    // Zod shouldn't dump its array error. It should return standard format.
    expect(data.error).toBe('Incorrect parameters');
  });

  it('Returns balance formatted as RUB (action: balance)', async () => {
    const res = await makeRequest({ key: 'SUPER_SECRET_KEY_123', action: 'balance' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.balance).toBe('5000.0000'); // 500000 cents / 100
    expect(data.currency).toBe('RUB');
  });

  it('Returns standard status for existing order (action: status)', async () => {
    // Manually create an order
    const order = await db.order.create({
      data: {
        userId: user.id,
        serviceId: service.id,
        link: 'test.com',
        quantity: 100,
        charge: 1500, // 15 RUB
        providerCost: 1000,
        numericId: 9999,
        status: 'IN_PROGRESS',
        remains: 50
      }
    });

    // Single order
    let res = await makeRequest({ key: 'SUPER_SECRET_KEY_123', action: 'status', order: '9999' });
    let data = await res.json();
    expect(data.status).toBe('In progress');
    expect(data.remains).toBe('50');
    expect(data.charge).toBe('15.0000');

    // Multiple orders
    res = await makeRequest({ key: 'SUPER_SECRET_KEY_123', action: 'status', orders: '9999,8888' });
    data = await res.json();
    expect(data['9999'].status).toBe('In progress');
    expect(data['8888'].error).toBe('Incorrect order ID');
  });

  it('Returns standard cancellation response (action: cancel)', async () => {
    const order = await db.order.create({
      data: {
        userId: user.id, serviceId: service.id, link: 'test.com', quantity: 100, charge: 1500, providerCost: 1000, numericId: 9999, status: 'IN_PROGRESS', remains: 50
      }
    });
    const res = await makeRequest({ key: 'SUPER_SECRET_KEY_123', action: 'cancel', order: '9999' });
    const data = await res.json();
    expect(data.error).toBe('Cancellation via API is not supported. Contact support.');
  });

  it('Returns error for refill without externalRefill support (action: refill)', async () => {
    const order = await db.order.create({
      data: {
        userId: user.id, serviceId: service.id, link: 'test.com', quantity: 100, charge: 1500, providerCost: 1000, numericId: 9999, status: 'IN_PROGRESS', remains: 50
      }
    });
    const res = await makeRequest({ key: 'SUPER_SECRET_KEY_123', action: 'refill', order: '9999' });
    const data = await res.json();
    // Because isRefillEnabled is false by default on the service
    expect(data.error).toBe('Refill is only available manually via support ticket for reseller platforms.');
  });
});
