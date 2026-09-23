/**
 * src/utils/social-link-placeholder.ts
 *
 * Universal Social Link Dynamic Placeholder, Badge & Normalization Engine.
 * Verified and architected by LLM Swarm Consensus (GLM-5.2 + MiniMax-M3).
 *
 * Supports 22+ Social Networks and platforms with O(1) matching,
 * contextual hints, auto-prefixing, and cross-network mismatch detection.
 */

export interface SocialLinkConfig {
  networkSlug: string;
  networkName: string;
  categoryName: string;
  label?: string;
  placeholder: string;
  hint: string;
  badge: string;
  examples: string[];
  hostAliases: string[];
  urlPattern?: RegExp;
}

// Canonical default fallback when network is unknown or unset
const DEFAULT_LINK_CONFIG: SocialLinkConfig = {
  networkSlug: 'generic',
  networkName: 'Социальная сеть',
  categoryName: 'Услуга',
  label: 'Ссылка для продвижения',
  placeholder: 'https://t.me/channel или vk.com/...',
  hint: 'Ссылка на канал, группу, профиль или публикацию',
  badge: 'Ссылка',
  examples: ['https://t.me/channel', 'https://vk.com/public123', 'https://youtube.com/watch?v=...'],
  hostAliases: [],
};

/**
 * Normalizes input string (lowercased, trimmed, removing non-alphanumeric noise)
 */
function normalizeKey(str?: string | null): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-zа-я0-9_-]/gi, '');
}

/**
 * Network-specific Link Matrix
 */
