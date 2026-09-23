import { describe, it, expect } from 'vitest';
import { db } from '@/lib/db';
import { VaultService } from '@/lib/vault';
import { UniversalProvider } from '@/services/providers/universal.provider';

describe('VexBoost Live Upstream Integration Suite', () => {
  it('1. Live Provider Connection & Positive Balance Verification', async () => {
    const provider = await db.provider.findFirst({
      where: { apiUrl: { contains: 'vexboost' } }
    });

    expect(provider).toBeDefined();
    expect(provider?.isActive).toBe(true);

    let apiKey = '';
    try {
      apiKey = VaultService.decrypt(provider!.apiKey);
    } catch {
      apiKey = provider!.apiKey;
    }

    const pInstance = new UniversalProvider(provider!.apiUrl, apiKey, provider!.metadata as any);
    const balanceInfo = await pInstance.getBalance();

    expect(balanceInfo).toBeDefined();
    expect(parseFloat(balanceInfo.balance)).toBeGreaterThan(0);
    expect(balanceInfo.currency).toBe('RUB');
  });

  it('2. Live Catalog Fetching & Schema Conformity', async () => {
    const provider = await db.provider.findFirst({
      where: { apiUrl: { contains: 'vexboost' } }
    });

    let apiKey = '';
    try {
      apiKey = VaultService.decrypt(provider!.apiKey);
    } catch {
      apiKey = provider!.apiKey;
    }

    const pInstance = new UniversalProvider(provider!.apiUrl, apiKey, provider!.metadata as any);
    const services = await pInstance.getServices();

    expect(Array.isArray(services)).toBe(true);
    expect(services.length).toBeGreaterThan(100);

    // Verify schema structure of live items
    const sample = services[0];
    expect(sample).toHaveProperty('service');
    expect(sample).toHaveProperty('name');
    expect(sample).toHaveProperty('rate');
    expect(sample).toHaveProperty('min');
    expect(sample).toHaveProperty('max');
  });

  it('3. Real Order Status Polling (Single & Batch Multi-Status)', async () => {
    const provider = await db.provider.findFirst({
      where: { apiUrl: { contains: 'vexboost' } }
    });

    let apiKey = '';
    try {
      apiKey = VaultService.decrypt(provider!.apiKey);
    } catch {
      apiKey = provider!.apiKey;
    }

    const pInstance = new UniversalProvider(provider!.apiUrl, apiKey, provider!.metadata as any);
    
    // Find the latest real dispatched order
    const realOrder = await db.order.findFirst({
      where: {
        externalId: { not: null },
        service: { providerId: provider!.id }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (realOrder && realOrder.externalId) {
      // Test single status
      const singleStatus = await pInstance.getOrderStatus(realOrder.externalId);
      expect(singleStatus).toBeDefined();
      expect(['Pending', 'In progress', 'Completed', 'Partial', 'Canceled', 'Processing']).toContain(singleStatus.status);

      // Test multi status
      const multiStatus = await pInstance.getMultiOrderStatus([realOrder.externalId]);
      expect(multiStatus).toBeDefined();
      const orderEntry = multiStatus[realOrder.externalId];
      expect(orderEntry).toBeDefined();
      if (typeof orderEntry === 'object' && orderEntry !== null) {
        expect(orderEntry.status).toBe(singleStatus.status);
      }
    }
  });
});
