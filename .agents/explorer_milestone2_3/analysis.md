# Analysis: Decomposition Design for `DynamicPayloadWarnings.tsx`

This document details the read-only analysis and proposed decomposition of the `DynamicPayloadWarnings` component (`src/components/landing/order-engine/DynamicPayloadWarnings.tsx`). The current file is 477 LOC (~27KB) and violates the strict 150 LOC limit specified in `AGENTS.md`. 

The proposed architecture decomposes this monolithic component into 1 custom logic hook and 7 distinct, focused UI components. No file in the proposed architecture exceeds 150 LOC, and all code and styling are identical to the original implementation.

---

## 1. Monolith Analysis

### 1.1 Current Size & Structure
- **File Path**: `src/components/landing/order-engine/DynamicPayloadWarnings.tsx`
- **Total Lines**: 477 LOC
- **Size**: ~27KB
- **Responsibility Overlap**:
  - Computational rules for link validation, platform mismatch detection, and custom input labels.
  - State management for local drawers/drawers instructions and the underlying `OrderEngine`.
  - Presentation rendering of 12 distinct warning UI blocks (DB warnings, platform warnings, inputs, confirmation steps).

### 1.2 State Management
The component relies heavily on two state layers:
1. **Local State**:
   - `isGuideOpen` (boolean): Controls display of `PlatformLinkGuideDrawer`.
   - `showTgInstructions` (boolean): Toggles visibility of Telegram-specific photo-album copying instructions.
   - `guideStep` (number): Hardcoded parameter for the guide drawer.
2. **Engine State (`OrderEngine`)**:
   - `selectedService`: Fields for name, category ID, warning requirements, and custom payload properties.
   - `customData` & `setCustomData`: Text/textarea contents for comment options, keywords, and poll variants.
   - `isLinkOverridden` & `setIsLinkOverridden`: Activates manual bypass for failed link validation.
   - `platform` & `manualPlatform`: Detected/typed platform names.
   - `networkId`: ID of active network.
   - `catalog`: Complete service network catalog.
   - `url`: Current link input.
   - `categoryId`: Selected category ID.
   - `mediaGroupUrl`: Backup link for Telegram album media groups.
   - `warningHasError` & `isWarningConfirmed`: Form confirmation states.

### 1.3 Render Logic
- **Early Return (`minimalMode`)**: Returns a lightweight block containing only the `swapSuggestion` (AI category helper) and `validationMessage` (link warning).
- **Early Return (Empty warnings)**: Renders nothing if no warning conditions are active.
- **Full Mode**: Wraps everything in a semi-transparent container (`bg-background/50 p-6 md:px-8 flex flex-col gap-4`) and outputs warning blocks sequentially based on matching criteria.

### 1.4 Styling & Animations
- Colors are specified using semantic tokens (e.g. `bg-warning/10`, `text-warning-text`, `bg-danger/10`, `text-danger`, `text-success`) matching Tailwind CSS v4 conventions in `src/app/globals.css`.
- Interactive components use transition modifiers: `transition-all duration-200` or `transition-all duration-300`.
- The checkbox uses `framer-motion` for a scale and color-interpolation animation based on confirmation status.

---

## 2. Decomposition Architecture

We will decompose the monolith using a **Strategy and Custom Hook Pattern**. All computational checks are extracted into a single hook, and individual warnings are placed in dedicated sub-components.

```
src/components/landing/order-engine/
├── DynamicPayloadWarnings.tsx         # Main entry point (coordinates views) (~80 LOC)
└── warnings/                          # New subfolder
    ├── useWarningRules.ts             # Warning condition computations (~120 LOC)
    ├── MinimalWarnings.tsx            # Minimal mode renderer (~75 LOC)
    ├── StandardDbWarnings.tsx         # DB-based warnings from DB (~35 LOC)
    ├── SocialPlatformWarnings.tsx     # Regex platform-specific checks (~70 LOC)
    ├── TelegramMediaGroupInput.tsx    # Media group inputs & guidelines (~50 LOC)
    ├── CustomPayloadInput.tsx         # Input/Textarea fields for custom data (~35 LOC)
    ├── FullValidationWarning.tsx      # Zod validation warning & swapper (~75 LOC)
    └── WarningConfirmation.tsx        # Agreement checkbox & action button (~65 LOC)
```

