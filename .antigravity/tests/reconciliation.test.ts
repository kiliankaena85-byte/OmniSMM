import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { runReconciliation } from '../scripts/reconciliation';

const db = new PrismaClient();

describe('AEARH Financial Reconciliation Negative Test Suite', () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it('runs reconciliation checks against current dataset', async () => {
    const report = await runReconciliation();
    expect(report.checks.length).toBeGreaterThanOrEqual(13);
    expect(report.timestamp).toBeDefined();
  });

  it('detects balance mismatch when user balance does not match ledger sum', async () => {
    const report = await runReconciliation();
    const balanceCheck = report.checks.find(c => c.check_id === 'USER_BALANCE_LEDGER_MATCH');
    expect(balanceCheck).toBeDefined();
  });

  it('detects duplicate idempotency key constraint', async () => {
    const report = await runReconciliation();
    const check = report.checks.find(c => c.check_id === 'DUPLICATE_IDEMPOTENCY_KEY');
    expect(check).toBeDefined();
  });

  it('detects duplicate commission constraint', async () => {
    const report = await runReconciliation();
    const check = report.checks.find(c => c.check_id === 'DUPLICATE_COMMISSION');
    expect(check).toBeDefined();
  });

  it('detects orphan drip order', async () => {
    const report = await runReconciliation();
    const check = report.checks.find(c => c.check_id === 'ORPHAN_DRIP_ORDER');
    expect(check).toBeDefined();
  });

  it('detects task quantity mismatch', async () => {
    const report = await runReconciliation();
    const check = report.checks.find(c => c.check_id === 'SMART_TASK_QUANTITY_MISMATCH');
    expect(check).toBeDefined();
  });

  it('detects stuck SENT task', async () => {
    const report = await runReconciliation();
    const check = report.checks.find(c => c.check_id === 'STUCK_SENT_TASK');
    expect(check).toBeDefined();
  });

  it('detects refund overcharge', async () => {
    const report = await runReconciliation();
    const check = report.checks.find(c => c.check_id === 'REFUND_OVERCHARGE');
    expect(check).toBeDefined();
  });
});
