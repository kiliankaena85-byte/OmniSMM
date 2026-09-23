import { getLinkValidator } from "@/validators/link-mutators";
import { inferTargetTypeFromCategory, TargetTypeEnum } from "@/utils/target-type";
import { resolveServiceTargetType } from "@/utils/target-type-mapper";
import { getServiceFlags } from "@/utils/service-flags";
import { IntelligencePlatform } from "@/services/analyzer/link-rules";

export interface SwapSuggestion {
  text: string;
  categoryId: string;
  categoryName: string;
}

export interface OrderWarningServiceCategory {
  id: string;
  name: string;
  requireWarning?: boolean;
  warningMessage?: string | null;
}

export interface OrderWarningNetwork {
  id: string;
  slug: string;
  name: string;
  categories: OrderWarningServiceCategory[];
}

export interface OrderWarningInput {
  url: string;
  platform?: string | null;
  manualPlatform?: string | null;
  networkId?: string | null;
  categoryId?: string | null;
  detectedType?: string | null;
  catalog: OrderWarningNetwork[];
  isLinkOverridden?: boolean;
  selectedService?: {
    id: string;
    name: string;
    categoryId?: string;
    targetType?: string | null;
    requireWarning?: boolean;
    warningMessage?: string | null;
  } | null;
}

export interface EvaluatedOrderWarnings {
  isMismatch: boolean;
  activeNetworkName: string;
  validationMessage: string | null;
  swapSuggestion: SwapSuggestion | null;
  isPrivateTelegramPost: boolean;
  isVkPhotoOrVideo: boolean;
  isTelegramViews: boolean;
  hasDbWarnings: boolean;
  hasActiveWarnings: boolean;
  shouldRender: boolean;
  serviceFlags: ReturnType<typeof getServiceFlags>;
  categoryWarningMessage?: string;
  serviceWarningMessage?: string;
}

