import { CATEGORY_LABELS } from '../providers/smart-analyzer.logic';

export enum IntelligencePlatform {
  YOUTUBE = 'YOUTUBE',
  INSTAGRAM = 'INSTAGRAM',
  TELEGRAM = 'TELEGRAM',
  TIKTOK = 'TIKTOK',
  VK = 'VK',
  TWITCH = 'TWITCH',
  TWITTER = 'TWITTER',
  WEBSITE = 'WEBSITE',
  LIKEE = 'LIKEE',
  OK = 'OK',
  RUTUBE = 'RUTUBE',
  DZEN = 'DZEN',
  DISCORD = 'DISCORD',
  KICK = 'KICK',
  SPOTIFY = 'SPOTIFY',
  FACEBOOK = 'FACEBOOK',
  THREADS = 'THREADS',
  MAX = 'MAX',
  STEAM = 'STEAM',
  WIBES = 'WIBES',
  TROVO = 'TROVO',
  PINTEREST = 'PINTEREST',
  SOUNDCLOUD = 'SOUNDCLOUD',
  REDDIT = 'REDDIT',
  LINKEDIN = 'LINKEDIN',
  SNAPCHAT = 'SNAPCHAT',
  YANDEX = 'YANDEX',
  APPLE = 'APPLE',
  KWAI = 'KWAI',
  TUMBLR = 'TUMBLR',
  MEDIUM = 'MEDIUM',
  QUORA = 'QUORA',
  VIMEO = 'VIMEO',
  RUMBLE = 'RUMBLE',
  SHAZAM = 'SHAZAM',
  WHATSAPP = 'WHATSAPP',
  OTHER = 'OTHER'
}

export interface LinkRule {
  platform: IntelligencePlatform;
  type: string;
  pattern: RegExp;
  suggestedCategories: string[];
  context?: string;
}

