# Справочник 08: Границы Ошибок, Защита от Проглатывания и Паттерн Result

> **Стандарт:** OmniSMM Production Readiness Standard (v2026)  
> **Ключевой инвариант:** `INV-PROD-09` — Запрещено скрывать ошибки (`catch {}`); разделение Expected Domain Errors (`Result<T, E>`) и System Panics.

---

## 1. Ловушка «Тихого Проглатывания» (The Error Swallowing Trap)

Один из самых коварных грехов начинающих разработчиков — попытка скрыть ошибку, чтобы «сервер не упал»:

```typescript
// ❌ СМЕРТЕЛЬНЫЙ АНТИПАТТЕРН: Тихое проглатывание
async function getUserBalance(userId: string) {
  try {
    const user = await db.user.findUnique({ where: { id: userId } });
    return user.balance;
  } catch (err) {
    // 💥 КАТАСТРОФА: Ошибка сети базы данных скрыта! Функция вернула null!
    return null;
  }
}

// Вызывающий код:
const balance = await getUserBalance(userId);
if (!balance) {
  // Вызывающий код решает, что у пользователя 0 рублей или аккаунт удален,
  // и блокирует добросовестного клиента или перезаписывает профиль!
}
```

### Последствия:
1. Вызывающий код не может отличить «баланс равен нулю» от «база данных временно недоступна».
2. Дежурный инженер не получает алерта в Sentry/Datadog, потому что исключение было тихо похоронено в catch-блоке.
3. Происходит тихое повреждение данных (Silent Data Corruption).

---

## 2. Разделение: Expected Domain Errors vs Infrastructure Panics

В профессиональной разработке все сбои строго делятся на две категории:

```
                                  [ СБОЙ В СИСТЕМЕ ]
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
     [ 1. EXPECTED DOMAIN ERRORS ]                   [ 2. INFRASTRUCTURE PANICS ]
     • Неверный пароль                               • Отвал сетевого кабеля БД
     • Недостаточно средств                          • OOM (Out Of Memory)
     • Услуга временно отключена                     • Синтаксическая ошибка в коде
                  │                                               │
                  ▼                                               ▼
     [ ОБРАБОТКА: Result<T, E> ]                     [ ОБРАБОТКА: FAIL-FAST / THROW ]
     • Возврат { success: false, error }             • Проброс исключения вверх (throw)
     • Понятное сообщение пользователю               • Запись в Sentry / Crash Alert
     • Чистый HTTP 200 или 400/422                   • Перехват в ErrorBoundary / 500
```

---

## 3. Специфика Next.js 16: Маскирование ошибок в Server Actions

В Next.js App Router при сборке в Production (`NODE_ENV=production`) любой выброшенный `throw new Error("Недостаточно средств")` внутри Server Action **автоматически маскируется движком Next.js** в неинформативную фразу:
> *"An unexpected response was received from the server."*

Пользователь видит бессмысленное сообщение, а служба поддержки не может понять причину отказа.

### ✅ Production-Grade: Контракт Server Actions в OmniSMM
```typescript
// src/types/actions.ts
export type ActionResult<T = void> = 
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

// src/actions/order.actions.ts
'use server';

import { requireAuth } from '@/lib/auth';
import { WalletOps } from '@/lib/wallet-ops';

export async function submitOrderAction(input: OrderInput): Promise<ActionResult<{ orderId: string }>> {
  try {
    const session = await requireAuth();
    if (!session) {
      return { success: false, error: 'Требуется авторизация', code: 'UNAUTHORIZED' };
    }

    const validation = OrderSchema.safeParse(input);
    if (!validation.success) {
      return { 
        success: false, 
        error: validation.error.issues[0].message, 
        code: 'VALIDATION_FAILED' 
      };
    }

    const result = await OrderService.create(session.userId, validation.data);
    return { success: true, data: { orderId: result.id } };

  } catch (err: any) {
    // Непредвиденный инфраструктурный сбой: логируем с контекстом!
    logger.error('Order creation failed unexpectedly', err, { input });
    
    // Возвращаем безопасный типизированный ответ, не роняя интерфейс
    return { 
      success: false, 
      error: 'Временный сбой при создании заказа. Попробуйте через 1 минуту.',
      code: 'INTERNAL_ERROR' 
    };
  }
}
```

---

## 4. Границы отказоустойчивости (Fail-Safe vs Fail-Closed)

- **Fail-Safe (Мягкая деградация):** Применяется ТОЛЬКО для некритичных фичей. 
  *Пример:* упал сервис рекомендаций похожих услуг $\to$ просто скрываем блок рекомендаций, страница продолжает работать.
- **Fail-Closed (Жесткий отказ):** ОБЯЗАТЕЛЕН для финансов, авторизации и безопасности.
  *Пример:* упал сервис проверки подписи вебхука $\to$ **категорический отказ HTTP 403**, ни в коем случае не зачислять баланс «на доверии»!

---

## 5. Чеклист готовности обработки ошибок

1. [ ] В коде нет пустых блоков `catch (e) {}` и конструкций `catch { return null; }`.
2. [ ] Все Server Actions возвращают строго типизированный контракт `{ success: boolean, error?: string, data?: T }`.
3. [ ] Критические финансовые операции и проверки прав работают по принципу **Fail-Closed**.
4. [ ] Непредвиденные сбои логируются через `logger.error(msg, err)` до возврата ответа.
5. [ ] В клиентской части присутствуют React 19 `ErrorBoundary` для изоляции сбоев отдельных виджетов.
