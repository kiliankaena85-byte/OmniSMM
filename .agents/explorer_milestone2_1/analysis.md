# Analysis — VisualLinkGuideModal Decomposition

## 1. Executive Summary
This report presents the decomposition design for `VisualLinkGuideModal.tsx` (~50KB, 759 LOC). The component serves as an interactive, multi-platform, step-by-step visual guide for copy-pasting links correctly (which is key to reducing order failures and user churn). Due to the strict **150 LOC limit** from `AGENTS.md`, we propose breaking down this monolithic component into platform-specific guides, modular step renderers, and stateless SVG sub-components.

---

## 2. Current State Analysis
- **File Path**: `src/components/landing/order-engine/VisualLinkGuideModal.tsx`
- **Total Size**: 50,318 bytes (~50 KB)
- **Total Lines of Code**: 759 LOC
- **Imports**:
  - `react`: `useState`, `useEffect`
  - `framer-motion`: `motion`, `AnimatePresence`
  - `lucide-react`: `X`, `Smartphone`, `Monitor`, `Check`, `AlertTriangle`
  - `sonner`: `toast`
- **State Management**:
  - `platform`: `"instagram" | "telegram" | "vk"` (synchronized dynamically via `initialPlatform` / `initialContentType` props)
  - `contentType`: `"profile" | "post" | "story" | "comment" | "photo"`
  - `deviceTab`: `"mobile" | "desktop"`
- **Render Logic**:
  - Configures a modal overlay using `framer-motion` for spring-based entering/exiting animations.
  - Dynamically switches lists of available tab options based on the chosen platform.
  - Calls `renderSteps` to build step arrays (with complex inline SVGs animating using CSS keyframes like `animate-ping` and `animate-pulse`) and maps over them.
  - Calls `renderFooterWarning` to render warnings dependent on the platform-content-type intersection.
- **Styling**:
  - Employs Tailwind CSS v4 semantic tokens (`bg-card`, `bg-background`, `border-border/80`, `text-muted-foreground`, etc.).
  - Follows CSS-first themes, interactive hover classes (`transition-all duration-200 active:scale-95`).

---

## 3. Proposed Directory Structure
To avoid cluttering the parent `order-engine` directory, all decomposed components will reside in a new dedicated sub-folder:
`src/components/landing/order-engine/visual-link-guide/`

```
src/components/landing/order-engine/visual-link-guide/
├── types.ts                    # Shared types & interfaces
├── constants.ts                # Tab configuration & platforms data
├── StepItem.tsx                # Reusable component for rendering a single step
├── FooterWarning.tsx           # Platform warnings & CTA action footer
├── VisualLinkGuideModal.tsx    # Modal wrapper orchestrator (max-level client shell)
├── instagram/
│   ├── svgs.tsx                # SVG mockup vectors for Instagram
│   └── index.tsx               # Instagram guide coordinator & steps definition
├── telegram/
│   ├── svgs.tsx                # SVG mockup vectors for Telegram
│   └── index.tsx               # Telegram guide coordinator & steps definition
└── vk/
    ├── svgs.tsx                # SVG mockup vectors for VK
    └── index.tsx               # VK guide coordinator & steps definition
```

---

## 4. Sub-Component Designs & LOC Estimation

Below is the verification plan ensuring that **no file exceeds 150 LOC**.

| File Path | Estimated LOC | Responsibility |
| :--- | :--- | :--- |
| `visual-link-guide/types.ts` | ~25 | TypeScript contracts, types, and prop interfaces. |
| `visual-link-guide/constants.ts` | ~35 | Static platform arrays, filtering helper, and label mapping. |
| `visual-link-guide/StepItem.tsx` | ~35 | Shared presentation container for a step card. |
| `visual-link-guide/FooterWarning.tsx` | ~85 | Renders specific warnings and Sonner toast completion. |
| `visual-link-guide/instagram/svgs.tsx` | ~110 | SVGs for Instagram profile, post, and story steps. |
| `visual-link-guide/instagram/index.tsx` | ~80 | Instantiates Instagram steps based on `contentType` & `device`. |
| `visual-link-guide/telegram/svgs.tsx` | ~110 | SVGs for Telegram profile, post, and photo steps. |
| `visual-link-guide/telegram/index.tsx` | ~80 | Instantiates Telegram steps based on `contentType` & `device`. |
| `visual-link-guide/vk/svgs.tsx` | ~140 | SVGs for VK profile, post, story, comment, and photo steps. |
| `visual-link-guide/vk/index.tsx` | ~110 | Instantiates VK steps based on `contentType` & `device`. |
| `visual-link-guide/VisualLinkGuideModal.tsx` | ~135 | Main coordinator modal with state and tabs layout. |

---

## 5. Implementation Blueprints (Code Drafts)

