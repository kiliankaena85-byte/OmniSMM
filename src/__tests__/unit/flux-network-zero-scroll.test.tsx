// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import fs from "fs";
import path from "path";
import type { FluxNetwork } from "@/types/flux";
import {
  resolveNetworkIcon,
  isMonochromeIcon,
  isTop6Network,
  getTop6Rank,
  matchesTaxonomy,
  matchesNetworkSearch,
} from "@/components/ab-test/flux-steps/flux-network-helpers";
import { FluxStepNetwork } from "@/components/ab-test/flux-steps/FluxStepNetwork";

const mockNetworks: FluxNetwork[] = [
  { id: "1", name: "Telegram", slug: "telegram" },
  { id: "2", name: "ВКонтакте", slug: "vkontakte" },
  { id: "3", name: "YouTube", slug: "youtube" },
  { id: "4", name: "Instagram", slug: "instagram" },
  { id: "5", name: "TikTok", slug: "tiktok" },
  { id: "6", name: "Rutube", slug: "rutube" },
  { id: "7", name: "Twitch", slug: "twitch" },
  { id: "8", name: "Discord", slug: "discord" },
  { id: "9", name: "WhatsApp", slug: "whatsapp" },
  { id: "10", name: "Viber", slug: "viber" },
  { id: "11", name: "Pikabu", slug: "pikabu" },
  { id: "12", name: "Behance", slug: "behance" },
  { id: "13", name: "GitHub", slug: "github" },
  { id: "14", name: "Spotify", slug: "spotify" },
  { id: "15", name: "Kick", slug: "kick" },
  { id: "16", name: "Snapchat", slug: "snapchat" },
  { id: "17", name: "Trovo", slug: "trovo" },
  { id: "18", name: "Дзен", slug: "yandex-dzen" },
];

