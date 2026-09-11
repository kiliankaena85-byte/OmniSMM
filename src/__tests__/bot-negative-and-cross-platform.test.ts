import { describe, it, expect } from "vitest";
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