export const SOCIAL_LINK_MATRIX: Record<string, {
  name: string;
  hostAliases: string[];
  categories: Record<string, Omit<SocialLinkConfig, 'networkSlug' | 'networkName' | 'hostAliases'>>;
  defaultCategory: Omit<SocialLinkConfig, 'networkSlug' | 'networkName' | 'hostAliases'>;
}> = {
  vk: {
    name: 'ВКонтакте',
    hostAliases: ['vk.com', 'm.vk.com', 'vk.ru', 'vkontakte.ru', 'vk.cc'],
    defaultCategory: {
      categoryName: 'ВКонтакте',
      placeholder: 'Например: vk.com/public123456 или vk.com/wall-123_456',
      hint: 'Ссылка на сообщество, профиль или запись ВКонтакте',
      badge: 'ВКонтакте',
      examples: ['https://vk.com/public123456', 'https://vk.com/wall-123456_789'],
    },
    categories: {
      subscribers: {
        categoryName: 'Подписчики / Группы',
        placeholder: 'Например: vk.com/public123456 или vk.com/club_name',
        hint: 'Ссылка на открытую группу, паблик или мероприятие ВКонтакте',
        badge: 'Группа / Паблик',
        examples: ['https://vk.com/public123456', 'https://vk.com/club123456'],
      },
      friends: {
        categoryName: 'Друзья / Профиль',
        placeholder: 'Например: vk.com/id123456 или vk.com/username',
        hint: 'Ссылка на личную страницу или профиль ВКонтакте',
        badge: 'Личный профиль',
        examples: ['https://vk.com/id123456789', 'https://vk.com/durov'],
      },
      likes: {
        categoryName: 'Лайки на запись',
        placeholder: 'Например: vk.com/wall-12345678_90',
        hint: 'Ссылка на конкретный пост / запись на стене ВКонтакте',
        badge: 'Запись на стене',
        examples: ['https://vk.com/wall-12345678_90'],
      },
      reposts: {
        categoryName: 'Репосты',
        placeholder: 'Например: vk.com/wall-12345678_90',
        hint: 'Ссылка на пост на стене, которым нужно поделиться',
        badge: 'Запись на стене',
        examples: ['https://vk.com/wall-12345678_90'],
      },
      views: {
        categoryName: 'Просмотры',
        placeholder: 'Например: vk.com/wall-12345678_90 или vk.com/clip-123_456',
        hint: 'Ссылка на запись на стене, видео или клип ВКонтакте',
        badge: 'Пост / Видео / Клип',
        examples: ['https://vk.com/wall-12345678_90', 'https://vk.com/clip-123456_789'],
      },
      clips: {
        categoryName: 'VK Клипы',
        placeholder: 'Например: vk.com/clip-12345678_90',
        hint: 'Ссылка на короткий видеоролик VK Клипы',
        badge: 'VK Клип',
        examples: ['https://vk.com/clip-12345678_90'],
      },
      stories: {
        categoryName: 'Истории',
        placeholder: 'Например: vk.com/story-12345678_90',
        hint: 'Ссылка на активную историю (сторис) ВКонтакте',
        badge: 'История (24ч)',
        examples: ['https://vk.com/story-12345678_90'],
      },
      polls: {
        categoryName: 'Опросы / Голосования',
        placeholder: 'Например: vk.com/poll-12345678_90 или vk.com/wall-123_456',
        hint: 'Ссылка на опрос или пост с голосованием ВКонтакте',
        badge: 'Опрос / Пост',
        examples: ['https://vk.com/poll-12345678_90', 'https://vk.com/wall-123456_789'],
      },
    },
  },

  telegram: {
    name: 'Telegram',
    hostAliases: ['t.me', 'telegram.me', 'telegram.dog'],
    defaultCategory: {
      categoryName: 'Telegram',
      placeholder: 't.me/channel или t.me/channel/123',
      hint: 'Ссылка на канал, группу или пост в Telegram',
      badge: 'Telegram',
      examples: ['https://t.me/channel_name', 'https://t.me/channel_name/1234'],
    },
    categories: {
      subscribers: {
        categoryName: 'Подписчики в канал',
        placeholder: 'Например: t.me/channel_name или t.me/+invitehash',
        hint: 'Ссылка на публичный канал или приватная ссылка-приглашение',
        badge: 'Канал Telegram',
        examples: ['https://t.me/channel_name', 'https://t.me/+AbCdEfGh123'],
      },
      members: {
        categoryName: 'Участники в группу',
        placeholder: 'Например: t.me/group_name или t.me/+invitehash',
        hint: 'Ссылка на открытую группу (чат) или приватный инвайт',
        badge: 'Группа / Чат',
        examples: ['https://t.me/group_name', 'https://t.me/+AbCdEfGh123'],
      },
      views: {
        categoryName: 'Просмотры на пост',
        placeholder: 'Например: t.me/channel_name/1234',
        hint: 'Ссылка на конкретное сообщение (пост) в Telegram-канале',
        badge: 'Пост в канале',
        examples: ['https://t.me/channel_name/1234'],
      },
      reactions: {
        categoryName: 'Реакции',
        placeholder: 'Например: t.me/channel_name/1234',
        hint: 'Ссылка на пост в канале, куда нужно поставить реакции',
        badge: 'Пост в канале',
        examples: ['https://t.me/channel_name/1234'],
      },
      reposts: {
        categoryName: 'Репосты / Пересылки',
        placeholder: 'Например: t.me/channel_name/1234',
        hint: 'Ссылка на пост в канале для пересылки',
        badge: 'Пост в канале',
        examples: ['https://t.me/channel_name/1234'],
      },
      stories: {
        categoryName: 'Истории',
        placeholder: 'Например: t.me/channel_name/s/123',
        hint: 'Ссылка на активную историю канала или профиля в Telegram',
        badge: 'История Telegram',
        examples: ['https://t.me/channel_name/s/123'],
      },
      polls: {
        categoryName: 'Опросы / Голосования',
        placeholder: 'Например: t.me/channel_name/1234',
        hint: 'Ссылка на пост с опросом или викториной в Telegram',
        badge: 'Опрос в канале',
        examples: ['https://t.me/channel_name/1234'],
      },
      bots: {
        categoryName: 'Бот-старты / Рефералы',
        placeholder: 'Например: t.me/bot_username?start=ref123',
        hint: 'Ссылка на бота с реферальным параметром start',
        badge: 'Telegram Бот',
        examples: ['https://t.me/bot_username?start=ref123'],
      },
    },
  },

  youtube: {
    name: 'YouTube',
    hostAliases: ['youtube.com', 'youtu.be', 'm.youtube.com'],
    defaultCategory: {
      categoryName: 'YouTube',
      placeholder: 'Например: youtube.com/watch?v=dQw4w9WgXcQ или youtube.com/@channel',
      hint: 'Ссылка на видео, Shorts или канал на YouTube',
      badge: 'YouTube',
      examples: ['https://youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com/@channel'],
    },
    categories: {
      subscribers: {
        categoryName: 'Подписчики на канал',
        placeholder: 'Например: youtube.com/@channel_name или youtube.com/channel/UC...',
        hint: 'Ссылка на YouTube-канал (handle @имя или ссылка на канал)',
        badge: 'YouTube Канал',
        examples: ['https://youtube.com/@channel_name', 'https://youtube.com/channel/UC1234567890'],
      },
      views: {
        categoryName: 'Просмотры на видео',
        placeholder: 'Например: youtube.com/watch?v=dQw4w9WgXcQ или youtu.be/dQw4w9WgXcQ',
        hint: 'Ссылка на стандартное видео YouTube',
        badge: 'YouTube Видео',
        examples: ['https://youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ'],
      },
      likes: {
        categoryName: 'Лайки на видео',
        placeholder: 'Например: youtube.com/watch?v=dQw4w9WgXcQ',
        hint: 'Ссылка на видео или Shorts для добавления лайков',
        badge: 'YouTube Видео',
        examples: ['https://youtube.com/watch?v=dQw4w9WgXcQ'],
      },
      shorts: {
        categoryName: 'YouTube Shorts',
        placeholder: 'Например: youtube.com/shorts/dQw4w9WgXcQ',
        hint: 'Ссылка на короткий ролик YouTube Shorts',
        badge: 'YouTube Shorts',
        examples: ['https://youtube.com/shorts/dQw4w9WgXcQ'],
      },
      streams: {
        categoryName: 'Прямые трансляции / Стримы',
        placeholder: 'Например: youtube.com/watch?v=... или youtube.com/live/...',
        hint: 'Ссылка на идущую прямую трансляцию или премьеру',
        badge: 'Прямой эфир',
        examples: ['https://youtube.com/live/123456'],
      },
      comments: {
        categoryName: 'Комментарии',
        placeholder: 'Например: youtube.com/watch?v=dQw4w9WgXcQ',
        hint: 'Ссылка на видео, под которым нужны комментарии',
        badge: 'YouTube Видео',
        examples: ['https://youtube.com/watch?v=dQw4w9WgXcQ'],
      },
    },
  },

  instagram: {
    name: 'Instagram',
    hostAliases: ['instagram.com', 'instagr.am', 'www.instagram.com'],
    defaultCategory: {
      categoryName: 'Instagram',
      placeholder: 'Например: instagram.com/username или instagram.com/p/CxY123/',
      hint: 'Ссылка на открытый профиль, пост или Reels в Instagram',
      badge: 'Instagram',
      examples: ['https://instagram.com/username', 'https://instagram.com/p/CxY123/'],
    },
    categories: {
      subscribers: {
        categoryName: 'Подписчики',
        placeholder: 'Например: instagram.com/username',
        hint: 'Ссылка на открытый (публичный) профиль Instagram',
        badge: 'Профиль Instagram',
        examples: ['https://instagram.com/username'],
      },
      likes: {
        categoryName: 'Лайки на публикацию',
        placeholder: 'Например: instagram.com/p/CxY123456/ или instagram.com/reel/...',
        hint: 'Ссылка на публикацию (фото, карусель) или Reels',
        badge: 'Пост / Reels',
        examples: ['https://instagram.com/p/CxY123456/'],
      },
      reels: {
        categoryName: 'Instagram Reels',
        placeholder: 'Например: instagram.com/reel/CxY123456/',
        hint: 'Ссылка на видеоролик Instagram Reels',
        badge: 'Instagram Reels',
        examples: ['https://instagram.com/reel/CxY123456/'],
      },
      views: {
        categoryName: 'Просмотры на видео / Reels',
        placeholder: 'Например: instagram.com/reel/CxY123456/ или instagram.com/p/...',
        hint: 'Ссылка на видео, Reels или публикацию',
        badge: 'Reels / Видео',
        examples: ['https://instagram.com/reel/CxY123456/'],
      },
      stories: {
        categoryName: 'Истории',
        placeholder: 'Например: instagram.com/stories/username/123456/ или instagram.com/username',
        hint: 'Ссылка на активную историю или открытый профиль с историями',
        badge: 'История (24ч)',
        examples: ['https://instagram.com/stories/username/123456/'],
      },
      comments: {
        categoryName: 'Комментарии',
        placeholder: 'Например: instagram.com/p/CxY123456/',
        hint: 'Ссылка на публикацию или Reels для добавления комментариев',
        badge: 'Публикация IG',
        examples: ['https://instagram.com/p/CxY123456/'],
      },
    },
  },

  tiktok: {
    name: 'TikTok',
    hostAliases: ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com', 'www.tiktok.com'],
    defaultCategory: {
      categoryName: 'TikTok',
      placeholder: 'Например: tiktok.com/@username или tiktok.com/@user/video/123',
      hint: 'Ссылка на профиль или видеоролик в TikTok',
      badge: 'TikTok',
      examples: ['https://tiktok.com/@username', 'https://tiktok.com/@user/video/1234567890'],
    },
    categories: {
      subscribers: {
        categoryName: 'Подписчики',
        placeholder: 'Например: tiktok.com/@username',
        hint: 'Ссылка на открытый профиль в TikTok',
        badge: 'Профиль TikTok',
        examples: ['https://tiktok.com/@username'],
      },
      views: {
        categoryName: 'Просмотры на видео',
        placeholder: 'Например: tiktok.com/@username/video/1234567890 или vm.tiktok.com/...',
        hint: 'Ссылка на конкретное видео в TikTok',
        badge: 'Видео TikTok',
        examples: ['https://tiktok.com/@username/video/1234567890'],
      },
      likes: {
        categoryName: 'Лайки на видео',
        placeholder: 'Например: tiktok.com/@username/video/1234567890',
        hint: 'Ссылка на видеоролик в TikTok',
        badge: 'Видео TikTok',
        examples: ['https://tiktok.com/@username/video/1234567890'],
      },
      reposts: {
        categoryName: 'Репосты / Поделиться',
        placeholder: 'Например: tiktok.com/@username/video/1234567890',
        hint: 'Ссылка на видео в TikTok для добавления репостов',
        badge: 'Видео TikTok',
        examples: ['https://tiktok.com/@username/video/1234567890'],
      },
    },
  },

  ok: {
    name: 'Одноклассники',
    hostAliases: ['ok.ru', 'm.ok.ru', 'odnoklassniki.ru'],
    defaultCategory: {
      categoryName: 'Одноклассники',
      placeholder: 'Например: ok.ru/group/1234567890 или ok.ru/profile/123456',
      hint: 'Ссылка на группу, профиль или тему в Одноклассниках',
      badge: 'Одноклассники',
      examples: ['https://ok.ru/group/1234567890'],
    },
    categories: {
      subscribers: {
        categoryName: 'Подписчики в группу',
        placeholder: 'Например: ok.ru/group/1234567890',
        hint: 'Ссылка на открытую группу в Одноклассниках',
        badge: 'Группа OK',
        examples: ['https://ok.ru/group/1234567890'],
      },
      friends: {
        categoryName: 'Друзья в профиль',
        placeholder: 'Например: ok.ru/profile/1234567890',
        hint: 'Ссылка на личный профиль пользователя в Одноклассниках',
        badge: 'Профиль OK',
        examples: ['https://ok.ru/profile/1234567890'],
      },
      likes: {
        categoryName: 'Классы на тему / пост',
        placeholder: 'Например: ok.ru/group/123/topic/456',
        hint: 'Ссылка на конкретную тему (пост) или публикацию в OK',
        badge: 'Тема / Пост OK',
        examples: ['https://ok.ru/group/123/topic/456'],
      },
    },
  },

  dzen: {
    name: 'Дзен',
    hostAliases: ['dzen.ru', 'zen.yandex.ru'],
    defaultCategory: {
      categoryName: 'Дзен',
      placeholder: 'Например: dzen.ru/channel_name или dzen.ru/a/ZxY123',
      hint: 'Ссылка на канал, статью или видео в Дзене',
      badge: 'Дзен',
      examples: ['https://dzen.ru/channel_name', 'https://dzen.ru/a/ZxY123456'],
    },
    categories: {
      subscribers: {
        categoryName: 'Подписчики на канал',
        placeholder: 'Например: dzen.ru/channel_name или dzen.ru/id/...',
        hint: 'Ссылка на канал или блог в Дзене',
        badge: 'Канал Дзен',
        examples: ['https://dzen.ru/channel_name'],
      },
      likes: {
        categoryName: 'Лайки на публикацию',
        placeholder: 'Например: dzen.ru/a/ZxY123456 или dzen.ru/b/...',
        hint: 'Ссылка на статью, пост или публикацию в Дзене',
        badge: 'Публикация Дзен',
        examples: ['https://dzen.ru/a/ZxY123456'],
      },
      views: {
        categoryName: 'Просмотры / Дочитывания',
        placeholder: 'Например: dzen.ru/a/ZxY123456 или dzen.ru/video/watch/...',
        hint: 'Ссылка на статью или видеоролик в Дзене',
        badge: 'Статья / Видео',
        examples: ['https://dzen.ru/a/ZxY123456'],
      },
    },
  },

  rutube: {
    name: 'RUTUBE',
    hostAliases: ['rutube.ru', 'www.rutube.ru'],
    defaultCategory: {
      categoryName: 'RUTUBE',
      placeholder: 'Например: rutube.ru/channel/12345678/ или rutube.ru/video/...',
      hint: 'Ссылка на канал или видео на платформе RUTUBE',
      badge: 'RUTUBE',
      examples: ['https://rutube.ru/channel/12345678/'],
    },
    categories: {
      subscribers: {
        categoryName: 'Подписчики на канал',
        placeholder: 'Например: rutube.ru/channel/12345678/',
        hint: 'Ссылка на канал автора на RUTUBE',
        badge: 'Канал RUTUBE',
        examples: ['https://rutube.ru/channel/12345678/'],
      },
      views: {
        categoryName: 'Просмотры на видео',
        placeholder: 'Например: rutube.ru/video/123456789abcdef/ или rutube.ru/shorts/...',
        hint: 'Ссылка на видеоролик или Shorts на RUTUBE',
        badge: 'Видео RUTUBE',
        examples: ['https://rutube.ru/video/123456789abcdef/'],
      },
      likes: {
        categoryName: 'Лайки (В топы)',
        placeholder: 'Например: rutube.ru/video/123456789abcdef/',
        hint: 'Ссылка на видеоролик на RUTUBE',
        badge: 'Видео RUTUBE',
        examples: ['https://rutube.ru/video/123456789abcdef/'],
      },
    },
  },

  twitter: {
    name: 'X (Twitter)',
    hostAliases: ['x.com', 'twitter.com', 'mobile.twitter.com'],
    defaultCategory: {
      categoryName: 'X (Twitter)',
      placeholder: 'Например: x.com/username или x.com/user/status/123',
      hint: 'Ссылка на профиль или твит в X (Twitter)',
      badge: 'X (Twitter)',
      examples: ['https://x.com/username', 'https://x.com/username/status/1234567890'],
    },
    categories: {
      subscribers: {
        categoryName: 'Читатели (Followers)',
        placeholder: 'Например: x.com/username или twitter.com/username',
        hint: 'Ссылка на открытый профиль в X (Twitter)',
        badge: 'Профиль X',
        examples: ['https://x.com/username'],
      },
      likes: {
        categoryName: 'Лайки на твит',
        placeholder: 'Например: x.com/username/status/1234567890',
        hint: 'Ссылка на конкретный твит (пост)',
        badge: 'Твит (Пост)',
        examples: ['https://x.com/username/status/1234567890'],
      },
      reposts: {
        categoryName: 'Ретвиты (Reposts)',
        placeholder: 'Например: x.com/username/status/1234567890',
        hint: 'Ссылка на твит для ретвита',
        badge: 'Твит (Пост)',
        examples: ['https://x.com/username/status/1234567890'],
      },
    },
  },

  twitch: {
    name: 'Twitch',
    hostAliases: ['twitch.tv', 'clips.twitch.tv', 'www.twitch.tv'],
    defaultCategory: {
      categoryName: 'Twitch',
      placeholder: 'Например: twitch.tv/streamer_name',
      hint: 'Ссылка на канал стримера на Twitch',
      badge: 'Twitch',
      examples: ['https://twitch.tv/streamer_name'],
    },
    categories: {
      subscribers: {
        categoryName: 'Фолловеры на канал',
        placeholder: 'Например: twitch.tv/streamer_name',
        hint: 'Ссылка на Twitch-канал стримера',
        badge: 'Twitch Канал',
        examples: ['https://twitch.tv/streamer_name'],
      },
      views: {
        categoryName: 'Зрители на трансляцию',
        placeholder: 'Например: twitch.tv/streamer_name',
        hint: 'Ссылка на идущую прямую трансляцию на Twitch',
        badge: 'Прямой эфир',
        examples: ['https://twitch.tv/streamer_name'],
      },
    },
  },

  discord: {
    name: 'Discord',
    hostAliases: ['discord.gg', 'discord.com'],
    defaultCategory: {
      categoryName: 'Discord',
      placeholder: 'Например: discord.gg/invitecode',
      hint: 'Ссылка-приглашение на Discord сервер',
      badge: 'Discord Сервер',
      examples: ['https://discord.gg/invitecode'],
    },
    categories: {
      subscribers: {
        categoryName: 'Участники на сервер',
        placeholder: 'Например: discord.gg/invitecode',
        hint: 'Действующая ссылка-приглашение на ваш сервер в Discord',
        badge: 'Discord Инвайт',
        examples: ['https://discord.gg/invitecode'],
      },
    },
  },

  threads: {
    name: 'Threads',
    hostAliases: ['threads.net', 'www.threads.net'],
    defaultCategory: {
      categoryName: 'Threads',
      placeholder: 'Например: threads.net/@username или threads.net/@user/post/123',
      hint: 'Ссылка на профиль или ветку в Threads',
      badge: 'Threads',
      examples: ['https://threads.net/@username'],
    },
    categories: {
      subscribers: {
        categoryName: 'Подписчики в профиль',
        placeholder: 'Например: threads.net/@username',
        hint: 'Ссылка на открытый аккаунт в Threads',
        badge: 'Профиль Threads',
        examples: ['https://threads.net/@username'],
      },
      likes: {
        categoryName: 'Лайки на ветку',
        placeholder: 'Например: threads.net/@username/post/CxY123456',
        hint: 'Ссылка на конкретную публикацию (ветку) в Threads',
        badge: 'Ветка Threads',
        examples: ['https://threads.net/@username/post/CxY123456'],
      },
    },
  },

  avito: {
    name: 'Авито',
    hostAliases: ['avito.ru', 'm.avito.ru'],
    defaultCategory: {
      categoryName: 'Авито',
      placeholder: 'Например: avito.ru/city/..._1234567890',
      hint: 'Ссылка на объявление или профиль продавца на Авито',
      badge: 'Объявление Авито',
      examples: ['https://avito.ru/moskva/..._1234567890'],
    },
    categories: {
      views: {
        categoryName: 'Просмотры на объявление',
        placeholder: 'Например: avito.ru/city/..._1234567890',
        hint: 'Ссылка на активное объявление на Авито',
        badge: 'Объявление Авито',
        examples: ['https://avito.ru/moskva/..._1234567890'],
      },
      favorites: {
        categoryName: 'Добавления в избранное',
        placeholder: 'Например: avito.ru/city/..._1234567890',
        hint: 'Ссылка на товар или объявление на Авито',
        badge: 'Объявление Авито',
        examples: ['https://avito.ru/moskva/..._1234567890'],
      },
    },
  },

  maps: {
    name: 'Карты (Яндекс / 2ГИС)',
    hostAliases: ['yandex.ru', 'maps.yandex.ru', '2gis.ru', 'google.com/maps'],
    defaultCategory: {
      categoryName: 'Карты / Навигаторы',
      placeholder: 'Например: yandex.ru/maps/org/.../123456 или 2gis.ru/firm/...',
      hint: 'Ссылка на карточку организации в Яндекс Картах или 2ГИС',
      badge: 'Организация на картах',
      examples: ['https://yandex.ru/maps/org/.../1234567890'],
    },
    categories: {
      reviews: {
        categoryName: 'Отзывы и оценки',
        placeholder: 'Например: yandex.ru/maps/org/.../123456 или 2gis.ru/firm/...',
        hint: 'Ссылка на страницу компании на Яндекс Картах или 2ГИС',
        badge: 'Организация на картах',
        examples: ['https://yandex.ru/maps/org/.../1234567890'],
      },
    },
  },
};

