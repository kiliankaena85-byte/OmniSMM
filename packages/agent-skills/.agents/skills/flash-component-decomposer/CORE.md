# flash-component-decomposer (L1 Core Invariants)
> **Статус:** CRITICAL GATE | **Бюджет:** < 450 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **Strict View/Logic Decoupling:** ЗАПРЕЩЕНО смешивать в одном файле сложные вызовы Server Actions, мутации стейта и тяжелый JSX. Логика выносится строго в кастомный хук use<Feature>State.
2. **No God Components:** Запрещено создавать компоненты, отвечающие одновременно за списки, карточки, модалки и фильтры. Каждый компонент решает ровно 1 задачу.
3. **Modal Hoisting Rule:** Модальные окна, шторки (Drawer) и диалоги подтверждения обязаны быть вынесены из дочерних строк таблицы на верхний уровень страницы.
4. **React 19 Compiler Compatibility:** Избегать ручных оберток useMemo/useCallback вокруг простых вычислений. Доверять автоматической мемоизации React 19.
5. **Clean DTO Boundaries:** Пропсы компонентов обязаны принимать типизированные DTO-интерфейсы без раскрытия сырых моделей базы данных Prisma.

## ⚡ FAST RULES & FORMULAS
- Архитектура папки: `src/components/<feature>/[FeatureView.tsx, useFeature.ts, FeatureItem.tsx, FeatureModal.tsx]`.
- Чистый компонент: презентационный stateless компонент принимает `{ data, actions, isLoading }`.

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Очищен ли JSX от логики парсинга данных и вызовов API?
- [ ] Вынесены ли модалки из дропдаунов?

---
*Для полного руководства см. [SKILL.md](./SKILL.md) (L2 Deep).*
