import { describe, it, expect } from "vitest";
import { aiCatalogEnricherService } from "../ai-catalog-enricher.service";

describe("aiCatalogEnricherService", () => {
  it("should generate standardized fallback output when API key is not present or mocked", async () => {
    const res = await aiCatalogEnricherService.enrichService({
      name: "[1042] Telegram Members - [Real / HQ] [Speed 10k/d] [30 Days Refill]",
      description: "Fast start 0-15m, real users",
      categoryName: "Подписчики",
      networkName: "Telegram",
      isRefillEnabled: true,
      minQty: 10,
      maxQty: 50000,
    });

    expect(res.cleanTitle).toContain("Telegram:");
    expect(res.isRefillConfirmed).toBe(true);
    expect(res.badge).toContain("Refill");
    expect(res.targetType).toBe("CHANNEL");
    expect(res.fullDescriptionMarkdown).toContain("Старт:");
  });

  it("should correctly handle non-guaranteed low quality services", async () => {
    const res = await aiCatalogEnricherService.enrichService({
      name: "Instagram Likes (No Refill / Cheap)",
      description: "Cheap bots without refill",
      categoryName: "Лайки",
      networkName: "Instagram",
      isRefillEnabled: false,
      minQty: 50,
      maxQty: 100000,
    });

    expect(res.cleanTitle).toContain("Instagram:");
    expect(res.isRefillConfirmed).toBe(false);
    expect(res.targetType).toBe("POST");
    expect(res.fullDescriptionMarkdown.toLowerCase()).toContain("без гарантии");
  });
});
