/**
 * @file test/helpers/db-cleanup.ts
 * 
 * Centralized Test DB Cleanup Utility — prevents ghost test data in catalog.
 * 
 * WHY THIS EXISTS:
 * Tests using the real smmplan_lite DB must clean up after themselves.
 * Without cleanup, ghost records (e.g. "Telegram 1788XXXXXX" networks,
 * "Sync Test Provider XXXXXXXXX") accumulate and break production UI.
 *
 * HOW TO USE:
 *   import { TestDbCleaner } from 'test/helpers/db-cleanup';
 *   const cleaner = new TestDbCleaner();
 *   afterEach(() => cleaner.cleanup());
 *   const net = cleaner.track(await db.network.create({...}), 'network');
 */

import { db } from '@/lib/db';

type EntityType =
  | 'service' | 'category' | 'network' | 'provider'
  | 'user' | 'order' | 'payment' | 'ledgerEntry'
  | 'promoCode' | 'ticket' | 'shadowService';

/** Correct deletion order (leaf → root) to respect FK constraints */
const DELETION_ORDER: EntityType[] = [
  'ledgerEntry', 'payment', 'order', 'service', 'shadowService',
  'category', 'network', 'provider', 'promoCode', 'ticket', 'user',
];

export class TestDbCleaner {
  private tracked: Array<{ id: string; type: EntityType }> = [];

  /** Track entity for cleanup. Returns entity unchanged for inline use. */
  track<T extends { id: string }>(entity: T, type: EntityType): T {
    this.tracked.push({ id: entity.id, type });
    return entity;
  }

  /** Track multiple entities of same type. */
  trackMany<T extends { id: string }>(entities: T[], type: EntityType): T[] {
    entities.forEach(e => this.tracked.push({ id: e.id, type }));
    return entities;
  }

  /** Delete all tracked entities in safe dependency order. */
  async cleanup(): Promise<void> {
    for (const entityType of DELETION_ORDER) {
      const ids = this.tracked.filter(e => e.type === entityType).map(e => e.id);
      if (ids.length === 0) continue;
      try {
        switch (entityType) {
          case 'ledgerEntry': await db.ledgerEntry.deleteMany({ where: { id: { in: ids } } }); break;
          case 'payment':     await db.payment.deleteMany({ where: { id: { in: ids } } }); break;
          case 'order':       await db.order.deleteMany({ where: { id: { in: ids } } }); break;
          case 'service':     await db.service.deleteMany({ where: { id: { in: ids } } }); break;
          case 'shadowService': await db.shadowService.deleteMany({ where: { id: { in: ids } } }); break;
          case 'category':    await db.category.deleteMany({ where: { id: { in: ids } } }); break;
          case 'network':     await db.network.deleteMany({ where: { id: { in: ids } } }); break;
          case 'provider':    await db.provider.deleteMany({ where: { id: { in: ids } } }); break;
          case 'promoCode':   await db.promoCode.deleteMany({ where: { id: { in: ids } } }); break;
          case 'ticket':      await db.ticket.deleteMany({ where: { id: { in: ids } } }); break;
          case 'user':        await db.user.deleteMany({ where: { id: { in: ids } } }); break;
        }
      } catch { /* FK cascade may have already removed it */ }
    }
    this.tracked = [];
  }

  /**
   * Static sweep — deletes ALL ghost records matching known test patterns.
   * Safe to call on smmplan_lite (only targets timestamped test slugs/names).
   */
  static async sweepGhostRecords(): Promise<{ networks: number; providers: number; categories: number }> {
    const ghostNets = await db.network.findMany({
      where: {
        OR: [
          { slug: { startsWith: 'tg-sync-' } },
          { slug: { startsWith: 'mock-net-' } },
          { slug: { startsWith: 'net-' }, name: { startsWith: 'Net ' } },
        ]
      },
      select: { id: true }
    });
    const netIds = ghostNets.map(n => n.id);

    const ghostCats = await db.category.findMany({ where: { networkId: { in: netIds } }, select: { id: true } });
    const catIds = ghostCats.map(c => c.id);

    await db.service.deleteMany({ where: { categoryId: { in: catIds } } }).catch(() => {});
    const delCats = await db.category.deleteMany({ where: { id: { in: catIds } } }).catch(() => ({ count: 0 }));
    const delNets = await db.network.deleteMany({ where: { id: { in: netIds } } }).catch(() => ({ count: 0 }));
    const delProviders = await db.provider.deleteMany({
      where: {
        OR: [
          { name: { contains: 'Sync Test Provider' } },
          { apiKey: { startsWith: 'key-sync-' } },
          { name: { contains: 'Mock Provider' } },
          { name: { contains: 'Test Provider' }, apiUrl: { contains: 'localhost' } },
        ]
      }
    }).catch(() => ({ count: 0 }));

    return { networks: delNets.count, categories: delCats.count, providers: delProviders.count };
  }
}
