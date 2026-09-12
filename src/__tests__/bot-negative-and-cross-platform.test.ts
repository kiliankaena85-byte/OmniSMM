import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/lib/db";
import { IntelligenceLinkAnalyzer } from "@/services/analyzer/link-analyzer";
import {
  isLinkServiceCompatible,
  normalizeServiceTargetType,
  normalizeLinkType,
  LinkType,
  ServiceTargetType
} from "@/constants/link-service-compatibility";
import { inferTargetTypeFromName, resolveServiceTargetType } from "@/utils/target-type-mapper";
import { BotCatalogService } from "@/bot/services/bot-catalog.service";

describe("Variant 3: Negative & Cross-Platform Bot Ordering Tests", () => {
  const analyzer = new IntelligenceLinkAnalyzer();

  beforeAll(async () => {
    // 1. Telegram
    let tgNet = await db.network.findFirst({ where: { slug: 'telegram', tenantId: 'smmplan' } });
    if (!tgNet) {
      tgNet = await db.network.create({
        data: { name: 'Telegram', slug: 'telegram', tenantId: 'smmplan', isActive: true, sort: 0 }
      });
    }
    let catTgSubs = await db.category.findFirst({ where: { name: 'Подписчики', networkId: tgNet.id } });
    if (!catTgSubs) {
      catTgSubs = await db.category.create({
        data: { name: 'Подписчики', slug: `tg-subs-${Date.now()}`, networkId: tgNet.id, tenantId: 'smmplan', sort: 0 }
      });
    }
    let sTgSubs = await db.service.findFirst({ where: { categoryId: catTgSubs.id, isActive: true } });
    if (!sTgSubs) {
      await db.service.create({
        data: { name: 'Telegram Подписчики', targetType: 'CHANNEL', categoryId: catTgSubs.id, rate: 0.5, minQty: 10, maxQty: 10000, tenantId: 'smmplan', isActive: true, isQuarantined: false }
      });
    }

    let catTgViews = await db.category.findFirst({ where: { name: 'Просмотры', networkId: tgNet.id } });
    if (!catTgViews) {
      catTgViews = await db.category.create({
        data: { name: 'Просмотры', slug: `tg-views-${Date.now()}`, networkId: tgNet.id, tenantId: 'smmplan', sort: 1 }
      });
    }
    let sTgViews = await db.service.findFirst({ where: { categoryId: catTgViews.id, targetType: 'POST', isActive: true } });
    if (!sTgViews) {
      await db.service.create({
        data: { name: 'Telegram Просмотры на пост', targetType: 'POST', categoryId: catTgViews.id, rate: 0.1, minQty: 10, maxQty: 10000, tenantId: 'smmplan', isActive: true, isQuarantined: false }
      });
    }

    // 2. VK
    let vkNet = await db.network.findFirst({ where: { slug: 'vk', tenantId: 'smmplan' } });
    if (!vkNet) {
      vkNet = await db.network.create({
        data: { name: 'ВКонтакте', slug: 'vk', tenantId: 'smmplan', isActive: true, sort: 1 }
      });
    }
    let catVkSubs = await db.category.findFirst({ where: { name: 'Подписчики в группу', networkId: vkNet.id } });
    if (!catVkSubs) {
      catVkSubs = await db.category.create({
        data: { name: 'Подписчики в группу', slug: `vk-subs-${Date.now()}`, networkId: vkNet.id, tenantId: 'smmplan', sort: 0 }
      });
    }
    let sVkSubs = await db.service.findFirst({ where: { categoryId: catVkSubs.id, isActive: true } });
    if (!sVkSubs) {
      await db.service.create({
        data: { name: 'VK Подписчики в группу', targetType: 'CHANNEL', categoryId: catVkSubs.id, rate: 0.5, minQty: 10, maxQty: 10000, tenantId: 'smmplan', isActive: true, isQuarantined: false }
      });
    }

    let catVkLikes = await db.category.findFirst({ where: { name: 'Лайки на запись', networkId: vkNet.id } });
    if (!catVkLikes) {
      catVkLikes = await db.category.create({
        data: { name: 'Лайки на запись', slug: `vk-likes-${Date.now()}`, networkId: vkNet.id, tenantId: 'smmplan', sort: 1 }
      });
    }
    let sVkLikes = await db.service.findFirst({ where: { categoryId: catVkLikes.id, isActive: true } });
    if (!sVkLikes) {
      await db.service.create({
        data: { name: 'VK Лайки на стену', targetType: 'POST', categoryId: catVkLikes.id, rate: 0.2, minQty: 10, maxQty: 10000, tenantId: 'smmplan', isActive: true, isQuarantined: false }
      });
    }

    // 3. YouTube
    let ytNet = await db.network.findFirst({ where: { slug: 'youtube', tenantId: 'smmplan' } });
    if (!ytNet) {
      ytNet = await db.network.create({
        data: { name: 'YouTube', slug: 'youtube', tenantId: 'smmplan', isActive: true, sort: 2 }
      });
    }
    let catYtViews = await db.category.findFirst({ where: { name: 'Просмотры видео', networkId: ytNet.id } });
    if (!catYtViews) {
      catYtViews = await db.category.create({
        data: { name: 'Просмотры видео', slug: `yt-views-${Date.now()}`, networkId: ytNet.id, tenantId: 'smmplan', sort: 0 }
      });
    }
    let sYtViews = await db.service.findFirst({ where: { categoryId: catYtViews.id, isActive: true } });
    if (!sYtViews) {
      await db.service.create({
        data: { name: 'YouTube Просмотры видео', targetType: 'VIDEO', categoryId: catYtViews.id, rate: 0.5, minQty: 10, maxQty: 10000, tenantId: 'smmplan', isActive: true, isQuarantined: false }
      });
    }
    let catYtSubs = await db.category.findFirst({ where: { name: 'Подписчики на канал', networkId: ytNet.id } });
    if (!catYtSubs) {
      catYtSubs = await db.category.create({
        data: { name: 'Подписчики на канал', slug: `yt-subs-${Date.now()}`, networkId: ytNet.id, tenantId: 'smmplan', sort: 1 }
      });
    }
    let sYtSubs = await db.service.findFirst({ where: { categoryId: catYtSubs.id, isActive: true } });
    if (!sYtSubs) {
      await db.service.create({
        data: { name: 'YouTube Подписчики на канал', targetType: 'CHANNEL', categoryId: catYtSubs.id, rate: 1.5, minQty: 10, maxQty: 10000, tenantId: 'smmplan', isActive: true, isQuarantined: false }
      });
    }
  });

  describe("1. Telegram Post Negative Scenarios (https://t.me/smmMarket69/123)", () => {
    const postLink = "https://t.me/smmMarket69/123";

    it("accurately detects link as TELEGRAM post", async () => {
      const analysis = await analyzer.analyze(postLink);
      expect(analysis).toBeDefined();
      expect(analysis?.platform).toBe("TELEGRAM");
      expect(analysis?.type).toBe("post");
      expect(normalizeLinkType(analysis?.type)).toBe(LinkType.POST);
    });

    it("verifies subscribers (CHANNEL) are strictly REJECTED for a post link", () => {
      const isCompatible = isLinkServiceCompatible(
        LinkType.POST,
        ServiceTargetType.CHANNEL
      );
      expect(isCompatible).toBe(false);
    });

    it("verifies package on last 5 posts (CHANNEL_POSTS) is strictly REJECTED for a post link", () => {
      // 5 last posts is for channel URL, NOT single post URL
      const isCompatible = isLinkServiceCompatible(
        LinkType.POST,
        ServiceTargetType.CHANNEL_POSTS
      );
      expect(isCompatible).toBe(false);

      // Verify with inferred target type from name
      const inferredTarget = inferTargetTypeFromName(
        "Telegram Просмотры на 5 последних постов [Пакет охвата]"
      );
      expect(inferredTarget).toBe("CHANNEL_POSTS");
      expect(
        isLinkServiceCompatible(
          "post",
          normalizeServiceTargetType(inferredTarget)
        )
      ).toBe(false);
    });

    it("verifies single post views/reactions (POST_INTERACTION) are ACCEPTED for a post link", () => {
      const isViewsCompatible = isLinkServiceCompatible(
        LinkType.POST,
        ServiceTargetType.POST_INTERACTION
      );
      expect(isViewsCompatible).toBe(true);

      const isCommentsCompatible = isLinkServiceCompatible(
        LinkType.POST,
        ServiceTargetType.COMMENTS
      );
      expect(isCommentsCompatible).toBe(true);

      const isPollCompatible = isLinkServiceCompatible(
        LinkType.POST,
        ServiceTargetType.POLL_VOTES
      );
      expect(isPollCompatible).toBe(true);
    });

    it("verifies category filtering for Telegram post link excludes Subscribers and Channel Boosts", async () => {
      const network = await BotCatalogService.findNetworkByPlatform("TELEGRAM", "smmplan");
      expect(network).toBeDefined();

      const allCategories = await BotCatalogService.getVisibleCategories(network!.id, "smmplan");
      expect(allCategories.length).toBeGreaterThan(0);

      const detectedType = "post";
      const compatibleCategories: Array<{ id: string; name: string }> = [];

      for (const c of allCategories) {
        const svcs = await BotCatalogService.getVisibleServices(c.id, "smmplan");
        const hasCompatible = svcs.some((s: { targetType?: string | null; name: string }) => {
          const rawTarget = resolveServiceTargetType(s);
          return isLinkServiceCompatible(detectedType, normalizeServiceTargetType(rawTarget));
        });
        if (hasCompatible) {
          compatibleCategories.push(c);
        }
      }

      console.log("Categories displayed for Telegram Post:", compatibleCategories.map(c => c.name));

      // Pure subscribers category (without post views/interactions) must be excluded
      const hasSubscribersCategory = compatibleCategories.some(c =>
        c.name.toLowerCase().includes("подписчик") &&
        !c.name.toLowerCase().includes("просмотр") &&
        !c.name.toLowerCase().includes("лайк") &&
        !c.name.toLowerCase().includes("реакци")
      );
      expect(hasSubscribersCategory).toBe(false);

      // Channel boosts category must be excluded
      const hasBoostsCategory = compatibleCategories.some(c =>
        c.name.toLowerCase().includes("буст")
      );
      expect(hasBoostsCategory).toBe(false);

      // Views / Reactions / Comments categories must be included
      const hasPostInteractions = compatibleCategories.some(c =>
        c.name.toLowerCase().includes("просмотр") ||
        c.name.toLowerCase().includes("реакци") ||
        c.name.toLowerCase().includes("комментар")
      );
      expect(hasPostInteractions).toBe(true);
    });
  });

  describe("2. Cross-Platform VK Scenarios (https://vk.com/wall-123456_789)", () => {
    const vkWallLink = "https://vk.com/wall-123456_789";

    it("accurately detects link as VK wall post and resolves ВКонтакте network", async () => {
      const analysis = await analyzer.analyze(vkWallLink);
      expect(analysis).toBeDefined();
      expect(analysis?.platform).toBe("VK");
      expect(analysis?.type).toBe("post");

      const network = await BotCatalogService.findNetworkByPlatform(analysis!.platform, "smmplan");
      expect(network).toBeDefined();
      expect(["vk", "vkontakte"]).toContain(network?.slug);
      expect(["ВКонтакте", "VKontakte"]).toContain(network?.name);
    });

    it("verifies VK category filtering displays post interactions (likes, views) and hides group subscribers", async () => {
      const network = await BotCatalogService.findNetworkByPlatform("VK", "smmplan");
      expect(network).toBeDefined();

      const allCategories = await BotCatalogService.getVisibleCategories(network!.id, "smmplan");
      const detectedType = "post";
      const compatibleCategories: Array<{ id: string; name: string }> = [];

      for (const c of allCategories) {
        const svcs = await BotCatalogService.getVisibleServices(c.id, "smmplan");
        const hasCompatible = svcs.some((s: { targetType?: string | null; name: string }) => {
          const rawTarget = resolveServiceTargetType(s);
          return isLinkServiceCompatible(detectedType, normalizeServiceTargetType(rawTarget));
        });
        if (hasCompatible) {
          compatibleCategories.push(c);
        }
      }

      console.log("Categories displayed for VK Wall Post:", compatibleCategories.map(c => c.name));

      // Must exclude subscribers/members
      const hasSubs = compatibleCategories.some(c => c.name.toLowerCase().includes("подписчик") || c.name.toLowerCase().includes("участник"));
      expect(hasSubs).toBe(false);

      // Must include likes / views / reposts
      const hasPostServices = compatibleCategories.some(c =>
        c.name.toLowerCase().includes("лайк") ||
        c.name.toLowerCase().includes("просмотр") ||
        c.name.toLowerCase().includes("репост")
      );
      expect(hasPostServices).toBe(true);
    });
  });

  describe("3. Cross-Platform YouTube Scenarios (https://www.youtube.com/watch?v=dQw4w9WgXcQ)", () => {
    const ytVideoLink = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

    it("accurately detects link as YOUTUBE video and resolves YouTube network", async () => {
      const analysis = await analyzer.analyze(ytVideoLink);
      expect(analysis).toBeDefined();
      expect(analysis?.platform).toBe("YOUTUBE");
      expect(analysis?.type).toBe("video");

      const network = await BotCatalogService.findNetworkByPlatform(analysis!.platform, "smmplan");
      expect(network).toBeDefined();
      expect(network?.slug).toBe("youtube");
      expect(network?.name).toBe("YouTube");
    });

    it("verifies YouTube category filtering displays video interactions and hides channel subscribers", async () => {
      const network = await BotCatalogService.findNetworkByPlatform("YOUTUBE", "smmplan");
      expect(network).toBeDefined();

      const allCategories = await BotCatalogService.getVisibleCategories(network!.id, "smmplan");
      const detectedType = "video";
      const compatibleCategories: Array<{ id: string; name: string }> = [];

      for (const c of allCategories) {
        const svcs = await BotCatalogService.getVisibleServices(c.id, "smmplan");
        const hasCompatible = svcs.some((s: { targetType?: string | null; name: string }) => {
          const rawTarget = resolveServiceTargetType(s);
          return isLinkServiceCompatible(detectedType, normalizeServiceTargetType(rawTarget));
        });
        if (hasCompatible) {
          compatibleCategories.push(c);
        }
      }

      console.log("Categories displayed for YouTube Video:", compatibleCategories.map(c => c.name));

      // Must exclude pure channel subscribers (without video/shorts/likes interactions)
      const hasChannelSubs = compatibleCategories.some(c =>
        c.name.toLowerCase().includes("подписчик") &&
        !c.name.toLowerCase().includes("лайк") &&
        !c.name.toLowerCase().includes("просмотр") &&
        !c.name.toLowerCase().includes("shorts")
      );
      expect(hasChannelSubs).toBe(false);

      // Must include video views / likes
      const hasVideoInteractions = compatibleCategories.some(c =>
        c.name.toLowerCase().includes("просмотр") || c.name.toLowerCase().includes("лайк")
      );
      expect(hasVideoInteractions).toBe(true);
    });
  });
});