---

## 3. Detailed Component Designs

### 3.1 `useWarningRules.ts`
*Extracted Logic Hook (Est. 120 LOC)*
```typescript
import { OrderEngine } from "@/hooks/useOrderEngine";
import { getLinkValidator } from "@/validators/link-mutators";
import { inferTargetTypeFromCategory } from "@/utils/target-type";
import { IntelligencePlatform } from "@/services/analyzer/link-rules";

export interface WarningRulesResult {
  isCustomComments: boolean;
  isKeywords: boolean;
  isPoll: boolean;
  isLiveStream: boolean;
  isPrivateChannel: boolean;
  customFieldLabel: string | null;
  isMismatch: boolean;
  activeNetworkName: string;
  validationMessage: string | null;
  isTelegramViews: boolean;
  isPrivateTelegramPost: boolean;
  isVkPhotoOrVideo: boolean;
  swapSuggestion: { text: string; categoryId: string; categoryName: string } | null;
  hasDbWarnings: boolean;
  hasActiveWarnings: boolean;
}

export function useWarningRules(engine: OrderEngine): WarningRulesResult {
  const { selectedService, url, networkId, catalog, categoryId, platform, manualPlatform } = engine;
  const sName = selectedService?.name.toLowerCase() || "";
  const cType = selectedService?.customDataType;

  const isCustomComments = cType === 'TEXTAREA' || sName.includes('свои') || sName.includes('свой текст');
  const isKeywords = cType === 'TEXT' || sName.includes('ключево');
  const isPoll = cType === 'NUMBER' || (sName.includes('опрос') && !sName.includes('просмотр')) || sName.includes('голосование');
  const isLiveStream = sName.includes('зрител') || sName.includes('эфир') || sName.includes('трансляц');
  const isPrivateChannel = sName.includes('закрыт');

  const customFieldLabel = selectedService?.customDataLabel?.trim() || (
    isCustomComments ? 'Ваши комментарии (по одному в строке)' 
    : isKeywords ? 'Ключевые слова (через запятую)' 
    : isPoll ? 'Номер варианта ответа' 
    : null
  );

  let isMismatch = false;
  let activeNetworkName = "";
  const activeNetwork = catalog.find(n => n.id === networkId);
  if (!engine.isLinkOverridden && platform && networkId && activeNetwork) {
    const detectedPlatform = platform.toLowerCase();
    const selectedPlatform = activeNetwork.slug.toLowerCase();
    if (!selectedPlatform.includes(detectedPlatform) && !detectedPlatform.includes(selectedPlatform)) {
      isMismatch = true;
      activeNetworkName = activeNetwork.name;
    }
  }

  const activePlatform = platform || manualPlatform;
  const selectedPlatformSlug = activeNetwork?.slug?.toUpperCase() || "";
  const validationPlatform = (activePlatform && activePlatform !== IntelligencePlatform.OTHER)
    ? activePlatform
    : selectedPlatformSlug;

  let validationMessage: string | null = null;
  if (url.trim().length > 3 && selectedService && validationPlatform) {
    const activeCatForVal = catalog.flatMap(n => n.categories).find(c => c.id === selectedService.categoryId);
    const targetType = selectedService.targetType === 'POST'
      ? inferTargetTypeFromCategory(activeCatForVal?.name)
      : (selectedService.targetType || inferTargetTypeFromCategory(activeCatForVal?.name));
    
    try {
      const validator = getLinkValidator(validationPlatform, targetType);
      const linkResult = validator.safeParse(url);
      if (!linkResult.success) {
        validationMessage = linkResult.error.errors[0].message;
      }
    } catch (e) {
      // safe fallback
    }
  }

  const activeCategory = activeNetwork?.categories.find(c => c.id === categoryId);
  const isTelegramViews = activeNetwork?.slug?.toLowerCase() === 'telegram'
    && activeCategory?.name?.toLowerCase().includes('просмотр')
    && !activeCategory?.name?.toLowerCase().includes('авто')
    && !activeCategory?.name?.toLowerCase().includes('auto')
    && !activeCategory?.name?.toLowerCase().includes('будущ')
    && selectedService?.targetType !== 'CHANNEL';

  const urlLower = url.toLowerCase();
  const isPrivateTelegramPost = urlLower.includes('t.me/c/') || urlLower.includes('telegram.me/c/');
  const isVkPhotoOrVideo = urlLower.includes('vk.com/photo') || urlLower.includes('vk.com/video') || urlLower.includes('vk.ru/photo') || urlLower.includes('vk.ru/video') || urlLower.includes('vkvideo.ru/');

  const isPostUrl = urlLower.includes('/p/') || urlLower.includes('/reel/') || urlLower.includes('/tv/') ||
                    urlLower.includes('wall') || urlLower.includes('watch?v=') || urlLower.includes('youtu.be/') || 
                    urlLower.includes('/shorts/') || (urlLower.includes('t.me/') && !urlLower.includes('t.me/c/') && /\/t\.me\/[\w-]+\/\d+/i.test(urlLower));

  const isChannelUrl = urlLower.length > 5 && !isPostUrl && (
    urlLower.includes('t.me/') || 
    (urlLower.includes('vk.com/') && !urlLower.includes('vk.com/wall') && !urlLower.includes('vk.com/video') && !urlLower.includes('vk.com/clip') && !urlLower.includes('vk.com/photo')) || 
    (urlLower.includes('instagram.com/') && !urlLower.includes('/p/') && !urlLower.includes('/reel/')) || 
    (urlLower.includes('youtube.com/') && !urlLower.includes('watch?v=') && !urlLower.includes('/shorts/'))
  );

  const isChannelCategory = activeCategory?.name?.toLowerCase().match(/(подписчик|фолловер|участник|канал|групп|буст|профиль|друзья)/i);
  const isPostCategory = activeCategory?.name?.toLowerCase().match(/(лайк|просмотр|реакц|репост|коммент|зрител|эфир|видео|клип)/i);

  let swapSuggestion: { text: string; categoryId: string; categoryName: string } | null = null;
  if (isPostUrl && isChannelCategory) {
    const targetCat = activeNetwork?.categories.find(c => c.name.toLowerCase().match(/(лайк|просмотр|реакц|репост|коммент)/i));
    if (targetCat) {
      swapSuggestion = {
        text: "Вы вставили ссылку на публикацию (пост), но выбрали категорию продвижения подписчиков. Хотите переключить на лайки или просмотры?",
        categoryId: targetCat.id,
        categoryName: targetCat.name
      };
    }
  } else if (isChannelUrl && isPostCategory) {
    const targetCat = activeNetwork?.categories.find(c => c.name.toLowerCase().match(/(подписчик|фолловер|участник|канал|групп|буст|профиль|друзья)/i));
    if (targetCat) {
      swapSuggestion = {
        text: "Вы вставили ссылку на профиль/канал, но выбрали категорию продвижения лайков или просмотров. Хотите переключить на подписчиков?",
        categoryId: targetCat.id,
        categoryName: targetCat.name
      };
    }
  }

  const hasDbWarnings = !!((selectedService?.requireWarning && selectedService?.warningMessage) || (activeCategory?.requireWarning && activeCategory?.warningMessage));
  const hasActiveWarnings = !!(isMismatch || isPrivateTelegramPost || isVkPhotoOrVideo || isLiveStream || isTelegramViews || isPrivateChannel || validationMessage || hasDbWarnings);

  return {
    isCustomComments,
    isKeywords,
    isPoll,
    isLiveStream,
    isPrivateChannel,
    customFieldLabel,
    isMismatch,
    activeNetworkName,
    validationMessage,
    isTelegramViews,
    isPrivateTelegramPost,
    isVkPhotoOrVideo,
    swapSuggestion,
    hasDbWarnings,
    hasActiveWarnings
  };
}
```

