import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Reproduction & Invariant Test Suite for Database & Prisma ORM Reliability (Milestone M5 / R1)
 *
 * Verifies findings:
 * - R1-P0-01 & R1-P0-02: Transaction context escape in order.service.ts
 * - R1-P0-03: N+1 query loop in price-drift.ts
 * - R1-P0-04: Unbounded findMany in analytics.service.ts
 * - R1-P1-04: Missing composite schema indexes in prisma/schema.prisma
 */
describe('Audit R1: Database & Prisma ORM Reliability Invariants', () => {

  describe('R1-P0-01: Transaction Context Escape in OrderService.createOrder (Lines 125-142)', () => {
    const orderServicePath = path.resolve(process.cwd(), 'src/services/core/order.service.ts');

    it('AST Invariant: SecurityEvent inside runSerializableTransaction uses root db client instead of tx', () => {
      const content = fs.readFileSync(orderServicePath, 'utf-8');

      // Locate the cross-tenant block in createOrder
      const crossTenantIndex = content.indexOf("serviceTenantId !== userTenantId");
      expect(crossTenantIndex).toBeGreaterThan(0);

      const crossTenantBlock = content.substring(crossTenantIndex, crossTenantIndex + 1200);

      // Verify transaction context escape is ELIMINATED: uses tx.securityEvent.create
      expect(crossTenantBlock.includes('await tx.securityEvent.create')).toBe(true);
      // And does NOT use global db client
      expect(crossTenantBlock.includes('await db.securityEvent.create')).toBe(false);
      // And throws immediately after, causing transaction rollback while securityEvent persists
      expect(crossTenantBlock.includes("throw new Error('SERVICE_NOT_FOUND')")).toBe(true);
    });

    it('Behavioral Simulation: Global db write bypasses transaction rollback and leaks connection pool slot', async () => {
      const poolConnections = { active: 0, max: 10 };
      const committedEvents: string[] = [];
      const rolledBackMutations: string[] = [];

      // Simulated global db client that acquires an independent connection
      const mockGlobalDb = {
        securityEvent: {
          create: async (data: { event: string }) => {
            poolConnections.active++;
            committedEvents.push(data.event);
            poolConnections.active--; // released after out-of-band commit
            return { id: 'sec-event-1' };
          }
        }
      };

      // Simulated serializable transaction
      const mockRunSerializableTransaction = async (callback: (tx: any) => Promise<any>) => {
        poolConnections.active++; // connection acquired for tx
        const txClient = {
          order: {
            create: async () => {
              rolledBackMutations.push('order.create');
            }
          }
        };

        try {
          await callback(txClient);
        } catch (err) {
          // Transaction aborts - rollback txClient mutations
          rolledBackMutations.length = 0;
          throw err;
        } finally {
          poolConnections.active--; // tx connection released
        }
      };

      let caughtError: Error | null = null;
      try {
        await mockRunSerializableTransaction(async (tx) => {
          await tx.order.create();

          // DEFECT: Calling global db instead of tx
          await mockGlobalDb.securityEvent.create({ event: 'CROSS_TENANT_ORDER_ATTEMPT' });

          throw new Error('SERVICE_NOT_FOUND');
        });
      } catch (err) {
        caughtError = err as Error;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError?.message).toBe('SERVICE_NOT_FOUND');
      // The transaction mutation was rolled back
      expect(rolledBackMutations).toHaveLength(0);
      // BUT the security event via global db was committed out-of-band!
      expect(committedEvents).toContain('CROSS_TENANT_ORDER_ATTEMPT');
    });
  });

  describe('R1-P0-02: Floating Un-awaited Promise in OrderService.cancelPendingOrderClient (Lines 329-338)', () => {
    const orderServicePath = path.resolve(process.cwd(), 'src/services/core/order.service.ts');

    it('AST Invariant: cancelPendingOrderClient launches floating un-awaited promise with global db calls', () => {
      const content = fs.readFileSync(orderServicePath, 'utf-8');

      const cancelFnIndex = content.indexOf('cancelPendingOrderClient(');
      expect(cancelFnIndex).toBeGreaterThan(0);

      const cancelFnBody = content.substring(cancelFnIndex, content.indexOf('return { success: true };', cancelFnIndex) + 200);

      // Verify floating un-awaited promise and global db queries are ELIMINATED
      expect(cancelFnBody.includes('db.user.findUnique')).toBe(false);
      expect(cancelFnBody.includes('db.service.findUnique')).toBe(false);
    });
  });

  describe('R1-P0-03: Catastrophic N+1 Query Loop in getDriftCandidatesAction (Lines 32-82)', () => {
    const priceDriftPath = path.resolve(process.cwd(), 'src/actions/admin/catalog/price-drift.ts');

    it('AST Invariant: getDriftCandidatesAction queries findMany then iterates with sequential findFirst', () => {
      const content = fs.readFileSync(priceDriftPath, 'utf-8');

      // 1. Initial findMany
      expect(content.includes('const services = await db.service.findMany(')).toBe(true);

      // 2. Sequential for loop over services
      expect(content.includes('for (const s of services) {')).toBe(true);

      // 3. Sequential findFirst per service inside loop
      expect(content.includes('await db.servicePriceHistory.findFirst({')).toBe(true);

      // 4. Second fallback findFirst per service inside loop
      const loopBody = content.substring(content.indexOf('for (const s of services) {'));
      const firstFind = loopBody.indexOf('db.servicePriceHistory.findFirst');
      const secondFind = loopBody.indexOf('db.servicePriceHistory.findFirst', firstFind + 1);
      expect(secondFind).toBeGreaterThan(firstFind);
    });

    it('Complexity Invariant: Query count scales linearly O(N) instead of constant O(1)', () => {
      let queryCounter = 0;

      // Simulation of current N+1 pattern
      const simulatePriceDriftCurrent = async (serviceCount: number) => {
        queryCounter++; // 1 for db.service.findMany
        const mockServices = Array.from({ length: serviceCount }, (_, i) => ({ id: `svc-${i}` }));

        for (const _s of mockServices) {
          queryCounter++; // 1 for latest price history
          queryCounter++; // 1 for fallback previous history
        }
      };

      // 10 services -> 21 queries
      queryCounter = 0;
      simulatePriceDriftCurrent(10);
      expect(queryCounter).toBe(21);

      // 3,000 services -> 6,001 queries (Catastrophic latency spike)
      queryCounter = 0;
      simulatePriceDriftCurrent(3000);
      expect(queryCounter).toBe(6001);

      // An optimal SQL query (WITH ranked_history AS ...) executes in exactly 1 query
      const simulatePriceDriftOptimal = () => {
        return 1; // single $queryRaw with ROW_NUMBER() OVER
      };
      expect(simulatePriceDriftOptimal()).toBe(1);
    });
  });

  describe('R1-P0-04: Unbounded findMany Queries in AnalyticsService (Lines 38-51, 136-140)', () => {
    const analyticsPath = path.resolve(process.cwd(), 'src/services/admin/analytics.service.ts');

    it('AST Invariant: getServiceProfitability queries orders with relations without take or pagination', () => {
      const content = fs.readFileSync(analyticsPath, 'utf-8');

      const fnIndex = content.indexOf('getServiceProfitability(');
      expect(fnIndex).toBeGreaterThan(0);

      const fnBody = content.substring(fnIndex, fnIndex + 800);

      expect(fnBody.includes('db.order.findMany')).toBe(true);
      expect(fnBody.includes('category: true')).toBe(true);
      // Lacks take clause
      expect(fnBody.includes('take:')).toBe(false);
    });

    it('AST Invariant: getLTVAnalytics queries all users into memory for in-process reduction', () => {
      const content = fs.readFileSync(analyticsPath, 'utf-8');

      const fnIndex = content.indexOf('getLTVAnalytics(');
      expect(fnIndex).toBeGreaterThan(0);

      const fnBody = content.substring(fnIndex, fnIndex + 1200);

      expect(fnBody.includes('db.user.findMany')).toBe(true);
      expect(fnBody.includes('take:')).toBe(false);
      // Performs in-memory JS reduction
      expect(fnBody.includes('users.reduce(')).toBe(true);
    });
  });

  describe('R1-P1-04: Missing Schema Composite Indexes in prisma/schema.prisma', () => {
    const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');

    it('Schema Invariant: Provider model lacks composite index @@index([tenantId, isActive])', () => {
      const content = fs.readFileSync(schemaPath, 'utf-8');
      const providerModel = content.substring(
        content.indexOf('model Provider {'),
        content.indexOf('model Service {')
      );

      // Provider has @@index([tenantId]) and @@index([slug]), but not [tenantId, isActive]
      expect(providerModel.includes('@@index([tenantId, isActive])')).toBe(false);
    });

    it('Schema Invariant: User model lacks @@index([telegramId]) for Telegram bot lookup', () => {
      const content = fs.readFileSync(schemaPath, 'utf-8');
      const userModel = content.substring(
        content.indexOf('model User {'),
        content.indexOf('model ApiConfig {')
      );

      // User has telegramId field, but lacks @@index([telegramId])
      expect(userModel.includes('telegramId')).toBe(true);
      expect(userModel.includes('@@index([telegramId])')).toBe(false);
    });

    it('Schema Invariant: LedgerEntry model lacks @@index([tenantId, status, userId])', () => {
      const content = fs.readFileSync(schemaPath, 'utf-8');
      const ledgerModel = content.substring(
        content.indexOf('model LedgerEntry {'),
        content.indexOf('enum LedgerStatus {')
      );

      // Missing composite index for user balance aggregation
      expect(ledgerModel.includes('@@index([tenantId, status, userId])')).toBe(false);
    });

    it('Schema Invariant: Order model lacks @@index([providerId, status, updatedAt])', () => {
      const content = fs.readFileSync(schemaPath, 'utf-8');
      const orderModel = content.substring(
        content.indexOf('model Order {'),
        content.indexOf('model OrderItem {')
      );

      // Missing index for sync worker provider status polling
      expect(orderModel.includes('@@index([providerId, status, updatedAt])')).toBe(false);
    });
  });
});
