import { describe, it, expect, vi } from 'vitest';
import { adminOrderService } from '../order.service';
import { db } from '@/lib/db';

describe('AdminOrderService - Omni-Search & Semantic Filters', () => {
  it('should construct strict numeric query when given digits or #id', async () => {
    const spy = vi.spyOn(db.order, 'findMany').mockResolvedValue([] as any);
    const countSpy = vi.spyOn(db.order, 'count').mockResolvedValue(0);

    // Search pure number 54
    await adminOrderService.searchOrders({ query: '54' });
    expect(spy).toHaveBeenCalled();
    const lastCallArg = spy.mock.calls[spy.mock.calls.length - 1][0];
    expect(lastCallArg?.where?.OR).toEqual([
      { numericId: 54 },
      { externalId: { equals: '54' } }
    ]);

    // Search #61
    await adminOrderService.searchOrders({ query: '#61' });
    const call61Arg = spy.mock.calls[spy.mock.calls.length - 1][0];
    expect(call61Arg?.where?.OR).toEqual([
      { numericId: 61 },
      { externalId: { equals: '61' } }
    ]);

    spy.mockRestore();
    countSpy.mockRestore();
  });

  it('should construct semantic activityType filter for subscribers', async () => {
    const spy = vi.spyOn(db.order, 'findMany').mockResolvedValue([] as any);
    const countSpy = vi.spyOn(db.order, 'count').mockResolvedValue(0);

    await adminOrderService.searchOrders({ activityType: 'subscribers' });
    expect(spy).toHaveBeenCalled();
    const lastCallArg = spy.mock.calls[spy.mock.calls.length - 1][0];
    expect(lastCallArg?.where?.AND).toBeDefined();
    
    spy.mockRestore();
    countSpy.mockRestore();
  });

  it('should handle date presets like today, 7d, 30d, this_month', async () => {
    const spy = vi.spyOn(db.order, 'findMany').mockResolvedValue([] as any);
    const countSpy = vi.spyOn(db.order, 'count').mockResolvedValue(0);

    await adminOrderService.searchOrders({ datePreset: '7d' });
    expect(spy).toHaveBeenCalled();
    const lastCallArg = spy.mock.calls[spy.mock.calls.length - 1][0];
    const createdAtFilter = lastCallArg?.where?.createdAt as any;
    expect(createdAtFilter?.gte).toBeInstanceOf(Date);

    spy.mockRestore();
    countSpy.mockRestore();
  });
});