### 3.2 `MinimalWarnings.tsx`
*Minimal mode layout (Est. 75 LOC)*
```typescript
import React from "react";
import { Zap, CheckCircle2 } from "lucide-react";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { WarningRulesResult } from "./useWarningRules";

interface MinimalWarningsProps {
  engine: OrderEngine;
  rules: WarningRulesResult;
}

export function MinimalWarnings({ engine, rules }: MinimalWarningsProps) {
  const { swapSuggestion, validationMessage } = rules;
  if (!swapSuggestion && !validationMessage) return null;

  return (
    <div className="space-y-2">
      {swapSuggestion && (
        <div className="bg-warning/5 border border-warning/20 rounded-xl p-3.5 flex flex-col gap-2.5 border-dashed">
          <p className="text-xs font-semibold text-warning-text leading-relaxed">
            💡 <strong>ИИ-Помощник:</strong> {swapSuggestion.text}
          </p>
          <div>
            <Button
              size="sm"
              type="button"
              onClick={() => {
                engine.setCategoryId(swapSuggestion.categoryId);
                engine.setSelectedService(null);
                toast.success(`Категория переключена на «${swapSuggestion.categoryName}»!`);
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-lg text-xs py-1.5 px-3.5 h-8.5 active:scale-95 transition-all shadow-sm shadow-primary/10 cursor-pointer"
            >
              Переключить на «{swapSuggestion.categoryName}»
            </Button>
          </div>
        </div>
      )}
      
      {validationMessage && (
        <div className="w-full bg-warning/10 border border-warning/20 text-warning-text rounded-xl p-4 flex flex-col gap-3 shadow-sm animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 shrink-0 mt-0.5 text-warning-text animate-pulse" />
            <div className="text-sm">
              <p className="font-bold">Неверный формат ссылки</p>
              <p className="mt-1 opacity-90 leading-relaxed">
                Авто-проверка: <span className="underline">{validationMessage}</span>. 
                Если ссылка верная, вы можете оформить заказ в обход проверки.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {engine.isLinkOverridden ? (
              <div className="flex items-center gap-1.5 text-success font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Обход валидатора успешно активирован!
              </div>
            ) : (
              <Button
                size="sm"
                type="button"
                onClick={() => {
                  engine.setIsLinkOverridden(true);
                  toast.success("Режим обхода активирован. Теперь вы можете продолжить оформление.");
                }}
                className="bg-warning/20 text-warning-text hover:bg-warning/30 border border-warning-text/20 font-bold rounded-lg text-xs py-1 px-3 h-8 active:scale-95 transition-all cursor-pointer"
              >
                Я уверен, что ссылка верная
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

### 3.3 `StandardDbWarnings.tsx`
*Database-configured warnings (Est. 35 LOC)*
```typescript
import React from "react";
import { Info } from "lucide-react";
import { OrderEngine } from "@/hooks/useOrderEngine";

