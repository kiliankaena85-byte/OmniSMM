# SPEC-2026-09-12: Admin Storefront Keys UI & Server Actions

- **Статус:** APPROVED
- **Уровень риска:** Tier 2: Standard
- **Автор / Инициатор:** Antigravity AI / Пользователь
- **Профильные скиллы:** `arch-boundary-guard`, `multi-tenant-isolation-arch`, `production-readiness-guard`

---

## 1. Контекст и Бизнес-требования
После реализации ядра **Headless Storefront Gateway (API v1)** операторам и инвесторам платформы OmniSMM 1.0 требуется административный веб-интерфейс в панели управления (`/admin/settings?tab=storefront`) для:
1. Просмотра списка выпущенных ключей (`pk_live_*`, `sk_live_*`) с фильтрацией по активному тенанту.
2. Выпуска новых ключей: выбор типа (`PUBLISHABLE` или `SECRET`), указание человекочитаемого имени (например, «iOS App», «Витрина партнера»).
3. Однократного безопасного отображения сгенерированного токена при создании с возможностью мгновенного копирования в буфер.
4. Отзыва (Revocation) скомпрометированных или неиспользуемых ключей.
5. Мониторинга активности ключей (`lastUsedAt`, статус активности).

---

## 2. Контракты данных и Типы (Data Contracts)

### 2.1. Server Actions DTO (Zod)
```typescript
import { z } from 'zod';

export const CreateStorefrontKeySchema = z.object({
  tenantId: z.string().min(1, 'Идентификатор тенанта обязателен'),
  type: z.enum(['PUBLISHABLE', 'SECRET']),
  name: z.string().trim().min(2, 'Название должно быть от 2 до 60 символов').max(60),
});
export type CreateStorefrontKeyDto = z.infer<typeof CreateStorefrontKeySchema>;

export const RevokeStorefrontKeySchema = z.object({
  id: z.string().min(1, 'Идентификатор ключа обязателен'),
  tenantId: z.string().min(1, 'Идентификатор тенанта обязателен'),
});
export type RevokeStorefrontKeyDto = z.infer<typeof RevokeStorefrontKeySchema>;

export interface StorefrontKeyItemDto {
  id: string;
  tenantId: string;
  type: 'PUBLISHABLE' | 'SECRET';
  keyPrefix: string;
  name: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}
```

---

## 3. Матрица состояний и Инварианты (State Machine & Invariants)
- **Изоляция тенантов (Multi-Tenant Guard):** Все Server Actions обязаны проверять доступ сотрудника через `requireStaffPermission('settings', 'view' | 'edit')` и скоупировать выборку ключей строго по переданному `tenantId`.
- **Защита секретов (One-Time Display):** Полный токен `sk_live_*` возвращается клиенту РОВНО ОДИН РАЗ в ответе метода создания. В БД сохраняется только SHA-256 хэш (`keyHash`) и префикс для витрины (`keyPrefix`).
- **Неизменяемость и отзыв (Soft Revoke):** При отзыве ключ не удаляется физически из БД, а переводится в `isActive: false` для сохранения истории аудита и предотвращения повторного использования.

---

## 4. Матрица граничных условий (Edge Cases Matrix)

| Сценарий | Входные данные | Ожидаемое поведение | Код ошибки / Статус |
| :--- | :--- | :--- | :--- |
| **Happy Path Create** | Валидный `tenantId`, `type: 'PUBLISHABLE'`, `name: 'Web Store'` | Ключ создается, возвращается полный токен и метаданные | `{ success: true, data: { token, key } }` |
| **Invalid Name** | `name: 'a'` (слишком короткое) | Ошибка валидации Zod | `{ success: false, error: '...' }` |
| **RBAC Denied** | Сессия без прав `settings:edit` | Отказ доступа на уровне RBAC | `{ success: false, error: 'Access denied' }` |
| **Revoke Non-Existent Key** | Несуществующий `id` или чужой `tenantId` | Отказ, ключ не найден | `{ success: false, error: 'Ключ не найден' }` |
| **Cross-Tenant Revoke (BOLA)**| Ключ принадлежит `tenantA`, запрос с `tenantB` | `findFirst` возвращает null, мутация отклоняется | `{ success: false, error: 'Ключ не найден' }` |

---

## 5. План тестирования (TDD Red Phase)
- [x] `describe('Storefront Keys Server Actions')`:
  - `listStorefrontKeysAction`: возвращает ключи только указанного тенанта.
  - `generateStorefrontKeyAction`: валидирует входные параметры, генерирует токен, создает запись в БД с префиксом и хэшем.
  - `revokeStorefrontKeyAction`: переводит статус в `isActive: false`, блокирует доступ к чужому тенанту.

---

## 6. Затрагиваемые файлы и Декомпозиция (Компоненты <= 200 строк)
- **Спецификация:** `docs/specs/SPEC-2026-09-12-admin-storefront-keys.md`
- **Тесты:** `src/__tests__/actions/storefront-keys-action.test.ts`
- **Бэкенд / Server Actions:** `src/actions/admin/storefront-keys.ts`
- **Навигация:** `src/components/admin/settings/settings-navigation-config.ts`
- **Фронтенд компоненты:**
  - `src/app/admin/settings/storefront-keys/storefront-keys-settings.tsx` (контейнер вкладки)
  - `src/app/admin/settings/storefront-keys/storefront-key-create-modal.tsx` (диалог создания и показа токена)
  - `src/app/admin/settings/storefront-keys/storefront-key-row.tsx` (карточка / строка ключа)
- **Страница настроек:** `src/app/admin/settings/page.tsx`