### A. `visual-link-guide/types.ts`
```typescript
import React from "react";

export type Platform = "instagram" | "telegram" | "vk";
export type ContentType = "profile" | "post" | "story" | "comment" | "photo";
export type DeviceTab = "mobile" | "desktop";

export interface VisualLinkGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPlatform?: string;
  initialContentType?: ContentType;
}

export interface Step {
  title: string;
  desc: string;
  svg: React.ReactNode;
}

export interface PlatformGuideProps {
  contentType: ContentType;
  device: DeviceTab;
}
```

### B. `visual-link-guide/StepItem.tsx`
```tsx
import React from "react";
import { Step } from "./types";

interface StepItemProps extends Step {
  index: number;
}

export function StepItem({ index, title, desc, svg }: StepItemProps) {
  return (
    <div className="flex flex-col gap-3 group">
      <div className="flex items-center gap-2.5">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-black">
          {index}
        </span>
        <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
          {title}
        </h4>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed pl-8">
        {desc}
      </p>
      
      <div className="aspect-[4/3] w-full rounded-2xl border border-border/60 bg-muted/30 dark:bg-muted/10 p-4 flex items-center justify-center overflow-hidden transition-all duration-200 group-hover:border-primary/30 group-hover:shadow-[0_8px_30px_rgb(var(--primary-rgb)/0.03)]">
        {svg}
      </div>
    </div>
  );
}
```

### C. `visual-link-guide/instagram/index.tsx`
```tsx
import React from "react";
import { PlatformGuideProps, Step } from "../types";
import { StepItem } from "../StepItem";
import * as SVGs from "./svgs";

export function InstagramGuide({ contentType, device }: PlatformGuideProps) {
  const steps: Step[] = [];

  if (contentType === "profile") {
    steps.push(
      {
        title: "Зайдите на нужный профиль",
        desc: device === "mobile" 
          ? "Откройте страницу блогера или паблика в приложении Instagram." 
          : "Перейдите на страницу нужного пользователя в браузере.",
        svg: <SVGs.InstagramProfileStep1 />
      },
      {
        title: device === "mobile" ? "Нажмите «Поделиться»" : "Скопируйте URL",
        desc: device === "mobile" 
          ? "Под описанием профиля нажмите большую кнопку **«Поделиться профилем»**." 
          : "Кликните по адресной строке в верхней части браузера.",
        svg: <SVGs.InstagramProfileStep2 />
      },
      {
        title: "«Копировать ссылку»",
        desc: device === "mobile" 
          ? "Во всплывающем меню выберите строчку **«Копировать ссылку»**." 
          : "Нажмите Ctrl+C, скопированная ссылка автоматически очистится от мусора в нашем поле ввода!",
        svg: <SVGs.InstagramProfileStep3 />
      }
    );
  } else if (contentType === "post") {
    steps.push(
      {
        title: "Откройте нужный пост/Reels",
        desc: "Перейдите к публикации, на которую хотите продвинуть лайки или просмотры.",
        svg: <SVGs.InstagramPostStep1 />
      },
      {
        title: "Нажмите меню «⋯» или «Поделиться»",
        desc: device === "mobile"
          ? "Тапните по иконке самолетика (Поделиться) под постом или три точки в углу."
          : "Нажмите три точки справа от имени автора поста.",
        svg: <SVGs.InstagramPostStep2 device={device} />
      },
      {
        title: "«Копировать ссылку»",
        desc: "Нажмите кнопку «Копировать ссылку» (Copy Link). Ссылка готова для вставки!",
        svg: <SVGs.InstagramPostStep3 />
      }
    );
  } else if (contentType === "story") {
    steps.push(
      {
        title: "Откройте нужную историю",
        desc: "Запустите просмотр Stories нужного аккаунта.",
        svg: <SVGs.InstagramStoryStep1 />
      },
      {
        title: "Нажмите меню «⋯» или самолетик",
        desc: "В правом верхнем углу (на ПК) или правом нижнем (в телефоне) нажмите на иконку меню / поделиться.",
        svg: <SVGs.InstagramStoryStep2 />
      },
      {
        title: "«Скопировать ссылку»",
        desc: "Выберите строчку «Скопировать ссылку». Помните, что история должна быть активной (с момента публикации прошло менее 24 часов).",
        svg: <SVGs.InstagramStoryStep3 />
      }
    );
  }

  return (
    <>
      {steps.map((step, idx) => (
        <StepItem 
          key={idx}
          index={idx + 1}
          title={step.title}
          desc={step.desc}
          svg={step.svg}
        />
      ))}
    </>
  );
}
```

---

## 6. Verification and QA Goals
- **Styling Preservation**: All class headers (`aspect-[4/3]`, custom dark-mode token adjustments, fonts, group animations) remain 100% identical.
- **Dynamic Imports compatibility**: Since `VisualLinkGuideModal` is lazily imported where needed, it still exports a default/named component with the identical signature.
- **Strict Lint check**: Avoid unused variables (`HelpCircle`, `ArrowRight` imports should be pruned).
- **TypeScript strict conformance**: Complete typings prevent issues with implicit any or mismatched platform/content-type combinations.