interface StandardDbWarningsProps {
  engine: OrderEngine;
}

export function StandardDbWarnings({ engine }: StandardDbWarningsProps) {
  const { selectedService, catalog, categoryId } = engine;
  const activeNetwork = catalog.find(n => n.id === engine.networkId);
  const activeCategory = activeNetwork?.categories.find(c => c.id === categoryId);

  return (
    <>
      {activeCategory?.requireWarning && activeCategory?.warningMessage && (
         <div className="w-full bg-warning/10 border border-warning/20 text-warning-text rounded-xl p-4 flex items-start gap-3 shadow-sm animate-in fade-in zoom-in-95 duration-200">
           <Info className="w-5 h-5 shrink-0 mt-0.5 text-warning-text animate-pulse" />
           <div className="text-sm">
             <p className="font-bold">Внимание: Информация о категории</p>
             <p className="mt-1 opacity-90 leading-relaxed">{activeCategory.warningMessage}</p>
           </div>
         </div>
      )}

      {selectedService?.requireWarning && selectedService?.warningMessage && (
         <div className="w-full bg-warning/10 border border-warning/20 text-warning-text rounded-xl p-4 flex items-start gap-3 shadow-sm animate-in fade-in zoom-in-95 duration-200">
           <Info className="w-5 h-5 shrink-0 mt-0.5 text-warning-text animate-pulse" />
           <div className="text-sm">
             <p className="font-bold">Внимание: Специфика услуги</p>
             <p className="mt-1 opacity-90 leading-relaxed">{selectedService.warningMessage}</p>
           </div>
         </div>
      )}
    </>
  );
}
```

### 3.4 `SocialPlatformWarnings.tsx`
*Warning layouts based on address type filters (Est. 70 LOC)*
```typescript
import React from "react";
import { Zap, Info } from "lucide-react";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { WarningRulesResult } from "./useWarningRules";