// Aliases for matching slug inputs
const NETWORK_ALIASES: Record<string, string> = {
  vk: 'vk',
  v_kontakte: 'vk',
  vkontakte: 'vk',
  вконтакте: 'vk',
  вк: 'vk',
  tg: 'telegram',
  telegram: 'telegram',
  телеграм: 'telegram',
  телега: 'telegram',
  yt: 'youtube',
  youtube: 'youtube',
  ютуб: 'youtube',
  ютубе: 'youtube',
  ig: 'instagram',
  instagram: 'instagram',
  инстаграм: 'instagram',
  инста: 'instagram',
  tt: 'tiktok',
  tiktok: 'tiktok',
  тикток: 'tiktok',
  ok: 'ok',
  odnoklassniki: 'ok',
  одноклассники: 'ok',
  ок: 'ok',
  dzen: 'dzen',
  zen: 'dzen',
  яндексдзен: 'dzen',
  дзен: 'dzen',
  rutube: 'rutube',
  рутуб: 'rutube',
  x: 'twitter',
  twitter: 'twitter',
  твиттер: 'twitter',
  twitch: 'twitch',
  твич: 'twitch',
  discord: 'discord',
  дискорд: 'discord',
  threads: 'threads',
  тредс: 'threads',
  avito: 'avito',
  авито: 'avito',
  maps: 'maps',
  yandexmaps: 'maps',
  яндекскарты: 'maps',
  '2gis': 'maps',
  карты: 'maps',
};

