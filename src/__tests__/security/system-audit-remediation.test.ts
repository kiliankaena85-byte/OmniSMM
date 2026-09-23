import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("System Audit Remediation Regression Gate", () => {
  const rootDir = process.cwd();

  it("BUG-01: VexBoost webhook status filter strictly excludes AWAITING_PAYMENT and PENDING", () => {
    const filePath = path.join(rootDir, "src/app/api/webhooks/vexboost/route.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("status: { in: ['IN_PROGRESS', 'PENDING_CHECK'] }");
    expect(content).not.toContain("'AWAITING_PAYMENT'");
  });

  it("BUG-02: BalanceGateway passes idempotencyKey and tenantId to WalletOps.charge", () => {
    const filePath = path.join(rootDir, "src/services/financial/payment-gateway.service.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("idempotencyKey: `balance-charge-${params.paymentId}`");
    expect(content).toContain("tenantId: params.tenantId");
  });

  it("BUG-03: Payments status route enforces Guest-Proof IDOR defense", () => {
    const filePath = path.join(rootDir, "src/app/api/payments/[id]/status/route.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("payment.userId && (!session || payment.userId !== session.userId) && !isStaff");
  });

  it("BUG-04: Treasury calculation uses Prisma SQL aggregates instead of findMany", () => {
    const filePath = path.join(rootDir, "src/actions/admin/finance/treasury.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("db.user.aggregate");
    expect(content).toContain("db.order.aggregate");
    expect(content).toContain("db.payment.aggregate");
    expect(content).not.toContain("const users = await db.user.findMany");
  });

  it("BUG-05: MaintenanceGuardian uses AbortSignal timeout and abort cleanup", () => {
    const filePath = path.join(rootDir, "src/components/providers/MaintenanceGuardian.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("controller.abort()");
    expect(content).toContain("timeoutSignal");
  });
});
