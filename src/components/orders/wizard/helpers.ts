import { inferTargetTypeFromCategory, inferTargetTypeFromName } from '@/utils/target-type';
import { PublicService } from '@/actions/order/catalog';

export function formatDetectedTargetName(t: string | null | undefined): string {
  if (!t) return '';
  const clean = t.toLowerCase();
  if (clean === 'post' || clean === 'private_post' || clean === 'photo') return 'Публикация (пост)';
  if (clean === 'channel' || clean === 'chat' || clean === 'group') return 'Канал / Группа';
  if (clean === 'profile' || clean === 'user' || clean === 'account') return 'Профиль / Пользователь';
  if (clean === 'video' || clean === 'reel' || clean === 'reels' || clean === 'clip') return 'Видео / Reels / Shorts';
  if (clean === 'story' || clean === 'stories') return 'История (Stories)';
  if (clean === 'bot') return 'Telegram-бот';
  if (clean === 'poll') return 'Опрос / Голосование';
  return clean;
}

export function normalizeUrl(raw: string): string {
  let trimmed = raw.trim();
  if (!trimmed) return '';
  trimmed = trimmed.replace(/^(?:https?:\/\/)+(https?:\/\/)/i, '$1');
  if (!/^https?:\/\//i.test(trimmed)) {
    if (trimmed.startsWith('@')) {
      trimmed = trimmed.substring(1);
      return `https://t.me/${trimmed}`;
    }
    return `https://${trimmed}`;
  }
  return trimmed;
}

export function getTargetTypeHint(catName?: string, srvTargetType?: string | null) {
  const type = srvTargetType || (catName ? inferTargetTypeFromCategory(catName) : 'POST');
  switch (type) {
    case 'CHANNEL':
      return {
        label: 'Ссылка на канал или группу Telegram',
        placeholder: 'https://t.me/your_channel или @your_channel',
        hint: 'Укажите ссылку на публичный канал или ссылку-приглашение',
      };
    case 'STORY':
      return {
        label: 'Ссылка на историю (Stories)',
        placeholder: 'https://instagram.com/your_profile или t.me/channel/s/123',
        hint: 'Укажите ссылку на активную историю',
      };
    case 'POST':
    default:
      return {
        label: 'Ссылка на публикацию (пост)',
        placeholder: 'https://t.me/channel/123 или https://vk.com/wall-123_456',
        hint: 'Укажите прямую ссылку на конкретную публикацию/пост',
      };
  }
}

export const isChannelSrv = (s: PublicService) => {
  const t = s.targetType || inferTargetTypeFromName(s.name);
  return t === 'CHANNEL' || t === 'CHANNEL_POSTS';
};

export const isPostSrv = (s: PublicService) => {
  const t = s.targetType || inferTargetTypeFromName(s.name);
  return t === 'POST' || t === 'VIDEO' || t === 'COMMENTS';
};