export function evaluateOrderWarnings(input: OrderWarningInput): EvaluatedOrderWarnings {
  const { selectedService } = input;
  const serviceFlags = getServiceFlags(selectedService as Parameters<typeof getServiceFlags>[0]);
  const { isLiveStream, isPrivateChannel, customFieldLabel } = serviceFlags;

  let isMismatch = false;
  let activeNetworkName = "";
  if (!input.isLinkOverridden && input.platform && input.networkId) {
    const activeNetwork = input.catalog.find(n => n.id === input.networkId);
    if (activeNetwork) {
      const detectedPlatform = input.platform.toLowerCase();
      const selectedPlatform = activeNetwork.slug.toLowerCase();
      if (!selectedPlatform.includes(detectedPlatform) && !detectedPlatform.includes(selectedPlatform)) {
        isMismatch = true;
        activeNetworkName = activeNetwork.name;
      }
    }
  }

  const activePlatform = input.platform || input.manualPlatform;
  const activeNetwork = input.catalog.find(n => n.id === input.networkId);
  const selectedPlatformSlug = activeNetwork?.slug?.toUpperCase() || "";

  const validationPlatform = (activePlatform && activePlatform !== IntelligencePlatform.OTHER)
    ? activePlatform
    : selectedPlatformSlug;

  let validationMessage: string | null = null;

  if (input.url.trim().length > 3 && selectedService && validationPlatform) {
    // Contract Rule 4.1: Use resolveServiceTargetType instead of fragile fallback
    const targetType = resolveServiceTargetType(selectedService as Parameters<typeof resolveServiceTargetType>[0]);

    try {
      const validator = getLinkValidator(validationPlatform, targetType);
      const linkResult = validator.safeParse(input.url);
      if (!linkResult.success) {
        validationMessage = linkResult.error.errors[0].message;
      }
    } catch {
      // safe fallback
    }
  }

  const activeCategory = activeNetwork?.categories.find(c => c.id === input.categoryId);
  const isTelegramViews = activeNetwork?.slug?.toLowerCase() === 'telegram'
    && !!activeCategory?.name?.toLowerCase().includes('просмотр')
    && !activeCategory?.name?.toLowerCase().includes('авто')
    && !activeCategory?.name?.toLowerCase().includes('auto')
    && !activeCategory?.name?.toLowerCase().includes('будущ')
    && selectedService?.targetType !== 'CHANNEL';

  const detectedType = input.detectedType;
  const platform = input.platform;
  const urlLower = input.url.toLowerCase().trim();

  // 1. Приватный пост Telegram
  const isPrivateTelegramPost = detectedType === 'private_post' 
    || urlLower.includes('t.me/c/') 
    || urlLower.includes('telegram.me/c/');

  // 2. Медиа VK
  const isVkPhotoOrVideo = (platform === IntelligencePlatform.VK && (detectedType === 'video' || detectedType === 'post'))
    || urlLower.includes('vk.com/photo') 
    || urlLower.includes('vk.com/video') 
    || urlLower.includes('vk.ru/photo') 
    || urlLower.includes('vk.ru/video') 
    || urlLower.includes('vkvideo.ru/');

  // 3. Ссылка на публикацию
  const isPostUrl = detectedType === 'post' 
    || detectedType === 'video' 
    || detectedType === 'private_post'
    || urlLower.includes('/p/') 
    || urlLower.includes('/reel/') 
    || urlLower.includes('/shorts/')
    || urlLower.includes('watch?v=');

  // 4. Ссылка на канал / профиль
  const isChannelUrl = ((detectedType === 'channel' || detectedType === 'profile') && !isPostUrl)
    || (urlLower.length > 5 && !isPostUrl && (
      (urlLower.includes('t.me/') && !urlLower.includes('/')) ||
      urlLower.includes('instagram.com/') ||
      urlLower.includes('youtube.com/@')
    ));

  // 5. Семантический анализ категории
  const categoryTargetType = activeCategory ? inferTargetTypeFromCategory(activeCategory.name) : TargetTypeEnum.CUSTOM;
  const isChannelCategory = categoryTargetType === TargetTypeEnum.CHANNEL || categoryTargetType === TargetTypeEnum.PROFILE;
  const isPostCategory = categoryTargetType === TargetTypeEnum.POST || categoryTargetType === TargetTypeEnum.VIDEO;

  let swapSuggestion: SwapSuggestion | null = null;

  if (isPostUrl && isChannelCategory) {
    const targetCat = activeNetwork?.categories.find(c => !!c.name.toLowerCase().match(/(лайк|просмотр|реакц|репост|коммент)/i));
    if (targetCat) {
      swapSuggestion = {
        text: "Вы вставили ссылку на публикацию (пост), но выбрали категорию продвижения подписчиков. Хотите переключить на лайки или просмотры?",
        categoryId: targetCat.id,
        categoryName: targetCat.name
      };
    }
  } else if (isChannelUrl && isPostCategory) {
    const targetCat = activeNetwork?.categories.find(c => !!c.name.toLowerCase().match(/(подписчик|фолловер|участник|канал|групп|буст|профиль|друзья)/i));
    if (targetCat) {
      swapSuggestion = {
        text: "Вы вставили ссылку на профиль/канал, но выбрали категорию продвижения лайков или просмотров. Хотите переключить на подписчиков?",
        categoryId: targetCat.id,
        categoryName: targetCat.name
      };
    }
  }

  const categoryWarningMessage = activeCategory?.requireWarning ? (activeCategory?.warningMessage || undefined) : undefined;
  const serviceWarningMessage = selectedService?.requireWarning ? (selectedService?.warningMessage || undefined) : undefined;

  const hasDbWarnings = Boolean(categoryWarningMessage || serviceWarningMessage);
  const hasActiveWarnings = Boolean(
    isMismatch || isPrivateTelegramPost || isVkPhotoOrVideo || isLiveStream || isTelegramViews || isPrivateChannel || validationMessage || hasDbWarnings
  );

  const shouldRender = Boolean(
    validationMessage || input.isLinkOverridden || customFieldLabel || isLiveStream || isPrivateChannel || isMismatch || isTelegramViews || isPrivateTelegramPost || isVkPhotoOrVideo || hasDbWarnings
  );

  return {
    isMismatch,
    activeNetworkName,
    validationMessage,
    swapSuggestion,
    isPrivateTelegramPost,
    isVkPhotoOrVideo,
    isTelegramViews,
    hasDbWarnings,
    hasActiveWarnings,
    shouldRender,
    serviceFlags,
    categoryWarningMessage,
    serviceWarningMessage,
  };
}
