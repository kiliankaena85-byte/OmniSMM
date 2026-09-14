import { IntelligencePlatform } from '../analyzer/link-rules';

/**
 * High-performance O(1) domain lookup table for supported social networks.
 * Eliminates running unrelated RegExp suites for known hosts.
 */
const DOMAIN_TO_PLATFORM = new Map<string, IntelligencePlatform>([
  // Telegram
  ['t.me', IntelligencePlatform.TELEGRAM],
  ['telegram.me', IntelligencePlatform.TELEGRAM],
  ['telegram.dog', IntelligencePlatform.TELEGRAM],
  ['web.telegram.org', IntelligencePlatform.TELEGRAM],

  // VKontakte
  ['vk.com', IntelligencePlatform.VK],
  ['m.vk.com', IntelligencePlatform.VK],
  ['vk.ru', IntelligencePlatform.VK],
  ['vkontakte.ru', IntelligencePlatform.VK],
  ['vkvideo.ru', IntelligencePlatform.VK],
  ['vk.cc', IntelligencePlatform.VK],

  // Instagram
  ['instagram.com', IntelligencePlatform.INSTAGRAM],
  ['www.instagram.com', IntelligencePlatform.INSTAGRAM],
  ['m.instagram.com', IntelligencePlatform.INSTAGRAM],
  ['instagr.am', IntelligencePlatform.INSTAGRAM],

  // TikTok
  ['tiktok.com', IntelligencePlatform.TIKTOK],
  ['www.tiktok.com', IntelligencePlatform.TIKTOK],
  ['m.tiktok.com', IntelligencePlatform.TIKTOK],
  ['vm.tiktok.com', IntelligencePlatform.TIKTOK],
  ['vt.tiktok.com', IntelligencePlatform.TIKTOK],

  // YouTube
  ['youtube.com', IntelligencePlatform.YOUTUBE],
  ['www.youtube.com', IntelligencePlatform.YOUTUBE],
  ['m.youtube.com', IntelligencePlatform.YOUTUBE],
  ['youtu.be', IntelligencePlatform.YOUTUBE],
  ['music.youtube.com', IntelligencePlatform.YOUTUBE],

  // Rutube
  ['rutube.ru', IntelligencePlatform.RUTUBE],
  ['www.rutube.ru', IntelligencePlatform.RUTUBE],

  // Odnoklassniki
  ['ok.ru', IntelligencePlatform.OK],
  ['www.ok.ru', IntelligencePlatform.OK],
  ['m.ok.ru', IntelligencePlatform.OK],
  ['odnoklassniki.ru', IntelligencePlatform.OK],

  // Twitter / X
  ['x.com', IntelligencePlatform.TWITTER],
  ['twitter.com', IntelligencePlatform.TWITTER],
  ['mobile.twitter.com', IntelligencePlatform.TWITTER],

  // Threads
  ['threads.net', IntelligencePlatform.THREADS],
  ['www.threads.net', IntelligencePlatform.THREADS],

  // Facebook
  ['facebook.com', IntelligencePlatform.FACEBOOK],
  ['www.facebook.com', IntelligencePlatform.FACEBOOK],
  ['m.facebook.com', IntelligencePlatform.FACEBOOK],
  ['fb.watch', IntelligencePlatform.FACEBOOK],
  ['fb.com', IntelligencePlatform.FACEBOOK],

  // Twitch
  ['twitch.tv', IntelligencePlatform.TWITCH],
  ['www.twitch.tv', IntelligencePlatform.TWITCH],
  ['m.twitch.tv', IntelligencePlatform.TWITCH],

  // Discord
  ['discord.gg', IntelligencePlatform.DISCORD],
  ['discord.com', IntelligencePlatform.DISCORD],
  ['discordapp.com', IntelligencePlatform.DISCORD],

  // Dzen
  ['dzen.ru', IntelligencePlatform.DZEN],
  ['zen.yandex.ru', IntelligencePlatform.DZEN],

  // Spotify
  ['spotify.com', IntelligencePlatform.SPOTIFY],
  ['open.spotify.com', IntelligencePlatform.SPOTIFY],

  // Kick
  ['kick.com', IntelligencePlatform.KICK],

  // Likee
  ['likee.video', IntelligencePlatform.LIKEE],
  ['l.likee.video', IntelligencePlatform.LIKEE],

  // Pinterest
  ['pinterest.com', IntelligencePlatform.PINTEREST],
  ['pin.it', IntelligencePlatform.PINTEREST],

  // SoundCloud
  ['soundcloud.com', IntelligencePlatform.SOUNDCLOUD],
  ['on.soundcloud.com', IntelligencePlatform.SOUNDCLOUD],

  // Reddit
  ['reddit.com', IntelligencePlatform.REDDIT],
  ['www.reddit.com', IntelligencePlatform.REDDIT],
  ['redd.it', IntelligencePlatform.REDDIT],

  // WhatsApp
  ['wa.me', IntelligencePlatform.WHATSAPP],
  ['whatsapp.com', IntelligencePlatform.WHATSAPP],
  ['chat.whatsapp.com', IntelligencePlatform.WHATSAPP],

  // Trovo
  ['trovo.live', IntelligencePlatform.TROVO],

  // Kwai
  ['kwai.com', IntelligencePlatform.KWAI],
  ['k.kwai.com', IntelligencePlatform.KWAI],

  // Steam
  ['steamcommunity.com', IntelligencePlatform.STEAM],
  ['store.steampowered.com', IntelligencePlatform.STEAM],

  // LinkedIn
  ['linkedin.com', IntelligencePlatform.LINKEDIN],
  ['www.linkedin.com', IntelligencePlatform.LINKEDIN],

  // Snapchat
  ['snapchat.com', IntelligencePlatform.SNAPCHAT],

  // Vimeo
  ['vimeo.com', IntelligencePlatform.VIMEO],

  // Rumble
  ['rumble.com', IntelligencePlatform.RUMBLE],

  // Shazam
  ['shazam.com', IntelligencePlatform.SHAZAM],

  // Medium
  ['medium.com', IntelligencePlatform.MEDIUM],

  // Tumblr
  ['tumblr.com', IntelligencePlatform.TUMBLR],

  // Quora
  ['quora.com', IntelligencePlatform.QUORA],

  // Apple Music
  ['music.apple.com', IntelligencePlatform.APPLE],
  ['podcasts.apple.com', IntelligencePlatform.APPLE],
]);

/**
 * Resolves social platform by hostname in O(1) time.
 * Supports root domain matching for subdomains (e.g. `sub.youtube.com` -> `youtube.com`).
 */
export function resolvePlatformByHostname(rawHost: string): IntelligencePlatform | null {
  if (!rawHost) return null;
  const host = rawHost.toLowerCase().trim();

  // 1. Direct match
  const direct = DOMAIN_TO_PLATFORM.get(host);
  if (direct) return direct;

  // 2. Suffix match (e.g., uk.pinterest.com -> pinterest.com)
  for (const [domain, platform] of DOMAIN_TO_PLATFORM.entries()) {
    if (host.endsWith(`.${domain}`)) {
      return platform;
    }
  }

  return null;
}

/**
 * Checks if a hostname belongs to any supported social network.
 */
export function isSupportedSocialHost(host: string): boolean {
  return resolvePlatformByHostname(host) !== null;
}
