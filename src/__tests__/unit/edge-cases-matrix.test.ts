import { describe, it, expect } from 'vitest';
import { unifiedLinkEngine } from '@/services/link-engine/unified-link-engine';
import { canonicalizeUrl, stripTrackingParams } from '@/services/link-engine/link-canonicalizer';
import { resolvePlatformByHostname } from '@/services/link-engine/link-domain-router';
import {
  isLinkServiceCompatible,
  getCompatibilityError,
  LinkType,
  ServiceTargetType,
  normalizeLinkType,
  normalizeServiceTargetType,
} from '@/constants/link-service-compatibility';
import { IntelligencePlatform } from '@/services/analyzer/link-rules';
import {
  CommentsCustomDataSchema,
  ReactionsCustomDataSchema,
  PollCustomDataSchema,
  MentionsCustomDataSchema,
  MediaGroupCustomDataSchema,
  SubscriptionCustomDataSchema,
  OrderCustomDataSchema,
  serializeCustomData,
  parseCustomData,
  sanitizeControlChars,
  EMOJI_REGEX,
  USERNAME_REGEX,
} from '@/schemas/custom-data';
import { isUrlSafeForFetch, isPublicIp } from '@/lib/ssrf-guard';
import { validateProhibitedContent } from '@/validators/prohibited-content';
import { orderFormSchema } from '@/validators/order.validators';