interface SocialPlatformWarningsProps {
  engine: OrderEngine;
  rules: WarningRulesResult;
}

export function SocialPlatformWarnings({ engine, rules }: SocialPlatformWarningsProps) {
  const {
    isMismatch,
    activeNetworkName,
    isPrivateTelegramPost,
    isVkPhotoOrVideo,
    isLiveStream,
    isPrivateChannel,
  } = rules;

  return (
    <>
      {isMismatch && (
         <div className="w-full bg-danger/10 border border-danger/20 text-danger rounded-xl p-4 flex items-start gap-3 shadow-sm">
           <Zap className="w-5 h-5 shrink-0 mt-0.5 text-danger" />
           <div className="text-sm">
             <p className="font-bold">Несовпадение соцсети</p>
             <p className="mt-1 opacity-90">Ссылка от <strong>{engine.platform}</strong>, но выбрана соцсеть <strong>{activeNetworkName}</strong>. Исправьте ссылку или измените соцсеть.</p>
           </div>
         </div>
      )}

      {isPrivateTelegramPost && (
         <div className="w-full bg-warning/10 border border-warning/20 text-warning-text rounded-xl p-4 flex items-start gap-3 shadow-sm">
           <Zap className="w-5 h-5 shrink-0 mt-0.5 text-warning-text" />
           <div className="text-sm">
             <p className="font-bold">Закрытый канал</p>
             <p className="mt-1 opacity-90">Приватные ссылки не поддерживаются. Сделайте канал <strong>«Публичным»</strong> и вставьте ссылку вида <code>t.me/имя/номер</code>.</p>
           </div>
         </div>
      )}

      {isVkPhotoOrVideo && (
         <div className="w-full bg-warning/10 border border-warning/20 text-warning-text rounded-xl p-4 flex items-start gap-3 shadow-sm">
           <Info className="w-5 h-5 shrink-0 mt-0.5 text-warning-text" />
           <div className="text-sm">
             <p className="font-bold">Ссылка на медиафайл VK</p>
             <p className="mt-1 opacity-90">Чтобы продвинуть весь пост, скопируйте ссылку на саму запись (формата <code>vk.com/wall...</code>) вместо фото/видео.</p>
           </div>
         </div>
      )}

      {isLiveStream && (
         <div className="w-full bg-danger/10 border border-danger/20 text-danger rounded-xl p-4 flex items-start gap-3">
           <Zap className="w-5 h-5 shrink-0 mt-0.5 text-danger" />
           <div className="text-sm">
             <p className="font-bold">Прямой эфир</p>
             <p className="mt-1 opacity-90">Стрим должен быть активен. При срыве трансляции гарантия сгорает.</p>
           </div>
         </div>
      )}

      {isPrivateChannel && (
         <div className="w-full bg-warning/10 border border-warning/20 text-warning-text rounded-xl p-4 flex items-start gap-3">
           <Zap className="w-5 h-5 shrink-0 mt-0.5 text-warning-text" />
           <div className="text-sm">
             <p className="font-bold">Приватный канал</p>
             <p className="mt-1 opacity-90">Нужна ссылка-приглашение (<code>t.me/+ссылка</code>). Иначе заказ будет отменен.</p>
           </div>
         </div>
      )}
    </>
  );
}
```

### 3.5 `TelegramMediaGroupInput.tsx`
*Telegram views album workflow (Est. 50 LOC)*
```typescript
import React, { useState } from "react";
import { Info, HelpCircle } from "lucide-react";
import { OrderEngine } from "@/hooks/useOrderEngine";

interface TelegramMediaGroupInputProps {
  engine: OrderEngine;
}

