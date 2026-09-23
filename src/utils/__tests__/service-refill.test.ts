import { describe, it, expect } from "vitest";
import { checkServiceRefill } from "../service-refill";

describe("checkServiceRefill", () => {
  it("should return false for services explicitly labeled without guarantee", () => {
    const srv1 = {
      name: "TG Подписчики (Без гарантии / Эконом)",
      description: "Обычные боты без гарантии и списания возможны",
      badge: "Эконом",
      isRefillEnabled: false,
    };
    expect(checkServiceRefill(srv1).hasRefill).toBe(false);

    const srv2 = {
      name: "Instagram Лайки No Refill",
      description: null,
      badge: "",
      isRefillEnabled: true, // even if flag is misconfigured, explicit name overrides
    };
    expect(checkServiceRefill(srv2).hasRefill).toBe(false);
  });

  it("should return true for services with isRefillEnabled or explicit guarantee keywords", () => {
    const srv1 = {
      name: "VK Подписчики с гарантией 30 дней",
      description: "Автоматический refill при списании",
      badge: "",
      isRefillEnabled: true,
    };
    const res1 = checkServiceRefill(srv1);
    expect(res1.hasRefill).toBe(true);
    expect(res1.badgeLabel).toBe("🛡️ Refill Гарантия");

    const srv2 = {
      name: "Telegram Живые участники (Refill 60d)",
      description: null,
      badge: "Refill 60",
      isRefillEnabled: false,
    };
    const res2 = checkServiceRefill(srv2);
    expect(res2.hasRefill).toBe(true);
    expect(res2.badgeLabel).toBe("Refill 60");
  });
});
