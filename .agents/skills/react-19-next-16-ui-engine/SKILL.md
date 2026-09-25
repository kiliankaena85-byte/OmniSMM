---
name: react-19-next-16-ui-engine
description: Используй этот скилл ВСЕГДА, когда Инженерный стандарт
  фронтенд-рантайма React 19 и Next.js 16 App Router (Server Actions,
  useActionState, useOptimistic, Streaming SSR, Suspense). НЕ применять для DDL
  миграций базы данных или серверных cron-задач.
metadata:
  tags:
    - react-19
    - nextjs-16
    - server-actions
    - use-action-state
    - use-optimistic
    - streaming-ssr
    - suspense
    - transitions
---

# React 19 & Next.js 16 UI Runtime Engine (L2 Deep Standard)

## 1. Философия и Контекст
Платформа OmniSMM 1.0 функционирует на базе **Next.js 16 App Router** и **React 19**. 
Новая парадигма рантайма исключает устаревшие подходы эпохи React 16–18 (ручной `useState(loading)` + `onSubmit`, нетипизированные мутации) и требует прямого использования нативных примитивов React 19:
- **Action-First Forms:** `useActionState` и Server Actions с типизированным контрактом `{ success, data, error }`.
- **Optimistic UI with Fail-Closed TTL:** Мгновенный отклик интерфейса с обязательным таймером авто-отката при сбое.
- **Streaming SSR & Suspense:** Потоковая отдача верстки сервером с геометрически зафиксированными скелетонами.
- **Subcomponent Status:** Использование `useFormStatus` для изоляции перерендеров кнопок сабмита.

---

## 2. Архитектурные инварианты (Hard Invariants)

### 2.1. Контракт Server Actions и useActionState
Каждый Server Action в `src/actions/` обязан возвращать типизированный результат:
```ts
export type ActionResponse<T = unknown> = 
  | { success: true; data: T; error?: never }
  | { success: false; error: string; data?: never };
```
Формы в клиентских компонентах связываются с действием через `useActionState`:
```tsx
'use client';
import { useActionState } from 'react';
import { updateProfile, ProfileState } from '@/actions/user/profile';
import { SubmitButton } from '@/components/ui/SubmitButton';

export function ProfileForm({ initialUser }: { initialUser: User }) {
  const [state, formAction, isPending] = useActionState(updateProfile, {
    success: false,
    data: initialUser
  });

  return (
    <form action={formAction} className="space-y-4">
      <input 
        name="name" 
        defaultValue={initialUser.name} 
        className="w-full text-base sm:text-sm px-4 py-2.5 rounded-xl border bg-background" 
      />
      {state.error && (
        <p className="text-xs text-destructive font-medium">{state.error}</p>
      )}
      <SubmitButton label="Сохранить" />
    </form>
  );
}
```

### 2.2. Изоляция сабмита через useFormStatus
Кнопка отправки формы (`SubmitButton`) выносится в дочерний компонент для изоляции реактивности `pending` без лишнего перерендера всей формы:
```tsx
'use client';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/Button';

export function SubmitButton({ label = 'Отправить' }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button 
      type="submit" 
      disabled={pending} 
      className="min-h-[44px] min-w-[120px] font-bold"
    >
      {pending ? 'Обработка...' : label}
    </Button>
  );
}
```

---

## 3. Optimistic UI с обязательным TTL-откатом (Fail-Safe Rollback)

Любая оптимистичная мутация обязана защищать пользователя от рассинхронизации стейта.