export const LINK_RULES: LinkRule[] = [
  // ===================== TELEGRAM =====================
  {
      platform: IntelligencePlatform.TELEGRAM,
      type: 'private_post',
      pattern: /(?:t\.me|telegram\.me|telegram\.dog)\/c\/(\d+)\/(\d+)\/?(?:\?.*)?$/i,
      suggestedCategories: [],
      context: 'private'
  },
  {
      platform: IntelligencePlatform.TELEGRAM,
      type: 'story',
      pattern: /(?:t\.me|telegram\.me|telegram\.dog)\/([\w-]+)\/s\/(\d+)\/?(?:\?.*)?$/i,
      suggestedCategories: [CATEGORY_LABELS.STORIES, CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.REACTIONS],
      context: 'temporary_story'
  },
  {
      platform: IntelligencePlatform.TELEGRAM,
      type: 'post',
      pattern: /(?:t\.me|telegram\.me|telegram\.dog)\/(?:s\/)?[\w-]+\/(?:topic\/|\d+\/)?(\d+)\/?(?:\?.*)?$/i,
      suggestedCategories: [CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.REACTIONS, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.REPOSTS, CATEGORY_LABELS.STARS],
      context: 'engagement'
  },
  {
      platform: IntelligencePlatform.TELEGRAM,
      type: 'bot',
      pattern: /(?:t\.me|telegram\.me|telegram\.dog)\/(?:[\w-]+bot|[\w-]+_bot)\/?(?:\?.*)?$/i,
      suggestedCategories: [CATEGORY_LABELS.BOTS, CATEGORY_LABELS.REFERRALS, CATEGORY_LABELS.SUBSCRIBERS],
      context: 'automation'
  },
  {
      platform: IntelligencePlatform.TELEGRAM,
      type: 'channel',
      pattern: /(?:t\.me|telegram\.me|telegram\.dog)\/(?:joinchat\/|\+)([\w-]+)\/?(?:\?.*)?$/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS],
      context: 'private_invite'
  },
  {
      platform: IntelligencePlatform.TELEGRAM,
      type: 'channel',
      pattern: /(?:t\.me|telegram\.me|telegram\.dog)\/(?:s\/)?@?([\w-]+)\/?(?:\?.*)?$|web\.telegram\.org\/(?:k|a)\/#@?([\w-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.PREMIUM, CATEGORY_LABELS.BOOSTS, CATEGORY_LABELS.GROUPS, CATEGORY_LABELS.STORIES, CATEGORY_LABELS.STARS, CATEGORY_LABELS.AUTO_VIEWS, CATEGORY_LABELS.AUTO_REACTIONS, CATEGORY_LABELS.AUTO_REPOSTS],
      context: 'global_search_optimization'
  },
  // ===================== YOUTUBE =====================
  {
      platform: IntelligencePlatform.YOUTUBE,
      type: 'video',
      pattern: /(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{6,12})(?=[^\w-]|$|&)/i,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.REPOSTS, CATEGORY_LABELS.STREAMS],
      context: 'high_retention_target'
  },
  {
      platform: IntelligencePlatform.YOUTUBE,
      type: 'channel',
      pattern: /youtube\.com\/((?:@)[\w-.]+|channel\/[\w-.]+|user\/[\w-.]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS],
      context: 'authority_growth'
  },
  // ===================== INSTAGRAM =====================
  {
      platform: IntelligencePlatform.INSTAGRAM,
      type: 'highlight',
      pattern: /instagram\.com\/stories\/highlights\/([\w-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.STORIES, CATEGORY_LABELS.VIEWS],
      context: 'highlight_views'
  },
  {
      platform: IntelligencePlatform.INSTAGRAM,
      type: 'story',
      pattern: /instagram\.com\/stories\/([\w._]+)\/(\d+)/i,
      suggestedCategories: [CATEGORY_LABELS.STORIES, CATEGORY_LABELS.VIEWS],
      context: 'temporary_story'
  },
  {
      platform: IntelligencePlatform.INSTAGRAM,
      type: 'post',
      pattern: /instagram\.com\/(?:p|reel|tv)\/([\w-]+)/,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.REPOSTS, CATEGORY_LABELS.SAVES, CATEGORY_LABELS.REACTIONS],
      context: 'viral_momentum'
  },
  {
      platform: IntelligencePlatform.INSTAGRAM,
      type: 'profile',
      pattern: /(?:instagram\.com|ig\.me)\/([\w._]+)/,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.STORIES, CATEGORY_LABELS.STREAMS, CATEGORY_LABELS.AUTO_LIKES, CATEGORY_LABELS.AUTO_VIEWS],
      context: 'trust_building'
  },
  // ===================== TIKTOK =====================
  {
      platform: IntelligencePlatform.TIKTOK,
      type: 'short_link',
      pattern: /(?:vm\.tiktok\.com|vt\.tiktok\.com|tiktok\.com\/t)\/([\w-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.REPOSTS, CATEGORY_LABELS.SAVES],
      context: 'mobile_viral'
  },
  {
      platform: IntelligencePlatform.TIKTOK,
      type: 'video',
      pattern: /tiktok\.com\/@[\w.]+\/(?:video|photo)\/(\d+)/i,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.REPOSTS, CATEGORY_LABELS.SAVES],
      context: 'viral_reach'
  },
  {
      platform: IntelligencePlatform.TIKTOK,
      type: 'live',
      pattern: /tiktok\.com\/@[\w.]+\/live/i,
      suggestedCategories: [CATEGORY_LABELS.STREAMS],
      context: 'live_stream'
  },
  {
      platform: IntelligencePlatform.TIKTOK,
      type: 'profile',
      pattern: /tiktok\.com\/(@[\w.]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.AUTO_LIKES],
      context: 'influence'
  },
  // ===================== VK =====================
  {
      platform: IntelligencePlatform.VK,
      type: 'comment',
      pattern: /(?:vk\.(?:com|ru)|vkvideo\.ru)\/(?:wall|video|photo|clip)(-?\d+_\d+)\?[^#]*\breply=(\d+)/i,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.REACTIONS],
      context: 'social_reach'
  },
  {
      platform: IntelligencePlatform.VK,
      type: 'post',
      pattern: /(?:vk\.(?:com|ru)|vkvideo\.ru)\/(?:wall|clip|video|photo)(-?\d+_\d+)/,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.REPOSTS, CATEGORY_LABELS.REACTIONS, CATEGORY_LABELS.POLLS],
      context: 'social_reach'
  },
  {
      platform: IntelligencePlatform.VK,
      type: 'profile',
      pattern: /vk\.(?:com|ru)\/([\w._]+)/,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.FRIENDS, CATEGORY_LABELS.VIEWS],
      context: 'networking'
  },
  // ===================== TWITCH =====================
  {
      platform: IntelligencePlatform.TWITCH,
      type: 'clip',
      pattern: /(?:clips\.twitch\.tv\/|twitch\.tv\/[\w]+\/clip\/)([\w-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.LIKES],
      context: 'viral_reach'
  },
  {
      platform: IntelligencePlatform.TWITCH,
      type: 'video',
      pattern: /twitch\.tv\/videos\/(\d+)/i,
      suggestedCategories: [CATEGORY_LABELS.VIEWS],
      context: 'past_broadcast_views'
  },
  {
      platform: IntelligencePlatform.TWITCH,
      type: 'channel',
      pattern: /twitch\.tv\/([\w]+)/,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.STREAMS, CATEGORY_LABELS.BOTS, CATEGORY_LABELS.GROUPS, CATEGORY_LABELS.OTHER],
      context: 'streaming_growth'
  },
  // ===================== TWITTER / X =====================
  {
      platform: IntelligencePlatform.TWITTER,
      type: 'post',
      // BUG-FIX (SIL-2026): anchor host with (?:^|[./]) to prevent substring match inside yandex.com etc.
      pattern: /(?:(?:^|[./])twitter\.com|(?:^|[./])x\.com)\/([\w]+)\/status\/(\d+)/,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.REPOSTS, CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.BOOKMARKS],
      context: 'social_reach'
  },
  {
      platform: IntelligencePlatform.TWITTER,
      type: 'profile',
      // BUG-FIX (SIL-2026): anchor host with (?:^|[./]) to prevent substring match inside yandex.com etc.
      pattern: /(?:(?:^|[./])twitter\.com|(?:^|[./])x\.com)\/([\w]+)/,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.AUTO_VIEWS],
      context: 'social_presence'
  },
  // ===================== LIKEE =====================
  {
      platform: IntelligencePlatform.LIKEE,
      type: 'video',
      pattern: /(?:l\.likee\.video\/v\/([\w-]+)|(?:likee\.video|likee\.com)\/@[\w.]+\/video\/(\d+))/i,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.REPOSTS],
      context: 'mobile_viral'
  },
  {
      platform: IntelligencePlatform.LIKEE,
      type: 'profile',
      pattern: /(?:l\.likee\.video\/p\/([\w-]+)|(?:likee\.video|likee\.com)\/(@[\w.]+))/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.VIEWS],
      context: 'influencer_growth'
  },
  // ===================== OK =====================
  {
      platform: IntelligencePlatform.OK,
      type: 'post',
      pattern: /ok\.ru\/(?:group|profile)\/\d+\/(?:topic|statuses)\/(\d+)/i,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.REPOSTS, CATEGORY_LABELS.REACTIONS],
      context: 'social_reach'
  },
  {
      platform: IntelligencePlatform.OK,
      type: 'group',
      pattern: /ok\.ru\/group\/(\d+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.VIEWS],
      context: 'community_authority'
  },
  {
      platform: IntelligencePlatform.OK,
      type: 'profile',
      pattern: /ok\.ru\/(?:profile\/(\d+)|([\w.-]+))/i,
      suggestedCategories: [CATEGORY_LABELS.FRIENDS, CATEGORY_LABELS.VIEWS],
      context: 'networking'
  },
  // ===================== RUTUBE =====================
  {
      platform: IntelligencePlatform.RUTUBE,
      type: 'video',
      pattern: /rutube\.ru\/(?:video\/(?:private\/)?|play\/embed\/)([\w-]{32})/i,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.REPOSTS],
      context: 'authority_growth'
  },
  {
      platform: IntelligencePlatform.RUTUBE,
      type: 'channel',
      pattern: /rutube\.ru\/(?:channel\/(\d+)|u\/([\w.-]+))/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS],
      context: 'viral_momentum'
  },
  // ===================== DZEN =====================
  {
      platform: IntelligencePlatform.DZEN,
      type: 'post',
      pattern: /(?:dzen\.ru|zen\.yandex\.ru)\/(?:a\/|b\/|shorts\/|video\/watch\/|media\/(?:[\w.-]+\/)?)([\w-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.REPOSTS],
      context: 'authority_growth'
  },
  {
      platform: IntelligencePlatform.DZEN,
      type: 'channel',
      pattern: /(?:dzen\.ru|zen\.yandex\.ru)\/(?:id\/([\w-]+)|u\/([\w.-]+)|channel\/([\w-]+)|@?([\w.-]+))\/?(?:\?.*)?$/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.VIEWS],
      context: 'viral_momentum'
  },
  // ===================== DISCORD =====================
  {
      platform: IntelligencePlatform.DISCORD,
      type: 'invite',
      pattern: /(?:discord\.gg|discord\.com\/invite)\/([\w-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.GROUPS],
      context: 'automation'
  },
  // ===================== KICK =====================
  {
      platform: IntelligencePlatform.KICK,
      type: 'channel',
      pattern: /kick\.com\/([\w.-]+)$/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.STREAMS],
      context: 'live_stream'
  },
  // ===================== SPOTIFY =====================
  {
      platform: IntelligencePlatform.SPOTIFY,
      type: 'artist',
      pattern: /open\.spotify\.com\/artist\/([\w-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.PLAYS],
      context: 'artist_listeners'
  },
  {
      platform: IntelligencePlatform.SPOTIFY,
      type: 'track',
      pattern: /open\.spotify\.com\/track\/([\w-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.PLAYS, CATEGORY_LABELS.SAVES],
      context: 'viral_reach'
  },
  {
      platform: IntelligencePlatform.SPOTIFY,
      type: 'playlist',
      pattern: /open\.spotify\.com\/(?:playlist|album)\/([\w-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.PLAYS],
      context: 'networking'
  },
  // ===================== SOUNDCLOUD =====================
  {
      platform: IntelligencePlatform.SOUNDCLOUD,
      type: 'track',
      pattern: /(?:soundcloud\.com\/[\w.-]+\/[\w.-]+|on\.soundcloud\.com\/([\w.-]+))/i,
      suggestedCategories: [CATEGORY_LABELS.PLAYS, CATEGORY_LABELS.LIKES, CATEGORY_LABELS.REPOSTS, CATEGORY_LABELS.COMMENTS],
      context: 'music_viral'
  },
  {
      platform: IntelligencePlatform.SOUNDCLOUD,
      type: 'artist',
      pattern: /soundcloud\.com\/([\w.-]+)\/?$/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS],
      context: 'authority_growth'
  },
  // ===================== PINTEREST =====================
  {
      platform: IntelligencePlatform.PINTEREST,
      type: 'pin',
      pattern: /(?:pinterest\.[a-z.]+\/pin\/|pin\.it\/)([\w-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SAVES, CATEGORY_LABELS.REPOSTS, CATEGORY_LABELS.REACTIONS],
      context: 'visual_discovery'
  },
  {
      platform: IntelligencePlatform.PINTEREST,
      type: 'profile',
      pattern: /pinterest\.[a-z.]+\/([\w.-]+)\/?$/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS],
      context: 'networking'
  },
  // ===================== REDDIT =====================
  {
      platform: IntelligencePlatform.REDDIT,
      type: 'post',
      pattern: /reddit\.com\/r\/[\w.-]+\/comments\/([\w]+)/i,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.REPOSTS],
      context: 'community_authority'
  },
  {
      platform: IntelligencePlatform.REDDIT,
      type: 'subreddit',
      pattern: /reddit\.com\/r\/([\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS],
      context: 'community_growth'
  },
  {
      platform: IntelligencePlatform.REDDIT,
      type: 'profile',
      pattern: /reddit\.com\/user\/([\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS],
      context: 'networking'
  },
  // ===================== LINKEDIN =====================
  {
      platform: IntelligencePlatform.LINKEDIN,
      type: 'post',
      pattern: /linkedin\.com\/(?:posts|feed\/update)\/([\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.REPOSTS],
      context: 'b2b_engagement'
  },
  {
      platform: IntelligencePlatform.LINKEDIN,
      type: 'company',
      pattern: /linkedin\.com\/company\/([\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS],
      context: 'corporate_growth'
  },
  {
      platform: IntelligencePlatform.LINKEDIN,
      type: 'profile',
      pattern: /linkedin\.com\/(?:in|pub)\/([\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.FRIENDS],
      context: 'professional_networking'
  },
  // ===================== SNAPCHAT =====================
  {
      platform: IntelligencePlatform.SNAPCHAT,
      type: 'spotlight',
      pattern: /snapchat\.com\/spotlight\/([\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.LIKES, CATEGORY_LABELS.REPOSTS],
      context: 'viral_momentum'
  },
  {
      platform: IntelligencePlatform.SNAPCHAT,
      type: 'profile',
      pattern: /(?:snapchat\.com\/add|story\.snapchat\.com\/u)\/([\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.STORIES],
      context: 'networking'
  },
  // ===================== YANDEX (MUSIC / MAPS) =====================
  {
      platform: IntelligencePlatform.YANDEX,
      type: 'track',
      pattern: /music\.yandex\.(?:ru|com)\/(?:album\/\d+\/track\/|track\/)(\d+)/i,
      suggestedCategories: [CATEGORY_LABELS.PLAYS, CATEGORY_LABELS.LIKES],
      context: 'music_growth'
  },
  {
      platform: IntelligencePlatform.YANDEX,
      type: 'artist',
      pattern: /music\.yandex\.(?:ru|com)\/artist\/(\d+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.PLAYS],
      context: 'artist_growth'
  },
  {
      platform: IntelligencePlatform.YANDEX,
      type: 'album',
      pattern: /music\.yandex\.(?:ru|com)\/album\/(\d+)/i,
      suggestedCategories: [CATEGORY_LABELS.PLAYS, CATEGORY_LABELS.LIKES],
      context: 'album_growth'
  },
  // ===================== APPLE (MUSIC / PODCASTS) =====================
  {
      platform: IntelligencePlatform.APPLE,
      type: 'podcast',
      pattern: /podcasts\.apple\.com\/[^/]+\/podcast\/[^/]+\/id(\d+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.PLAYS, CATEGORY_LABELS.REACTIONS],
      context: 'audio_authority'
  },
  {
      platform: IntelligencePlatform.APPLE,
      type: 'track',
      pattern: /music\.apple\.com\/[^/]+\/album\/[^/]+\/\d+\?i=(\d+)/i,
      suggestedCategories: [CATEGORY_LABELS.PLAYS, CATEGORY_LABELS.LIKES],
      context: 'music_growth'
  },
  {
      platform: IntelligencePlatform.APPLE,
      type: 'album',
      pattern: /music\.apple\.com\/[^/]+\/album\/[^/]+\/(\d+)/i,
      suggestedCategories: [CATEGORY_LABELS.PLAYS, CATEGORY_LABELS.LIKES],
      context: 'album_growth'
  },
  // ===================== FACEBOOK =====================
  {
      platform: IntelligencePlatform.FACEBOOK,
      type: 'post',
      pattern: /facebook\.com\/[^/]+\/(?:posts|videos|photos)\/([\w.-]+)|permalink\.php\?story_fbid=([\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.REPOSTS, CATEGORY_LABELS.REACTIONS],
      context: 'social_reach'
  },
  {
      platform: IntelligencePlatform.FACEBOOK,
      type: 'profile',
      pattern: /facebook\.com\/([\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.FRIENDS],
      context: 'networking'
  },
  // ===================== THREADS =====================
  {
      platform: IntelligencePlatform.THREADS,
      type: 'post',
      pattern: /threads\.net\/@[\w.-]+\/post\/([\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.REPOSTS],
      context: 'viral_momentum'
  },
  {
      platform: IntelligencePlatform.THREADS,
      type: 'profile',
      pattern: /threads\.net\/@[\w.-]+/,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS],
      context: 'networking'
  },
  // ===================== KWAI =====================
  {
      platform: IntelligencePlatform.KWAI,
      type: 'video',
      pattern: /kwai\.com\/(?:video|p)\/([\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.REPOSTS],
      context: 'viral_reach'
  },
  {
      platform: IntelligencePlatform.KWAI,
      type: 'profile',
      pattern: /kwai\.com\/@?([\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS],
      context: 'networking'
  },
  // ===================== TUMBLR =====================
  {
      platform: IntelligencePlatform.TUMBLR,
      type: 'post',
      pattern: /(?:[\w.-]+\.tumblr\.com\/post\/\d+|tumblr\.com\/[\w.-]+\/(\d+))/i,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.REPOSTS],
      context: 'blog_growth'
  },
  {
      platform: IntelligencePlatform.TUMBLR,
      type: 'profile',
      pattern: /([\w.-]+)\.tumblr\.com/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS],
      context: 'networking'
  },
  // ===================== MEDIUM =====================
  {
      platform: IntelligencePlatform.MEDIUM,
      type: 'post',
      pattern: /medium\.com\/(?:@[\w.-]+\/|p\/)([\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.VIEWS],
      context: 'blog_reach'
  },
  {
      platform: IntelligencePlatform.MEDIUM,
      type: 'profile',
      pattern: /medium\.com\/@([\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS],
      context: 'networking'
  },
  // ===================== QUORA =====================
  {
      platform: IntelligencePlatform.QUORA,
      type: 'profile',
      pattern: /quora\.com\/profile\/([\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS],
      context: 'networking'
  },
  {
      platform: IntelligencePlatform.QUORA,
      type: 'question',
      pattern: /quora\.com\/(?:q\/)?([\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.COMMENTS],
      context: 'expert_authority'
  },
  // ===================== VIMEO =====================
  {
      platform: IntelligencePlatform.VIMEO,
      type: 'video',
      pattern: /vimeo\.com\/(?:video\/|channels\/[\w.-]+\/)?(\d+)/i,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.COMMENTS],
      context: 'video_growth'
  },
  {
      platform: IntelligencePlatform.VIMEO,
      type: 'channel',
      pattern: /vimeo\.com\/([\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.VIEWS],
      context: 'video_growth'
  },
  // ===================== RUMBLE =====================
  {
      platform: IntelligencePlatform.RUMBLE,
      type: 'video',
      pattern: /rumble\.com\/([\w.-]+\.html|v[\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.COMMENTS],
      context: 'video_growth'
  },
  {
      platform: IntelligencePlatform.RUMBLE,
      type: 'channel',
      pattern: /rumble\.com\/(?:c\/|user\/)?([\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.VIEWS],
      context: 'video_growth'
  },
  // ===================== SHAZAM =====================
  {
      platform: IntelligencePlatform.SHAZAM,
      type: 'track',
      pattern: /shazam\.com\/track\/(\d+)/i,
      suggestedCategories: [CATEGORY_LABELS.PLAYS, CATEGORY_LABELS.LIKES],
      context: 'music_discovery'
  },
  // ===================== WHATSAPP =====================
  {
      platform: IntelligencePlatform.WHATSAPP,
      type: 'group',
      pattern: /(?:chat\.whatsapp\.com|wa\.me)\/([\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.GROUPS],
      context: 'messenger_community'
  },
  // ===================== MAX MESSENGER =====================
  {
      platform: IntelligencePlatform.MAX,
      type: 'channel',
      pattern: /(?:max\.ru)\/c\/(-?\d+(?:\/[\w-]+)?|[\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.GROUPS],
      context: 'automation'
  },
  {
      platform: IntelligencePlatform.MAX,
      type: 'profile',
      pattern: /(?:max\.ru)\/([\w_.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.BOTS],
      context: 'networking'
  },
  // ===================== STEAM =====================
  {
      platform: IntelligencePlatform.STEAM,
      type: 'post',
      pattern: /steamcommunity\.com\/sharedfiles\/filedetails\/\?id=(\d+)/i,
      suggestedCategories: [CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.LIKES],
      context: 'social_reach'
  },
  {
      platform: IntelligencePlatform.STEAM,
      type: 'profile',
      pattern: /steamcommunity\.com\/(?:id\/([\w.-]+)|profiles\/(\d+))/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.FRIENDS],
      context: 'networking'
  },
  // ===================== WIBES =====================
  {
      platform: IntelligencePlatform.WIBES,
      type: 'post',
      pattern: /wibes\.ru\/[\w.-]+\/([\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.REPOSTS, CATEGORY_LABELS.SAVES],
      context: 'social_reach'
  },
  {
      platform: IntelligencePlatform.WIBES,
      type: 'profile',
      pattern: /wibes\.ru\/([\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS],
      context: 'networking'
  },
  // ===================== TROVO =====================
  {
      platform: IntelligencePlatform.TROVO,
      type: 'live',
      pattern: /trovo\.live\/(?:s\/[\w.-]+\/|[\w.-]+\/)(\d+)/i,
      suggestedCategories: [CATEGORY_LABELS.STREAMS],
      context: 'live_stream'
  },
  {
      platform: IntelligencePlatform.TROVO,
      type: 'channel',
      pattern: /trovo\.live\/(?:s\/)?([\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.STREAMS],
      context: 'streaming_growth'
  },
  // ===================== FALLBACK WEBSITE & TRAFFIC =====================
  {
      platform: IntelligencePlatform.WEBSITE,
      type: 'seo_traffic',
      pattern: /^https?:\/\/[^/\s]+\.[a-z]{2,}/i,
      suggestedCategories: [CATEGORY_LABELS.TRAFFIC],
      context: 'seo_authority'
  },
  {
      platform: IntelligencePlatform.WEBSITE,
      type: 'direct_traffic',
      pattern: /^https?:\/\//,
      suggestedCategories: [CATEGORY_LABELS.OTHER, CATEGORY_LABELS.VIEWS],
      context: 'visibility'
  }
];

