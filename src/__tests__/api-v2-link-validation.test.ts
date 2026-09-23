import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/v2/route';
import { orderService } from '@/services/core/order.service';
import { db } from '@/lib/db';
import { RateLimitService } from '@/services/core/rate-limit.service';

vi.mock('@/lib/db', () => ({
  db: {
    apiRequestLog: { create: vi.fn().mockResolvedValue({}) },
    user: { 
      findFirst: vi.fn(),
      findUnique: vi.fn().mockResolvedValue({ id: 'user-123', balance: BigInt(1000000), tenantId: 'smmplan' })
    },
    service: { 
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    order: {
      findUnique: vi.fn().mockResolvedValue({ numericId: 777123 })
    }
  }
}));

vi.mock('@/lib/api-auth', () => ({
  verifyAPIKey: vi.fn().mockResolvedValue({
    id: 'user-123',
    role: 'USER',
    tenantId: 'smmplan',
    balance: BigInt(1000000)
  }),
  resolveTenantFromRequest: vi.fn().mockReturnValue('smmplan'),
  resolveContourFromHost: vi.fn().mockReturnValue('test')
}));

vi.mock('@/services/marketing.service', () => ({
  marketingService: {
    calculatePrice: vi.fn().mockResolvedValue({ totalCents: BigInt(5000), providerCostCents: BigInt(2000) })
  }
}));

vi.mock('@/services/core/order.service', () => ({
  orderService: {
    createOrder: vi.fn().mockResolvedValue({ success: true, orderId: 'order-123' })
  }
}));

vi.mock('@/services/security/security-alert.service', () => ({
  SecurityAlertService: { record: vi.fn() }
}));

describe('SEC-04: API v2 Link Validation and Sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(RateLimitService, 'checkCustomKeyDetail').mockResolvedValue({
      allowed: true,
      limit: 50,
      remaining: 49,
      resetSeconds: 60
    });
  });

  const mockService = {
    id: 'srv-1',
    numericId: 101,
    minQty: 10,
    maxQty: 10000,
    isActive: true,
    tenantId: 'smmplan',
    category: {
      id: 'cat-1',
      name: 'Telegram Followers',
      network: 'TELEGRAM',
      tenantId: 'smmplan'
    }
  };

  it('rejects dangerous javascript: protocol with 400 error', async () => {
    vi.mocked(db.service.findFirst).mockResolvedValueOnce(mockService as any);

    const formData = new FormData();
    formData.append('key', 'valid_key_123');
    formData.append('action', 'add');
    formData.append('service', '101');
    formData.append('link', 'javascript:alert(document.cookie)');
    formData.append('quantity', '100');

    const req = new NextRequest('http://localhost:3000/api/v2', {
      method: 'POST',
      body: formData
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Unsupported link protocol|Invalid URL/);
    expect(orderService.createOrder).not.toHaveBeenCalled();
  });

  it('rejects dangerous data: protocol with 400 error', async () => {
    vi.mocked(db.service.findFirst).mockResolvedValueOnce(mockService as any);

    const formData = new FormData();
    formData.append('key', 'valid_key_123');
    formData.append('action', 'add');
    formData.append('service', '101');
    formData.append('link', 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==');
    formData.append('quantity', '100');

    const req = new NextRequest('http://localhost:3000/api/v2', {
      method: 'POST',
      body: formData
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(orderService.createOrder).not.toHaveBeenCalled();
  });

  it('rejects overly long link (> 2048 chars) with 400 error', async () => {
    vi.mocked(db.service.findFirst).mockResolvedValueOnce(mockService as any);

    const longLink = 'https://t.me/' + 'a'.repeat(2050);
    const formData = new FormData();
    formData.append('key', 'valid_key_123');
    formData.append('action', 'add');
    formData.append('service', '101');
    formData.append('link', longLink);
    formData.append('quantity', '100');

    const req = new NextRequest('http://localhost:3000/api/v2', {
      method: 'POST',
      body: formData
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(orderService.createOrder).not.toHaveBeenCalled();
  });

  it('rejects cross-platform link mismatch (e.g. Instagram link for Telegram service)', async () => {
    vi.mocked(db.service.findFirst).mockResolvedValueOnce(mockService as any);

    const formData = new FormData();
    formData.append('key', 'valid_key_123');
    formData.append('action', 'add');
    formData.append('service', '101');
    formData.append('link', 'https://www.instagram.com/p/C7X30y/');
    formData.append('quantity', '100');

    const req = new NextRequest('http://localhost:3000/api/v2', {
      method: 'POST',
      body: formData
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Link format is invalid for selected service category');
    expect(orderService.createOrder).not.toHaveBeenCalled();
  });

  it('sanitizes and accepts valid telegram channel link, passing sanitized link to orderService', async () => {
    vi.mocked(db.service.findFirst).mockResolvedValueOnce(mockService as any);

    const formData = new FormData();
    formData.append('key', 'valid_key_123');
    formData.append('action', 'add');
    formData.append('service', '101');
    formData.append('link', '  t.me/durov  ');
    formData.append('quantity', '100');

    const req = new NextRequest('http://localhost:3000/api/v2', {
      method: 'POST',
      body: formData
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.order).toBe(777123);
    expect(orderService.createOrder).toHaveBeenCalledWith(
      'user-123',
      expect.objectContaining({
        link: 'https://t.me/durov',
        quantity: 100
      })
    );
  });
});
