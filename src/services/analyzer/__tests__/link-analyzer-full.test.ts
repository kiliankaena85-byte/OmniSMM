import { describe, it, expect, vi } from 'vitest';
import { safeUrlForLog } from '@/lib/log-safe';
import { isPublicHost, isPublicIp, resolveShortLink } from '@/lib/ssrf-guard';
import { IntelligenceLinkAnalyzer } from '../link-analyzer';
import { IntelligencePlatform } from '../link-rules';
import { getCustomValidator } from '@/validators/link-mutators';
import { matchesSuggestedCategory } from '../category-matcher';
import * as adminAudit from '@/lib/admin-audit';

describe('Full Link Analyzer Remediation Suite (L-1, L-3, L-4, L-6, L-new1..L-new5)', () => {
  describe('L-new1: safeUrlForLog', () => {
    it('strips query parameters and hashes from URLs for privacy', () => {
      expect(safeUrlForLog('https://example.com/page?secret=123&user=admin#hash')).toBe('https://example.com/page');
      expect(safeUrlForLog('https://t.me/durov?start=ref123')).toBe('https://t.me/durov');
    });

    it('handles unparseable or null input safely', () => {
      expect(safeUrlForLog('')).toBe('[unparseable-url]');
      expect(safeUrlForLog(null)).toBe('[unparseable-url]');
      expect(safeUrlForLog(':::invalid-url')).toBe('[unparseable-url]');
    });
  });

  describe('L-1: SSRF Guard (protocol, internal IPs, redirect limits)', () => {
    it('returns raw input for non-HTTP/HTTPS protocols', async () => {
      expect(await resolveShortLink('file:///etc/passwd')).toBe('file:///etc/passwd');
      expect(await resolveShortLink('gopher://127.0.0.1:70')).toBe('gopher://127.0.0.1:70');
      expect(await resolveShortLink('dict://127.0.0.1:2628')).toBe('dict://127.0.0.1:2628');
    });

    it('rejects private and loopback IPv4/IPv6 addresses', () => {
      expect(isPublicIp('127.0.0.1')).toBe(false);
      expect(isPublicIp('10.0.0.1')).toBe(false);
      expect(isPublicIp('172.16.0.1')).toBe(false);
      expect(isPublicIp('192.168.1.1')).toBe(false);
      expect(isPublicIp('169.254.1.1')).toBe(false);
      expect(isPublicIp('0.0.0.0')).toBe(false);
      expect(isPublicIp('::1')).toBe(false);
      expect(isPublicIp('fc00::1')).toBe(false);
      expect(isPublicIp('fe80::1')).toBe(false);
      expect(isPublicIp('8.8.8.8')).toBe(true);
    });

    it('rejects internal hostnames like localhost, .local, .internal', async () => {
      expect(await isPublicHost('localhost')).toBe(false);
      expect(await isPublicHost('app.local')).toBe(false);
      expect(await isPublicHost('server.internal')).toBe(false);
    });
  });

  describe('L-new2 & L-new3: normalizeForMatch and first-match order', () => {
    const analyzer = new IntelligenceLinkAnalyzer();

    it('normalizes uppercase host and percent-encoding before matching', async () => {
      const res = await analyzer.analyze('https://T.ME/%64%75%72%6f%76');
      expect(res.platform).toBe(IntelligencePlatform.TELEGRAM);
      expect(res.id).toBe('durov');
    });

    it('guarantees first-match rule priority for chameleon links', async () => {
      // Private post matches private_post before generic channel rule
      const resPrivate = await analyzer.analyze('https://t.me/c/12345/6789');
      expect(resPrivate.platform).toBe(IntelligencePlatform.TELEGRAM);
      expect(resPrivate.type).toBe('private_post');

      // Bot link matches bot rule before generic channel rule
      const resBot = await analyzer.analyze('https://t.me/my_smm_bot');
      expect(resBot.platform).toBe(IntelligencePlatform.TELEGRAM);
      expect(resBot.type).toBe('bot');
    });

    it('validates @username handle by requiring explicit domain (Option B INV-1)', async () => {
      const resInvalid = await analyzer.analyze('@durov<script>');
      expect(resInvalid.platform).toBe(IntelligencePlatform.OTHER);

      const resValid = await analyzer.analyze('@durov');
      expect(resValid.platform).toBe(IntelligencePlatform.OTHER);
      expect(resValid.errorCode).toBe('MISSING_DOMAIN');
      expect(resValid.userHint).toContain('t.me/durov');
    });
  });

  describe('L-new4: CUSTOM Validator (getCustomValidator)', () => {
    it('validates NUMBER custom input strictly', () => {
      const numberValidator = getCustomValidator('NUMBER');
      expect(numberValidator.safeParse('12345').success).toBe(true);
      expect(numberValidator.safeParse('123a45').success).toBe(false);
      expect(numberValidator.safeParse('').success).toBe(false);
    });

    it('validates TEXTAREA custom input with control character check', () => {
      const textareaValidator = getCustomValidator('TEXTAREA');
      expect(textareaValidator.safeParse('Hello World\nLine 2').success).toBe(true);
      expect(textareaValidator.safeParse('Bad\x00Control').success).toBe(false);
      expect(textareaValidator.safeParse('a'.repeat(10001)).success).toBe(false);
    });

    it('validates NONE custom input as non-empty string', () => {
      const defaultValidator = getCustomValidator('NONE');
      expect(defaultValidator.safeParse('Valid').success).toBe(true);
      expect(defaultValidator.safeParse('   ').success).toBe(false);
    });
  });

  describe('L-new5: CATEGORY_UNMAPPED Handling', () => {
    it('correctly rejects unmapped category mismatch', async () => {
      const matched = matchesSuggestedCategory('Неизвестная Категория 123', ['Подписчики']);
      expect(matched).toBe(false);
    });
  });

  describe('2026 Formats: TikTok Photo Mode & Instagram Stories/Highlights', () => {
    const analyzer = new IntelligenceLinkAnalyzer();

    it('accurately parses TikTok Photo Mode links (/photo/)', async () => {
      const res = await analyzer.analyze('https://www.tiktok.com/@creator/photo/7123456789012345678');
      expect(res.platform).toBe('TIKTOK');
      expect(res.type).toBe('video');
      expect(res.id).toBe('7123456789012345678');
    });

    it('accurately parses Instagram temporary stories links', async () => {
      const res = await analyzer.analyze('https://www.instagram.com/stories/username/3123456789012345678/');
      expect(res.platform).toBe('INSTAGRAM');
      expect(res.type).toBe('story');
    });

    it('accurately parses Instagram highlights links', async () => {
      const res = await analyzer.analyze('https://www.instagram.com/stories/highlights/17987654321012345/');
      expect(res.platform).toBe('INSTAGRAM');
      expect(res.type).toBe('highlight');
      expect(res.id).toBe('17987654321012345');
    });

    it('accurately parses Twitch VOD past broadcasts (/videos/)', async () => {
      const res = await analyzer.analyze('https://www.twitch.tv/videos/1234567890');
      expect(res.platform).toBe('TWITCH');
      expect(res.type).toBe('video');
      expect(res.id).toBe('1234567890');
    });

    it('accurately parses Twitch Clips (clips.twitch.tv)', async () => {
      const res = await analyzer.analyze('https://clips.twitch.tv/BlushingCuteKangaroo');
      expect(res.platform).toBe('TWITCH');
      expect(res.type).toBe('clip');
      expect(res.id).toBe('BlushingCuteKangaroo');
    });

    it('accurately parses Spotify artist profiles (/artist/)', async () => {
      const res = await analyzer.analyze('https://open.spotify.com/artist/06HL4z0CvFAxyc27GXpf02');
      expect(res.platform).toBe('SPOTIFY');
      expect(res.type).toBe('artist');
      expect(res.id).toBe('06HL4z0CvFAxyc27GXpf02');
    });

    it('accurately parses Rutube embed players (play/embed/hash)', async () => {
      const res = await analyzer.analyze('https://rutube.ru/play/embed/e1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6');
      expect(res.platform).toBe('RUTUBE');
      expect(res.type).toBe('video');
      expect(res.id).toBe('e1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6');
    });

    it('accurately parses Dzen vertical shorts (/shorts/)', async () => {
      const res = await analyzer.analyze('https://dzen.ru/shorts/65a123456789abcdef');
      expect(res.platform).toBe('DZEN');
      expect(res.type).toBe('post');
      expect(res.id).toBe('65a123456789abcdef');
    });

    it('accurately parses Dzen legacy Yandex Zen channels (zen.yandex.ru)', async () => {
      const res = await analyzer.analyze('https://zen.yandex.ru/id/60a123456789abcdef');
      expect(res.platform).toBe('DZEN');
      expect(res.type).toBe('channel');
      expect(res.id).toBe('60a123456789abcdef');
    });

    it('accurately parses Dzen media slug articles (/media/)', async () => {
      const res = await analyzer.analyze('https://dzen.ru/media/mychannel/how-to-code-60a123456789');
      expect(res.platform).toBe('DZEN');
      expect(res.type).toBe('post');
      expect(res.id).toBe('how-to-code-60a123456789');
    });

    it('accurately parses Likee web profile and video links (likee.video & likee.com)', async () => {
      const profileRes = await analyzer.analyze('https://likee.video/@supercreator');
      expect(profileRes.platform).toBe('LIKEE');
      expect(profileRes.type).toBe('profile');
      expect(profileRes.id).toBe('@supercreator');

      const videoRes = await analyzer.analyze('https://likee.com/@supercreator/video/123456789');
      expect(videoRes.platform).toBe('LIKEE');
      expect(videoRes.type).toBe('video');
      expect(videoRes.id).toBe('123456789');
    });

    it('accurately parses Likee mobile share links (/p/ profile & /v/ video)', async () => {
      const videoShort = await analyzer.analyze('https://l.likee.video/v/AbCdEf123');
      expect(videoShort.platform).toBe('LIKEE');
      expect(videoShort.type).toBe('video');
      expect(videoShort.id).toBe('AbCdEf123');

      const profileShort = await analyzer.analyze('https://l.likee.video/p/AbCdEf123');
      expect(profileShort.platform).toBe('LIKEE');
      expect(profileShort.type).toBe('profile');
      expect(profileShort.id).toBe('AbCdEf123');
    });
  });
});

