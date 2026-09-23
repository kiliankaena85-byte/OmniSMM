import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { orderService } from "@/services/core/order.service";
import { WalletOps } from "@/services/financial/wallet-ops";
import { isLinkServiceCompatible, normalizeServiceTargetType } from "@/constants/link-service-compatibility";
import { IntelligenceLinkAnalyzer } from "@/services/analyzer/link-analyzer";

describe("Bot Real Order Execution Flow", () => {
  let createdOrderId: string | null = null;

  afterAll(async () => {
    if (createdOrderId) {
      await db.order.deleteMany({ where: { id: createdOrderId } }).catch(() => {});
    }
  });

  let testNetworkId: string;
  let testSubsCatId: string;
  let testViewsCatId: string;
  let testSubsServiceId: string;
  let testS5ServiceId: string;

  beforeAll(async () => {
    let network = await db.network.findFirst({
      where: { slug: 'telegram', tenantId: 'smmplan' }
    });
    if (!network) {
      network = await db.network.create({
        data: {
          name: 'Telegram',
          slug: 'telegram',
          tenantId: 'smmplan',
          isActive: true,
          sort: 0,
        }
      });
    }
    testNetworkId = network.id;

    let catSubs = await db.category.findFirst({
      where: { name: { contains: 'Подписчик' }, networkId: network.id }
    });
    if (!catSubs) {
      catSubs = await db.category.create({
        data: {
          name: 'Подписчики',
          slug: `telegram-subs-${Date.now()}`,
          networkId: network.id,
          tenantId: 'smmplan',
          sort: 0,
        }
      });
    }
    testSubsCatId = catSubs.id;

    let catViews = await db.category.findFirst({
      where: { name: { contains: 'Просмотр' }, networkId: network.id }
    });
    if (!catViews) {
      catViews = await db.category.create({
        data: {
          name: 'Просмотры',
          slug: `telegram-views-${Date.now()}`,
          networkId: network.id,
          tenantId: 'smmplan',
          sort: 1,
        }
      });
    }
    testViewsCatId = catViews.id;

    let sSubs = await db.service.findFirst({
      where: { name: { contains: 'Подписчики' }, categoryId: testSubsCatId, isActive: true }
    });
    if (!sSubs) {
      sSubs = await db.service.create({
        data: {
          name: 'Telegram Подписчики',
          targetType: 'CHANNEL',
          categoryId: testSubsCatId,
          rate: 0.5,
          minQty: 10,
          maxQty: 10000,
          tenantId: 'smmplan',
          isActive: true
        }
      });
    }
    testSubsServiceId = sSubs.id;

    let s5 = await db.service.findFirst({
      where: { name: { contains: '5 последних постов' }, categoryId: testViewsCatId, isActive: true }
    });
    if (!s5) {
      s5 = await db.service.create({
        data: {
          name: 'Telegram Просмотры на 5 последних постов',
          targetType: 'CHANNEL_POSTS',
          categoryId: testViewsCatId,
          rate: 0.5,
          minQty: 10,
          maxQty: 10000,
          tenantId: 'smmplan',
          isActive: true
        }
      });
    }
    testS5ServiceId = s5.id;
  });

  it("verifies link compatibility for telegram channel and channel-posts services", async () => {
    const { resolveServiceTargetType } = await import("@/utils/target-type-mapper");
    const link = "https://t.me/smmMarket69";
    const analyzer = new IntelligenceLinkAnalyzer();
    const analysis = await analyzer.analyze(link);
    expect(analysis?.type).toBe("channel");
    expect(analysis?.platform).toBe("TELEGRAM");

    // Service: 5 последних постов
    const s5 = await db.service.findUnique({
      where: { id: testS5ServiceId }
    });
    expect(s5).toBeDefined();
    expect(["CHANNEL_POSTS", "POST"]).toContain(s5?.targetType);
    const expectedLinkType = s5?.targetType === 'POST' ? 'post' : 'channel';
    expect(isLinkServiceCompatible(expectedLinkType, normalizeServiceTargetType(s5?.targetType))).toBe(true);

    // Service: Подписчики
    const sSubs = await db.service.findUnique({
      where: { id: testSubsServiceId }
    });
    expect(sSubs).toBeDefined();
    const resolvedSubsTarget = resolveServiceTargetType(sSubs!);
    expect(isLinkServiceCompatible("channel", normalizeServiceTargetType(resolvedSubsTarget))).toBe(true);
  });

  it("successfully creates a real bot order without SYSTEM_HALT or LINK_SERVICE_MISMATCH", async () => {
    // 1. Resolve user or create if missing
    let tgUser = await db.user.findFirst({
      where: { telegramId: "1382446520" }
    });
    if (!tgUser) {
      tgUser = await db.user.create({
        data: {
          telegramId: "1382446520",
          email: "tg_test_1382446520@smmplan.pro",
          role: "USER",
          balance: BigInt(50000),
          tenantId: "smmplan",
        }
      });
    }
    expect(tgUser).toBeDefined();

    // Ensure balance
    if (Number(tgUser!.balance) < 500) {
      await db.$transaction(async (tx) => {
        await WalletOps.adminAdjust(
          tx,
          tgUser!.id,
          5000,
          "Test balance for bot order verification",
          { adminId: "admin-system-test" }
        );
      });
    }

    const testLink = "https://t.me/smmMarket69";
    const res = await orderService.createOrder(tgUser!.id, {
      serviceId: testSubsServiceId,
      link: testLink,
      quantity: 100,
      charge: 500, // 5.00 RUB in cents
      providerCost: 150,
      runs: 1,
      interval: 0,
    });

    expect(res.success).toBe(true);
    expect(res.orderId).toBeDefined();
    createdOrderId = res.orderId!;
    expect(res.error).toBeUndefined();

    // Verify order in database
    const orderInDb = await db.order.findUnique({
      where: { id: res.orderId }
    });
    expect(orderInDb).toBeDefined();
    expect(orderInDb?.link).toBe(testLink);
    expect(orderInDb?.quantity).toBe(100);
    expect(orderInDb?.charge).toBe(BigInt(500));
  });

  it("verifies that category filtering selects only compatible categories for a channel link", async () => {
    const { BotCatalogService } = await import("@/bot/services/bot-catalog.service");
    const { isLinkServiceCompatible, normalizeServiceTargetType } = await import("@/constants/link-service-compatibility");
    const { resolveServiceTargetType } = await import("@/utils/target-type-mapper");

    const network = await BotCatalogService.findNetworkByPlatform("TELEGRAM", "smmplan");
    expect(network).toBeDefined();

    const allCategories = await BotCatalogService.getVisibleCategories(network!.id, "smmplan");
    expect(allCategories.length).toBeGreaterThan(0);

    const detectedType = "channel";
    const compatibleCategories: Array<{ id: string; name: string }> = [];

    for (const c of allCategories) {
      const svcs = await BotCatalogService.getVisibleServices(c.id, "smmplan");
      const hasCompatible = svcs.some((s: { targetType?: string | null; name: string }) => {
        const resolvedTarget = resolveServiceTargetType(s);
        return isLinkServiceCompatible(detectedType, normalizeServiceTargetType(resolvedTarget));
      });
      if (hasCompatible) {
        compatibleCategories.push(c);
      }
    }

    // Must include "Подписчики"
    const hasSubscribersCategory = compatibleCategories.some(c => c.name.includes("Подписчик"));
    expect(hasSubscribersCategory).toBe(true);

    console.log("Filtered categories for channel link:", compatibleCategories.map(c => c.name));
  });
});