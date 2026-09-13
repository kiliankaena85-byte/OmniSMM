# react-19-next-16-ui-engine (L1 Core Invariants)
> **Статус:** CRITICAL GATE | **Бюджет:** < 450 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **React 19 Action-First:** Формы отправки данных используют `useActionState` и нативный `action={formAction}` вместо устаревших `onSubmit + useState(loading)`.
2. **Optimistic UI with TTL Rollback:** Любой оптимистичный стейт (`useOptimistic`) с временным ID обязан иметь 10–12s таймер авто-очистки и немедленный откат при `{ success: false }`.
3. **Streaming & Skeleton First:** Серверные компоненты с загрузкой данных обязаны оборачиваться в `<Suspense fallback={<ScreenSkeleton />}>`. Белый экран запрещен.
4. **useFormStatus in Subcomponents:** Индикация загрузки кнопок отправки реализуется через хук `useFormStatus` внутри дочернего компонента формы.
5. **No State Mutations in Transitions:** Обновления стейта внутри `startTransition` обязаны быть чистыми функциями.

## ⚡ FAST RULES & FORMULAS
- Action Hook: `const [state, formAction, isPending] = useActionState(serverAction, initialState);`.
- Submit Button: `const { pending } = useFormStatus(); <Button isLoading={pending} />`.

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Используется ли `useActionState` вместо ручного `useState(loading)`?
- [ ] Есть ли таймер авто-отката оптимистичного стейта?
- [ ] Добавлен ли скелетон в Suspense?

---
*Для полного руководства см. [SKILL.md](./SKILL.md) (L2 Deep).*\n