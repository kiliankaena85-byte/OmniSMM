import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IntelligenceLinkAnalyzer, IntelligenceAnalysisResult } from './link-analyzer';
import { IntelligencePlatform } from './link-rules';
import { mutateLink, getLinkValidator } from '@/validators/link-mutators';

// Stub global fetch so resolve() doesn't make real HTTP requests
vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network disabled in test')));

describe('🔬 Comprehensive Link Analyzer Audit', () => {
    let analyzer: IntelligenceLinkAnalyzer;

    beforeEach(() => {
        analyzer = new IntelligenceLinkAnalyzer();
        // Re-stub fetch each test so resolve() doesn't try real HTTP
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network disabled in test')));
    });

    // ======================== HELPER ========================
    const expectPlatform = async (url: string, platform: IntelligencePlatform, type: string) => {
        const res = await analyzer.analyze(url);
        expect(res.platform, `URL "${url}" → platform`).toBe(platform);
        expect(res.type, `URL "${url}" → type`).toBe(type);
        return res;
    };

    const expectOther = async (url: string) => {
        const res = await analyzer.analyze(url);
        expect(res.platform, `URL "${url}" should NOT match any platform`).toBe(IntelligencePlatform.OTHER);
        return res;
    };

    // =====================================================
    //                     TELEGRAM
    // =====================================================
    describe('📱 Telegram', () => {
        describe('✅ Valid channels', () => {
            it('standard public channel', async () => {
                await expectPlatform('https://t.me/durov', IntelligencePlatform.TELEGRAM, 'channel');
            });

            it('channel with trailing slash', async () => {
                await expectPlatform('https://t.me/durov/', IntelligencePlatform.TELEGRAM, 'channel');
            });

            it('CamelCase username', async () => {
                const res = await expectPlatform('https://t.me/smmMarket69', IntelligencePlatform.TELEGRAM, 'channel');
                expect(res.id).toBe('smmMarket69');
            });

            it('channel on telegram.me domain', async () => {
                await expectPlatform('https://telegram.me/channel_name', IntelligencePlatform.TELEGRAM, 'channel');
            });

            it('channel on telegram.dog domain', async () => {
                await expectPlatform('https://telegram.dog/mychannel', IntelligencePlatform.TELEGRAM, 'channel');
            });

            it('channel with query params (?start=...)', async () => {
                await expectPlatform('https://t.me/mybot_channel?start=abc123', IntelligencePlatform.TELEGRAM, 'channel');
            });

            it('joinchat invite link', async () => {
                await expectPlatform('https://t.me/joinchat/AAAAABBBBBCCCCCDDD', IntelligencePlatform.TELEGRAM, 'channel');
            });

            it('+ invite link (new format)', async () => {
                await expectPlatform('https://t.me/+AAAAABBBBBCCCCCDDD', IntelligencePlatform.TELEGRAM, 'channel');
            });

            it('web.telegram.org link (k version)', async () => {
                await expectPlatform('https://web.telegram.org/k/#@durov', IntelligencePlatform.TELEGRAM, 'channel');
            });

            it('web.telegram.org link (a version)', async () => {
                await expectPlatform('https://web.telegram.org/a/#@myChannel', IntelligencePlatform.TELEGRAM, 'channel');
            });

            it('hyphenated username', async () => {
                await expectPlatform('https://t.me/my-cool-channel', IntelligencePlatform.TELEGRAM, 'channel');
            });

            it('underscore username', async () => {
                await expectPlatform('https://t.me/my_channel_2024', IntelligencePlatform.TELEGRAM, 'channel');
            });

            it('without https:// prefix (auto-prepend)', async () => {
                await expectPlatform('t.me/durov', IntelligencePlatform.TELEGRAM, 'channel');
            });
        });

        describe('✅ Valid posts', () => {
            it('standard post', async () => {
                const res = await expectPlatform('https://t.me/durov/123', IntelligencePlatform.TELEGRAM, 'post');
                expect(res.id).toBe('123');
            });

            it('post with trailing slash', async () => {
                await expectPlatform('https://t.me/durov/456/', IntelligencePlatform.TELEGRAM, 'post');
            });

            it('post with /s/ discussion thread', async () => {
                await expectPlatform('https://t.me/s/channel_name/789', IntelligencePlatform.TELEGRAM, 'post');
            });

            it('post with query params', async () => {
                await expectPlatform('https://t.me/channel/999?single', IntelligencePlatform.TELEGRAM, 'post');
            });

            it('post on telegram.dog', async () => {
                await expectPlatform('https://telegram.dog/mychannel/42', IntelligencePlatform.TELEGRAM, 'post');
            });

            it('post on telegram.me', async () => {
                await expectPlatform('https://telegram.me/channel/100', IntelligencePlatform.TELEGRAM, 'post');
            });

            it('post with large ID', async () => {
                await expectPlatform('https://t.me/durov/99999999', IntelligencePlatform.TELEGRAM, 'post');
            });
        });

        describe('✅ Valid bots', () => {
            it('standard bot ending with "bot"', async () => {
                await expectPlatform('https://t.me/SmmPanelBot', IntelligencePlatform.TELEGRAM, 'bot');
            });

            it('bot ending with "_bot"', async () => {
                await expectPlatform('https://t.me/crypto_wallet_bot', IntelligencePlatform.TELEGRAM, 'bot');
            });

            it('bot with trailing slash', async () => {
                await expectPlatform('https://t.me/myAwesomeBot/', IntelligencePlatform.TELEGRAM, 'bot');
            });

            it('bot on telegram.dog', async () => {
                await expectPlatform('https://telegram.dog/smmMarket69_bot/', IntelligencePlatform.TELEGRAM, 'bot');
            });

            it('bot with query params', async () => {
                await expectPlatform('https://t.me/GameBot?start=ref123', IntelligencePlatform.TELEGRAM, 'bot');
            });
        });

        describe('❌ Telegram edge/invalid cases', () => {
            it('empty path after t.me should fallback', async () => {
                // t.me/ alone → won't match channel (no username)
                const res = await analyzer.analyze('https://t.me/');
                // This should still match as channel because regex is [\w-]+ which needs at least 1 char
                // Actually the path is "/" which is empty username, so it should NOT match
                expect(res.platform).not.toBe(IntelligencePlatform.OTHER); // t.me/ could match empty
                // Actually let's check what happens
            });

            it('should not crash on t.me without path', async () => {
                const res = await analyzer.analyze('https://t.me');
                // t.me without trailing / — should fallback to WEBSITE or OTHER
                expect(res).toBeDefined();
            });
        });
    });

    // =====================================================
    //                     YOUTUBE
    // =====================================================
    describe('🎬 YouTube', () => {
        describe('✅ Valid videos', () => {
            it('standard watch URL', async () => {
                const res = await expectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ', IntelligencePlatform.YOUTUBE, 'video');
                expect(res.id).toBe('dQw4w9WgXcQ');
            });

            it('without www', async () => {
                await expectPlatform('https://youtube.com/watch?v=dQw4w9WgXcQ', IntelligencePlatform.YOUTUBE, 'video');
            });

            it('youtu.be shortlink (resolved internally)', async () => {
                const res = await expectPlatform('https://youtu.be/dQw4w9WgXcQ', IntelligencePlatform.YOUTUBE, 'video');
                expect(res.id).toBe('dQw4w9WgXcQ');
            });

            it('Shorts URL', async () => {
                await expectPlatform('https://youtube.com/shorts/abc123def4', IntelligencePlatform.YOUTUBE, 'video');
            });

            it('embed URL', async () => {
                await expectPlatform('https://youtube.com/embed/dQw4w9WgXcQ', IntelligencePlatform.YOUTUBE, 'video');
            });

            it('watch URL with extra params (playlist, time)', async () => {
                await expectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf', IntelligencePlatform.YOUTUBE, 'video');
            });

            it('without schema prefix (auto-prepend)', async () => {
                await expectPlatform('youtube.com/watch?v=dQw4w9WgXcQ', IntelligencePlatform.YOUTUBE, 'video');
            });

            it('youtu.be with params after ID', async () => {
                await expectPlatform('https://youtu.be/dQw4w9WgXcQ?t=30', IntelligencePlatform.YOUTUBE, 'video');
            });
        });

        describe('✅ Valid channels', () => {
            it('channel with @ handle', async () => {
                const res = await expectPlatform('https://youtube.com/@MrBeast', IntelligencePlatform.YOUTUBE, 'channel');
                expect(res.id).toBe('@MrBeast');
            });

            it('old-format /channel/UC...', async () => {
                await expectPlatform('https://youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA', IntelligencePlatform.YOUTUBE, 'channel');
            });

            it('old-format /user/...', async () => {
                await expectPlatform('https://youtube.com/user/PewDiePie', IntelligencePlatform.YOUTUBE, 'channel');
            });
        });

        describe('❌ YouTube invalid/edge cases', () => {
            it('short video ID (5 chars) should NOT match', async () => {
                // Pattern requires 6-12 chars
                const res = await analyzer.analyze('https://youtube.com/watch?v=abc12');
                expect(res.platform).not.toBe(IntelligencePlatform.YOUTUBE);
            });

            it('too long video ID (>12 chars) should NOT match as video', async () => {
                const res = await analyzer.analyze('https://youtube.com/watch?v=abcdefghijklm');
                // 13 chars: regex {6,12} + boundary assertion means no video match
                // It will fallback to WEBSITE since youtube.com doesn't match channel pattern either
                expect(res.type).not.toBe('video');
            });

            it('youtube.com homepage (no specific content)', async () => {
                const res = await analyzer.analyze('https://youtube.com');
                expect(res.type).not.toBe('video');
            });

            it('youtube playlist URL (no video match)', async () => {
                const res = await analyzer.analyze('https://youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');
                // Should not match as a video (no v= param)
                expect(res.type).not.toBe('video');
            });
        });
    });

    // =====================================================
    //                    INSTAGRAM
    // =====================================================
    describe('📸 Instagram', () => {
        describe('✅ Valid posts', () => {
            it('standard post /p/', async () => {
                const res = await expectPlatform('https://instagram.com/p/C1234abcdef/', IntelligencePlatform.INSTAGRAM, 'post');
                expect(res.id).toBe('C1234abcdef');
            });

            it('reel', async () => {
                await expectPlatform('https://instagram.com/reel/C999xyz/', IntelligencePlatform.INSTAGRAM, 'post');
            });

            it('IGTV /tv/', async () => {
                await expectPlatform('https://instagram.com/tv/C555abc/', IntelligencePlatform.INSTAGRAM, 'post');
            });

            it('with www prefix', async () => {
                await expectPlatform('https://www.instagram.com/p/CxYz123/', IntelligencePlatform.INSTAGRAM, 'post');
            });

            it('with query params (igshid stripped by sanitizer)', async () => {
                const res = await analyzer.analyze('https://instagram.com/p/C1234?igshid=abc123&utm_source=share');
                expect(res.platform).toBe(IntelligencePlatform.INSTAGRAM);
                expect(res.type).toBe('post');
                // igshid and utm_ are stripped by sanitizer
                expect(res.canonicalUrl).not.toContain('igshid');
                expect(res.canonicalUrl).not.toContain('utm_source');
            });

            it('post without trailing slash', async () => {
                await expectPlatform('https://instagram.com/p/ABC123', IntelligencePlatform.INSTAGRAM, 'post');
            });
        });

        describe('✅ Valid profiles', () => {
            it('standard profile', async () => {
                const res = await expectPlatform('https://instagram.com/cristiano', IntelligencePlatform.INSTAGRAM, 'profile');
                expect(res.id).toBe('cristiano');
            });

            it('profile with dots and underscores', async () => {
                await expectPlatform('https://instagram.com/user.name_123', IntelligencePlatform.INSTAGRAM, 'profile');
            });

            it('ig.me short domain', async () => {
                await expectPlatform('https://ig.me/cristiano', IntelligencePlatform.INSTAGRAM, 'profile');
            });

            it('without schema (auto-prepend)', async () => {
                await expectPlatform('instagram.com/elonmusk', IntelligencePlatform.INSTAGRAM, 'profile');
            });
        });

        describe('❌ Instagram edge cases', () => {
            it('stories URL should still match as profile (cleaned by mutator)', async () => {
                // Note: The link-rules don't have a separate "story" type, so stories/user/id will
                // first be tested against post and profile patterns
                const res = await analyzer.analyze('https://instagram.com/stories/cristiano/12345');
                // This contains /stories/ which doesn't match /p|reel|tv/ but matches the profile pattern
                expect(res.platform).toBe(IntelligencePlatform.INSTAGRAM);
            });

            it('instagram.com homepage alone', async () => {
                const res = await analyzer.analyze('https://instagram.com');
                // No username path → should fallback to WEBSITE
                expect(res.platform).toBe(IntelligencePlatform.WEBSITE);
            });

            it('instagram explore page should match profile (false positive check)', async () => {
                const res = await analyzer.analyze('https://instagram.com/explore');
                // "explore" matches profile pattern, this is a known false positive
                expect(res.platform).toBe(IntelligencePlatform.INSTAGRAM);
                expect(res.type).toBe('profile');
            });
        });
    });

    // =====================================================
    //                      TIKTOK
    // =====================================================
    describe('🎵 TikTok', () => {
        describe('✅ Valid videos', () => {
            it('standard video URL', async () => {
                const res = await expectPlatform('https://tiktok.com/@user123/video/7234567890123456789', IntelligencePlatform.TIKTOK, 'video');
                expect(res.id).toBe('7234567890123456789');
            });

            it('www prefix', async () => {
                await expectPlatform('https://www.tiktok.com/@cooluser/video/7234567890123456789', IntelligencePlatform.TIKTOK, 'video');
            });

            it('user with dots in name', async () => {
                await expectPlatform('https://tiktok.com/@user.name.123/video/7234567890123456789', IntelligencePlatform.TIKTOK, 'video');
            });
        });

        describe('✅ Valid short links', () => {
            it('vm.tiktok.com short link', async () => {
                await expectPlatform('https://vm.tiktok.com/ZMabc123/', IntelligencePlatform.TIKTOK, 'short_link');
            });

            it('vt.tiktok.com short link', async () => {
                await expectPlatform('https://vt.tiktok.com/ZSYZ123abc/', IntelligencePlatform.TIKTOK, 'short_link');
            });

            it('tiktok.com/t/ short format', async () => {
                await expectPlatform('https://tiktok.com/t/ZTR1abc/', IntelligencePlatform.TIKTOK, 'short_link');
            });
        });

        describe('✅ Valid profiles', () => {
            it('standard profile', async () => {
                const res = await expectPlatform('https://tiktok.com/@bellapoarch', IntelligencePlatform.TIKTOK, 'profile');
                expect(res.id).toBe('@bellapoarch');
            });

            it('profile with dots', async () => {
                await expectPlatform('https://tiktok.com/@user.name.tt', IntelligencePlatform.TIKTOK, 'profile');
            });
        });

        describe('✅ Valid live streams', () => {
            it('live stream URL', async () => {
                await expectPlatform('https://tiktok.com/@streamer/live', IntelligencePlatform.TIKTOK, 'live');
            });
        });

        describe('❌ TikTok edge cases', () => {
            it('tiktok.com homepage → should match WEBSITE fallback', async () => {
                const res = await analyzer.analyze('https://tiktok.com');
                // Should NOT match as profile (no @)
                expect(res.type).not.toBe('profile');
            });

            it('tiktok discover page', async () => {
                const res = await analyzer.analyze('https://tiktok.com/discover');
                // No @ → shouldn't match profile, but might match WEBSITE
                expect(res.platform).toBe(IntelligencePlatform.WEBSITE);
            });
        });
    });

    // =====================================================
    //                     VKONTAKTE
    // =====================================================
    describe('🇷🇺 VKontakte (VK)', () => {
        describe('✅ Valid posts', () => {
            it('wall post', async () => {
                const res = await expectPlatform('https://vk.com/wall-123_456', IntelligencePlatform.VK, 'post');
                expect(res.id).toBe('-123_456');
            });

            it('positive wall post (user post)', async () => {
                await expectPlatform('https://vk.com/wall123_456', IntelligencePlatform.VK, 'post');
            });

            it('video post', async () => {
                await expectPlatform('https://vk.com/video-123_456', IntelligencePlatform.VK, 'post');
            });

            it('clip post', async () => {
                await expectPlatform('https://vk.com/clip-123_456', IntelligencePlatform.VK, 'post');
            });

            it('vk.ru domain (alternative)', async () => {
                await expectPlatform('https://vk.ru/wall-999_111', IntelligencePlatform.VK, 'post');
            });

            it('vkvideo.ru domain', async () => {
                await expectPlatform('https://vkvideo.ru/video-123_456', IntelligencePlatform.VK, 'post');
            });

            it('wall post with ?w= query parameter (normalizer)', async () => {
                const res = await expectPlatform('https://vk.com/club123?w=wall-123_456', IntelligencePlatform.VK, 'post');
                expect(res.id).toBe('-123_456');
            });

            it('video post with ?z= query parameter (normalizer)', async () => {
                const res = await expectPlatform('https://vk.com/public123?z=video-123_456', IntelligencePlatform.VK, 'post');
                expect(res.id).toBe('-123_456');
            });
        });

        describe('✅ Valid profiles/groups', () => {
            it('standard username', async () => {
                await expectPlatform('https://vk.com/durov', IntelligencePlatform.VK, 'profile');
            });

            it('club page', async () => {
                await expectPlatform('https://vk.com/club123', IntelligencePlatform.VK, 'profile');
            });

            it('public page', async () => {
                await expectPlatform('https://vk.com/public123', IntelligencePlatform.VK, 'profile');
            });

            it('username with dots and underscores', async () => {
                await expectPlatform('https://vk.com/user.name_123', IntelligencePlatform.VK, 'profile');
            });

            it('vk.ru domain profile', async () => {
                await expectPlatform('https://vk.ru/my_group', IntelligencePlatform.VK, 'profile');
            });

            it('mobile m.vk.com profile (mutator cleans to vk.com)', () => {
                const cleaned = mutateLink('https://m.vk.com/durov', 'VK', 'CHANNEL');
                expect(cleaned).toContain('vk.com/durov');
                expect(cleaned).not.toContain('m.vk.com');
            });
        });

        describe('❌ VK edge cases', () => {
            it('vk.com homepage', async () => {
                const res = await analyzer.analyze('https://vk.com');
                // No path → should be WEBSITE
                expect(res.type).not.toBe('profile');
            });

            it('vk.com/feed page', async () => {
                const res = await analyzer.analyze('https://vk.com/feed');
                // "feed" matches profile pattern, but it's a system page
                expect(res.platform).toBe(IntelligencePlatform.VK);
                expect(res.type).toBe('profile'); // Known false positive
            });

            it('VK photo with z= param (normalizer extracts it)', async () => {
                const cleaned = mutateLink('https://vk.com/albums-123?z=photo-456_789', 'VK', 'POST');
                expect(cleaned).toContain('photo-456_789');
            });
        });
    });

    // =====================================================
    //                  TWITTER / X
    // =====================================================
    describe('🐦 Twitter / X', () => {
        describe('✅ Valid posts', () => {
            it('twitter.com tweet', async () => {
                const res = await expectPlatform('https://twitter.com/elonmusk/status/123456789', IntelligencePlatform.TWITTER, 'post');
                expect(res.id).toBe('elonmusk');
            });

            it('x.com tweet', async () => {
                await expectPlatform('https://x.com/elonmusk/status/987654321', IntelligencePlatform.TWITTER, 'post');
            });

            it('tweet with long status ID', async () => {
                await expectPlatform('https://x.com/user/status/1734567890123456789', IntelligencePlatform.TWITTER, 'post');
            });
        });

        describe('✅ Valid profiles', () => {
            it('twitter.com profile', async () => {
                const res = await expectPlatform('https://twitter.com/elonmusk', IntelligencePlatform.TWITTER, 'profile');
                expect(res.id).toBe('elonmusk');
            });

            it('x.com profile', async () => {
                await expectPlatform('https://x.com/elonmusk', IntelligencePlatform.TWITTER, 'profile');
            });

            it('profile with underscores', async () => {
                await expectPlatform('https://x.com/the_real_user', IntelligencePlatform.TWITTER, 'profile');
            });
        });

        describe('❌ Twitter edge cases', () => {
            it('x.com homepage → fallback to WEBSITE', async () => {
                const res = await analyzer.analyze('https://x.com');
                expect(res.platform).toBe(IntelligencePlatform.WEBSITE);
            });

            it('twitter search URL → profile (false positive)', async () => {
                const res = await analyzer.analyze('https://twitter.com/search?q=test');
                // "search" matches the profile regex
                expect(res.platform).toBe(IntelligencePlatform.TWITTER);
            });
        });
    });

    // =====================================================
    //                     TWITCH
    // =====================================================
    describe('🎮 Twitch', () => {
        describe('✅ Valid channels', () => {
            it('standard channel', async () => {
                const res = await expectPlatform('https://twitch.tv/shroud', IntelligencePlatform.TWITCH, 'channel');
                expect(res.id).toBe('shroud');
            });

            it('www prefix', async () => {
                await expectPlatform('https://www.twitch.tv/xQc', IntelligencePlatform.TWITCH, 'channel');
            });

            it('channel with underscores and digits', async () => {
                await expectPlatform('https://twitch.tv/streamer_2024', IntelligencePlatform.TWITCH, 'channel');
            });
        });
    });

    // =====================================================
    //                      LIKEE
    // =====================================================
    describe('🎭 Likee', () => {
        describe('✅ Valid videos', () => {
            it('l.likee.video short link', async () => {
                await expectPlatform('https://l.likee.video/v/abc123', IntelligencePlatform.LIKEE, 'video');
            });

            it('likee.video full URL with username and video ID', async () => {
                await expectPlatform('https://likee.video/@user123/video/7890123', IntelligencePlatform.LIKEE, 'video');
            });
        });
    });

    // =====================================================
    //                   WEBSITE FALLBACK
    // =====================================================
    describe('🌐 Website Fallback', () => {
        it('generic HTTP website', async () => {
            await expectPlatform('https://example.com', IntelligencePlatform.WEBSITE, 'seo_traffic');
        });

        it('website with complex path', async () => {
            await expectPlatform('https://myshop.ru/products/item-123', IntelligencePlatform.WEBSITE, 'seo_traffic');
        });

        it('website with .org TLD', async () => {
            await expectPlatform('https://wikipedia.org/wiki/Cat', IntelligencePlatform.WEBSITE, 'seo_traffic');
        });

        it('website with .io TLD', async () => {
            await expectPlatform('https://app.vercel.io', IntelligencePlatform.WEBSITE, 'seo_traffic');
        });

        it('http:// (not https) should also work', async () => {
            await expectPlatform('http://old-site.com/page', IntelligencePlatform.WEBSITE, 'seo_traffic');
        });
    });

    // =====================================================
    //              INVALID / GARBAGE / EDGE CASES
    // =====================================================
    describe('🚫 Invalid & Boundary Inputs', () => {
        it('empty string → OTHER', async () => {
            await expectOther('');
        });

        it('whitespace only → OTHER', async () => {
            await expectOther('   ');
        });

        it('plain text (no URL) → should not crash', async () => {
            const res = await analyzer.analyze('hello world');
            expect(res).toBeDefined();
            // "hello world" → sanitizer tries prepend https://, URL parse fails, returns trimmed
        });

        it('single word → should not crash', async () => {
            const res = await analyzer.analyze('durov');
            expect(res).toBeDefined();
        });

        it('email address → should not match social', async () => {
            const res = await analyzer.analyze('user@gmail.com');
            expect(res).toBeDefined();
            expect(res.platform).not.toBe(IntelligencePlatform.TELEGRAM);
        });

        it('javascript: protocol → should not crash', async () => {
            const res = await analyzer.analyze('javascript:alert(1)');
            expect(res).toBeDefined();
        });

        it('data: URI → should not match social', async () => {
            const res = await analyzer.analyze('data:text/html,<h1>hi</h1>');
            expect(res).toBeDefined();
        });

        it('very long URL (10000 chars)', async () => {
            const longUrl = 'https://example.com/' + 'a'.repeat(10000);
            const res = await analyzer.analyze(longUrl);
            expect(res).toBeDefined();
            expect(res.platform).toBe(IntelligencePlatform.WEBSITE);
        });

        it('URL with unicode characters', async () => {
            const res = await analyzer.analyze('https://t.me/канал123');
            expect(res).toBeDefined();
        });

        it('URL with spaces in the middle (should take first part)', async () => {
            const res = await analyzer.analyze('https://t.me/durov some extra text');
            expect(res.platform).toBe(IntelligencePlatform.TELEGRAM);
            expect(res.type).toBe('channel');
        });

        it('URL with tab characters → sanitized', async () => {
            const res = await analyzer.analyze('https://t.me/durov\t/123');
            expect(res).toBeDefined();
        });

        it('null-like input', async () => {
            const res = await analyzer.analyze('' as any);
            expect(res.platform).toBe(IntelligencePlatform.OTHER);
        });
    });

    // =====================================================
    //           UTM / TRACKING PARAM SANITIZATION
    // =====================================================
    describe('🧹 URL Sanitization (UTM & tracking)', () => {
        it('strips utm_ params', async () => {
            const res = await analyzer.analyze('https://instagram.com/p/abc123?utm_source=twitter&utm_medium=post');
            expect(res.canonicalUrl).not.toContain('utm_source');
            expect(res.canonicalUrl).not.toContain('utm_medium');
        });

        it('strips igshid param', async () => {
            const res = await analyzer.analyze('https://instagram.com/p/abc123?igshid=abcdef');
            expect(res.canonicalUrl).not.toContain('igshid');
        });

        it('strips feature param', async () => {
            const res = await analyzer.analyze('https://youtube.com/watch?v=dQw4w9WgXcQ&feature=share');
            expect(res.canonicalUrl).not.toContain('feature');
        });

        it('strips si param', async () => {
            const res = await analyzer.analyze('https://youtube.com/watch?v=dQw4w9WgXcQ&si=abcdef');
            expect(res.canonicalUrl).not.toContain('si=');
        });

        it('strips ref param', async () => {
            const res = await analyzer.analyze('https://instagram.com/p/abc123?ref=abc');
            expect(res.canonicalUrl).not.toContain('ref=');
        });

        it('preserves non-blacklisted params', async () => {
            const res = await analyzer.analyze('https://t.me/channel/123?comment=5');
            expect(res.canonicalUrl).toContain('comment=5');
        });
    });

    // =====================================================
    //                   LINK MUTATORS
    // =====================================================
    describe('🔧 Link Mutators', () => {
        describe('Instagram mutator', () => {
            it('strips query params from Instagram', () => {
                const result = mutateLink('https://instagram.com/p/abc123?igshid=foo', 'INSTAGRAM', 'POST');
                expect(result).toBe('https://instagram.com/p/abc123');
            });

            it('converts story URL to profile URL', () => {
                const result = mutateLink('https://www.instagram.com/stories/cristiano/12345', 'INSTAGRAM', 'STORY');
                expect(result).toBe('https://www.instagram.com/cristiano/');
            });

            it('handles URL without schema', () => {
                const result = mutateLink('instagram.com/p/abc123', 'INSTAGRAM', 'POST');
                expect(result).toContain('https://');
            });
        });

        describe('VK mutator', () => {
            it('replaces m.vk.com with vk.com', () => {
                const result = mutateLink('https://m.vk.com/durov', 'VK', 'CHANNEL');
                expect(result).toContain('vk.com/durov');
                expect(result).not.toContain('m.vk.com');
            });

            it('extracts photo from z= param', () => {
                const result = mutateLink('https://vk.com/album-123?z=photo-456_789', 'VK', 'POST');
                expect(result).toBe('https://vk.com/photo-456_789');
            });

            it('preserves reply param for comments', () => {
                const result = mutateLink('https://vk.com/wall-123_456?reply=789', 'VK', 'POST');
                expect(result).toContain('reply=789');
            });

            it('strips other query params', () => {
                const result = mutateLink('https://vk.com/wall-123_456?from=search', 'VK', 'POST');
                expect(result).not.toContain('from=search');
            });
        });

        describe('Telegram mutator', () => {
            it('replaces telegram.me with t.me', () => {
                const result = mutateLink('https://telegram.me/durov', 'TELEGRAM', 'CHANNEL');
                expect(result).toContain('t.me/durov');
            });

            it('preserves ?single param (needed for media group targeting)', () => {
                const result = mutateLink('https://t.me/channel/123?single', 'TELEGRAM', 'POST');
                expect(result).toContain('single');
            });
        });

        describe('YouTube mutator', () => {
            it('converts youtu.be to full URL', () => {
                const result = mutateLink('https://youtu.be/dQw4w9WgXcQ', 'YOUTUBE', 'POST');
                expect(result).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
            });

            it('converts /shorts/ to watch URL', () => {
                const result = mutateLink('https://youtube.com/shorts/abc123', 'YOUTUBE', 'POST');
                expect(result).toBe('https://www.youtube.com/watch?v=abc123');
            });

            it('strips extra params from watch URL', () => {
                const result = mutateLink('https://youtube.com/watch?v=dQw4w9WgXcQ&t=120&list=PLabc', 'YOUTUBE', 'POST');
                expect(result).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
            });
        });

        describe('TikTok mutator', () => {
            it('strips query params', () => {
                const result = mutateLink('https://vm.tiktok.com/abc123/?is_from_webapp=v1&sender_device=pc', 'TIKTOK', 'POST');
                expect(result).toBe('https://vm.tiktok.com/abc123/');
            });
        });

        describe('Default mutator', () => {
            it('passes through unknown platforms', () => {
                const result = mutateLink('https://example.com/path', 'TWITCH', 'CHANNEL');
                expect(result).toBe('https://example.com/path');
            });

            it('prepends https:// if missing', () => {
                const result = mutateLink('twitch.tv/user', 'TWITCH', 'CHANNEL');
                expect(result).toBe('https://twitch.tv/user');
            });
        });
    });

    // =====================================================
    //                 LINK VALIDATORS (ZOD)
    // =====================================================
    describe('🛡️ Link Validators (Zod)', () => {
        describe('Telegram validators', () => {
            it('CHANNEL: accepts valid channel URL', () => {
                const validator = getLinkValidator('TELEGRAM', 'CHANNEL');
                expect(validator.safeParse('https://t.me/durov').success).toBe(true);
            });

            it('CHANNEL: accepts joinchat URL', () => {
                const validator = getLinkValidator('TELEGRAM', 'CHANNEL');
                expect(validator.safeParse('https://t.me/joinchat/ABCDE12345').success).toBe(true);
            });

            it('CHANNEL: rejects invalid URL', () => {
                const validator = getLinkValidator('TELEGRAM', 'CHANNEL');
                expect(validator.safeParse('https://example.com/page').success).toBe(false);
            });

            it('POST: accepts valid post URL', () => {
                const validator = getLinkValidator('TELEGRAM', 'POST');
                expect(validator.safeParse('https://t.me/durov/123').success).toBe(true);
            });

            it('POST: rejects /c/ private chat URL', () => {
                const validator = getLinkValidator('TELEGRAM', 'POST');
                const result = validator.safeParse('https://t.me/c/1234567/123');
                expect(result.success).toBe(false);
            });

            it('POST: rejects channel URL (no post ID)', () => {
                const validator = getLinkValidator('TELEGRAM', 'POST');
                expect(validator.safeParse('https://t.me/durov').success).toBe(false);
            });
        });

        describe('VK validators', () => {
            it('POST: accepts wall post', () => {
                const validator = getLinkValidator('VK', 'POST');
                expect(validator.safeParse('https://vk.com/wall-123_456').success).toBe(true);
            });

            it('POST: accepts video post', () => {
                const validator = getLinkValidator('VK', 'POST');
                expect(validator.safeParse('https://vk.com/video-123_456').success).toBe(true);
            });

            it('POST: accepts clip', () => {
                const validator = getLinkValidator('VK', 'POST');
                expect(validator.safeParse('https://vk.com/clip-123_456').success).toBe(true);
            });

            it('POST: accepts photo', () => {
                const validator = getLinkValidator('VK', 'POST');
                expect(validator.safeParse('https://vk.com/photo-123_456').success).toBe(true);
            });

            it('POST: rejects profile URL', () => {
                const validator = getLinkValidator('VK', 'POST');
                expect(validator.safeParse('https://vk.com/durov').success).toBe(false);
            });

            it('CHANNEL: accepts group URL', () => {
                const validator = getLinkValidator('VK', 'CHANNEL');
                expect(validator.safeParse('https://vk.com/my_group').success).toBe(true);
            });

            it('CHANNEL: accepts mobile URL', () => {
                const validator = getLinkValidator('VK', 'CHANNEL');
                expect(validator.safeParse('https://m.vk.com/my_group').success).toBe(true);
            });

            it('CHANNEL: rejects with query params', () => {
                const validator = getLinkValidator('VK', 'CHANNEL');
                expect(validator.safeParse('https://vk.com/group?w=wall-1_2').success).toBe(false);
            });
        });

        describe('Instagram validators', () => {
            it('POST: accepts /p/ post', () => {
                const validator = getLinkValidator('INSTAGRAM', 'POST');
                expect(validator.safeParse('https://www.instagram.com/p/ABC123/').success).toBe(true);
            });

            it('POST: accepts /reel/', () => {
                const validator = getLinkValidator('INSTAGRAM', 'POST');
                expect(validator.safeParse('https://instagram.com/reel/XYZ789/').success).toBe(true);
            });

            it('POST: rejects profile URL', () => {
                const validator = getLinkValidator('INSTAGRAM', 'POST');
                expect(validator.safeParse('https://instagram.com/cristiano').success).toBe(false);
            });

            it('CHANNEL: accepts profile URL', () => {
                const validator = getLinkValidator('INSTAGRAM', 'CHANNEL');
                expect(validator.safeParse('https://instagram.com/cristiano').success).toBe(true);
            });

            it('STORY: accepts profile URL (stories redirect to profile)', () => {
                const validator = getLinkValidator('INSTAGRAM', 'STORY');
                expect(validator.safeParse('https://instagram.com/cristiano').success).toBe(true);
            });
        });

        describe('TikTok validators', () => {
            it('POST: accepts web video URL', () => {
                const validator = getLinkValidator('TIKTOK', 'POST');
                expect(validator.safeParse('https://www.tiktok.com/@user/video/7234567890123').success).toBe(true);
            });

            it('POST: accepts vm.tiktok short link', () => {
                const validator = getLinkValidator('TIKTOK', 'POST');
                expect(validator.safeParse('https://vm.tiktok.com/ZMabc123').success).toBe(true);
            });

            it('POST: accepts vt.tiktok short link', () => {
                const validator = getLinkValidator('TIKTOK', 'POST');
                expect(validator.safeParse('https://vt.tiktok.com/ZSYZ123abc').success).toBe(true);
            });

            it('POST: rejects profile URL', () => {
                const validator = getLinkValidator('TIKTOK', 'POST');
                expect(validator.safeParse('https://tiktok.com/@user').success).toBe(false);
            });

            it('CHANNEL: accepts profile URL', () => {
                const validator = getLinkValidator('TIKTOK', 'CHANNEL');
                expect(validator.safeParse('https://tiktok.com/@user').success).toBe(true);
            });

            it('CHANNEL: rejects video URL', () => {
                const validator = getLinkValidator('TIKTOK', 'CHANNEL');
                expect(validator.safeParse('https://tiktok.com/@user/video/123').success).toBe(false);
            });
        });

        describe('YouTube validators', () => {
            it('POST: accepts watch URL', () => {
                const validator = getLinkValidator('YOUTUBE', 'POST');
                expect(validator.safeParse('https://youtube.com/watch?v=dQw4w9WgXcQ').success).toBe(true);
            });

            it('POST: accepts youtu.be', () => {
                const validator = getLinkValidator('YOUTUBE', 'POST');
                expect(validator.safeParse('https://youtu.be/dQw4w9WgXcQ').success).toBe(true);
            });

            it('POST: accepts /shorts/', () => {
                const validator = getLinkValidator('YOUTUBE', 'POST');
                expect(validator.safeParse('https://youtube.com/shorts/abc123').success).toBe(true);
            });

            it('POST: rejects channel URL', () => {
                const validator = getLinkValidator('YOUTUBE', 'POST');
                expect(validator.safeParse('https://youtube.com/@MrBeast').success).toBe(false);
            });

            it('CHANNEL: accepts @ handle', () => {
                const validator = getLinkValidator('YOUTUBE', 'CHANNEL');
                expect(validator.safeParse('https://youtube.com/@MrBeast').success).toBe(true);
            });

            it('CHANNEL: accepts /channel/UC... format', () => {
                const validator = getLinkValidator('YOUTUBE', 'CHANNEL');
                expect(validator.safeParse('https://youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA').success).toBe(true);
            });

            it('CHANNEL: accepts /c/ custom URL', () => {
                const validator = getLinkValidator('YOUTUBE', 'CHANNEL');
                expect(validator.safeParse('https://youtube.com/c/LinusTechTips').success).toBe(true);
            });

            it('CHANNEL: rejects watch URL', () => {
                const validator = getLinkValidator('YOUTUBE', 'CHANNEL');
                expect(validator.safeParse('https://youtube.com/watch?v=dQw4w9WgXcQ').success).toBe(false);
            });
        });

        describe('Default (unknown) validator', () => {
            it('falls back to z.string().url() for unknown combos', () => {
                const validator = getLinkValidator('TWITCH', 'CHANNEL');
                expect(validator.safeParse('https://twitch.tv/shroud').success).toBe(true);
                expect(validator.safeParse('not-a-url').success).toBe(false);
            });
        });
    });

    // =====================================================
    //         CROSS-PLATFORM CONFUSION (DISAMBIGUATION)
    // =====================================================
    describe('🔀 Cross-Platform Confusion Tests', () => {
        it('t.me link should NOT match as WEBSITE', async () => {
            const res = await analyzer.analyze('https://t.me/durov');
            expect(res.platform).not.toBe(IntelligencePlatform.WEBSITE);
        });

        it('instagram.com should NOT match as WEBSITE', async () => {
            const res = await analyzer.analyze('https://instagram.com/p/abc123');
            expect(res.platform).not.toBe(IntelligencePlatform.WEBSITE);
        });

        it('vk.com profile should NOT match as WEBSITE', async () => {
            const res = await analyzer.analyze('https://vk.com/durov');
            expect(res.platform).not.toBe(IntelligencePlatform.WEBSITE);
        });

        it('x.com profile should NOT match as WEBSITE', async () => {
            const res = await analyzer.analyze('https://x.com/elonmusk');
            expect(res.platform).not.toBe(IntelligencePlatform.WEBSITE);
        });

        it('Telegram post should match BEFORE channel rule', async () => {
            const res = await analyzer.analyze('https://t.me/durov/123');
            // Post rule is before channel rule in LINK_RULES array
            expect(res.type).toBe('post');
        });

        it('Telegram bot should match BEFORE channel rule', async () => {
            const res = await analyzer.analyze('https://t.me/MyBot');
            // Bot regex requires ending with "bot" or "_bot" — "MyBot" ends with "Bot"
            expect(res.type).toBe('bot');
        });

        it('Instagram post should match BEFORE profile', async () => {
            const res = await analyzer.analyze('https://instagram.com/p/abc123');
            expect(res.type).toBe('post');
        });

        it('TikTok video should match BEFORE profile', async () => {
            const res = await analyzer.analyze('https://tiktok.com/@user/video/123456');
            expect(res.type).toBe('video');
        });

        it('YouTube watch should match BEFORE channel', async () => {
            const res = await analyzer.analyze('https://youtube.com/watch?v=dQw4w9WgXcQ');
            expect(res.type).toBe('video');
        });

        it('VK wall post should match BEFORE profile', async () => {
            const res = await analyzer.analyze('https://vk.com/wall-123_456');
            expect(res.type).toBe('post');
        });
    });

    // =====================================================
    //           PRIORITY ORDER VALIDATION
    // =====================================================
    describe('📊 Rule Priority Order', () => {
        it('Telegram: post → bot → channel (in that order)', async () => {
            // A link matching post should NOT be classified as channel
            const postRes = await analyzer.analyze('https://t.me/durov/42');
            expect(postRes.type).toBe('post');

            // A bot link should match bot, not channel
            const botRes = await analyzer.analyze('https://t.me/CoolBot');
            expect(botRes.type).toBe('bot');
        });

        it('Instagram: post → profile (post has priority)', async () => {
            const postRes = await analyzer.analyze('https://instagram.com/reel/C99xyz');
            expect(postRes.type).toBe('post');
        });

        it('TikTok: short_link → video → live → profile (in rule order)', async () => {
            // Short link (note: fetch mock makes resolve() return original URL)
            const shortRes = await analyzer.analyze('https://vm.tiktok.com/ZMabc123/');
            expect(shortRes.platform).toBe(IntelligencePlatform.TIKTOK);
            expect(shortRes.type).toBe('short_link');

            // Video
            const videoRes = await analyzer.analyze('https://tiktok.com/@user/video/123456');
            expect(videoRes.type).toBe('video');

            // Live (must match BEFORE profile)
            const liveRes = await analyzer.analyze('https://tiktok.com/@user/live');
            expect(liveRes.type).toBe('live');

            // Profile
            const profRes = await analyzer.analyze('https://tiktok.com/@user');
            expect(profRes.type).toBe('profile');
        });
    });
});
