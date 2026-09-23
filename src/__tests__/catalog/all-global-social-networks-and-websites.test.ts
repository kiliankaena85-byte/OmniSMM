import { describe, it, expect, vi } from 'vitest';
import { IntelligenceLinkAnalyzer } from '@/services/analyzer/link-analyzer';
import { IntelligencePlatform } from '@/services/analyzer/link-rules';

vi.mock('@/lib/ssrf-guard', () => ({
  SHORT_LINK_HOSTS: new Set(['bit.ly', 'youtu.be', 'vm.tiktok.com', 'vt.tiktok.com', 't.co', 'cutt.ly', 'clck.ru', 'tinyurl.com', 'is.gd']),
  resolveShortLink: vi.fn(async (url: string) => url)
}));

describe('🌐 All Global Social Networks & Websites Comprehensive Link Matrix', () => {
  const analyzer = new IntelligenceLinkAnalyzer();

  const testCases = [
    // 1. Twitter / X
    { url: 'https://x.com/elonmusk/status/1888888888888888888', platform: IntelligencePlatform.TWITTER, type: 'post' },
    { url: 'https://twitter.com/OpenAI/status/1234567890123456789', platform: IntelligencePlatform.TWITTER, type: 'post' },
    { url: 'https://x.com/telegram', platform: IntelligencePlatform.TWITTER, type: 'profile' },
    { url: 'twitter.com/Google', platform: IntelligencePlatform.TWITTER, type: 'profile' },

    // 2. TikTok
    { url: 'https://vm.tiktok.com/ZM8xABCde/', platform: IntelligencePlatform.TIKTOK, type: 'short_link' },
    { url: 'https://vt.tiktok.com/ZS9yXYZ12/', platform: IntelligencePlatform.TIKTOK, type: 'short_link' },
    { url: 'https://www.tiktok.com/@charlidamelio/video/7123456789012345678', platform: IntelligencePlatform.TIKTOK, type: 'video' },
    { url: 'https://www.tiktok.com/@khaby.lame/live', platform: IntelligencePlatform.TIKTOK, type: 'live' },
    { url: 'https://tiktok.com/@mrbeast', platform: IntelligencePlatform.TIKTOK, type: 'profile' },

    // 3. Twitch
    { url: 'https://www.twitch.tv/ninja', platform: IntelligencePlatform.TWITCH, type: 'channel' },
    { url: 'twitch.tv/shroud', platform: IntelligencePlatform.TWITCH, type: 'channel' },

    // 4. Discord
    { url: 'https://discord.gg/midjourney', platform: IntelligencePlatform.DISCORD, type: 'invite' },
    { url: 'https://discord.com/invite/openai', platform: IntelligencePlatform.DISCORD, type: 'invite' },

    // 5. Rutube
    { url: 'https://rutube.ru/video/1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d/', platform: IntelligencePlatform.RUTUBE, type: 'video' },
    { url: 'https://rutube.ru/u/techno_news/', platform: IntelligencePlatform.RUTUBE, type: 'channel' },
    { url: 'https://rutube.ru/channel/1234567/', platform: IntelligencePlatform.RUTUBE, type: 'channel' },

    // 6. Dzen
    { url: 'https://dzen.ru/a/Zg1234567890abcdef', platform: IntelligencePlatform.DZEN, type: 'post' },
    { url: 'https://dzen.ru/video/watch/654321abcdef123456', platform: IntelligencePlatform.DZEN, type: 'post' },
    { url: 'https://dzen.ru/id/5e1234567890abcdef', platform: IntelligencePlatform.DZEN, type: 'channel' },
    { url: 'https://dzen.ru/artmspektr', platform: IntelligencePlatform.DZEN, type: 'channel' },

    // 7. OK (Odnoklassniki)
    { url: 'https://ok.ru/group/54321098765432/topic/155555555555555', platform: IntelligencePlatform.OK, type: 'post' },
    { url: 'https://ok.ru/group/54321098765432', platform: IntelligencePlatform.OK, type: 'group' },
    { url: 'https://ok.ru/profile/123456789012', platform: IntelligencePlatform.OK, type: 'profile' },

    // 8. Likee
    { url: 'https://l.likee.video/v/AbCdEf', platform: IntelligencePlatform.LIKEE, type: 'video' },
    { url: 'https://likee.video/@creators_hub/video/1234567890', platform: IntelligencePlatform.LIKEE, type: 'video' },

    // 9. Kick
    { url: 'https://kick.com/xqc', platform: IntelligencePlatform.KICK, type: 'channel' },
    { url: 'kick.com/adinross', platform: IntelligencePlatform.KICK, type: 'channel' },

    // 10. Spotify
    { url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT', platform: IntelligencePlatform.SPOTIFY, type: 'track' },
    { url: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M', platform: IntelligencePlatform.SPOTIFY, type: 'playlist' },
    { url: 'https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3', platform: IntelligencePlatform.SPOTIFY, type: 'playlist' },

    // 11. SoundCloud
    { url: 'https://soundcloud.com/artist-name/hit-track-2026', platform: IntelligencePlatform.SOUNDCLOUD, type: 'track' },
    { url: 'https://on.soundcloud.com/xyz123', platform: IntelligencePlatform.SOUNDCLOUD, type: 'track' },
    { url: 'https://soundcloud.com/top-producer', platform: IntelligencePlatform.SOUNDCLOUD, type: 'artist' },

    // 12. Pinterest
    { url: 'https://pinterest.com/pin/123456789012345678/', platform: IntelligencePlatform.PINTEREST, type: 'pin' },
    { url: 'https://pin.it/7AbCdEf', platform: IntelligencePlatform.PINTEREST, type: 'pin' },
    { url: 'https://www.pinterest.com/design_inspo/', platform: IntelligencePlatform.PINTEREST, type: 'profile' },

    // 13. Reddit
    { url: 'https://www.reddit.com/r/programming/comments/1abc234/future_of_ai_in_2026/', platform: IntelligencePlatform.REDDIT, type: 'post' },
    { url: 'https://reddit.com/r/technology', platform: IntelligencePlatform.REDDIT, type: 'subreddit' },
    { url: 'https://www.reddit.com/user/spez', platform: IntelligencePlatform.REDDIT, type: 'profile' },

    // 14. LinkedIn
    { url: 'https://www.linkedin.com/posts/satyanadella_ai-innovation-activity-7123456789012345678-AbCd', platform: IntelligencePlatform.LINKEDIN, type: 'post' },
    { url: 'https://linkedin.com/company/microsoft', platform: IntelligencePlatform.LINKEDIN, type: 'company' },
    { url: 'https://www.linkedin.com/in/williamhgates', platform: IntelligencePlatform.LINKEDIN, type: 'profile' },

    // 15. Snapchat
    { url: 'https://www.snapchat.com/add/mrbeast', platform: IntelligencePlatform.SNAPCHAT, type: 'profile' },
    { url: 'https://snapchat.com/spotlight/W7_EDlXWTBiXAEEniNoMPwAAYbWFnb2FzY2FwZQE2AAA', platform: IntelligencePlatform.SNAPCHAT, type: 'spotlight' },

    // 16. Yandex (Music / Maps)
    { url: 'https://music.yandex.ru/album/1234567/track/89012345', platform: IntelligencePlatform.YANDEX, type: 'track' },
    { url: 'https://music.yandex.ru/artist/123456', platform: IntelligencePlatform.YANDEX, type: 'artist' },
    { url: 'https://music.yandex.ru/album/1234567', platform: IntelligencePlatform.YANDEX, type: 'album' },

    // 17. Apple (Music / Podcasts)
    { url: 'https://podcasts.apple.com/us/podcast/the-daily/id1200361736', platform: IntelligencePlatform.APPLE, type: 'podcast' },
    { url: 'https://music.apple.com/us/album/thriller/269572838?i=269573268', platform: IntelligencePlatform.APPLE, type: 'track' },
    { url: 'https://music.apple.com/us/album/thriller/269572838', platform: IntelligencePlatform.APPLE, type: 'album' },

    // 18. Facebook
    { url: 'https://www.facebook.com/zuck/posts/1011234567890', platform: IntelligencePlatform.FACEBOOK, type: 'post' },
    { url: 'https://facebook.com/meta', platform: IntelligencePlatform.FACEBOOK, type: 'profile' },

    // 19. Threads
    { url: 'https://www.threads.net/@zuck/post/Cx123456789', platform: IntelligencePlatform.THREADS, type: 'post' },
    { url: 'https://threads.net/@instagram', platform: IntelligencePlatform.THREADS, type: 'profile' },

    // 20. Kwai
    { url: 'https://kwai.com/video/523456789012345', platform: IntelligencePlatform.KWAI, type: 'video' },
    { url: 'https://kwai.com/@top_creator', platform: IntelligencePlatform.KWAI, type: 'profile' },

    // 21. Tumblr
    { url: 'https://tech-blog.tumblr.com/post/712345678901234567/ai-revolution', platform: IntelligencePlatform.TUMBLR, type: 'post' },
    { url: 'https://photographer.tumblr.com', platform: IntelligencePlatform.TUMBLR, type: 'profile' },

    // 22. Medium
    { url: 'https://medium.com/@author_name/deep-dive-into-distributed-systems-a1b2c3d4e5f6', platform: IntelligencePlatform.MEDIUM, type: 'post' },
    { url: 'https://medium.com/@ai_researcher', platform: IntelligencePlatform.MEDIUM, type: 'profile' },

    // 23. Quora
    { url: 'https://www.quora.com/What-is-the-best-architecture-for-scalable-microservices', platform: IntelligencePlatform.QUORA, type: 'question' },
    { url: 'https://quora.com/profile/Guido-van-Rossum', platform: IntelligencePlatform.QUORA, type: 'profile' },

    // 24. Vimeo
    { url: 'https://vimeo.com/76979871', platform: IntelligencePlatform.VIMEO, type: 'video' },
    { url: 'https://vimeo.com/staffpicks', platform: IntelligencePlatform.VIMEO, type: 'channel' },

    // 25. Rumble
    { url: 'https://rumble.com/v2abcde-daily-news-livestream.html', platform: IntelligencePlatform.RUMBLE, type: 'video' },
    { url: 'https://rumble.com/c/NewsChannel', platform: IntelligencePlatform.RUMBLE, type: 'channel' },

    // 26. Shazam
    { url: 'https://www.shazam.com/track/123456789/song-title', platform: IntelligencePlatform.SHAZAM, type: 'track' },

    // 27. WhatsApp
    { url: 'https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv', platform: IntelligencePlatform.WHATSAPP, type: 'group' },
    { url: 'https://wa.me/79991234567', platform: IntelligencePlatform.WHATSAPP, type: 'group' },

    // 28. Steam
    { url: 'https://steamcommunity.com/sharedfiles/filedetails/?id=2890123456', platform: IntelligencePlatform.STEAM, type: 'post' },
    { url: 'https://steamcommunity.com/id/gaben', platform: IntelligencePlatform.STEAM, type: 'profile' },
    { url: 'https://steamcommunity.com/profiles/76561197960287930', platform: IntelligencePlatform.STEAM, type: 'profile' },

    // 29. Trovo
    { url: 'https://trovo.live/s/streamer_name/123456789', platform: IntelligencePlatform.TROVO, type: 'live' },
    { url: 'https://trovo.live/streamer_name', platform: IntelligencePlatform.TROVO, type: 'channel' },

    // 30. Max Messenger & Wibes
    { url: 'https://max.ru/c/channel_crypto_news', platform: IntelligencePlatform.MAX, type: 'channel' },
    { url: 'https://wibes.ru/traveler/post-12345', platform: IntelligencePlatform.WIBES, type: 'post' },

    // 31. Direct Website, SEO Backlinks & Web Traffic
    { url: 'https://my-online-store.ru', platform: IntelligencePlatform.WEBSITE, type: 'seo_traffic' },
    { url: 'http://subdomain.corporate-portal.com/pricing?utm_source=google', platform: IntelligencePlatform.WEBSITE, type: 'seo_traffic' },
    { url: 'www.awesome-landing.pro/start', platform: IntelligencePlatform.WEBSITE, type: 'seo_traffic' },
    { url: 'https://specialized-forum.org/threads/topic-id-1234', platform: IntelligencePlatform.WEBSITE, type: 'seo_traffic' }
  ];

  for (const tc of testCases) {
    it(`correctly recognizes [${tc.platform}] -> ${tc.url}`, async () => {
      const result = await analyzer.analyze(tc.url);
      expect(result.platform).toBe(tc.platform);
      expect(result.type).toBe(tc.type);
      expect(result.canonicalUrl).toBeDefined();
    });
  }
});
