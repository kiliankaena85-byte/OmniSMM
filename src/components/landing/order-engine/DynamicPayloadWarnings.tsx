import React, { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { PlatformLinkGuideDrawer } from "./PlatformLinkGuideDrawer";
import { getLinkValidator } from "@/validators/link-mutators";
import { inferTargetTypeFromCategory, TargetTypeEnum } from "@/utils/target-type";
import { getServiceFlags } from "@/utils/service-flags";
import { IntelligencePlatform } from "@/services/analyzer/link-rules";

// Warnings Components
import { ValidationWarning } from "./warnings/ValidationWarning";
import { TelegramAlbumWarning, PrivateTelegramWarning } from "./warnings/TelegramWarnings";
import { 
  CategoryInfoWarning, 
  ServiceInfoWarning, 
  PlatformMismatchWarning, 
  VkMediaWarning, 
  LiveStreamWarning 
} from "./warnings/GeneralWarnings";
import { CustomFieldWarning } from "./warnings/CustomFieldWarning";
import { WarningConfirmation } from "./warnings/WarningConfirmation";

interface DynamicPayloadWarningsProps {
  engine: OrderEngine;
  minimalMode?: boolean;
}

export function DynamicPayloadWarnings({ engine, minimalMode }: DynamicPayloadWarningsProps) {
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const guideStep = 0;
  const { selectedService } = engine;
  const { isCustomComments, isPoll, isLiveStream, isPrivateChannel, customFieldLabel } = getServiceFlags(selectedService);

  let isMismatch = false;
  let activeNetworkName = "";
  if (!engine.isLinkOverridden && engine.platform && engine.networkId) {
    const activeNetwork = engine.catalog.find(n => n.id === engine.networkId);
    if (activeNetwork) {
      const detectedPlatform = engine.platform.toLowerCase();
      const selectedPlatform = activeNetwork.slug.toLowerCase();
      if (!selectedPlatform.includes(detectedPlatform) && !detectedPlatform.includes(selectedPlatform)) {
        isMismatch = true;
        activeNetworkName = activeNetwork.name;
      }
    }
  }

  const activePlatform = engine.platform || engine.manualPlatform;
  const activeNetwork = engine.catalog.find(n => n.id === engine.networkId);
  const selectedPlatformSlug = activeNetwork?.slug?.toUpperCase() || "";
  
  const validationPlatform = (activePlatform && activePlatform !== IntelligencePlatform.OTHER)
    ? activePlatform
    : selectedPlatformSlug;

  let validationMessage: string | null = null;
  
  if (engine.url.trim().length > 3 && selectedService && validationPlatform) {
    const activeCatForVal = engine.catalog.flatMap(n => n.categories).find(c => c.id === selectedService.categoryId);
    const targetType = selectedService.targetType === 'POST'
      ? inferTargetTypeFromCategory(activeCatForVal?.name)
      : (selectedService.targetType || inferTargetTypeFromCategory(activeCatForVal?.name));
    
    try {
      const validator = getLinkValidator(validationPlatform, targetType);
      const linkResult = validator.safeParse(engine.url);
      if (!linkResult.success) {
        validationMessage = linkResult.error.errors[0].message;
      }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      // safe fallback
    }
  }

  const activeCategory = activeNetwork?.categories.find(c => c.id === engine.categoryId);
  const isTelegramViews = activeNetwork?.slug?.toLowerCase() === 'telegram'
    && !!activeCategory?.name?.toLowerCase().includes('просмотр')
    && !activeCategory?.name?.toLowerCase().includes('авто')
    && !activeCategory?.name?.toLowerCase().includes('auto')
    && !activeCategory?.name?.toLowerCase().includes('будущ')
    && selectedService?.targetType !== 'CHANNEL';

  const detectedType = engine.detectedType;
  const platform = engine.platform;
  const urlLower = engine.url.toLowerCase().trim();

  // 1. Приватный пост Telegram (t.me/c/123/456)
  const isPrivateTelegramPost = detectedType === 'private_post' 
    || urlLower.includes('t.me/c/') 
    || urlLower.includes('telegram.me/c/');

  // 2. Медиа VK (фото или видео)
  const isVkPhotoOrVideo = (platform === IntelligencePlatform.VK && (detectedType === 'video' || detectedType === 'post'))
    || urlLower.includes('vk.com/photo') 
    || urlLower.includes('vk.com/video') 
    || urlLower.includes('vk.ru/photo') 
    || urlLower.includes('vk.ru/video') 
    || urlLower.includes('vkvideo.ru/');

  // 3. Ссылка на публикацию (пост/видео)
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

  // 5. Семантический анализ категории через единый движок типов
  const categoryTargetType = activeCategory ? inferTargetTypeFromCategory(activeCategory.name) : TargetTypeEnum.CUSTOM;
  const isChannelCategory = categoryTargetType === TargetTypeEnum.CHANNEL || categoryTargetType === TargetTypeEnum.PROFILE;
  const isPostCategory = categoryTargetType === TargetTypeEnum.POST || categoryTargetType === TargetTypeEnum.VIDEO;

  let swapSuggestion: { text: string; categoryId: string; categoryName: string } | null = null;

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

  if (minimalMode) {
    if (!swapSuggestion && !validationMessage) return null;
    return (
      <div className="space-y-2">
        <ValidationWarning engine={engine} validationMessage={validationMessage} swapSuggestion={swapSuggestion} />
      </div>
    );
  }

  const hasDbWarnings = !!((selectedService?.requireWarning && selectedService?.warningMessage) || (activeCategory?.requireWarning && activeCategory?.warningMessage));
  const hasActiveWarnings = !!(isMismatch || isPrivateTelegramPost || isVkPhotoOrVideo || isLiveStream || isTelegramViews || isPrivateChannel || validationMessage || hasDbWarnings);

  if (!validationMessage && !engine.isLinkOverridden && !customFieldLabel && !isLiveStream && !isPrivateChannel && !isMismatch && !isTelegramViews && !isPrivateTelegramPost && !isVkPhotoOrVideo && !hasDbWarnings) return null;

  return (
    <div className="bg-background/50 p-6 md:px-8 flex flex-col gap-4">
      <CategoryInfoWarning message={activeCategory?.requireWarning ? (activeCategory?.warningMessage || undefined) : undefined} />
      <ServiceInfoWarning message={selectedService?.requireWarning ? (selectedService?.warningMessage || undefined) : undefined} />
      <PlatformMismatchWarning isMismatch={isMismatch} platform={engine.platform || ""} networkName={activeNetworkName} />
      <PrivateTelegramWarning isPrivatePost={isPrivateTelegramPost} isPrivateChannel={isPrivateChannel} />
      <VkMediaWarning isVkPhotoOrVideo={isVkPhotoOrVideo} />
      <LiveStreamWarning isLiveStream={isLiveStream} />
      <TelegramAlbumWarning engine={engine} isTelegramViews={isTelegramViews} />
      
      <CustomFieldWarning 
        engine={engine} 
        customFieldLabel={customFieldLabel} 
        isCustomComments={isCustomComments} 
        isPoll={isPoll} 
      />
      
      <ValidationWarning engine={engine} validationMessage={validationMessage} swapSuggestion={swapSuggestion} />
      <WarningConfirmation engine={engine} hasActiveWarnings={hasActiveWarnings} />

      {engine.isLinkOverridden && !validationMessage && (
        <div className="w-full bg-success/10 border border-success/20 text-success rounded-xl p-4 flex items-start gap-3 shadow-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-success" />
          <div className="text-sm">
            <p className="font-bold">Включен обход проверки</p>
            <p className="mt-1 opacity-95">Убедитесь, что ссылка полностью рабочая.</p>
          </div>
        </div>
      )}
      
      <PlatformLinkGuideDrawer 
        isOpen={isGuideOpen} 
        onClose={() => setIsGuideOpen(false)} 
        initialPlatform="telegram"
        initialStep={guideStep}
      />
    </div>
  );
}
