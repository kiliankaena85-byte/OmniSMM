import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { getDripFeedFloor, validateDripFeedLimits } from "@/hooks/useOrderWizard";

describe("Wave 3: Mobile Checkout CRO & Touch Ergonomics Invariants (WCAG 2.2 AA)", () => {
  const rootDir = process.cwd();

  describe("Drip-Feed Floor Invariants (AGENTS.md Rule 4)", () => {
    it("calculates minimum total volume as minQty * runs", () => {
      expect(getDripFeedFloor(100, 5)).toBe(500);
      expect(getDripFeedFloor(250, 4)).toBe(1000);
      expect(getDripFeedFloor(10, 10)).toBe(100);
    });

    it("ensures portion per run is not below service minQty", () => {
      // 80 < 100
      const invalid = validateDripFeedLimits(80, 5, 100, 10000);
      expect(invalid.isValid).toBe(false);
      expect(invalid.error).toContain("не может быть меньше минимального");

      // 100 >= 100
      const valid = validateDripFeedLimits(100, 5, 100, 10000);
      expect(valid.isValid).toBe(true);
    });
  });

  describe("SMMplan WizardStepCheckout Touch Targets & iOS Auto-Zoom Guard", () => {
    const filePath = path.join(rootDir, "src/components/orders/wizard/WizardStepCheckout.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    it("stepper buttons have WCAG 2.2 AA compliant size (w-11 h-11 or min-w-[44px] min-h-[44px])", () => {
      expect(content).toMatch(/w-11\s+h-11|min-w-\[44px\]\s+min-h-\[44px\]/);
      expect(content).not.toMatch(/className="w-10 h-10 flex items-center justify-center/);
    });

    it("order URL, quantity, and email inputs have text-base on mobile to prevent iOS Safari auto-zoom", () => {
      expect(content).toMatch(/id="order-url"[\s\S]*?text-base\s+sm:text-sm/);
      expect(content).toMatch(/inputMode="numeric"[\s\S]*?text-base\s+sm:text-sm/);
      expect(content).toMatch(/type="email"[\s\S]*?text-base\s+sm:text-sm/);
    });

    it("auxiliary buttons have comfortable mobile touch target heights (min-h-[44px])", () => {
      expect(content).toMatch(/onBackToServices[\s\S]*?min-h-\[44px\]/);
      expect(content).toMatch(/setIsTgGuideOpen[\s\S]*?min-h-\[44px\]/);
    });
  });

  describe("SMMplan CheckoutDripFeed Touch Targets & iOS Auto-Zoom Guard", () => {
    const filePath = path.join(rootDir, "src/components/orders/wizard/sub/CheckoutDripFeed.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    it("drip-feed toggle switch label has WCAG 2.2 AA compliant touch target (min-w-[44px] min-h-[44px])", () => {
      expect(content).toMatch(/min-w-\[44px\]\s+min-h-\[44px\]/);
    });

    it("drip-feed numeric inputs have text-base on mobile and min-h-[44px]", () => {
      expect(content).toMatch(/type="number"[\s\S]*?text-base\s+sm:text-sm/);
      expect(content).toMatch(/type="number"[\s\S]*?min-h-\[44px\]/);
    });
  });

  describe("SMMflux FluxOrderClient Touch Targets & iOS Auto-Zoom Guard", () => {
    const filePath = path.join(rootDir, "src/components/ab-test/FluxOrderClient.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    it("link and quantity inputs have text-base on mobile to prevent iOS Safari auto-zoom", () => {
      expect(content).toMatch(/name="link"[\s\S]*?text-base/);
      expect(content).toMatch(/name="quantity"[\s\S]*?text-base/);
      expect(content).toMatch(/name="email"[\s\S]*?text-base/);
    });

    it("navigation back and clear buttons have touch targets >= 44px", () => {
      expect(content).toMatch(/w-11\s+h-11\s+min-w-\[44px\]\s+min-h-\[44px\]/);
    });

    it("flux drip-feed toggle switch label has touch target >= 44px", () => {
      expect(content).toMatch(/min-w-\[44px\]\s+min-h-\[44px\]/);
    });
  });
});