export function TelegramMediaGroupInput({ engine }: TelegramMediaGroupInputProps) {
  const [showTgInstructions, setShowTgInstructions] = useState(false);

  return (
     <div className="w-full bg-primary/10 border border-primary/20 text-primary rounded-xl p-4 flex flex-col gap-3 shadow-sm animate-in fade-in zoom-in-95 duration-200">
       <div className="flex items-start gap-3">
         <Info className="w-5 h-5 shrink-0 mt-0.5 text-primary animate-pulse" />
         <div className="text-sm">
           <p className="font-bold">Telegram-альбом (медиагруппа)</p>
           <p className="mt-1 opacity-90 leading-relaxed">
             Укажите две ссылки: на <strong>первое</strong> медиа (в поле выше) и на <strong>последнее</strong> медиа (в поле ниже). Просмотры пойдут на весь альбом (2 заказа, цена ×2).
           </p>
         </div>
       </div>
       <div className="ml-8 text-xs">
         <button 
           type="button"
           onClick={() => setShowTgInstructions(!showTgInstructions)}
           className="font-semibold text-primary hover:opacity-85 flex items-center gap-1.5 transition-colors duration-200 cursor-pointer h-9 min-h-[36px]"
         >
           <HelpCircle className="w-3.5 h-3.5" />
           {showTgInstructions ? "Скрыть инструкцию" : "Как скопировать ссылки?"}
         </button>
       </div>
       {showTgInstructions && (
         <div className="ml-8 p-3 rounded-xl bg-primary/5 text-xs text-primary leading-relaxed space-y-1.5 border border-primary/10 animate-in fade-in slide-in-from-top-1 duration-200">
           <p>1. <strong>Первая ссылка:</strong> правый клик или долгий тап по посту ➔ «Копировать ссылку» (вставьте в поле выше).</p>
           <p>2. <strong>Вторая ссылка:</strong> откройте последнее фото альбома во весь экран ➔ ⋮ в углу ➔ «Копировать ссылку» (вставьте в поле ниже).</p>
         </div>
       )}
       <div className="ml-8">
         <input 
           type="url" 
           value={engine.mediaGroupUrl} 
           onChange={e => engine.setMediaGroupUrl(e.target.value)} 
           placeholder="Ссылка на последнее медиа (необязательно)"
           className="w-full h-10 px-3 rounded-lg border border-primary/20 bg-card text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
         />
         {engine.mediaGroupUrl.trim().length > 5 && (
           <p className="mt-1.5 text-xs text-primary font-medium">
             ✓ Будет создано 2 заказа. Итоговая стоимость ×2.
           </p>
         )}
       </div>
     </div>
  );
}
```

### 3.6 `CustomPayloadInput.tsx`
*Injects inputs or textareas for extra order parameters (Est. 35 LOC)*
```typescript
import React from "react";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { WarningRulesResult } from "./useWarningRules";

interface CustomPayloadInputProps {
  engine: OrderEngine;
  rules: WarningRulesResult;
}

export function CustomPayloadInput({ engine, rules }: CustomPayloadInputProps) {
  const { customData, setCustomData } = engine;
  const { customFieldLabel, isCustomComments, isPoll } = rules;

  if (!customFieldLabel) return null;

  return (
    <div className="w-full space-y-2 mt-2">
      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">{customFieldLabel}</label>
      {isCustomComments ? (
        <textarea 
          value={customData} 
          onChange={e => setCustomData(e.target.value)} 
          placeholder="Каждая строка - новый комментарий..."
          className="w-full min-h-[100px] p-4 rounded-xl border border-border bg-card text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-y shadow-sm"
        />
      ) : (
        <input 
          type="text" 
          value={customData} 
          onChange={e => setCustomData(e.target.value)} 
          placeholder={isPoll ? "Например: 2" : "Слова через запятую..."}
          className="w-full h-12 px-4 rounded-xl border border-border bg-card text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm"
        />
      )}
    </div>
  );
}
```

### 3.7 `FullValidationWarning.tsx`
*Full validation block layout with inner swapper integration (Est. 75 LOC)*
```typescript
import React from "react";
import { Zap, CheckCircle2 } from "lucide-react";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { WarningRulesResult } from "./useWarningRules";

interface FullValidationWarningProps {
  engine: OrderEngine;
  rules: WarningRulesResult;
}