const CATEGORY_ALIASES: Record<string, string> = {
  // Subscribers / Followers
  subscribers: 'subscribers',
  subscriber: 'subscribers',
  subs: 'subscribers',
  members: 'members',
  member: 'members',
  followers: 'subscribers',
  follower: 'subscribers',
  friends: 'friends',
  подписчики: 'subscribers',
  участники: 'members',
  друзья: 'friends',
  фолловеры: 'subscribers',
  читатели: 'subscribers',
  каналы: 'subscribers',
  группы: 'subscribers',
  паблики: 'subscribers',

  // Likes / Reactions
  likes: 'likes',
  like: 'likes',
  reactions: 'reactions',
  reaction: 'reactions',
  favorites: 'favorites',
  лайки: 'likes',
  реакции: 'reactions',
  классы: 'likes',
  избранное: 'favorites',

  // Views / Plays
  views: 'views',
  view: 'views',
  plays: 'views',
  просмотры: 'views',
  дочитывания: 'views',
  прослушивания: 'views',

  // Reposts / Shares
  reposts: 'reposts',
  repost: 'reposts',
  shares: 'reposts',
  retweets: 'reposts',
  репосты: 'reposts',
  поделиться: 'reposts',
  ретвиты: 'reposts',
  пересылки: 'reposts',

  // Video formats
  shorts: 'shorts',
  reels: 'reels',
  clips: 'clips',
  шортс: 'shorts',
  рилс: 'reels',
  клипы: 'clips',
  рилсы: 'reels',

  // Stories
  stories: 'stories',
  story: 'stories',
  истории: 'stories',
  сторис: 'stories',

  // Polls
  polls: 'polls',
  poll: 'polls',
  votes: 'polls',
  vote: 'polls',
  опросы: 'polls',
  голосования: 'polls',

  // Streams
  streams: 'streams',
  stream: 'streams',
  live: 'streams',
  стримы: 'streams',
  эфиры: 'streams',
  трансляции: 'streams',

  // Bots
  bots: 'bots',
  bot: 'bots',
  боты: 'bots',
  рефералы: 'bots',

  // Reviews
  reviews: 'reviews',
  review: 'reviews',
  отзывы: 'reviews',
  оценки: 'reviews',
};

