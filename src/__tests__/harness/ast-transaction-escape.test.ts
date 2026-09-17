import { describe, it, expect } from 'vitest';
import { detectTransactionEscapesAst, MakerCheckerHarness } from '../../../scripts/maker-checker-harness';
import fs from 'fs';
import path from 'path';

describe('AST Transaction Escape Detector (True AST Traversal)', () => {
  it('does NOT flag db.* in multi-function files where one function uses $transaction and another does not', () => {
    const code = `
      import { db } from '@/lib/db';

      // Unrelated read function outside transaction
      export async function getRecentOrders() {
        return await db.order.findMany({ where: { status: 'PENDING' } });
      }

      // Proper transactional function using tx
      export async function placeOrder(userId: string, amount: bigint) {
        return await db.$transaction(async (tx) => {
          const user = await tx.user.findUnique({ where: { id: userId } });
          await tx.user.update({ where: { id: userId }, data: { balance: { decrement: amount } } });
        });
      }
    `;

    const lines = code.split('\n');
    const findings = detectTransactionEscapesAst('src/services/order.service.ts', code, lines);

    expect(findings).toHaveLength(0);
  });

  it('detects transaction escape when db.* is called inside $transaction callback', () => {
    const code = `
      import { db } from '@/lib/db';

      export async function faultyCheckout(userId: string) {
        return await db.$transaction(async (tx) => {
          await tx.ledgerEntry.create({ data: { amount: -100 } });
          // ESCAPE! Used db.user instead of tx.user
          await db.user.update({ where: { id: userId }, data: { balance: 0 } });
        });
      }
    `;

    const lines = code.split('\n');
    const findings = detectTransactionEscapesAst('src/services/checkout.service.ts', code, lines);

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('BLOCKER');
    expect(findings[0].vector).toBe('Vector 2: Financial & ACID');
    expect(findings[0].message).toContain("обращение к глобальному 'db.user'");
    expect(findings[0].snippet).toContain('db.user.update');
  });

  it('detects transaction escape inside functions taking tx: PrismaTx as parameter', () => {
    const code = `
      import { db } from '@/lib/db';
      import { PrismaTx } from '@/lib/db';

      export async function writeAuditRecord(event: string, tx: PrismaTx) {
        // ESCAPE! Used db.auditLog instead of tx.auditLog
        await db.auditLog.create({ data: { event } });
      }
    `;

    const lines = code.split('\n');
    const findings = detectTransactionEscapesAst('src/services/audit.service.ts', code, lines);

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('BLOCKER');
    expect(findings[0].message).toContain("обращение к глобальному 'db.auditLog'");
    expect(findings[0].snippet).toContain('db.auditLog.create');
  });

  it('does NOT flag legitimate tx usage in functions taking tx: PrismaTx', () => {
    const code = `
      import { PrismaTx } from '@/lib/db';

      export async function writeAuditRecord(event: string, tx: PrismaTx) {
        await tx.auditLog.create({ data: { event } });
      }
    `;

    const lines = code.split('\n');
    const findings = detectTransactionEscapesAst('src/services/audit.service.ts', code, lines);

    expect(findings).toHaveLength(0);
  });

  it('detects custom named transaction callback parameters (e.g. customTx)', () => {
    const code = `
      import { db } from '@/lib/db';

      export async function executeWithCustomTx() {
        return await db.$transaction(async (customTx) => {
          await customTx.wallet.findFirst();
          // ESCAPE!
          await db.service.update({ where: { id: '1' }, data: { name: 'New' } });
        });
      }
    `;

    const lines = code.split('\n');
    const findings = detectTransactionEscapesAst('src/services/test.service.ts', code, lines);

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('BLOCKER');
    expect(findings[0].message).toContain("обращение к глобальному 'db.service'");
    expect(findings[0].message).toContain('customTx');
  });

  it('ignores test files to allow mock database queries in unit and e2e tests', () => {
    const code = `
      import { db } from '@/lib/db';

      describe('test suite', () => {
        it('tests transaction', async () => {
          await db.$transaction(async (tx) => {
            await db.user.findFirst();
          });
        });
      });
    `;

    const lines = code.split('\n');
    const findings = detectTransactionEscapesAst('src/__tests__/something.test.ts', code, lines);

    expect(findings).toHaveLength(0);
  });

  it('integrates seamlessly with MakerCheckerHarness scanFile', () => {
    const harness = new MakerCheckerHarness(process.cwd());
    const tempFilePath = path.join(process.cwd(), 'temp-escape-test.ts');

    const fileContent = `
      import { db } from '@/lib/db';

      export async function safeRead() {
        return await db.service.findMany();
      }

      export async function buggyTx() {
        return await db.$transaction(async (tx) => {
          await db.order.findUnique({ where: { id: '1' } });
        });
      }
    `;

    try {
      fs.writeFileSync(tempFilePath, fileContent, 'utf-8');
      const findings = harness.scanFile('temp-escape-test.ts');
      const escapeFindings = findings.filter((f) => f.vector.includes('Vector 2'));

      expect(escapeFindings).toHaveLength(1);
      expect(escapeFindings[0].severity).toBe('BLOCKER');
      expect(escapeFindings[0].snippet).toContain('db.order.findUnique');
    } finally {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  });

  it('detects transaction escape when using prisma alias and prisma.$transaction', () => {
    const code = `
      import { db as prisma } from '@/lib/db';

      export async function processTask() {
        return await prisma.$transaction(async (tx) => {
          await tx.task.update({ where: { id: '1' }, data: { status: 'DONE' } });
          // ESCAPE via prisma alias!
          await prisma.user.update({ where: { id: 'usr_1' }, data: { balance: 0 } });
        });
      }
    `;

    const lines = code.split('\n');
    const findings = detectTransactionEscapesAst('src/workers/task.processor.ts', code, lines);

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('BLOCKER');
    expect(findings[0].message).toContain("обращение к глобальному 'prisma.user'");
  });

  it('detects transaction escape even when wrapped in type assertions (e.g. (db as any))', () => {
    const code = `
      import { db } from '@/lib/db';

      export async function backdoorEscape() {
        return await db.$transaction(async (tx) => {
          // ESCAPE wrapped in type casting!
          await (db as any).ledgerEntry.create({ data: { amount: 100 } });
        });
      }
    `;

    const lines = code.split('\n');
    const findings = detectTransactionEscapesAst('src/services/backdoor.service.ts', code, lines);

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('BLOCKER');
    expect(findings[0].message).toContain("обращение к глобальному 'db.ledgerEntry'");
  });

  it('detects transaction escape inside runSerializableTransaction wrapper', () => {
    const code = `
      import { db } from '@/lib/db';
      import { runSerializableTransaction } from '@/lib/transactions';

      export async function executeOrder() {
        return await runSerializableTransaction(async (customClient) => {
          // ESCAPE inside transaction wrapper callback!
          await db.order.update({ where: { id: '1' }, data: { status: 'COMPLETED' } });
        });
      }
    `;

    const lines = code.split('\n');
    const findings = detectTransactionEscapesAst('src/services/order-runner.service.ts', code, lines);

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('BLOCKER');
    expect(findings[0].message).toContain("обращение к глобальному 'db.order'");
  });

  it('detects transaction escape with destructured parameter ({ tx })', () => {
    const code = `
      import { db } from '@/lib/db';
      import { PrismaTx } from '@/lib/db';

      export async function handleTx({ tx }: { tx: PrismaTx }) {
        // ESCAPE with destructured parameter!
        await db.service.findFirst();
      }
    `;

    const lines = code.split('\n');
    const findings = detectTransactionEscapesAst('src/services/destruct.service.ts', code, lines);

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('BLOCKER');
    expect(findings[0].message).toContain("обращение к глобальному 'db.service'");
  });

  it('does NOT falsely flag transaction wrapper signatures taking fn: (tx: PrismaTx) => Promise<T>', () => {
    const code = `
      import { db } from '@/lib/db';
      import { PrismaTx } from '@/lib/db';

      export async function customTransactionRunner<T>(fn: (tx: PrismaTx) => Promise<T>): Promise<T> {
        // Legitimate call on db.$transaction to run the callback
        return await db.$transaction(fn);
      }
    `;

    const lines = code.split('\n');
    const findings = detectTransactionEscapesAst('src/lib/custom-tx.ts', code, lines);

    expect(findings).toHaveLength(0);
  });
});
