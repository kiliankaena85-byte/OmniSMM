# Справочник 02: Next.js 16 RSC Payload, Hydration и Защита Бандла

> **Стандарт:** OmniSMM Production Readiness Standard (v2026)  
> **Ключевой инвариант:** `INV-PROD-04` — Запрещено передавать сырые модели БД и массивы $> 50$ элементов через границу Server Component $\to$ Client Component.

---

## 1. Механизм RSC Payload: Невидимый убийца производительности

В Next.js App Router (React Server Components) граница между сервером и клиентом работает через скрытую сериализацию данных:

```
[ SERVER COMPONENT (page.tsx) ]
       │
       │  const users = await db.user.findMany({ include: { orders: true, logs: true } });
       │  return <ClientTable users={users} />;
       ▼
[ СЕРИАЛИЗАЦИЯ В RSC PAYLOAD (JSON) ]
       │
       ▼
[ ВСТРАИВАНИЕ В HTML СТРАНИЦЫ: <script>self.__next_f.push([... 45 MB JSON ...])</script> ]
       │
       ▼ (Передача 45 МБ по мобильной сети 4G)
       │
[ КЛИЕНТСКИЙ БРАУЗЕР ]
       ├── 1. Разбор гигантского HTML (Длительный TTFB)
       ├── 2. JSON.parse в главном потоке браузера (Зависание UI на 3-5 секунд)
       └── 3. Hydration Crash: Вкладка вылетает по нехватке памяти на смартфонах!
```

Кроме катастрофы производительности, передача сырых моделей БД — это **дыра безопасности**:
- На клиент в открытый HTML попадают `passwordHash`, `apiKeyHash`, `telegramChatId`, `providerCost` (себестоимость услуг), даже если в таблице отображается только `name`!

---

## 2. Антипаттерн vs Production-Grade: Передача данных на клиент

### ❌ Антипаттерн (Лабораторный код):
```tsx
// src/app/admin/users/page.tsx (Server Component)
import { db } from '@/lib/db';
import { UserDataTable } from './UserDataTable'; // 'use client'

export default async function UsersPage() {
  // 💥 ОШИБКА 1: Нет пагинации (загружает 50 000 юзеров в память сервера и HTML)
  // 💥 ОШИБКА 2: Включает тяжелые связи
  // 💥 ОШИБКА 3: Утечка секретов в HTML
  const users = await db.user.findMany({
    include: {
      orders: true,
      ledgerEntries: true,
    }
  });

  return <UserDataTable users={users} />;
}
```

### ✅ Production-Grade (DTO Mapping + Keyset Pagination):
```tsx
// src/app/admin/users/page.tsx (Server Component)
import { db } from '@/lib/db';
import { UserDataTable } from './UserDataTable'; // 'use client'

// 1. Четкий DTO-интерфейс без приватных полей
export interface UserRowDTO {
  id: string;
  email: string;
  name: string | null;
  balanceRub: string;
  createdAt: string;
  ordersCount: number;
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const { cursor } = await searchParams;
  const PAGE_SIZE = 25; // Строгий лимит на страницу

  // Выбираем СТРОГО нужные поля, а не всю таблицу
  const users = await db.user.findMany({
    take: PAGE_SIZE + 1,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { id: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      balance: true,
      createdAt: true,
      _count: {
        select: { orders: true }
      }
    }
  });

  const hasMore = users.length > PAGE_SIZE;
  const pageItems = hasMore ? users.slice(0, PAGE_SIZE) : users;

  // 2. Строгий маппинг в легковесный DTO (BigInt конвертируется в строку)
  const dtos: UserRowDTO[] = pageItems.map(u => ({
    id: u.id,
    email: u.email,
    name: u.name,
    balanceRub: (Number(u.balance) / 100).toFixed(2),
    createdAt: u.createdAt.toISOString(),
    ordersCount: u._count.orders,
  }));

  const nextCursor = hasMore ? pageItems[pageItems.length - 1].id : null;

  return <UserDataTable initialUsers={dtos} nextCursor={nextCursor} />;
}
```

---

## 3. Защита клиентского бандла и Tree-Shaking

В Next.js App Router клиентские компоненты компилируются в отдельные JS-чанки. Неправильные импорты раздувают размер бандла в 10-20 раз.

### Правило 1: Запрет «бочковых» (Barrel) импортов тяжелых библиотек
```typescript
// ❌ АНТИПАТТЕРН: Затягивает весь пакет lodash (500 Кб) в бандл
import { debounce, cloneDeep } from 'lodash';

// ❌ АНТИПАТТЕРН: Затягивает 5000 SVG-иконок Lucide в один бандл
import { Trash, Check, User, Search, Settings, ArrowRight } from 'lucide-react';

// ✅ PRODUCTION-GRADE: Точечные микро-импорты (Tree-Shaking Friendly)
import debounce from 'lodash/debounce';
import cloneDeep from 'lodash/cloneDeep';
// Для lucide-react Next.js 16 поддерживает optimizePackageImports: ['lucide-react'] в next.config.mjs
```

### Правило 2: Динамический импорт монструозных компонентов (Lazy Loading)
Библиотеки форматированного текста (BlockNote, Monaco Editor), графики (Recharts) и генераторы PDF **запрещено** импортировать статически на первом экране:

```tsx
// ✅ PRODUCTION-GRADE: Компонент графика загружается ТОЛЬКО при необходимости
import dynamic from 'next/dynamic';

const DynamicAnalyticsChart = dynamic(
  () => import('@/components/admin/AnalyticsChart').then(mod => mod.AnalyticsChart),
  {
    loading: () => <div className="h-64 animate-pulse rounded-xl bg-content2/50" />,
    ssr: false, // Отключаем SSR для чисто клиентских тяжелых визуализаций
  }
);
```

---

## 4. Чеклист готовности RSC и Бандла (Next.js Hygiene)

1. [ ] Ни один сырой объект модели Prisma не передается напрямую в `props` компонентов `'use client'`.
2. [ ] Все передаваемые массивы ограничены `take: 20..50` (Keyset пагинация).
3. [ ] В клиентских DTO отсутствуют поля `password`, `hash`, `secret`, `cost`, `providerResponse`.
4. [ ] Поля типа `BigInt` нормализованы в `string` или `number` до сериализации в RSC (JSON не поддерживает BigInt).
5. [ ] Тяжелые редакторы и чарты вынесены в `next/dynamic` с `ssr: false`.