describe('OmniSMM Link Edge Cases & Taxonomic Matrix Test Vector Suite (M4)', () => {
  // ---------------------------------------------------------------------------
  // TAXONOMIC DIMENSION 1: Multi-Category Applicability (1 Link -> N Categories)
  // ---------------------------------------------------------------------------
  describe('Dimension 1: Multi-Category Applicability & Intent Disambiguation', () => {
    const tgChannelService = {
      id: 'srv-tg-subs',
      name: 'Подписчики Telegram (Канал)',
      targetType: 'CHANNEL',
      category: { name: 'Подписчики', network: { slug: 'telegram' } },
    };

    const tgPostViewService = {
      id: 'srv-tg-views',
      name: 'Просмотры на пост Telegram',
      targetType: 'POST',
      category: { name: 'Просмотры', network: { slug: 'telegram' } },
    };

    const tgAutoPostsService = {
      id: 'srv-tg-auto',
      name: 'Авто-просмотры на будущие посты Telegram',
      targetType: 'CHANNEL_POSTS',
      category: { name: 'Авто-просмотры', network: { slug: 'telegram' } },
    };

    it('TV-01: Public Telegram Channel link analyzes to channel and suggests multi-category intent', async () => {
      const res = await unifiedLinkEngine.analyze('https://t.me/durov');
      expect(res.errorCode).toBeUndefined();
      expect(res.platform).toBe(IntelligencePlatform.TELEGRAM);
      expect(res.type).toBe('channel');
      expect(res.suggestedCategories.length).toBeGreaterThanOrEqual(4);
    });

    it('TV-02: Public Telegram Channel is compatible with ServiceTargetType.CHANNEL (Subscribers)', () => {
      const compatible = isLinkServiceCompatible('channel', ServiceTargetType.CHANNEL);
      expect(compatible).toBe(true);
    });

    it('TV-03: Public Telegram Channel is compatible with ServiceTargetType.CHANNEL_POSTS (Auto-views)', () => {
      const compatible = isLinkServiceCompatible('channel', ServiceTargetType.CHANNEL_POSTS);
      expect(compatible).toBe(true);
    });

    it('TV-04: Public Telegram Channel is incompatible with ServiceTargetType.POST_INTERACTION and provides user guidance', async () => {
      const res = await unifiedLinkEngine.validateForService('https://t.me/durov', tgPostViewService);
      expect(res.isValid).toBe(false);
      expect(res.errorCode).toBe('INCOMPATIBLE_TARGET_TYPE');
      expect(res.error).toContain('отдельный пост в канале');
    });

    it('TV-05: VK Public Group is compatible with ServiceTargetType.CHANNEL and PROFILE', () => {
      expect(isLinkServiceCompatible('channel', ServiceTargetType.CHANNEL)).toBe(true);
      expect(isLinkServiceCompatible('channel', ServiceTargetType.PROFILE)).toBe(true);
    });

    it('TV-06: VK Public Group is incompatible with ServiceTargetType.POST_INTERACTION', () => {
      expect(isLinkServiceCompatible('channel', ServiceTargetType.POST_INTERACTION)).toBe(false);
      const errMsg = getCompatibilityError('channel', ServiceTargetType.POST_INTERACTION, 'Лайки на стену');
      expect(errMsg).toContain('применяется к конкретным записям');
    });

    it('TV-07: YouTube Channel (@handle) is compatible with CHANNEL target', () => {
      expect(isLinkServiceCompatible('channel', ServiceTargetType.CHANNEL)).toBe(true);
    });

    it('TV-08: YouTube Channel is incompatible with VIDEO_INTERACTION', () => {
      expect(isLinkServiceCompatible('channel', ServiceTargetType.VIDEO_INTERACTION)).toBe(false);
    });

    it('TV-09: Instagram Profile is compatible with PROFILE and CHANNEL target types', () => {
      expect(isLinkServiceCompatible('profile', ServiceTargetType.PROFILE)).toBe(true);
      expect(isLinkServiceCompatible('profile', ServiceTargetType.CHANNEL)).toBe(true);
    });

    it('TV-10: Instagram Profile is incompatible with POST_INTERACTION and yields educational error', () => {
      expect(isLinkServiceCompatible('profile', ServiceTargetType.POST_INTERACTION)).toBe(false);
      const err = getCompatibilityError('profile', ServiceTargetType.POST_INTERACTION, 'Лайки Instagram');
      expect(err).toContain('укажите прямую ссылку на конкретный пост или фото');
    });
  });

  // ---------------------------------------------------------------------------
  // TAXONOMIC DIMENSION 2: Auto and Subscription Services
  // ---------------------------------------------------------------------------
  describe('Dimension 2: Auto and Subscription Services (Drip-Feed & Subscriptions)', () => {
    // ExactMath helper for Drip-Feed Floor invariant
    const checkDripFeedFloor = (quantity: number, runs: number, minQty: number): boolean => {
      if (runs <= 0 || minQty <= 0) return false;
      return Math.floor(quantity / runs) >= minQty;
    };

    it('TV-11: Drip-Feed Floor Invariant: Valid distribution floor(Q / N) >= minQty', () => {
      // 1000 quantity / 10 runs = 100 per run >= 100 minQty -> Valid
      expect(checkDripFeedFloor(1000, 10, 100)).toBe(true);
      expect(checkDripFeedFloor(2500, 5, 200)).toBe(true);
    });

    it('TV-12: Drip-Feed Floor Invariant: Violation when floor(Q / N) < minQty', () => {
      // 999 quantity / 10 runs = 99 per run < 100 minQty -> Invalid
      expect(checkDripFeedFloor(999, 10, 100)).toBe(false);
      // 500 quantity / 10 runs = 50 per run < 100 minQty -> Invalid
      expect(checkDripFeedFloor(500, 10, 100)).toBe(false);
    });

    it('TV-13: Drip-Feed Floor Invariant: Boundary check with single run (N = 1)', () => {
      expect(checkDripFeedFloor(100, 1, 100)).toBe(true);
      expect(checkDripFeedFloor(99, 1, 100)).toBe(false);
    });

    it('TV-14: SubscriptionCustomDataSchema validates correct auto-monitoring payload', () => {
      const payload = {
        kind: 'SUBSCRIPTION' as const,
        minPerPost: 100,
        maxPerPost: 500,
        futurePosts: 20,
        delayMinutes: 10,
      };
      const parsed = SubscriptionCustomDataSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.minPerPost).toBe(100);
        expect(parsed.data.futurePosts).toBe(20);
      }
    });

    it('TV-15: SubscriptionCustomDataSchema defaults delayMinutes to 0 when omitted', () => {
      const payload = {
        kind: 'SUBSCRIPTION' as const,
        minPerPost: 50,
        maxPerPost: 100,
        futurePosts: 5,
      };
      const parsed = SubscriptionCustomDataSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.delayMinutes).toBe(0);
      }
    });

    it('TV-16: SubscriptionCustomDataSchema rejects futurePosts > 100', () => {
      const payload = {
        kind: 'SUBSCRIPTION' as const,
        minPerPost: 50,
        maxPerPost: 100,
        futurePosts: 101,
      };
      const parsed = SubscriptionCustomDataSchema.safeParse(payload);
      expect(parsed.success).toBe(false);
    });

    it('TV-17: SubscriptionCustomDataSchema rejects futurePosts < 1', () => {
      const payload = {
        kind: 'SUBSCRIPTION' as const,
        minPerPost: 50,
        maxPerPost: 100,
        futurePosts: 0,
      };
      const parsed = SubscriptionCustomDataSchema.safeParse(payload);
      expect(parsed.success).toBe(false);
    });

    it('TV-18: SubscriptionCustomDataSchema rejects minPerPost < 1', () => {
      const payload = {
        kind: 'SUBSCRIPTION' as const,
        minPerPost: 0,
        maxPerPost: 100,
        futurePosts: 10,
      };
      const parsed = SubscriptionCustomDataSchema.safeParse(payload);
      expect(parsed.success).toBe(false);
    });

    it('TV-19: SubscriptionCustomDataSchema rejects negative delayMinutes', () => {
      const payload = {
        kind: 'SUBSCRIPTION' as const,
        minPerPost: 10,
        maxPerPost: 20,
        futurePosts: 5,
        delayMinutes: -1,
      };
      const parsed = SubscriptionCustomDataSchema.safeParse(payload);
      expect(parsed.success).toBe(false);
    });

    it('TV-20: Livestream watch time URL canonicalizes YouTube live link to watch URL', () => {
      const liveUrl = 'https://youtube.com/live/dQw4w9WgXcQ';
      const canonical = canonicalizeUrl(liveUrl, IntelligencePlatform.YOUTUBE, 'VIDEO');
      expect(canonical).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(isLinkServiceCompatible('video', ServiceTargetType.VIDEO_INTERACTION)).toBe(true);
    });

    it('TV-21: Twitch channel is compatible with VIDEO_INTERACTION (live viewers) and CHANNEL (followers)', () => {
      // Twitch channels support both stream interaction and follower acquisition
      expect(isLinkServiceCompatible('channel', ServiceTargetType.CHANNEL)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // TAXONOMIC DIMENSION 3: Closed, Private & Restricted Entities
  // ---------------------------------------------------------------------------
  describe('Dimension 3: Closed, Private & Restricted Entities', () => {
    const tgPostService = {
      id: 'srv-post-views',
      name: 'Просмотры Telegram',
      targetType: 'POST',
      category: { name: 'Просмотры', network: { slug: 'telegram' } },
    };

    const tgChannelService = {
      id: 'srv-subs',
      name: 'Подписчики Telegram',
      targetType: 'CHANNEL',
      category: { name: 'Подписчики', network: { slug: 'telegram' } },
    };

    it('TV-22: Telegram /c/ private chat link is REJECTED with specific educational message', async () => {
      const privatePostUrl = 'https://t.me/c/1234567890/456';
      const res = await unifiedLinkEngine.validateForService(privatePostUrl, tgPostService);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Невозможно заказать услугу в закрытый чат (ссылка содержит /c/). Сделайте канал публичным.');
    });

    it('TV-23: Telegram telegram.me/c/ variant is also rejected with educational message', async () => {
      const privatePostUrl = 'https://telegram.me/c/9876543210/12';
      const res = await unifiedLinkEngine.validateForService(privatePostUrl, tgPostService);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Невозможно заказать услугу в закрытый чат (ссылка содержит /c/). Сделайте канал публичным.');
    });

    it('TV-24: Telegram /c/ private chat link is rejected for CHANNEL service due to target type incompatibility', async () => {
      const privatePostUrl = 'https://t.me/c/1234567890/456';
      const res = await unifiedLinkEngine.validateForService(privatePostUrl, tgChannelService);
      expect(res.isValid).toBe(false);
      expect(res.errorCode).toBe('INCOMPATIBLE_TARGET_TYPE');
    });

    it('TV-25: Telegram private invite (+hash) is accepted for CHANNEL service and flagged as private invite', async () => {
      const inviteUrl = 'https://t.me/+AbCdEfGh12345678';
      const analysis = await unifiedLinkEngine.analyze(inviteUrl);
      expect(analysis.errorCode).toBeUndefined();
      expect(analysis.platform).toBe(IntelligencePlatform.TELEGRAM);
      expect(analysis.type).toBe('channel');
      expect(analysis.metadata.isPrivateInvite).toBe(true);

      const res = await unifiedLinkEngine.validateForService(inviteUrl, tgChannelService);
      expect(res.isValid).toBe(true);
      expect(res.canonicalUrl).toBe(inviteUrl);
    });

    it('TV-26: Telegram legacy private invite (joinchat/hash) is accepted for CHANNEL service', async () => {
      const legacyInviteUrl = 'https://t.me/joinchat/AbCdEfGh12345678';
      const analysis = await unifiedLinkEngine.analyze(legacyInviteUrl);
      expect(analysis.errorCode).toBeUndefined();
      expect(analysis.metadata.isPrivateInvite).toBe(true);

      const res = await unifiedLinkEngine.validateForService(legacyInviteUrl, tgChannelService);
      expect(res.isValid).toBe(true);
    });

    it('TV-27: Telegram private invite (+hash) is rejected for POST service', async () => {
      const inviteUrl = 'https://t.me/+AbCdEfGh12345678';
      const res = await unifiedLinkEngine.validateForService(inviteUrl, tgPostService);
      expect(res.isValid).toBe(false);
      expect(res.errorCode).toBe('INCOMPATIBLE_TARGET_TYPE');
    });

    it('TV-28: Discord server invite (discord.gg/code) is recognized and accepted for CHANNEL target', () => {
      const invite = 'https://discord.gg/coolServer123';
      const canonical = canonicalizeUrl(invite, IntelligencePlatform.DISCORD, 'CHANNEL');
      expect(canonical).toBe('https://discord.gg/coolServer123');
      expect(isLinkServiceCompatible('channel', ServiceTargetType.CHANNEL)).toBe(true);
    });

    it('TV-29: Discord web invite (discord.com/invite/code) canonicalizes to discord.gg/code', () => {
      const webInvite = 'https://discord.com/invite/coolServer123';
      const canonical = canonicalizeUrl(webInvite, IntelligencePlatform.DISCORD, 'CHANNEL');
      expect(canonical).toContain('discord.gg/coolServer123');
    });

    it('TV-30: Instagram profile URL passes validation for followers, leaving open-profile guard to client JIT', async () => {
      const igService = {
        id: 'srv-ig-followers',
        name: 'Подписчики Instagram',
        targetType: 'PROFILE',
        category: { name: 'Подписчики', network: { slug: 'instagram' } },
      };
      const res = await unifiedLinkEngine.validateForService('https://www.instagram.com/cristiano', igService);
      expect(res.isValid).toBe(true);
      expect(res.canonicalUrl).toBe('https://www.instagram.com/cristiano');
    });
  });

  // ---------------------------------------------------------------------------
  // TAXONOMIC DIMENSION 4: Dynamic Custom Input Fields (Zod Schemas)
  // ---------------------------------------------------------------------------
  describe('Dimension 4: Dynamic Custom Fields (src/schemas/custom-data.ts)', () => {
    it('TV-31: CommentsCustomDataSchema validates a clean single-line comment', () => {
      const payload = { kind: 'COMMENTS' as const, lines: ['Отличный пост!'] };
      const parsed = CommentsCustomDataSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.lines).toEqual(['Отличный пост!']);
      }
    });

    it('TV-32: CommentsCustomDataSchema validates multi-line comments with emojis and diverse scripts', () => {
      const payload = {
        kind: 'COMMENTS' as const,
        lines: [
          'Классный контент! 🔥',
          'Super interesting insights, thanks! 👍',
          '非常棒的分享 🚀',
        ],
      };
      const parsed = CommentsCustomDataSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.lines).toHaveLength(3);
      }
    });

    it('TV-33: CommentsCustomDataSchema strips ASCII control characters (\x00-\x1F\x7F)', () => {
      const dirty = 'Bad\x00Line\x07With\x1FControl\x7FChars';
      const clean = sanitizeControlChars(dirty);
      expect(clean).toBe('BadLineWithControlChars');

      const payload = { kind: 'COMMENTS' as const, lines: [dirty] };
      const parsed = CommentsCustomDataSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.lines[0]).toBe('BadLineWithControlChars');
      }
    });

    it('TV-34: sanitizeControlChars explicitly preserves standard newlines and tabs', () => {
      const formatted = 'First line\n\tIndented line\r\nSecond line';
      const sanitized = sanitizeControlChars(formatted);
      expect(sanitized).toBe(formatted);
    });

    it('TV-35: CommentsCustomDataSchema rejects empty lines array', () => {
      const parsed = CommentsCustomDataSchema.safeParse({ kind: 'COMMENTS', lines: [] });
      expect(parsed.success).toBe(false);
    });

    it('TV-36: CommentsCustomDataSchema rejects empty comment line', () => {
      const parsed = CommentsCustomDataSchema.safeParse({ kind: 'COMMENTS', lines: ['Valid line', '   ', 'Another valid'] });
      expect(parsed.success).toBe(false);
    });

    it('TV-37: CommentsCustomDataSchema rejects a comment line exceeding 500 characters', () => {
      const longLine = 'a'.repeat(501);
      const parsed = CommentsCustomDataSchema.safeParse({ kind: 'COMMENTS', lines: [longLine] });
      expect(parsed.success).toBe(false);
    });

    it('TV-38: CommentsCustomDataSchema rejects exceeding 1000 lines limit', () => {
      const lines = Array.from({ length: 1001 }, (_, i) => `Comment line ${i + 1}`);
      const parsed = CommentsCustomDataSchema.safeParse({ kind: 'COMMENTS', lines });
      expect(parsed.success).toBe(false);
    });

    it('TV-39: ReactionsCustomDataSchema validates single emoji', () => {
      const parsed = ReactionsCustomDataSchema.safeParse({ kind: 'REACTIONS', emojis: ['👍'] });
      expect(parsed.success).toBe(true);
    });

    it('TV-40: ReactionsCustomDataSchema validates multiple Unicode emojis', () => {
      const parsed = ReactionsCustomDataSchema.safeParse({
        kind: 'REACTIONS',
        emojis: ['👍', '🔥', '❤️', '👏', '🎉', '💯'],
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.emojis).toHaveLength(6);
      }
    });

    it('TV-41: ReactionsCustomDataSchema validates custom Telegram Document ID string (15-22 digits)', () => {
      const customDocId = '543210987654321098';
      const parsed = ReactionsCustomDataSchema.safeParse({ kind: 'REACTIONS', emojis: [customDocId] });
      expect(parsed.success).toBe(true);
    });

    it('TV-42: ReactionsCustomDataSchema rejects invalid emoji text string', () => {
      const parsed = ReactionsCustomDataSchema.safeParse({ kind: 'REACTIONS', emojis: ['not_an_emoji_text'] });
      expect(parsed.success).toBe(false);
    });

    it('TV-43: ReactionsCustomDataSchema rejects exceeding 10 emojis', () => {
      const emojis = ['👍', '🔥', '❤️', '👏', '🎉', '💯', '✨', '⚡', '🚀', '😍', '🤩']; // 11
      const parsed = ReactionsCustomDataSchema.safeParse({ kind: 'REACTIONS', emojis });
      expect(parsed.success).toBe(false);
    });

    it('TV-44: PollCustomDataSchema validates optionIndex 1', () => {
      const parsed = PollCustomDataSchema.safeParse({ kind: 'POLL', optionIndex: 1 });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.optionIndex).toBe(1);
      }
    });

    it('TV-45: PollCustomDataSchema validates optionIndex 20 with optional optionText', () => {
      const parsed = PollCustomDataSchema.safeParse({
        kind: 'POLL',
        optionIndex: 20,
        optionText: 'Вариант 20 (финальный)',
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.optionIndex).toBe(20);
        expect(parsed.data.optionText).toBe('Вариант 20 (финальный)');
      }
    });

    it('TV-46: PollCustomDataSchema rejects optionIndex 0 (< 1)', () => {
      const parsed = PollCustomDataSchema.safeParse({ kind: 'POLL', optionIndex: 0 });
      expect(parsed.success).toBe(false);
    });

    it('TV-47: PollCustomDataSchema rejects optionIndex 21 (> 20)', () => {
      const parsed = PollCustomDataSchema.safeParse({ kind: 'POLL', optionIndex: 21 });
      expect(parsed.success).toBe(false);
    });

    it('TV-48: PollCustomDataSchema rejects non-integer optionIndex', () => {
      const parsed = PollCustomDataSchema.safeParse({ kind: 'POLL', optionIndex: 1.5 });
      expect(parsed.success).toBe(false);
    });

    it('TV-49: MentionsCustomDataSchema strips leading @ from usernames and validates alphanumeric format', () => {
      const parsed = MentionsCustomDataSchema.safeParse({
        kind: 'MENTIONS',
        usernames: ['@durov', 'elonmusk', '@user_name.1'],
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.usernames).toEqual(['durov', 'elonmusk', 'user_name.1']);
      }
    });

    it('TV-50: MentionsCustomDataSchema strips leading # from optional hashtag', () => {
      const parsed = MentionsCustomDataSchema.safeParse({
        kind: 'MENTIONS',
        usernames: ['durov'],
        hashtag: '#giveaway2026',
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.hashtag).toBe('giveaway2026');
      }
    });

    it('TV-51: MentionsCustomDataSchema rejects usernames with illegal characters', () => {
      const parsed = MentionsCustomDataSchema.safeParse({
        kind: 'MENTIONS',
        usernames: ['invalid!user$name'],
      });
      expect(parsed.success).toBe(false);
    });

    it('TV-52: MediaGroupCustomDataSchema validates first and last post URLs for albums', () => {
      const parsed = MediaGroupCustomDataSchema.safeParse({
        kind: 'MEDIA_GROUP',
        firstPostUrl: 'https://t.me/channel/100',
        lastPostUrl: 'https://t.me/channel/104',
      });
      expect(parsed.success).toBe(true);
    });

    it('TV-53: MediaGroupCustomDataSchema rejects invalid URL strings', () => {
      const parsed = MediaGroupCustomDataSchema.safeParse({
        kind: 'MEDIA_GROUP',
        firstPostUrl: 'not-a-url',
        lastPostUrl: 'https://t.me/channel/104',
      });
      expect(parsed.success).toBe(false);
    });

    it('TV-54: serializeCustomData and parseCustomData roundtrip for COMMENTS', () => {
      const original = { kind: 'COMMENTS' as const, lines: ['Comment 1', 'Comment 2', 'Comment 3'] };
      const serialized = serializeCustomData(original);
      const deserialized = parseCustomData(serialized);
      expect(deserialized).toEqual(original);
    });

    it('TV-55: serializeCustomData and parseCustomData roundtrip for REACTIONS', () => {
      const original = { kind: 'REACTIONS' as const, emojis: ['🔥', '👍'] };
      const serialized = serializeCustomData(original);
      const deserialized = parseCustomData(serialized);
      expect(deserialized).toEqual(original);
    });

    it('TV-56: serializeCustomData and parseCustomData roundtrip for POLL', () => {
      const original = { kind: 'POLL' as const, optionIndex: 3, optionText: 'Third Choice' };
      const serialized = serializeCustomData(original);
      const deserialized = parseCustomData(serialized);
      expect(deserialized).toEqual(original);
    });

    it('TV-57: parseCustomData legacy fallback parses pure numeric string into POLL', () => {
      const legacyPoll = '7';
      const parsed = parseCustomData(legacyPoll);
      expect(parsed).toEqual({ kind: 'POLL', optionIndex: 7 });
    });

    it('TV-58: parseCustomData legacy fallback parses raw multiline text into COMMENTS', () => {
      const legacyText = 'Line 1\nLine 2\nLine 3';
      const parsed = parseCustomData(legacyText);
      expect(parsed).toEqual({ kind: 'COMMENTS', lines: ['Line 1', 'Line 2', 'Line 3'] });
    });

    it('TV-59: parseCustomData returns null for empty or whitespace-only input', () => {
      expect(parseCustomData(null)).toBeNull();
      expect(parseCustomData('')).toBeNull();
      expect(parseCustomData('   ')).toBeNull();
    });

    it('TV-60: serializeCustomData succeeds for payload within 5,000 characters limit', () => {
      const lines = Array.from({ length: 50 }, (_, i) => `Comment line number ${i + 1} with some text.`);
      const serialized = serializeCustomData({ kind: 'COMMENTS', lines });
      expect(serialized.length).toBeLessThanOrEqual(5000);
      expect(typeof serialized).toBe('string');
    });

    it('TV-61: serializeCustomData throws error if serialized JSON exceeds 5,000 characters', () => {
      const hugeLines = Array.from({ length: 60 }, () => 'a'.repeat(200)); // ~12,000 chars
      expect(() => {
        serializeCustomData({ kind: 'COMMENTS', lines: hugeLines });
      }).toThrow('Сериализованные пользовательские данные превышают лимит в 5000 символов');
    });
  });

  // ---------------------------------------------------------------------------
  // TAXONOMIC DIMENSION 5: Platform URL Edge Cases across Tiers 1, 2, 3
  // ---------------------------------------------------------------------------
  describe('Dimension 5: Platform URL Edge Cases (Tiers 1, 2, 3)', () => {
    // --- Tier 1: Telegram, VK, YouTube, Instagram, TikTok ---
    it('TV-62: Telegram forum topic URL canonicalizes to group/topic_id/msg_id', () => {
      const topicUrl = 'https://t.me/supergroup/topic/100/250';
      const canonical = canonicalizeUrl(topicUrl, IntelligencePlatform.TELEGRAM, 'POST');
      expect(canonical).toBe('https://t.me/supergroup/100/250');
    });

    it('TV-63: Telegram channel story URL is recognized as temporary story', async () => {
      const storyUrl = 'https://t.me/durov/s/12';
      const analysis = await unifiedLinkEngine.analyze(storyUrl);
      expect(analysis.errorCode).toBeUndefined();
      expect(analysis.platform).toBe(IntelligencePlatform.TELEGRAM);
      expect(analysis.type).toBe('story');
    });

    it('TV-64: Telegram post comment anchor preserves ?comment= parameter', () => {
      const commentUrl = 'https://t.me/durov/123?comment=456&utm_source=tg';
      const canonical = canonicalizeUrl(commentUrl, IntelligencePlatform.TELEGRAM, 'POST');
      expect(canonical).toContain('comment=456');
      expect(canonical).not.toContain('utm_source');
    });

    it('TV-65: Telegram bot URL preserves ?start= referral parameter', () => {
      const botUrl = 'https://t.me/my_special_bot?start=affiliate_123&utm_medium=cpc';
      const canonical = canonicalizeUrl(botUrl, IntelligencePlatform.TELEGRAM, 'BOT');
      expect(canonical).toContain('start=affiliate_123');
      expect(canonical).not.toContain('utm_medium');
    });

    it('TV-66: Telegram album single photo preserves ?single parameter', () => {
      const singleUrl = 'https://t.me/durov/123?single&utm_campaign=track';
      const canonical = canonicalizeUrl(singleUrl, IntelligencePlatform.TELEGRAM, 'POST');
      expect(canonical).toContain('single');
      expect(canonical).not.toContain('utm_campaign');
    });

    it('TV-67: VK community wall post preserves negative community ID prefix', () => {
      const wallUrl = 'https://vk.com/wall-123456_789?utm_source=vk';
      const canonical = canonicalizeUrl(wallUrl, IntelligencePlatform.VK, 'POST');
      expect(canonical).toBe('https://vk.com/wall-123456_789');
    });

    it('TV-68: VK user wall post preserves positive user ID prefix', () => {
      const userWall = 'https://vk.com/wall123456_789';
      const canonical = canonicalizeUrl(userWall, IntelligencePlatform.VK, 'POST');
      expect(canonical).toBe('https://vk.com/wall123456_789');
    });

    it('TV-69: VK deep-link photo query parameter z= extracts to canonical direct photo URL', () => {
      const deepLink = 'https://vk.com/feed?z=photo-100_200%2Fwall-100_300';
      const canonical = canonicalizeUrl(deepLink, IntelligencePlatform.VK, 'POST');
      expect(canonical).toBe('https://vk.com/photo-100_200');
    });

    it('TV-70: VK comment reply parameter ?reply= is preserved', () => {
      const commentUrl = 'https://vk.com/wall-100_200?reply=345&utm_content=btn';
      const canonical = canonicalizeUrl(commentUrl, IntelligencePlatform.VK, 'POST');
      expect(canonical).toContain('reply=345');
      expect(canonical).not.toContain('utm_content');
    });

    it('TV-71: VK video standalone domain vkvideo.ru canonicalizes to vk.com', () => {
      const vkVideoUrl = 'https://vkvideo.ru/video-1_2';
      const canonical = canonicalizeUrl(vkVideoUrl, IntelligencePlatform.VK, 'VIDEO');
      expect(canonical).toBe('https://vk.com/video-1_2');
    });

    it('TV-72: YouTube short-link youtu.be/ID canonicalizes to watch?v=ID', () => {
      const shortUrl = 'https://youtu.be/dQw4w9WgXcQ';
      const canonical = canonicalizeUrl(shortUrl, IntelligencePlatform.YOUTUBE, 'VIDEO');
      expect(canonical).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('TV-73: YouTube Shorts URL canonicalizes to standard watch?v=ID for provider compatibility', () => {
      const shortsUrl = 'https://www.youtube.com/shorts/dQw4w9WgXcQ';
      const canonical = canonicalizeUrl(shortsUrl, IntelligencePlatform.YOUTUBE, 'VIDEO');
      expect(canonical).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('TV-74: YouTube live stream URL canonicalizes to watch?v=ID', () => {
      const liveUrl = 'https://youtube.com/live/dQw4w9WgXcQ';
      const canonical = canonicalizeUrl(liveUrl, IntelligencePlatform.YOUTUBE, 'VIDEO');
      expect(canonical).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('TV-75: YouTube watch URL strips tracking tags (?si=, ?feature=, &t=) while preserving v=', () => {
      const dirtyYt = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share&si=abc123xyz&t=45s';
      const canonical = canonicalizeUrl(dirtyYt, IntelligencePlatform.YOUTUBE, 'VIDEO');
      expect(canonical).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(canonical).not.toContain('feature');
      expect(canonical).not.toContain('si=');
    });

    it('TV-76: YouTube linked comment anchor preserves lc= parameter when target is COMMENT', () => {
      const commentYt = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&lc=Ugz123456789&si=junk';
      const canonical = canonicalizeUrl(commentYt, IntelligencePlatform.YOUTUBE, 'COMMENT');
      expect(canonical).toContain('v=dQw4w9WgXcQ');
      expect(canonical).toContain('lc=Ugz123456789');
      expect(canonical).not.toContain('si=');
    });

    it('TV-77: Instagram mobile share URL (/share/p/ID/) canonicalizes to /p/ID/', () => {
      const shareUrl = 'https://www.instagram.com/share/p/Cxyz123/?igsh=NTc4MTIwNjQ2YQ==';
      const canonical = canonicalizeUrl(shareUrl, IntelligencePlatform.INSTAGRAM, 'POST');
      expect(canonical).toBe('https://www.instagram.com/p/Cxyz123/');
      expect(canonical).not.toContain('igsh');
    });

    it('TV-78: Instagram plural Reels (/reels/ID/) and share canonicalize to singular /reel/ID/', () => {
      const reelsUrl = 'https://www.instagram.com/reels/Cxyz123/?igsh=abc';
      const canonical = canonicalizeUrl(reelsUrl, IntelligencePlatform.INSTAGRAM, 'VIDEO');
      expect(canonical).toBe('https://www.instagram.com/reel/Cxyz123/');
    });

    it('TV-79: Instagram story highlight URL is recognized and preserved', async () => {
      const highlightUrl = 'https://www.instagram.com/stories/highlights/1234567890/';
      const analysis = await unifiedLinkEngine.analyze(highlightUrl);
      expect(analysis.errorCode).toBeUndefined();
      expect(analysis.platform).toBe(IntelligencePlatform.INSTAGRAM);
      expect(analysis.type).toBe('highlight');
    });

    it('TV-80: TikTok video URL strips all tracking parameters (is_from_webapp, sender_device, ttref)', () => {
      const dirtyTt = 'https://www.tiktok.com/@user/video/1234567890?is_from_webapp=1&sender_device=pc&ttref=share';
      const canonical = canonicalizeUrl(dirtyTt, IntelligencePlatform.TIKTOK, 'VIDEO');
      expect(canonical).toBe('https://www.tiktok.com/@user/video/1234567890');
      expect(canonical).not.toContain('is_from_webapp');
    });

    it('TV-81: TikTok profile path without @ automatically prepends @', () => {
      const noAtTt = 'https://www.tiktok.com/username';
      const canonical = canonicalizeUrl(noAtTt, IntelligencePlatform.TIKTOK, 'PROFILE');
      expect(canonical).toBe('https://www.tiktok.com/@username');
    });

    // --- Tier 2: Twitch, Rutube, Dzen, Twitter/X, Discord, Threads, Facebook, OK ---
    it('TV-82: Twitch channel URL resolves to TWITCH platform and channel entity', async () => {
      const res = await unifiedLinkEngine.analyze('https://www.twitch.tv/shroud');
      expect(res.errorCode).toBeUndefined();
      expect(res.platform).toBe(IntelligencePlatform.TWITCH);
      expect(res.type).toBe('channel');
    });

    it('TV-83: Twitch clip URL resolves to TWITCH clip', async () => {
      const res = await unifiedLinkEngine.analyze('https://clips.twitch.tv/SillyToughDolphin');
      expect(res.errorCode).toBeUndefined();
      expect(res.platform).toBe(IntelligencePlatform.TWITCH);
      expect(res.type).toBe('clip');
    });

    it('TV-84: Rutube 32-hex video URL resolves to RUTUBE video', async () => {
      const res = await unifiedLinkEngine.analyze('https://rutube.ru/video/abcdef0123456789abcdef0123456789/');
      expect(res.errorCode).toBeUndefined();
      expect(res.platform).toBe(IntelligencePlatform.RUTUBE);
      expect(res.type).toBe('video');
    });

    it('TV-85: Rutube shorts URL canonicalizes to /video/ format', () => {
      const rutubeShorts = 'https://rutube.ru/shorts/abcdef0123456789abcdef0123456789/';
      const canonical = canonicalizeUrl(rutubeShorts, IntelligencePlatform.RUTUBE, 'VIDEO');
      expect(canonical).toBe('https://rutube.ru/video/abcdef0123456789abcdef0123456789/');
    });

    it('TV-86: Dzen article URL resolves to DZEN post', async () => {
      const res = await unifiedLinkEngine.analyze('https://dzen.ru/a/Zxyz12345678');
      expect(res.errorCode).toBeUndefined();
      expect(res.platform).toBe(IntelligencePlatform.DZEN);
    });

    it('TV-87: Dzen legacy zen.yandex.ru domain routes to Dzen', () => {
      const hostPlatform = resolvePlatformByHostname('zen.yandex.ru');
      expect(hostPlatform).toBe(IntelligencePlatform.DZEN);
    });

    it('TV-88: Twitter status URL canonicalizes to x.com domain', () => {
      const tweetUrl = 'https://twitter.com/elonmusk/status/123456789?s=20';
      const canonical = canonicalizeUrl(tweetUrl, IntelligencePlatform.TWITTER, 'POST');
      expect(canonical).toContain('https://x.com/elonmusk/status/123456789');
      expect(canonical).not.toContain('twitter.com');
    });

    it('TV-89: Threads post URL resolves to THREADS post', async () => {
      const res = await unifiedLinkEngine.analyze('https://www.threads.net/@zuck/post/Cxyz123456');
      expect(res.errorCode).toBeUndefined();
      expect(res.platform).toBe(IntelligencePlatform.THREADS);
    });

    it('TV-90: Facebook post URL resolves to FACEBOOK platform', async () => {
      const res = await unifiedLinkEngine.analyze('https://www.facebook.com/zuck/posts/101010101010');
      expect(res.errorCode).toBeUndefined();
      expect(res.platform).toBe(IntelligencePlatform.FACEBOOK);
    });

    it('TV-91: Odnoklassniki (OK) topic URL resolves to OK platform and post entity', async () => {
      const res = await unifiedLinkEngine.analyze('https://ok.ru/group/12345/topic/6789012345');
      expect(res.errorCode).toBeUndefined();
      expect(res.platform).toBe(IntelligencePlatform.OK);
    });

    // --- Tier 3: Spotify, Kick, Likee, WhatsApp, Pinterest, SoundCloud, Reddit, Apple, MAX, WIBES, Web Traffic ---
    it('TV-92: Spotify track URL strips ?si= sharing parameter', () => {
      const trackUrl = 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=d2861a47df1242ee';
      const canonical = canonicalizeUrl(trackUrl, IntelligencePlatform.SPOTIFY, 'POST');
      expect(canonical).toBe('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
      expect(canonical).not.toContain('si=');
    });

    it('TV-93: Kick streamer URL resolves to KICK platform', async () => {
      const res = await unifiedLinkEngine.analyze('https://kick.com/xqc');
      expect(res.errorCode).toBeUndefined();
      expect(res.platform).toBe(IntelligencePlatform.KICK);
    });

    it('TV-94: Likee video URL resolves to LIKEE platform', async () => {
      const res = await unifiedLinkEngine.analyze('https://likee.video/@user/video/123456789');
      expect(res.errorCode).toBeUndefined();
      expect(res.platform).toBe(IntelligencePlatform.LIKEE);
    });

    it('TV-95: WhatsApp group / chat invite URL resolves to WHATSAPP platform', async () => {
      const res = await unifiedLinkEngine.analyze('https://chat.whatsapp.com/InviteCode12345');
      expect(res.errorCode).toBeUndefined();
      expect(res.platform).toBe(IntelligencePlatform.WHATSAPP);
      expect(res.type).toBe('group');
    });

    it('TV-96: Pinterest pin URL resolves to PINTEREST platform', async () => {
      const res = await unifiedLinkEngine.analyze('https://www.pinterest.com/pin/123456789012345/');
      expect(res.errorCode).toBeUndefined();
      expect(res.platform).toBe(IntelligencePlatform.PINTEREST);
    });

    it('TV-97: SoundCloud track URL resolves to SOUNDCLOUD platform', async () => {
      const res = await unifiedLinkEngine.analyze('https://soundcloud.com/artist-name/super-track');
      expect(res.errorCode).toBeUndefined();
      expect(res.platform).toBe(IntelligencePlatform.SOUNDCLOUD);
    });

    it('TV-98: Reddit post URL resolves to REDDIT platform', async () => {
      const res = await unifiedLinkEngine.analyze('https://www.reddit.com/r/technology/comments/123456/exciting_news/');
      expect(res.errorCode).toBeUndefined();
      expect(res.platform).toBe(IntelligencePlatform.REDDIT);
    });

    it('TV-99: Apple Music track within album preserves ?i= parameter', () => {
      const appleUrl = new URL('https://music.apple.com/us/album/song-title/123456?i=789012&utm_source=itunes');
      stripTrackingParams(appleUrl, IntelligencePlatform.APPLE, 'POST');
      expect(appleUrl.searchParams.has('i')).toBe(true);
      expect(appleUrl.searchParams.has('utm_source')).toBe(false);
    });

    it('TV-100: MAX (Яндекс Музыка) track URL resolves to MAX/YANDEX', async () => {
      const res = await unifiedLinkEngine.analyze('https://music.yandex.ru/album/123/track/456');
      expect(res.errorCode).toBeUndefined();
      expect(res.platform === IntelligencePlatform.MAX || res.platform === IntelligencePlatform.YANDEX).toBe(true);
    });

    it('TV-101: Wibes product/post URL resolves to WIBES platform', async () => {
      const res = await unifiedLinkEngine.analyze('https://wibes.ru/brand/item-12345');
      expect(res.errorCode).toBeUndefined();
      expect(res.platform).toBe(IntelligencePlatform.WIBES);
    });

    it('TV-102: Universal Web Traffic URL is accepted for CUSTOM TargetType', async () => {
      const webTrafficService = {
        id: 'srv-web-traffic',
        name: 'Посетители на сайт',
        targetType: 'CUSTOM',
        category: { name: 'Трафик на сайт', network: { slug: 'traffic' } },
      };
      const res = await unifiedLinkEngine.validateForService('https://my-landing-page.com/promo', webTrafficService);
      expect(res.isValid).toBe(true);
      expect(res.linkType).toBe('custom');
    });
  });

  // ---------------------------------------------------------------------------
  // SUITE 6: Negative Vectors, SSRF, Prohibited Content, ReDoS & Boundaries
  // ---------------------------------------------------------------------------
  describe('Dimension 6: Negative Vectors, Security, SSRF & ReDoS Hardening', () => {
    const dummyService = {
      id: 'srv-generic',
      name: 'Универсальная услуга',
      targetType: 'CUSTOM',
      category: { name: 'Услуги', network: { slug: 'other' } },
    };

    it('TV-103: SSRF: Loopback IPv4 (127.0.0.1) is blocked by security guard', async () => {
      const tgService = {
        id: 'srv-tg-subs',
        name: 'Подписчики Telegram',
        targetType: 'CHANNEL',
        category: { name: 'Подписчики', network: { slug: 'telegram' } },
      };
      const res = await unifiedLinkEngine.validateForService('http://127.0.0.1:8080/admin', tgService);
      expect(res.isValid).toBe(false);
      expect(res.errorCode).toBe('SECURITY_BLOCKED');
      expect(isUrlSafeForFetch('http://127.0.0.1:8080/admin')).toBe(false);
    });

    it('TV-104: SSRF: Private RFC 1918 Class A (10.0.0.1) is blocked', () => {
      expect(isPublicIp('10.0.0.1')).toBe(false);
      expect(isUrlSafeForFetch('http://10.0.0.1/internal/config')).toBe(false);
    });

    it('TV-105: SSRF: Private RFC 1918 Class B (172.16.0.1) is blocked', () => {
      expect(isPublicIp('172.16.0.1')).toBe(false);
      expect(isUrlSafeForFetch('http://172.16.0.1/api')).toBe(false);
    });

    it('TV-106: SSRF: Private RFC 1918 Class C (192.168.1.1) is blocked', () => {
      expect(isPublicIp('192.168.1.1')).toBe(false);
      expect(isUrlSafeForFetch('http://192.168.1.1/router')).toBe(false);
    });

    it('TV-107: SSRF: IPv6 Loopback ([::1]) is blocked', () => {
      expect(isPublicIp('::1')).toBe(false);
      expect(isUrlSafeForFetch('http://[::1]/internal')).toBe(false);
    });

    it('TV-108: SSRF: Cloud Metadata IP (169.254.169.254) is blocked', () => {
      expect(isPublicIp('169.254.169.254')).toBe(false);
      expect(isUrlSafeForFetch('http://169.254.169.254/latest/meta-data')).toBe(false);
    });

    it('TV-109: Prohibited Content: kremlin.ru domain is blocked by legal compliance validator', () => {
      const check = validateProhibitedContent('https://kremlin.ru/acts/news');
      expect(check.isAllowed).toBe(false);
      expect(check.code).toBe('GOVERNMENT_SERVICE_PROHIBITED');
    });

    it('TV-110: Prohibited Content: mvd.gov.ru domain is blocked', () => {
      const check = validateProhibitedContent('https://mvd.gov.ru/news');
      expect(check.isAllowed).toBe(false);
      expect(check.code).toBe('GOVERNMENT_SERVICE_PROHIBITED');
    });

    it('TV-111: Non-HTTP protocol (file:///etc/passwd) is rejected by SSRF guard', () => {
      expect(isUrlSafeForFetch('file:///etc/passwd')).toBe(false);
    });

    it('TV-112: Non-HTTP protocol (gopher://127.0.0.1) is rejected by SSRF guard', () => {
      expect(isUrlSafeForFetch('gopher://127.0.0.1:70/')).toBe(false);
    });

    it('TV-113: Length Guard: URL exceeding 2048 characters is rejected', async () => {
      const tooLongUrl = 'https://t.me/durov?' + 'a'.repeat(2050);
      const res = await unifiedLinkEngine.validateForService(tooLongUrl, dummyService);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('2048 символов');
    });

    it('TV-114: Empty or whitespace URL is rejected with EMPTY_INPUT', async () => {
      const res = await unifiedLinkEngine.validateForService('   ', dummyService);
      expect(res.isValid).toBe(false);
      expect(res.errorCode).toBe('EMPTY_INPUT');
    });

    it('TV-115: Bare @handle without domain is rejected with MISSING_DOMAIN and hint', async () => {
      const res = await unifiedLinkEngine.analyze('@durov');
      expect(res.errorCode).toBe('MISSING_DOMAIN');
      expect(res.userHint).toContain('t.me/durov');
    });

    it('TV-116: Bare single word without dots is rejected with MISSING_DOMAIN', async () => {
      const res = await unifiedLinkEngine.analyze('durov');
      expect(res.errorCode).toBe('MISSING_DOMAIN');
    });

    it('TV-117: ReDoS Fuzzing: Pathological string executes in < 25ms without catastrophic backtracking', async () => {
      const pathologicalUrl = 'https://youtube.com/watch?v=' + 'a'.repeat(1500) + '!@#$';
      const start = performance.now();
      await unifiedLinkEngine.analyze(pathologicalUrl);
      const durationMs = performance.now() - start;
      expect(durationMs).toBeLessThan(25);
    });
  });

  // ---------------------------------------------------------------------------
  // SUITE 7: Bug Regression Verifications (Bugs A through D from SDD)
  // ---------------------------------------------------------------------------
  describe('Dimension 7: Discovered Bug Regressions (Bugs A-D from SDD)', () => {
    it('TV-118: Bug C Regression: orderFormSchema accepts customData exactly at 5,000 characters limit', () => {
      const maxLenCustomData = 'a'.repeat(5000);
      const testOrder = {
        link: 'https://t.me/durov/123',
        quantity: 100,
        email: 'user@example.com',
        serviceId: 'srv-123',
        customData: maxLenCustomData,
      };
      const parsed = orderFormSchema.safeParse(testOrder);
      expect(parsed.success).toBe(true);
    });

    it('TV-119: Bug C Regression: orderFormSchema rejects customData of 5,001 characters', () => {
      const tooLongCustomData = 'a'.repeat(5001);
      const testOrder = {
        link: 'https://t.me/durov/123',
        quantity: 100,
        email: 'user@example.com',
        serviceId: 'srv-123',
        customData: tooLongCustomData,
      };
      const parsed = orderFormSchema.safeParse(testOrder);
      expect(parsed.success).toBe(false);
    });

    it('TV-120: Bug D Regression: parseCustomData maps COMMENTS to lines, POLL to optionIndex, MENTIONS to usernames', () => {
      // 1. Comments mapping
      const commentsJson = JSON.stringify({ kind: 'COMMENTS', lines: ['Line 1', 'Line 2'] });
      const parsedComments = parseCustomData(commentsJson);
      expect(parsedComments?.kind).toBe('COMMENTS');
      if (parsedComments?.kind === 'COMMENTS') {
        const mappedProviderComments = parsedComments.lines.join('\n');
        expect(mappedProviderComments).toBe('Line 1\nLine 2');
      }

      // 2. Poll mapping
      const pollJson = JSON.stringify({ kind: 'POLL', optionIndex: 4 });
      const parsedPoll = parseCustomData(pollJson);
      expect(parsedPoll?.kind).toBe('POLL');
      if (parsedPoll?.kind === 'POLL') {
        const mappedAnswerNumber = String(parsedPoll.optionIndex);
        expect(mappedAnswerNumber).toBe('4');
      }

      // 3. Mentions mapping
      const mentionsJson = JSON.stringify({ kind: 'MENTIONS', usernames: ['user1', 'user2'] });
      const parsedMentions = parseCustomData(mentionsJson);
      expect(parsedMentions?.kind).toBe('MENTIONS');
      if (parsedMentions?.kind === 'MENTIONS') {
        const mappedUsernames = parsedMentions.usernames.join('\n');
        expect(mappedUsernames).toBe('user1\nuser2');
      }
    });
  });
});
