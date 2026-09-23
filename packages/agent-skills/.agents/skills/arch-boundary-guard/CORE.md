# arch-boundary-guard (L1 Core Invariants)
> **Статус:** CRITICAL GATE | **Бюджет:** < 450 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **Запрет 'use server' в page.tsx:** КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО объявлять `"use server"` внутри Page Components. Server Actions строго в `src/actions/`.
2. **Лимит строк компонентов:** Компоненты UI обязаны быть $\le 200$ строк с выносом субкомпонентов.
3. **Чистота слоев Clean Architecture:** UI никогда не обращается к Prisma напрямую; вызовы идут строго через Action / Service.
4. **DTO без секретов:** Запрещено возвращать клиенту внутренние сущности БД с API-ключами провайдеров или хешами паролей.
5. **Типизированный ответ:** Все Server Actions возвращают `{ success: true, data } | { success: false, error: string }`. Запрещен необработанный throw Error.

## ⚡ FAST RULES & FORMULAS
- Server Action Guard: `await requireStaffPermission('ADMIN')` или `await requireAdmin()`.
- Безопасный возврат: `return { success: false, error: 'Понятное сообщение' };`

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Нет ли `"use server"` в page.tsx?
- [ ] Размер файла меньше 200 строк?
- [ ] Обернуты ли все ошибки в типизированный результат?

---
*Для полного дерева решений и премортема см. [SKILL.md](./SKILL.md) (L2 Deep).*\n