describe("High-Density Zero-Scroll Catalog & Contrast System (BGS-2026)", () => {
  describe("Helper Functions & Brand Icon Resolver", () => {
    it("should resolve correct brand SVG paths with fallback", () => {
      expect(resolveNetworkIcon({ id: "1", name: "Telegram", slug: "telegram" })).toBe("/brands/telegram.svg");
      expect(resolveNetworkIcon({ id: "2", name: "VKontakte", slug: "vkontakte" })).toBe("/brands/vk.svg");
      expect(resolveNetworkIcon({ id: "10", name: "Viber", slug: "viber" })).toBe("/brands/viber.svg");
      expect(resolveNetworkIcon({ id: "11", name: "Pikabu", slug: "pikabu" })).toBe("/brands/pikabu.svg");
      expect(resolveNetworkIcon({ id: "12", name: "Behance", slug: "behance" })).toBe("/brands/behance.svg");
      expect(resolveNetworkIcon({ id: "15", name: "Kick", slug: "kick" })).toBe("/brands/kick.svg");
      expect(resolveNetworkIcon({ id: "16", name: "Snapchat", slug: "snapchat" })).toBe("/brands/snapchat.svg");
      expect(resolveNetworkIcon({ id: "17", name: "Trovo", slug: "trovo" })).toBe("/brands/trovo.svg");
      expect(resolveNetworkIcon({ id: "99", name: "Unknown Net", slug: "nonexistent-net" })).toBe("/brands/generic.svg");
    });

    it("should identify monochrome icons and protect multi-letter words with letter x", () => {
      expect(isMonochromeIcon({ id: "13", name: "GitHub", slug: "github" })).toBe(true);
      expect(isMonochromeIcon({ id: "19", name: "Threads", slug: "threads" })).toBe(true);
      expect(isMonochromeIcon({ id: "20", name: "X (Twitter)", slug: "x" })).toBe(true);
      expect(isMonochromeIcon({ id: "21", name: "Twitter", slug: "twitter" })).toBe(true);
      expect(isMonochromeIcon({ id: "22", name: "Medium", slug: "medium" })).toBe(true);

      // Must NOT falsely flag networks containing the letter 'x'
      expect(isMonochromeIcon({ id: "18", name: "Яндекс Дзен", slug: "yandex-dzen" })).toBe(false);
      expect(isMonochromeIcon({ id: "23", name: "Max", slug: "max" })).toBe(false);
      expect(isMonochromeIcon({ id: "1", name: "Telegram", slug: "telegram" })).toBe(false);
      expect(isMonochromeIcon({ id: "3", name: "YouTube", slug: "youtube" })).toBe(false);
    });

    it("should detect Top-6 CIS networks and rank them accurately", () => {
      const tg = { id: "1", name: "Telegram", slug: "telegram" };
      const vk = { id: "2", name: "ВКонтакте", slug: "vk" };
      const yt = { id: "3", name: "YouTube", slug: "youtube" };
      const ig = { id: "4", name: "Instagram", slug: "instagram" };
      const tt = { id: "5", name: "TikTok", slug: "tiktok" };
      const rt = { id: "6", name: "Rutube", slug: "rutube" };
      const dis = { id: "8", name: "Discord", slug: "discord" };

      expect(isTop6Network(tg)).toBe(true);
      expect(isTop6Network(vk)).toBe(true);
      expect(isTop6Network(yt)).toBe(true);
      expect(isTop6Network(ig)).toBe(true);
      expect(isTop6Network(tt)).toBe(true);
      expect(isTop6Network(rt)).toBe(true);
      expect(isTop6Network(dis)).toBe(false);

      expect(getTop6Rank(tg)).toBe(1);
      expect(getTop6Rank(vk)).toBe(2);
      expect(getTop6Rank(yt)).toBe(3);
      expect(getTop6Rank(ig)).toBe(4);
      expect(getTop6Rank(tt)).toBe(5);
      expect(getTop6Rank(rt)).toBe(6);
      expect(getTop6Rank(dis)).toBe(99);
    });

    it("should correctly resolve multi-lingual Russian and abbreviation searches", () => {
      const yt = { id: "3", name: "YouTube", slug: "youtube" };
      const tg = { id: "1", name: "Telegram", slug: "telegram" };
      const vk = { id: "2", name: "ВКонтакте", slug: "vkontakte" };
      const ig = { id: "4", name: "Instagram", slug: "instagram" };
      const tt = { id: "5", name: "TikTok", slug: "tiktok" };
      const tw = { id: "7", name: "Twitch", slug: "twitch" };

      expect(matchesNetworkSearch(yt, "ютуб")).toBe(true);
      expect(matchesNetworkSearch(yt, "yt")).toBe(true);
      expect(matchesNetworkSearch(tg, "телега")).toBe(true);
      expect(matchesNetworkSearch(tg, "тг")).toBe(true);
      expect(matchesNetworkSearch(vk, "вк")).toBe(true);
      expect(matchesNetworkSearch(ig, "инста")).toBe(true);
      expect(matchesNetworkSearch(tt, "тт")).toBe(true);
      expect(matchesNetworkSearch(tw, "твич")).toBe(true);
      expect(matchesNetworkSearch(tw, "ютуб")).toBe(false);
    });

    it("should correctly filter networks by taxonomy chips", () => {
      const tg = { id: "1", name: "Telegram", slug: "telegram" };
      const yt = { id: "3", name: "YouTube", slug: "youtube" };
      const vk = { id: "2", name: "ВКонтакте", slug: "vkontakte" };
      const tw = { id: "7", name: "Twitch", slug: "twitch" };

      expect(matchesTaxonomy(tg, "messengers")).toBe(true);
      expect(matchesTaxonomy(tg, "video")).toBe(false);

      expect(matchesTaxonomy(yt, "video")).toBe(true);
      expect(matchesTaxonomy(yt, "social")).toBe(false);

      expect(matchesTaxonomy(vk, "social")).toBe(true);

      expect(matchesTaxonomy(tw, "streams_music")).toBe(true);
      expect(matchesTaxonomy(tw, "messengers")).toBe(false);

      expect(matchesTaxonomy(tg, "all")).toBe(true);
    });
  });

  describe("Brand Vector SVG Integrity & Contrast Hardening", () => {
    it("should ensure behance.svg is a valid vector file (> 100 bytes)", () => {
      const filePath = path.resolve(process.cwd(), "public/brands/behance.svg");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf8");
      expect(content.length).toBeGreaterThan(100);
      expect(content).toContain("<svg");
      expect(content).toContain("M16.969");
    });

    it("should ensure viber.svg is the authentic brand logo, not generic placeholder", () => {
      const filePath = path.resolve(process.cwd(), "public/brands/viber.svg");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf8");
      expect(content).toContain("<svg");
      expect(content).not.toContain("circle cx=\"12\" cy=\"12\" r=\"10\" stroke=\"#3b82f6\"");
      expect(content).toContain("M11.4 0C9.473");
    });

    it("should ensure pikabu.svg is the authentic brand logo, not generic placeholder", () => {
      const filePath = path.resolve(process.cwd(), "public/brands/pikabu.svg");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf8");
      expect(content).toContain("<svg");
      expect(content).not.toContain("circle cx=\"12\" cy=\"12\" r=\"10\" stroke=\"#3b82f6\"");
      expect(content).toContain("#6DCD5B");
    });

    it("should ensure kick.svg has black background badge for high contrast (>= 14:1)", () => {
      const filePath = path.resolve(process.cwd(), "public/brands/kick.svg");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf8");
      expect(content).toContain("<rect");
      expect(content).toContain('fill="#000000"');
      expect(content).toContain('fill="#53FC18"');
    });

    it("should ensure snapchat.svg has official yellow badge and black-outlined white ghost", () => {
      const filePath = path.resolve(process.cwd(), "public/brands/snapchat.svg");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf8");
      expect(content).toContain("<rect");
      expect(content).toContain('fill="#FFFC00"');
      expect(content).toContain('stroke="#000000"');
      expect(content).toContain('fill="#FFFFFF"');
    });

    it("should ensure trovo.svg has dark contrast badge and 1:1 square aspect ratio", () => {
      const filePath = path.resolve(process.cwd(), "public/brands/trovo.svg");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf8");
      expect(content).toContain('viewBox="0 0 24 24"');
      expect(content).toContain("<rect");
      expect(content).toContain('fill="#181B20"');
      expect(content).toContain('fill="#19D66B"');
    });
  });

  describe("FluxStepNetwork Component Rendering & Interactions", () => {
    const dummyVariants = {
      hidden: { opacity: 0 },
      show: { opacity: 1 },
    };

    it("should render Top-6 CIS Quick Access cards and Tier 2 capsules in default view", () => {
      const onSelect = vi.fn();
      render(
        <FluxStepNetwork
          networks={mockNetworks}
          onSelectNetwork={onSelect}
          containerVariants={dummyVariants}
          itemVariants={dummyVariants}
        />
      );

      // Verify Tier 1 Top-6 header
      expect(screen.getByText(/Быстрый выбор \(ТОП СНГ\)/i)).toBeDefined();

      // Top-6 CIS items rendered
      expect(screen.getByText("Telegram")).toBeDefined();
      expect(screen.getByText("ВКонтакте")).toBeDefined();
      expect(screen.getByText("YouTube")).toBeDefined();
      expect(screen.getByText("Instagram")).toBeDefined();
      expect(screen.getByText("TikTok")).toBeDefined();
      expect(screen.getByText("Rutube")).toBeDefined();

      // Tier 2 other platforms header
      expect(screen.getByText(/Другие платформы \(12\)/i)).toBeDefined();
      expect(screen.getByText("Twitch")).toBeDefined();
      expect(screen.getByText("Discord")).toBeDefined();
    });

    it("should trigger onSelectNetwork when a platform card is clicked", () => {
      const onSelect = vi.fn();
      render(
        <FluxStepNetwork
          networks={mockNetworks}
          onSelectNetwork={onSelect}
          containerVariants={dummyVariants}
          itemVariants={dummyVariants}
        />
      );

      const tgButton = screen.getByRole("button", { name: /Telegram/i });
      fireEvent.click(tgButton);

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ name: "Telegram" }));
    });

    it("should filter platforms dynamically via Russian search query", () => {
      const onSelect = vi.fn();
      render(
        <FluxStepNetwork
          networks={mockNetworks}
          onSelectNetwork={onSelect}
          containerVariants={dummyVariants}
          itemVariants={dummyVariants}
        />
      );

      const searchInput = screen.getByPlaceholderText(/Поиск платформы.../i);
      fireEvent.change(searchInput, { target: { value: "ютуб" } });

      expect(screen.getByText(/Найдено \(1\)/i)).toBeDefined();
      expect(screen.getByText("YouTube")).toBeDefined();
      expect(screen.queryByText("Telegram")).toBeNull();
    });

    it("should filter platforms via taxonomy chips", () => {
      const onSelect = vi.fn();
      render(
        <FluxStepNetwork
          networks={mockNetworks}
          onSelectNetwork={onSelect}
          containerVariants={dummyVariants}
          itemVariants={dummyVariants}
        />
      );

      const messengersChip = screen.getByRole("button", { name: "Мессенджеры" });
      fireEvent.click(messengersChip);

      // Telegram, Discord, WhatsApp, Viber are messengers in mockNetworks
      expect(screen.getByText("Telegram")).toBeDefined();
      expect(screen.getByText("Discord")).toBeDefined();
      expect(screen.getByText("WhatsApp")).toBeDefined();
      expect(screen.getByText("Viber")).toBeDefined();
      expect(screen.queryByText("YouTube")).toBeNull();
    });
  });

  describe("Clean Architecture & Strict Invariant Compliance", () => {
    it("should ensure all modified flux step files adhere to <= 200 lines rule", () => {
      const files = [
        "src/components/ab-test/flux-steps/FluxStepNetwork.tsx",
        "src/components/ab-test/flux-steps/flux-network-helpers.ts",
        "src/components/ab-test/flux-steps/flux-search-aliases.ts",
        "src/components/ab-test/flux-steps/sub/FluxNetworkSearchBar.tsx",
        "src/components/ab-test/flux-steps/sub/FluxNetworkCardTier1.tsx",
        "src/components/ab-test/flux-steps/sub/FluxNetworkCapsuleTier2.tsx",
        "src/components/ab-test/flux-steps/FluxStepCategory.tsx",
        "src/components/ab-test/sub/FluxNavHeader.tsx",
        "src/app/page.tsx",
      ];

      for (const rel of files) {
        const full = path.resolve(process.cwd(), rel);
        const lines = fs.readFileSync(full, "utf8").split("\n").length;
        expect(lines, `${rel} has ${lines} lines, expected <= 200`).toBeLessThanOrEqual(200);
      }
    });
  });
});
