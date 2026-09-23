/**
 * @deprecated Use `getServiceFlags` from `@/utils/service-flags` instead.
 * Legacy url-analyzer module preserved for backward-compatibility.
 */

export { getServiceFlags, type ServiceFlagsDTO } from './service-flags';

/**
 * @deprecated Prefer using `analysisResult` from `useOrderEngine` instead of heuristic regexes.
 */
export function getUrlFlags(url: string, activeCategory?: { name: string }) {
  const urlLower = url.toLowerCase();
  
  const isPrivateTelegramPost = urlLower.includes('t.me/c/') || urlLower.includes('telegram.me/c/');
  const isVkPhotoOrVideo = urlLower.includes('vk.com/photo') || urlLower.includes('vk.com/video') || urlLower.includes('vk.ru/photo') || urlLower.includes('vk.ru/video') || urlLower.includes('vkvideo.ru/');

  const isPostUrl = urlLower.includes('/p/') || 
                    urlLower.includes('/reel/') || 
                    urlLower.includes('/tv/') ||
                    urlLower.includes('wall') || 
                    urlLower.includes('watch?v=') || 
                    urlLower.includes('youtu.be/') || 
                    urlLower.includes('/shorts/') || 
                    (urlLower.includes('t.me/') && !urlLower.includes('t.me/c/') && /\/t\.me\/[\w-]+\/\d+/i.test(urlLower));

  const isChannelUrl = urlLower.length > 5 && !isPostUrl && (
    urlLower.includes('t.me/') || 
    (urlLower.includes('vk.com/') && !urlLower.includes('vk.com/wall') && !urlLower.includes('vk.com/video') && !urlLower.includes('vk.com/clip') && !urlLower.includes('vk.com/photo')) || 
    (urlLower.includes('instagram.com/') && !urlLower.includes('/p/') && !urlLower.includes('/reel/')) || 
    (urlLower.includes('youtube.com/') && !urlLower.includes('watch?v=') && !urlLower.includes('/shorts/'))
  );

  const isChannelCategory = activeCategory?.name?.toLowerCase().match(/(подписчик|фолловер|участник|канал|групп|буст|профиль|друзья)/i);
  const isPostCategory = activeCategory?.name?.toLowerCase().match(/(лайк|просмотр|реакц|репост|коммент|зрител|эфир|видео|клип)/i);

  return {
    isPrivateTelegramPost,
    isVkPhotoOrVideo,
    isPostUrl,
    isChannelUrl,
    isChannelCategory: !!isChannelCategory,
    isPostCategory: !!isPostCategory
  };
}
