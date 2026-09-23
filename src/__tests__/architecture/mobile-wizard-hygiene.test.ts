import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Mobile Wizard & Responsive Architecture Hygiene", () => {
  const rootDir = process.cwd();

  it("Header hides desktop profile/exit action pills on mobile (hidden sm:flex)", () => {
    const headerPath = path.join(rootDir, "src/components/landing/Header.tsx");
    const content = fs.readFileSync(headerPath, "utf-8");
    expect(content).toContain("hidden sm:flex items-center gap-2 sm:gap-3");
  });

  it("MobileStep4Checkout does not include selectedGateway in gateway fetch effect dependencies", () => {
    const checkoutPath = path.join(rootDir, "src/components/landing/order-engine/wizard-steps/MobileStep4Checkout.tsx");
    const content = fs.readFileSync(checkoutPath, "utf-8");
    // Verifies the mount-only dependency array for getAvailableGatewaysAction
    expect(content).toMatch(/getAvailableGatewaysAction\(\)[\s\S]*?\}, \[\]\);/);
  });

  it("MobileCheckoutGateways uses static Tailwind grid classes instead of dynamic string concatenation", () => {
    const gatewaysPath = path.join(rootDir, "src/components/landing/order-engine/wizard-steps/MobileCheckoutGateways.tsx");
    const content = fs.readFileSync(gatewaysPath, "utf-8");
    expect(content).not.toContain("sm:grid-cols-${");
    expect(content).toContain("grid-cols-2 sm:grid-cols-3");
  });

  it("MobileWizard container includes pb-28 to avoid overlap with floating MobileStickyCTA", () => {
    const wizardPath = path.join(rootDir, "src/components/landing/order-engine/MobileWizard.tsx");
    const content = fs.readFileSync(wizardPath, "utf-8");
    expect(content).toContain("pb-28");
  });

  it("MobileStep1Link obeys arch-boundary-guard line limit (<= 200 lines)", () => {
    const step1Path = path.join(rootDir, "src/components/landing/order-engine/wizard-steps/MobileStep1Link.tsx");
    const lines = fs.readFileSync(step1Path, "utf-8").split("\n");
    expect(lines.length).toBeLessThanOrEqual(200);
  });
});
