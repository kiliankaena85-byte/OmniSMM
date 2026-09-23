import React, { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { PlatformLinkGuideDrawer } from "./PlatformLinkGuideDrawer";
import { evaluateOrderWarnings } from "@/utils/order-warning-evaluator";

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

  const {
    isMismatch,
    activeNetworkName,
    validationMessage,
    swapSuggestion,
    isPrivateTelegramPost,
    isVkPhotoOrVideo,
    isTelegramViews,
    hasActiveWarnings,
    shouldRender,
    serviceFlags,
    categoryWarningMessage,
    serviceWarningMessage,
  } = evaluateOrderWarnings(engine);

  const { isCustomComments, isPoll, isLiveStream, isPrivateChannel, customFieldLabel } = serviceFlags;

  if (minimalMode) {
    if (!swapSuggestion && !validationMessage) return null;
    return (
      <div className="space-y-2">
        <ValidationWarning engine={engine} validationMessage={validationMessage} swapSuggestion={swapSuggestion} />
      </div>
    );
  }

  if (!shouldRender) return null;

  return (
    <div className="bg-background/50 p-6 md:px-8 flex flex-col gap-4">
      <CategoryInfoWarning message={categoryWarningMessage} />
      <ServiceInfoWarning message={serviceWarningMessage} />
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