### 3.1. Паттерн useOptimistic с 10-12s TTL таймером
```tsx
'use client';
import { useOptimistic, useTransition, useRef } from 'react';

interface Message {
  id: string;
  text: string;
  isSending?: boolean;
}

export function TicketChat({ initialMessages }: { initialMessages: Message[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [isPending, startTransition] = useTransition();
  const rollbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (state, newMsg: Message) => [...state, { ...newMsg, isSending: true }]
  );

  const handleSendMessage = async (text: string) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = { id: tempId, text };

    startTransition(async () => {
      addOptimisticMessage(optimisticMsg);

      // Защитный таймер авто-очистки (10-12s TTL)
      rollbackTimerRef.current = setTimeout(() => {
        toast.error('Превышено время ожидания ответа сервера');
      }, 12000);

      const res = await sendTicketMessageAction({ text });
      if (rollbackTimerRef.current) clearTimeout(rollbackTimerRef.current);

      if (res.success && res.data) {
        setMessages(prev => [...prev, res.data]);
      } else {
        toast.error(res.error || 'Ошибка отправки сообщения');
        // Оптимистичное сообщение автоматически откатится, так как messages не обновился
      }
    });
  };

  return (
    <div className="space-y-3">
      {optimisticMessages.map(msg => (
        <div 
          key={msg.id} 
          className={`p-3 rounded-xl ${msg.isSending ? 'opacity-60 italic' : 'bg-muted/50'}`}
        >
          {msg.text}
        </div>
      ))}
    </div>
  );
}
```

---

## 4. Streaming SSR и Suspense-границы

В Next.js 16 запрещено блокировать отображение интерфейса тяжелыми запросами в корневой `page.tsx`:
1. **Layout & Shell First:** Макет, навигация, сайдбар и карточки отдаются сервером мгновенно (Time to First Byte < 200ms).
2. **Suspense Granularity:** Каждый блок данных (статистика, каталог, баланс) оборачивается в изолированный `<Suspense>`.
3. **Geometry-Preserving Skeletons:** Скелетон обязан резервировать точные размеры (`min-h-*`, `aspect-*`), предотвращая CLS.

```tsx
export default async function AdminDashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <DashboardHeader />
      
      {/* Метрики выручки и заказов */}
      <Suspense fallback={<MetricsSkeleton />}>
        <AsyncMetricsSection />
      </Suspense>

      {/* Таблица последних событий */}
      <Suspense fallback={<TableSkeleton rows={5} />}>
        <AsyncEventsSection />
      </Suspense>
    </div>
  );
}
```

---

## 5. Переходы и навигация (useTransition Guard)

Для плавной смены табов, фильтров и пагинации без моргания используется `startTransition`:
```tsx
const [isFiltering, startTransition] = useTransition();

const handleFilterChange = (category: string) => {
  startTransition(() => {
    setActiveCategory(category);
    // URL обновляется без прерывания рендера
    router.push(`?category=${category}`, { scroll: false });
  });
};
```

---

## 6. Чеклист приемки компонента (RAC-2026)
- [ ] Используется ли `useActionState` вместо `onSubmit + useState(loading)`?
- [ ] Кнопка отправки вынесена в подкомпонент с `useFormStatus`?
- [ ] Имеют ли оптимистичные элементы таймер отката 10–12s?
- [ ] Все асинхронные серверные секции изолированы через `<Suspense>` со скелетонами?
- [ ] Отсутствуют ли прямые `throw new Error()` в Server Actions?\n

---

## Пошаговый алгоритм выполнения (Step-by-step Protocol)
1. **Шаг 1:** Анализ контекста задачи и определение границ влияния.
2. **Шаг 2:** Проверка соответствия архитектурным инвариантам.
3. **Шаг 3:** Реализация изменений с соблюдением контрактов.
4. **Шаг 4:** Верификация через автоматические тесты и линтеры.
5. **Шаг 5:** Документирование и сохранение точки стабильности.

---

## Предотвращаемые антипаттерны (Gotchas / Bad vs Good)
❌ **Плохо:** Игнорирование архитектурных инвариантов ради быстрой реализации.
- ✅ **Хорошо:** Строгое соблюдение чистоты слоев и контрактов платформы.
❌ **Плохо:** Отсутствие автоматических тестов на граничные условия.
- ✅ **Хорошо:** Покрытие сценариев тестами до выкатки изменений.