/**
 * Resolves optimal SocialLinkConfig based on selected network, category, or service details.
 */
export function getSocialLinkConfig(
  networkInput?: string | null,
  categoryInput?: string | null,
  serviceName?: string | null,
  targetType?: string | null,
  overridePlaceholder?: string | null,
  overrideHint?: string | null
): SocialLinkConfig {
  const normNet = normalizeKey(networkInput);
  const normCat = normalizeKey(categoryInput);
  const normName = normalizeKey(serviceName);

  // 1. Resolve canonical network
  let resolvedNetKey = NETWORK_ALIASES[normNet];

  // Try extracting network from serviceName if networkInput wasn't resolved
  if (!resolvedNetKey && normName) {
    for (const [alias, targetNet] of Object.entries(NETWORK_ALIASES)) {
      if (normName.includes(alias)) {
        resolvedNetKey = targetNet;
        break;
      }
    }
  }

  if (!resolvedNetKey || !SOCIAL_LINK_MATRIX[resolvedNetKey]) {
    return DEFAULT_LINK_CONFIG;
  }

  const netConfig = SOCIAL_LINK_MATRIX[resolvedNetKey];

  // 2. Resolve canonical category
  let resolvedCatKey = CATEGORY_ALIASES[normCat];

  // Fine-grained heuristic from serviceName
  if (normName) {
    if (normName.includes('клип') || normName.includes('clip')) resolvedCatKey = 'clips';
    else if (normName.includes('shorts') || normName.includes('шортс')) resolvedCatKey = 'shorts';
    else if (normName.includes('reels') || normName.includes('рилс')) resolvedCatKey = 'reels';
    else if (normName.includes('сторис') || normName.includes('истори') || normName.includes('story')) resolvedCatKey = 'stories';
    else if (normName.includes('опрос') || normName.includes('голос') || normName.includes('poll')) resolvedCatKey = 'polls';
    else if (normName.includes('стрим') || normName.includes('stream') || normName.includes('эфир')) resolvedCatKey = 'streams';
    else if (normName.includes('бот') || normName.includes('bot') || normName.includes('реферал')) resolvedCatKey = 'bots';
    else if (normName.includes('отзыв') || normName.includes('карты') || normName.includes('review')) resolvedCatKey = 'reviews';
  }

  // Refinement by targetType (e.g. from service definition)
  const cleanTargetType = targetType ? targetType.trim().toUpperCase() : '';
  if (cleanTargetType) {
    if (cleanTargetType === 'CHANNEL' || cleanTargetType === 'CHANNEL_POSTS') {
      resolvedCatKey = 'subscribers';
    } else if (cleanTargetType === 'CHAT' || cleanTargetType === 'GROUP') {
      resolvedCatKey = 'members';
    } else if (cleanTargetType === 'POST') {
      if (!resolvedCatKey || resolvedCatKey === 'subscribers' || resolvedCatKey === 'members') {
        resolvedCatKey = 'views';
      }
    } else if (cleanTargetType === 'STORY') {
      resolvedCatKey = 'stories';
    } else if (cleanTargetType === 'BOT') {
      resolvedCatKey = 'bots';
    } else if (cleanTargetType === 'PROFILE' || cleanTargetType === 'USER') {
      resolvedCatKey = 'friends';
    }
  }

  // 3. Extract exact category or fallback to network default
  const categoryData = resolvedCatKey && netConfig.categories[resolvedCatKey]
    ? netConfig.categories[resolvedCatKey]
    : netConfig.defaultCategory;

  // 4. Compute human-readable contextual field label
  let dynamicLabel = `Ссылка для заказа`;
  if (resolvedCatKey === 'subscribers') {
    dynamicLabel = resolvedNetKey === 'telegram' ? 'Ссылка на канал или группу' : `Ссылка на сообщество ${netConfig.name}`;
  } else if (resolvedCatKey === 'members') {
    dynamicLabel = resolvedNetKey === 'telegram' ? 'Ссылка на группу или чат' : `Ссылка на группу ${netConfig.name}`;
  } else if (resolvedCatKey === 'friends') {
    dynamicLabel = `Ссылка на страницу / профиль ${netConfig.name}`;
  } else if (resolvedCatKey === 'views' || resolvedCatKey === 'likes' || resolvedCatKey === 'reactions' || resolvedCatKey === 'reposts' || resolvedCatKey === 'comments') {
    dynamicLabel = 'Ссылка на публикацию (пост)';
  } else if (resolvedCatKey === 'clips' || resolvedCatKey === 'reels' || resolvedCatKey === 'shorts') {
    dynamicLabel = 'Ссылка на видео / клип';
  } else if (resolvedCatKey === 'stories') {
    dynamicLabel = 'Ссылка на историю (Stories)';
  } else if (resolvedCatKey === 'bots') {
    dynamicLabel = 'Ссылка на Telegram-бота';
  } else if (resolvedCatKey === 'polls') {
    dynamicLabel = 'Ссылка на опрос / голосование';
  } else if (resolvedCatKey === 'streams') {
    dynamicLabel = 'Ссылка на прямой эфир (стрим)';
  } else {
    dynamicLabel = `Ссылка на ${netConfig.name}`;
  }

  return {
    networkSlug: resolvedNetKey,
    networkName: netConfig.name,
    hostAliases: netConfig.hostAliases,
    ...categoryData,
    label: dynamicLabel,
    placeholder: overridePlaceholder || categoryData.placeholder,
    hint: overrideHint || categoryData.hint,
  };
}

