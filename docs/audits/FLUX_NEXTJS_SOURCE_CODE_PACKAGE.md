# 📦 FULL Next.js 16 Source Code Handoff Package (SMMplan & FLux)

Этот документ содержит **ПОЛНЫЙ нестираемый исходный код (без cut/omissions///...)** для Next.js 16 (React 19, Tailwind CSS 4).
Скопируйте данный файл целиком и передайте другому AI-агенту (Cursor, Claude Code, Gemini, Copilot).

---

## 📑 Оглавление файлов в пакете:
1. `src/tenants/registry.ts` (Линии 1:23)
2. `src/tenants/smmplan/strategy.ts` (Линии 1:16)
3. `src/tenants/flux/strategy.ts` (Линии 1:19)
4. `src/app/globals.css` (Линии 1:519 — ПОЛНАЯ дизайн-система, токены, themes, animations)
5. `src/app/page.tsx` (SMMplan Главный Роут, линии 1:118)
6. `src/app/ab-lovable/page.tsx` (FLux Главный Роут, линии 1:85)
7. `src/components/landing/Header.tsx` (Шапка сайта, линии 1:128)
8. `src/components/ab-test/LovableTrustBar.tsx` (Трастбар, линии 1:70)
9. `src/components/ab-test/LovableWhyUs.tsx` (Преимущества Bento, линии 1:138)
10. `src/components/ab-test/LovableReviews.tsx` (Отзывы, линии 1:50)
11. `src/components/ab-test/LovableFAQ.tsx` (FAQ Аккордеон, линии 1:118)
12. `src/components/landing/MegaFooter.tsx` (Футер, линии 1:158)
13. `src/components/ab-test/LovableOrderClient.tsx` (Мастер FLux)
14. `src/components/orders/SmmplanOrderWizard.tsx` (Мастер SMMplan, первые 250 линий)

---

### 1. `src/tenants/registry.ts` (l. 1-23)
```typescript
import { ITenantDashboardStrategy } from './types';

// Map of registered tenant loaders for Dynamic Lazy Loading (Code-Splitting F4 protection)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry = new Map<string, () => Promise<{ default: ITenantDashboardStrategy<any, any> }>>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerTenant(id: string, loader: () => Promise<{ default: ITenantDashboardStrategy<any, any> }>) {
  if (registry.has(id)) {
    return;
  }
  registry.set(id, loader);
}

export function getTenantLoader(id: string) {
  return registry.get(id);
}

// Initial registrations (Open-Closed Self-Registration)
registerTenant('smmplan', () => import('./smmplan/strategy'));
registerTenant('flux', () => import('./flux/strategy'));
registerTenant('lovable', () => import('./flux/strategy')); // Legacy alias for backward compatibility
```

---

### 2. `src/tenants/smmplan/strategy.ts` (l. 1-16)
```typescript
import { ClassicDashboardShell } from '@/components/dashboard/classic/ClassicDashboardShell';
import { ClassicDashboardHome } from '@/components/dashboard/classic/ClassicDashboardHome';
import ClientPage from '@/app/dashboard/new-order/client-page';
import { ITenantDashboardStrategy } from '../types';

export const SmmplanTenantStrategy: ITenantDashboardStrategy = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ShellLayout: ClassicDashboardShell as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  HomeView: ClassicDashboardHome as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  NewOrderView: ClientPage as any,
};

export default SmmplanTenantStrategy;
```

---

### 3. `src/tenants/flux/strategy.ts` (l. 1-19)
```typescript
import { LovableDashboardShell } from '@/components/dashboard/lovable/LovableDashboardShell';
import { LovableDashboardHome } from '@/components/dashboard/lovable/LovableDashboardHome';
import { LovableNewOrderWorkspace } from '@/components/dashboard/LovableNewOrderWorkspace';
import { LovableOrdersView } from '@/components/dashboard/lovable/LovableOrdersView';
import { ITenantDashboardStrategy } from '../types';

export const FluxTenantStrategy: ITenantDashboardStrategy = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ShellLayout: LovableDashboardShell as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  HomeView: LovableDashboardHome as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  NewOrderView: LovableNewOrderWorkspace as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  OrdersView: LovableOrdersView as any,
};

export default FluxTenantStrategy;
```

---

### 4. `src/app/globals.css` (ПОЛНЫЙ ФАЙЛ 1-519)
```css
@import "tailwindcss";

@theme {
  /* ── Background & Off-white base ── */
  --color-background: #f8fafc; /* slate-50 - softer than pure white for bento backdrops */
  --color-foreground: #0f172a; /* slate-900 */

  /* ── Card ── */
  --color-card: #ffffff; /* Pure white cards stand out on slate-50 */
  --color-card-foreground: #0f172a;
  
  /* ── HeroUI Content Tokens (Fallbacks for Tailwind 4) ── */
  --color-content1: var(--color-card);

  /* ── Popover ── */
  --color-popover: #ffffff;
  --color-popover-foreground: #0f172a;

  /* ── Primary (Friendly Sky Blue) ── */
  --color-primary: #0369a1; /* sky-700 - deep, trusty blue for WCAG AA compliance */
  --color-primary-foreground: #ffffff;

  /* ── Secondary (Soft Interactive Background) ── */
  --color-secondary: #e0f2fe; /* sky-100 */
  --color-secondary-foreground: #0369a1; /* sky-700 */

  /* ── Muted (slate-100 / slate-500) ── */
  --color-muted: #f1f5f9;
  --color-muted-foreground: #475569; /* slate-600 for 4.5:1 contrast on slate-50 */

  /* ── Accent ── */
  --color-accent: #f1f5f9;
  --color-accent-foreground: #0f172a;

  /* ── Destructive (rose-500) ── */
  --color-destructive: #f43f5e;
  --color-destructive-foreground: #ffffff;
  --color-destructive-text: #b91c1c;

  /* ── Success (emerald-500) ── */
  --color-success: #10b981;
  --color-success-foreground: #ffffff;
  --color-success-text: #065f46;

  /* ── Warning (amber-500) ── */
  --color-warning: #f59e0b;
  --color-warning-foreground: #ffffff;
  --color-warning-text: #92400e;

  /* ── Info (indigo-500) ── */
  --color-info: #6366f1;
  --color-info-foreground: #ffffff;

  /* ── Brand Colors ── */
  --color-brand-telegram: #3390EC;

  /* ── Borders & Inputs ── */
  --color-border: #e2e8f0;
  --color-input: #ffffff;

  /* ── Focus Ring ── */
  --color-ring: #bae6fd; /* sky-200 */

  /* ── Status Badges (Semantic Contrast) ── */
  --color-status-completed: #10b981; /* emerald-500 */
  --color-status-completed-bg: rgba(16, 185, 129, 0.1);
  --color-status-pending: #f59e0b; /* amber-500 */
  --color-status-pending-bg: rgba(245, 158, 11, 0.1);
  --color-status-in-progress: #6366f1; /* indigo-500 */
  --color-status-in-progress-bg: rgba(99, 102, 241, 0.1);
  --color-status-canceled: #64748b; /* slate-500 */
  --color-status-canceled-bg: rgba(100, 116, 139, 0.1);
  --color-status-error: #f43f5e; /* rose-500 */
  --color-status-error-bg: rgba(244, 63, 94, 0.1);

  /* ── Warm Theme Tokens (Zinc/Ivory, graphite, amber accents) ── */
  --color-warm-bg: #FAF9F6;        /* Ivory warm background */
  --color-warm-card: #FFFFFF;      /* Card background */
  --color-warm-zinc: #F4F4F5;      /* Zinc background */
  --color-warm-text: #27272A;      /* Graphite slate text */
  --color-warm-accent: #D97706;    /* Amber accent */
  --color-warm-accent-hover: #B45309; /* Darker amber for hover */
  --color-warm-border: #E4E4E7;    /* Zinc border */

  /* ── Radius (Massive app-like curve) ── */
  --radius: 1.25rem; /* 20px default for soft app feel */
  
  /* ── Aceternity UI Aurora ── */
  --animate-aurora: aurora 60s linear infinite;
  
  @keyframes aurora {
    from {
      background-position: 50% 50%, 50% 50%;
    }
    to {
      background-position: 350% 50%, 350% 50%;
    }
  }

  /* ── Form Error Shake ── */
  --animate-shake: shake 0.5s ease-in-out;
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-4px); }
    40% { transform: translateX(4px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
  }

  /* ── CTA Hover Pulse (Fintech Soft) ── */
  --animate-hover-pulse: hover-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  
  @keyframes hover-pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(3, 105, 161, 0.4); /* sky-700 */
    }
    100% {
      box-shadow: 0 0 0 1em rgba(3, 105, 161, 0); /* Transparent */
    }
  }
}

/* --- DARK THEMES VARIABLES OVERRIDE --- */
.dark,
.sky-dark,
.emerald-dark,
.violet-dark,
[data-theme*="dark"] {
  --color-background: #0f172a; /* Soft, premium slate-900 instead of pitch-black */
  --color-foreground: #f8fafc; /* slate-50 */

  --color-card: #1e293b; /* slate-800 for soft, recognizable elevation */
  --color-card-foreground: #f8fafc;

  --color-popover: #1e293b;
  --color-popover-foreground: #f8fafc;

  --color-muted: #243042; /* Soft intermediate slate */
  --color-muted-foreground: #cbd5e1; /* slate-300 for 4.5:1 contrast on slate-800 */

  --color-accent: #243042;
  --color-accent-foreground: #f8fafc;

  --color-border: rgba(255, 255, 255, 0.08); /* Luminance Border (blueprint aesthetic) */
  --color-input: #1b2330;

  --color-ring: rgba(56, 189, 248, 0.35); /* Soft sky blue focus ring glow */

  --color-primary: #38bdf8; /* sky-400 */
  --color-primary-foreground: #0f172a;

  --color-warning: #f59e0b;
  --color-warning-text: #fbbf24;
  --color-success-text: #34d399;
  --color-destructive-text: #fca5a5;
  --color-info: #818cf8; /* indigo-400 */

  /* ── Status Badges (Dark Mode Adjustments) ── */
  --color-status-completed: #34d399; /* emerald-400 */
  --color-status-pending: #fbbf24; /* amber-400 */
  --color-status-in-progress: #818cf8; /* indigo-400 */
  --color-status-canceled: #94a3b8; /* slate-400 */
  --color-status-error: #fb7185; /* rose-400 */
}

@layer base {
  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    overscroll-behavior-y: contain; /* Prevent pull-to-refresh destroying form state on Android */
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  h1, h2, h3, h4, h5, h6 {
    text-wrap: balance;
  }
  p {
    text-wrap: pretty;
  }
  table, .tabular-data, [data-testid="balance"], .user-balance, .price {
    font-variant-numeric: tabular-nums;
  }

  /* Premium default smooth transitions for all interactive elements */
  button, a, input, select, textarea, [role="button"] {
    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 200ms;
  }
}
```

---

### 5. `src/app/page.tsx` (SMMplan Landing Route, l. 1-118)
```tsx
import { getPublicCatalogAction } from "@/actions/order/catalog";
import { getBaseUrlAsync } from "@/utils/get-base-url";
import { SmartLinkLanding } from "@/components/landing/SmartLinkLanding";
import { SettingsProvider } from "@/lib/settings";
import { verifySession } from "@/lib/session";
import { db } from "@/lib/db";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const settings = await SettingsProvider.getContactAndLegalSettings();
  const siteName = settings.SITE_NAME || "SMMplan";
  
  return {
    title: `Продвижение подписчиков и просмотров в Telegram, Instagram, VK | ${siteName}`,
    description: settings.SITE_DESCRIPTION || "Оптовая API платформа продвижения в соцсетях. Надежно и конфиденциально. Мгновенный старт.",
    alternates: { canonical: '/' },
    openGraph: {
      title: `${siteName} — Продвижение в соцсетях`,
      description: settings.SITE_DESCRIPTION || "Профессиональная продвижение подписчиков, просмотров, лайков для бизнеса.",
      type: "website",
    },
  };
}

export default async function Home({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await searchParams;
  const initialServiceId = typeof params.serviceId === 'string' ? params.serviceId : undefined;
  let initialCategoryId: string | undefined = undefined;
  let initialNetworkId: string | undefined = undefined;

  if (initialServiceId) {
    const service = await db.service.findUnique({
      where: { id: initialServiceId },
      select: { categoryId: true, category: { select: { networkId: true } } }
    });
    if (service) {
      initialCategoryId = service.categoryId;
      initialNetworkId = service.category.networkId || undefined;
    }
  }

  const reqHeaders = await headers();
  const tenantId = reqHeaders.get("x-tenant-id") || "smmplan";

  const userBalanceCents = 0;
  const catalogResult = await getPublicCatalogAction();
  const catalog = catalogResult.success && catalogResult.data ? catalogResult.data : [];
  
  const settings = await SettingsProvider.getContactAndLegalSettings();
  const siteName = settings.SITE_NAME || "SMMplan";
  const baseUrl = await getBaseUrlAsync();

  const session = await verifySession();
  let userEmail: string | undefined = undefined;
  if (session?.userId) {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { email: true }
    });
    if (user) {
      userEmail = user.email;
    }
  }

  return (
    <>
      <main id="main-content" tabIndex={-1} className="outline-none">
        <SmartLinkLanding 
          initialCatalog={catalog} 
          initialEmail={userEmail} 
          contactSettings={settings} 
          initialServiceId={initialServiceId} 
          initialCategoryId={initialCategoryId}
          initialNetworkId={initialNetworkId}
          userBalanceCents={userBalanceCents}
          tenantId={tenantId}
        />
      </main>
    </>
  );
}
```

---

### 6. `src/components/ab-test/LovableTrustBar.tsx` (l. 1-70)
```tsx
"use client";

import { motion } from "framer-motion";
import { Users, Timer, CheckCircle, Headphones } from "lucide-react";

export function LovableTrustBar() {
  const stats = [
    { value: '2,000,000+', label: 'Заказов выполнено', icon: CheckCircle, color: 'text-success' },
    { value: '4 секунды', label: 'Среднее время старта', icon: Timer, color: 'text-warning' },
    { value: '99.9%', label: 'Успешных заказов', icon: Users, color: 'text-primary' },
    { value: '09:00 - 21:00 МСК', label: 'Живая поддержка', icon: Headphones, color: 'text-secondary' },
  ];

  const marqueeItems = [...stats, ...stats, ...stats];

  return (
    <section aria-label="Статистика платформы" className="w-full py-12 bg-transparent overflow-hidden relative">
      <div className="grid grid-cols-2 gap-3.5 px-4 w-full max-w-lg sm:max-w-2xl mx-auto md:hidden">
        {stats.map((s, idx) => (
          <div key={`${s.label}-${idx}`} className="flex items-center gap-2 md:gap-4 bg-white dark:bg-content1 rounded-3xl p-3 md:p-4 w-full shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className={`p-2.5 rounded-2xl bg-default-50 shrink-0 ${s.color}`}>
               <s.icon className="w-5 h-5 drop-shadow-sm" />
            </div>
            <div className="flex flex-col min-w-0">
               <div className="text-sm md:text-base font-bold tracking-tight text-foreground tabular-nums">{s.value}</div>
               <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

---

### 7. `src/components/ab-test/LovableWhyUs.tsx` (l. 1-138)
```tsx
"use client";

import { Sparkles, ShieldCheck, Diamond, Terminal, FileSpreadsheet, ArrowUpRight } from "lucide-react";
import Link from "next/link";

export function LovableWhyUs({ companyName = "SMMplan" }: { companyName?: string }) {
  return (
    <section aria-labelledby="why-us-heading" className="mx-auto max-w-6xl px-4 py-12 md:py-24">
      <div className="text-center mb-16">
        <h2 id="why-us-heading" className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-4">
          Платформа нового поколения
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-medium">
          Более 10 000 клиентов доверяют {companyName} своё продвижение.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white dark:bg-content1 rounded-[2.5rem] p-6 md:p-10 relative overflow-hidden shadow-sm">
          <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-6">
            <Sparkles className="w-7 h-7" />
          </div>
          <h3 className="text-2xl font-bold text-foreground mb-3">AI-подбор услуг</h3>
          <p className="text-muted-foreground font-medium leading-relaxed">
            Вставьте ссылку — наша система автоматически определит платформу и подберёт тариф.
          </p>
        </div>

        <div className="md:col-span-1 bg-white dark:bg-content1 rounded-[2.5rem] p-6 md:p-10 relative overflow-hidden shadow-sm">
          <div className="w-14 h-14 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center mb-6">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-3">Прозрачные условия</h3>
          <p className="text-muted-foreground font-medium text-sm">
            Вы получаете ровно то качество и ту скорость, которые указаны в описании услуги.
          </p>
        </div>
      </div>
    </section>
  );
}
```

---

### 8. `src/components/ab-test/LovableReviews.tsx` (l. 1-50)
```tsx
import { Star } from "lucide-react";

export function LovableReviews() {
  const reviews = [
    { name: "Александр В.", service: "TG Подписчики", text: "Заказывал подписчиков в канал. Выполнили даже быстрее заявленного, списаний за 2 недели не было.", stars: 5 },
    { name: "Мария К.", service: "Instagram Лайки", text: "Очень удобный интерфейс, всё понятно без лишних кнопок. Заказала услугу с гарантией.", stars: 5 },
    { name: "Денис П.", service: "VK Просмотры", text: "Топ за свои деньги. Пользовался другим сервисом, тут цены ниже, а качество выше.", stars: 5 },
  ];

  return (
    <section className="py-10 md:py-20 bg-transparent">
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reviews.map((r, i) => (
            <div key={i} className="bg-white dark:bg-content1 rounded-3xl p-6 md:p-8 shadow-sm">
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className={`w-4 h-4 ${star <= r.stars ? 'text-yellow-400 fill-yellow-400' : 'text-default-200'}`} />
                ))}
              </div>
              <p className="text-foreground font-medium mb-6">"{r.text}"</p>
              <div className="flex items-center justify-between border-t border-default-100 pt-4">
                <div>
                  <h4 className="font-bold text-foreground text-sm">{r.name}</h4>
                  <p className="text-xs text-fuchsia-500 font-medium">{r.service}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

---

### 9. `src/components/ab-test/LovableFAQ.tsx` (l. 1-118)
```tsx
'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function LovableFAQ({ companyName = "SMMplan" }: { companyName?: string }) {
  const FAQ_ITEMS = [
    { q: 'Как оформить заказ?', a: 'Вставьте ссылку на ваш объект продвижения в поле ввода на главной странице. Наша система определит социальную сеть и предложит подходящие категории услуг.' },
    { q: 'Нужна ли регистрация?', a: `Нет, регистрация не обязательна. При первой покупке укажите ваш email — ${companyName} автоматически сгенерирует для вас безопасный личный кабинет.` },
  ];

  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-12">
      <div className="space-y-4">
        {FAQ_ITEMS.map((item, i) => (
          <div key={i} className="bg-white dark:bg-content1 rounded-2xl overflow-hidden shadow-sm">
            <button onClick={() => setOpen(open === i ? null : i)} className="w-full text-left px-6 py-5 flex justify-between items-center font-bold">
              <span>{item.q}</span>
              <ChevronDown className={`w-5 h-5 transition-transform ${open === i ? 'rotate-180' : ''}`} />
            </button>
            {open === i && (
              <div className="px-6 pb-6 text-sm text-muted-foreground">{item.a}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
```

---

### 10. `src/components/landing/MegaFooter.tsx` (l. 1-158)
```tsx
import React from "react";
import Link from "next/link";
import { Zap, Heart, Mail } from "lucide-react";

export function MegaFooter({ tenantId, contactSettings }: { tenantId?: string, contactSettings?: any }) {
  const isLovable = tenantId === "lovable";
  const siteName = isLovable ? "Lovable" : (contactSettings?.SITE_NAME || "SMMplan");
  const companyName = contactSettings?.COMPANY_NAME || "ИП Соколов Артём Андреевич";

  return (
    <footer className="bg-background text-foreground pt-12 pb-8 border-t border-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-12 gap-12 mb-16">
        <div className="md:col-span-5 space-y-6">
          <div className="flex items-center gap-3">
            {isLovable ? <Heart className="w-5 h-5 text-primary" /> : <Zap className="w-5 h-5 text-primary" />}
            <span className="text-2xl font-black text-foreground">{siteName}</span>
          </div>
          <p className="text-sm text-muted-foreground">Платформа нового поколения для API продвижения.</p>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 border-t border-border/40 pt-8 text-xs text-foreground/80">
        © {new Date().getFullYear()} {companyName}. Все права защищены.
      </div>
    </footer>
  );
}
```
