import { describe, it, expect, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { scanDraftReply } from "@/services/admin/output-policy-engine";
import { AiObserverService } from "@/services/observer/ai-observer.service";
import { redis } from "@/lib/redis";

describe("Swarm Audit Remediation Regression Suite (2026)", () => {
  const rootDir = process.cwd();

  it("REMEDY-01: Robokassa webhook has MutexManager lock and static crypto import", () => {
    const filePath = path.join(rootDir, "src/app/api/webhooks/robokassa/route.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("MutexManager.withLock");
    expect(content).toContain("createHash");
    expect(content).not.toContain("await import('crypto')");
    expect(content).toContain("webhook:robo:event:");
  });

  it("REMEDY-02: Provider balance service has synchronized 5000ms timeout", () => {
    const filePath = path.join(rootDir, "src/services/admin/provider-balance.service.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("TIMEOUT_MS = 5000");
    expect(content).not.toContain("TIMEOUT_MS = 3000");
  });

  it("REMEDY-03: CatalogProcessor safely isolates cache revalidation errors", () => {
    const filePath = path.join(rootDir, "src/workers/processors/catalog.processor.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("safeTriggerCacheRevalidation");
  });

  it("REMEDY-04: AiObserverService killswitch fails closed on Redis errors", async () => {
    vi.spyOn(redis, "get").mockRejectedValueOnce(new Error("Redis connection refused"));
    const isKilled = await AiObserverService.isKillswitchActive();
    expect(isKilled).toBe(true);
  });

  it("REMEDY-05: OutputPolicyEngine blocks unverified monetary claims with BLOCK severity", () => {
    const violations = scanDraftReply("Мы зачислили вам 5000 ₽ в качестве компенсации.", "100.00", []);
    const financialViolation = violations.find(v => v.rule === "UNVERIFIED_FINANCIAL_CLAIM");
    expect(financialViolation).toBeDefined();
    expect(financialViolation?.severity).toBe("BLOCK");
  });

  it("REMEDY-06: AiSupportCoPilotService checks staff operator role and permissions", () => {
    const filePath = path.join(rootDir, "src/services/support/ai-copilot.service.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("staffUserId");
    expect(content).toContain("ADMIN");
    expect(content).toContain("SUPPORT");
  });
});