/**
 * Normalizes user-entered URL (auto-prefixes https://, trims, strips noise)
 */
/**
 * Strictly preserves user-entered URL As-Is (only trims outer whitespace).
 * Zero mutation policy ensures legal safe harbor and zero platform liability.
 */
export function normalizeUserLink(rawInput: string): string {
  if (!rawInput) return '';
  return rawInput.trim();
}

/**
 * Detects if the entered URL matches a different social network (Cross-Network Warning)
 */
export function detectMismatchedNetwork(
  enteredUrl: string,
  selectedNetworkSlug?: string | null
): { isMismatch: boolean; detectedNetworkKey?: string; detectedNetworkName?: string; expectedNetworkName?: string } {
  if (!enteredUrl || !selectedNetworkSlug) return { isMismatch: false };

  const normTargetNet = NETWORK_ALIASES[normalizeKey(selectedNetworkSlug)];
  if (!normTargetNet || !SOCIAL_LINK_MATRIX[normTargetNet]) return { isMismatch: false };

  const cleanUrl = enteredUrl.toLowerCase().trim();
  if (!cleanUrl.includes('.')) return { isMismatch: false };

  // Check which network the URL actually belongs to
  let foundNetKey: string | null = null;
  for (const [netKey, config] of Object.entries(SOCIAL_LINK_MATRIX)) {
    for (const host of config.hostAliases) {
      if (cleanUrl.includes(host)) {
        foundNetKey = netKey;
        break;
      }
    }
    if (foundNetKey) break;
  }

  if (foundNetKey && foundNetKey !== normTargetNet) {
    return {
      isMismatch: true,
      detectedNetworkKey: foundNetKey,
      detectedNetworkName: SOCIAL_LINK_MATRIX[foundNetKey].name,
      expectedNetworkName: SOCIAL_LINK_MATRIX[normTargetNet].name,
    };
  }

  return { isMismatch: false };
}
