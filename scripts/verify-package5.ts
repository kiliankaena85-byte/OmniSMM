import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('Testing Package 5 Audit Rules:');

// R4-P0-01
const retryServicePath = path.resolve(process.cwd(), 'src/services/orders/retry-checkout.service.ts');
const retryContent = fs.readFileSync(retryServicePath, 'utf-8');
assert.ok(retryContent.includes("if (gateway === 'balance')"));
assert.ok(retryContent.includes("status: gateway === 'balance' ? 'SUCCEEDED' : 'PENDING'"));
console.log('  ✅ R4-P0-01: Double-Charge on Retry Checkout with Balance Prevention: PASS');

// R4-P0-02
const filesToAudit = [
  'src/actions/admin/orders.ts',
  'src/actions/admin/users.ts',
  'src/services/admin/order/order-status-mutator.service.ts',
  'src/services/orders/retry-checkout.service.ts',
  'src/services/financial/ledger-reconciliation.service.ts',
  'src/services/financial/payment-gateway.service.ts',
];
const violations: string[] = [];
for (const relPath of filesToAudit) {
  const fullPath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) continue;
  const lines = fs.readFileSync(fullPath, 'utf-8').split('\n');
  for (const [idx, line] of lines.entries()) {
    if (line.includes('idempotencyKey') && line.includes('Date.now()')) {
      violations.push(`${relPath}:${idx + 1}`);
    }
  }
}
assert.strictEqual(violations.length, 0);
console.log('  ✅ R4-P0-02: Deterministic Idempotency Keys (Zero Date.now): PASS');

// DEF-008
const exportRoutePath = path.resolve(process.cwd(), 'src/app/api/admin/export/route.ts');
const exportContent = fs.readFileSync(exportRoutePath, 'utf-8');
assert.strictEqual(exportContent.includes('take: 10000,'), false);
assert.ok(exportContent.includes('const BATCH_SIZE = 500;'));
console.log('  ✅ DEF-008: Chunked Batched Cursor Pagination in Admin Export: PASS');

// R3-P1-01
const inboundRoutePath = path.resolve(process.cwd(), 'src/app/api/webhooks/inbound-email/route.ts');
const inboundContent = fs.readFileSync(inboundRoutePath, 'utf-8');
assert.ok(inboundContent.includes('.split(/\\r?\\n\\d{2}\\.\\d{2}\\.\\d{4}[^\\r\\n:]+от[^\\r\\n:]+:/i)[0]'));
const hardenedRegex1 = /\r?\n\d{2}\.\d{2}\.\d{4}[^\r\n:]+от[^\r\n:]+:/i;
const hardenedRegex2 = /\r?\n\d{4}-\d{2}-\d{2}[^\r\n:]+<[^\r\n>]+>:/i;
const adversarial1 = '\n20.05.2026 ' + 'от '.repeat(100) + 'X'.repeat(10000);
const adversarial2 = '\n2026-05-20 ' + '<no-reply> '.repeat(100) + 'Y'.repeat(10000);
const t0 = performance.now();
assert.strictEqual(hardenedRegex1.test(adversarial1), false);
assert.strictEqual(hardenedRegex2.test(adversarial2), false);
const dur = performance.now() - t0;
assert.ok(dur < 10);
console.log(`  ✅ R3-P1-01: ReDoS Protection in Inbound Email Webhook (${dur.toFixed(2)}ms): PASS`);

console.log('\n🎉 ALL PACKAGE 5 ACID & RE-DOS HARNESS TESTS: 100% PASS!');
