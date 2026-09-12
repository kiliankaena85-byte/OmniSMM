# Справочник 06: Конкурентность, Защита от TOCTOU и Ключи Идемпотентности

> **Стандарт:** OmniSMM Production Readiness Standard (v2026)  
> **Ключевой инвариант:** `INV-PROD-07` — Все изменения разделяемого состояния обязаны быть атомарными и сопровождаться уникальным `idempotencyKey`.

---

## 1. Анатомия бага TOCTOU (Time-of-Check to Time-of-Use)

Классическая ошибка разработчиков, не имевших опыта с многопоточными/параллельными системами:

```typescript
// ❌ СМЕРТЕЛЬНЫЙ АНТИПАТТЕРН: Двойное списание (Double Spending)
const user = await db.user.findUnique({ where: { id: userId } });

if (user.balance >= orderCost) {
  // 💥 МЕЖДУ ПРОВЕРКОЙ И СПИСАНИЕМ ПРОХОДИТ 1-5 МИЛЛИСЕКУНД!
  // В этот момент прилетает второй параллельный запрос от пользователя (двойной клик)
  // Второй запрос ТОЖЕ видит старый баланс и проходит проверку if!
  await db.user.update({
    where: { id: userId },
    data: { balance: user.balance - orderCost }
  });
}
```

### Последствия:
При балансе 100 ₽ и стоимости услуги 100 ₽ пользователь отправляет два одновременных клика. 
Оба проходят проверку `if (100 >= 100)`. В результате создаются 2 заказа на сумму 200 ₽, а баланс уходит в минус или списывается некорректно. Компания теряет деньги.

---

## 2. Способы решения в Production-Grade

### Способ A: Атомарный SQL-декремент (Atomic Conditional Update)
Лучший способ для простых числовых счетчиков и балансов:

```sql
UPDATE "User"
SET "balance" = "balance" - :cost
WHERE "id" = :userId AND "balance" >= :cost
RETURNING "balance";
```
Если баланса недостаточно, база данных обновит 0 строк (`rowCount === 0`). Проверка и мутация происходят в **один неделимый такт процессора БД**.

### Способ B: Пессимистическая блокировка (`SELECT FOR UPDATE`)
Для сложных транзакций, где требуется прочитать состояние, зафиксировать строки в журнале (`LedgerEntry`) и изменить баланс:

```typescript
// ✅ Production-Grade с Row-Level Lock в рамках ACID-транзакции
export async function debitWalletSafe(tx: PrismaTx, userId: string, amountKopecks: bigint, idempotencyKey: string) {
  // 1. Блокируем строку пользователя: никакой параллельный запрос не может прочитать
  // или изменить баланс этого юзера, пока транзакция не завершится (COMMIT)!
  const [lockedUser] = await tx.$queryRaw<Array<{ id: string; balance: bigint }>>`
    SELECT "id", "balance"
    FROM "User"
    WHERE "id" = ${userId}
    FOR UPDATE
  `;

  if (!lockedUser || lockedUser.balance < amountKopecks) {
    throw new Error('INSUFFICIENT_FUNDS');
  }

  // 2. Создаем запись в леджере с гарантией уникальности idempotencyKey (P2002)
  await tx.ledgerEntry.create({
    data: {
      userId,
      amount: -amountKopecks,
      idempotencyKey,
      balanceAfter: lockedUser.balance - amountKopecks,
    }
  });

  // 3. Обновляем баланс
  await tx.user.update({
    where: { id: userId },
    data: { balance: lockedUser.balance - amountKopecks }
  });
}
```

---

## 3. Физика Ключей Идемпотентности (Idempotency Keys)

В распределенных системах сеть по своей природе **ненадежна** (Проблема двух генералов):

```
1. Клиент отправляет: POST /api/order/checkout (Заказ на 1000 ₽)
2. Сервер выполнил заказ, списал деньги, но на обратном пути ОБОРВАЛАСЬ СВЯЗЬ!
3. Браузер клиента получил Network Error / Timeout.
4. Клиент нажимает кнопку "Повторить заказ" (Retry).
```

Если сервер не идемпотентен, деньги спишутся **второй раз**, а клиент получит два одинаковых заказа!

### Архитектура идемпотентного обработчика:
1. Клиент генерирует UUID `idempotencyKey` на фронтенде перед отправкой запроса.
2. Сервер сохраняет ключ в БД с уникальным индексом (`UNIQUE INDEX idx_idempotency`).
3. При повторном запросе:
   - Если операция в процессе: возвращается статус `409 Conflict / In-Progress`.
   - Если операция завершена: сервер **не повторяет списание**, а возвращает сохраненный результат первого выполнения!

---

## 4. Чеклист готовности конкурентности

1. [ ] В кодовой базе нет логики «сначала прочитал баланс/статус в JS, потом обновил вторым запросом» (устранено TOCTOU).
2. [ ] Все мутации баланса, заказов и складов снабжены уникальным `idempotencyKey`.
3. [ ] В таблицах проводок и транзакций наложен `UNIQUE` индекс на `idempotencyKey`.
4. [ ] Порядок захвата блокировок детерминирован (всегда блокируем таблицы и записи в одном алфавитном порядке `User -> Order`, предотвращая Deadlocks).
5. [ ] В транзакциях используется строгий `IsolationLevel: Serializable` или `FOR UPDATE`.
