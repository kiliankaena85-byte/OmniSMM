export const PREDEFINED_TAGS: { id: string; label: string; networks?: string[] }[] = [
  { id: 'channel', label: 'Канал / Группа', networks: ['telegram', 'tg', 'vk', 'vkontakte', 'youtube', 'yt', 'rutube'] },
  { id: 'post', label: 'Пост / Публикация', networks: ['telegram', 'tg', 'vk', 'vkontakte', 'instagram', 'in', 'threads', 'twitter', 'x', 'facebook', 'dzen'] },
  { id: 'profile', label: 'Профиль / Аккаунт', networks: ['instagram', 'in', 'tiktok', 'tt', 'vk', 'vkontakte', 'threads', 'twitter', 'x', 'facebook'] },
  { id: 'video', label: 'Видео', networks: ['youtube', 'yt', 'rutube', 'vk', 'vkontakte', 'tiktok', 'tt', 'twitch'] },
  { id: 'reel', label: 'Reels / Shorts / Клипы', networks: ['instagram', 'in', 'youtube', 'yt', 'tiktok', 'tt', 'vk', 'vkontakte'] },
  { id: 'story', label: 'Истории (Stories)', networks: ['instagram', 'in', 'telegram', 'tg', 'vk', 'vkontakte'] },
  { id: 'poll', label: 'Опрос / Голосование', networks: ['telegram', 'tg', 'vk', 'vkontakte', 'twitter', 'x'] },
  { id: 'comment', label: 'Комментарии', networks: ['telegram', 'tg', 'vk', 'vkontakte', 'instagram', 'in', 'youtube', 'yt', 'tiktok', 'tt'] },
  { id: 'bot', label: 'Бот / MiniApp', networks: ['telegram', 'tg'] },
  { id: 'chat', label: 'Чат / Беседа', networks: ['telegram', 'tg', 'vk', 'vkontakte'] }
];

export interface NetworkItem {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  sort: number;
  isActive?: boolean;
}

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  networkId?: string | null;
  sort: number;
  tenantId?: string | null;
  activityType?: string | null;
  requireWarning?: boolean;
  warningMessage?: string | null;
  analyzerTags?: string | null;
  icon?: string | null;
  network?: NetworkItem | null;
  _count: { services: number };
  tenantServicesCount?: number;
  globalServicesCount?: number;
  otherTenantsCount?: number;
  otherTenantsLabel?: string;
}