export function FullValidationWarning({ engine, rules }: FullValidationWarningProps) {
  const { validationMessage, swapSuggestion } = rules;

  if (!validationMessage) return null;

  return (
    <div className="w-full bg-warning/10 border border-warning/20 text-warning-text rounded-xl p-4 flex flex-col gap-3 shadow-sm animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-start gap-3">
        <Zap className="w-5 h-5 shrink-0 mt-0.5 text-warning-text animate-pulse" />
        <div className="text-sm">
          <p className="font-bold">Неверный формат ссылки</p>
          <p className="mt-1 opacity-90">
            Авто-проверка: <span className="underline">{validationMessage}</span>. 
            Если ссылка верная, вы можете оформить заказ в обход проверки.
          </p>
        </div>
      </div>

      {swapSuggestion && (
        <div className="bg-warning/5 border border-warning/20/40 rounded-xl p-3.5 flex flex-col gap-2.5 ml-8 mt-1 border-dashed">
          <p className="text-xs font-semibold text-warning-text leading-relaxed">
            💡 <strong>ИИ-Помощник:</strong> {swapSuggestion.text}
          </p>
          <div>
            <Button
              size="sm"
              type="button"
              onClick={() => {
                engine.setCategoryId(swapSuggestion.categoryId);
                engine.setSelectedService(null);
                toast.success(`Категория переключена на «${swapSuggestion.categoryName}»!`);
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-lg text-xs py-1.5 px-3.5 h-8.5 active:scale-95 transition-all shadow-sm shadow-primary/10"
            >
              Переключить на «{swapSuggestion.categoryName}»
            </Button>
          </div>
        </div>
      )}

      <div className="ml-8 flex items-center gap-2">
        {engine.isLinkOverridden ? (
          <div className="flex items-center gap-1.5 text-success font-semibold text-sm">
            <CheckCircle2 className="w-4 h-4" />
            Обход валидатора успешно активирован!
          </div>
        ) : (
          <Button
            size="sm"
            type="button"
            onClick={() => {
              engine.setIsLinkOverridden(true);
              toast.success("Режим обхода активирован. Теперь вы можете продолжить оформление.");
            }}
            className="bg-warning/20 text-warning-text hover:bg-warning/30 border border-warning-text/20 font-bold rounded-lg text-xs py-1 px-3 h-8 active:scale-95 transition-all"
          >
            Я уверен, что ссылка верная
          </Button>
        )}
      </div>
    </div>
  );
}
```

### 3.8 `WarningConfirmation.tsx`
*Animated checkbox and confirmation button (Est. 65 LOC)*
```typescript
import React from "react";
import { motion } from "framer-motion";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface WarningConfirmationProps {
  engine: OrderEngine;
}

export function WarningConfirmation({ engine }: WarningConfirmationProps) {
  return (
    <div className={`w-full mt-1 p-4 bg-warning/5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 ${
      engine.warningHasError 
        ? "border-destructive bg-destructive/5 shadow-md shadow-destructive/5 ring-2 ring-destructive/20 animate-pulse" 
        : engine.isWarningConfirmed 
          ? "border-success/30 bg-success/5" 
          : "border-warning/30"
    }`}>
      <div className="flex items-start gap-3 flex-1">
        <div className="relative flex items-center justify-center w-5 h-5 shrink-0 mt-0.5">
          <input
            id="warning-confirm-checkbox"
            type="checkbox"
            checked={engine.isWarningConfirmed || false}
            onChange={(e) => {
              engine.setIsWarningConfirmed(e.target.checked);
              if (e.target.checked) {
                engine.setWarningHasError(false);
              }
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <motion.div
            animate={{
              scale: engine.isWarningConfirmed ? [1, 1.15, 1] : 1,
              borderColor: engine.isWarningConfirmed ? "var(--color-success)" : "var(--color-warning)",
              backgroundColor: engine.isWarningConfirmed ? "var(--color-success)" : "rgba(217, 119, 6, 0)",
            }}
            className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors pointer-events-none"
          >
            {engine.isWarningConfirmed && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none" className="stroke-current stroke-[2.5]" style={{ strokeLinecap: "round", strokeLinejoin: "round", stroke: "var(--color-success-foreground)" }}>
                <path d="M1.5 4L4 6.5L8.5 1.5" />
              </svg>
            )}
          </motion.div>
        </div>
        <label htmlFor="warning-confirm-checkbox" className="text-xs font-bold text-foreground cursor-pointer select-none leading-relaxed">
          Я подтверждаю правильность ссылки и согласен с условиями
        </label>
      </div>
      
      {!engine.isWarningConfirmed && (
        <Button
          type="button"
          onClick={() => {
            engine.setIsWarningConfirmed(true);
            engine.setWarningHasError(false);
            toast.success("Предупреждение подтверждено");
          }}
          className="h-10 px-5 bg-warning hover:bg-warning/90 text-warning-foreground font-black text-xs rounded-xl shadow-md shadow-warning/20 transition-all shrink-0 active:scale-95 cursor-pointer"
        >
          Подтвердить
        </Button>
      )}
    </div>
  );
}
```

### 3.9 Main Entry point: `DynamicPayloadWarnings.tsx`
*Clean layout orchestrator (Est. 80 LOC)*
```typescript
import React, { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { PlatformLinkGuideDrawer } from "./PlatformLinkGuideDrawer";
import { useWarningRules } from "./warnings/useWarningRules";
import { MinimalWarnings } from "./warnings/MinimalWarnings";
import { StandardDbWarnings } from "./warnings/StandardDbWarnings";
import { SocialPlatformWarnings } from "./warnings/SocialPlatformWarnings";
import { TelegramMediaGroupInput } from "./warnings/TelegramMediaGroupInput";
import { CustomPayloadInput } from "./warnings/CustomPayloadInput";
import { FullValidationWarning } from "./warnings/FullValidationWarning";
import { WarningConfirmation } from "./warnings/WarningConfirmation";

interface DynamicPayloadWarningsProps {
  engine: OrderEngine;
  minimalMode?: boolean;
}

export function DynamicPayloadWarnings({ engine, minimalMode }: DynamicPayloadWarningsProps) {
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const guideStep = 0;
  const rules = useWarningRules(engine);

  if (minimalMode) {
    return <MinimalWarnings engine={engine} rules={rules} />;
  }

  const {
    validationMessage,
    customFieldLabel,
    isLiveStream,
    isPrivateChannel,
    isMismatch,
    isTelegramViews,
    isPrivateTelegramPost,
    isVkPhotoOrVideo,
    hasDbWarnings,
    hasActiveWarnings,
  } = rules;

  const showWarningsBlock = 
    validationMessage || 
    engine.isLinkOverridden || 
    customFieldLabel || 
    isLiveStream || 
    isPrivateChannel || 
    isMismatch || 
    isTelegramViews || 
    isPrivateTelegramPost || 
    isVkPhotoOrVideo || 
    hasDbWarnings;

  if (!showWarningsBlock) return null;

  return (
    <div className="bg-background/50 p-6 md:px-8 flex flex-col gap-4">
      <StandardDbWarnings engine={engine} />
      
      <SocialPlatformWarnings engine={engine} rules={rules} />

      {isTelegramViews && <TelegramMediaGroupInput engine={engine} />}

      <CustomPayloadInput engine={engine} rules={rules} />

      <FullValidationWarning engine={engine} rules={rules} />

      {hasActiveWarnings && <WarningConfirmation engine={engine} />}

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
```

---

## 4. Key Benefits & Design Compliance

1. **Strict 150 LOC Limit**: The largest file in the decomposed system is `useWarningRules.ts` (~120 LOC), followed by the entry point `DynamicPayloadWarnings.tsx` (~80 LOC) and visual components (`MinimalWarnings.tsx` ~75 LOC, `FullValidationWarning.tsx` ~75 LOC). This completely conforms to `AGENTS.md` rules.
2. **Identical UX & Styling**: Not a single tailwind utility class, padding, margin, or layout container was altered. All semantic color tokens (`bg-warning/10`, `text-warning-text`, etc.) are preserved verbatim.
3. **Animations**: The Framer Motion configuration (`motion.div` scale/border-color arrays) is preserved exactly.
4. **Clean Code & Type Safety**:
   - `OrderEngine` interface is strictly typed across all components.
   - Component properties interface `WarningRulesResult` provides full autocomplete and compile-time verification.
