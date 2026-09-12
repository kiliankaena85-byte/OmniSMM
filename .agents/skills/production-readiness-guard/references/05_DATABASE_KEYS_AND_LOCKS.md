# Справочник 05: База Данных, Искоренение N+1 и Keyset Пагинация

> **Стандарт:** OmniSMM Production Readiness Standard (v2026)  
> **Ключевые инварианты:** `INV-PROD-05` (Запрет N+1), `INV-PROD-06` (Keyset вместо OFFSET).

---

## 1. Проблема N+1: Катастрофа пула соединений

Сценарий, на котором проваливается большинство джуниоров и мидлов:

```typescript
// ❌ АНТИПАТТЕРН: "10 001 запрос к базе"
const orders = await db.order.findMany({ take: 100 }); // 1 запрос

for (const order of orders) {
  // 💥 100 дополнительных запросов к БД в цикле!
  const user = await db.user.findUnique({ where: { id: order.userId } });
  const service = await db.service.findUnique({ where: { id: order.serviceId } });
}
```

### Что происходит в продакшене:
1. Задержка (Latency) суммируется: $100 \times 5\text{мс} = 500\text{мс}$ чистого сетевого оверхеда (Round-Trip Time) между Node.js и PostgreSQL.
2. Пул соединений базы (обычно $10\text{--}20$ подключений) блокируется этим запросом, заставляя остальные запросы пользователей висеть в очереди.
3. Ошибка: `Timed out fetching a new connection from the connection pool`.

### ✅ Production-Grade (Жадная загрузка или Batching IN):
```typescript
// Выполняется ровно за 1 запрос через JOIN или 2 пакетных запроса через IN (...)
const orders = await db.order.findMany({
  take: 100,
  include: {
    user: {
      select: { id: true, email: true, name: true } // Без тяжелых полей
    },
    service: {
      select: { id: true, name: true, priceRub: true }
    }
  }
});
```

---

## 2. Ловушка `OFFSET` vs Keyset Пагинация (Seek Method)

Когда кандидат пишет пагинацию `OFFSET 200000 LIMIT 20`, он не понимает, как устроен движок реляционной базы данных (PostgreSQL):

```
OFFSET 200 000:
1. PostgreSQL читает 200 020 строк с диска в память.
2. Сортирует все 200 020 строк.
3. Выбрасывает первые 200 000 строк.
4. Отдает клиенту последние 20 строк.
ИТОГ: Время запроса растет линейно O(OFFSET). При странице 10 000 запрос длится 8 секунд!
```

```
KEYSET (CURSOR):
1. PostgreSQL использует B-Tree индекс: WHERE (created_at, id) < (:last_date, :last_id).
2. Движок мгновенно прыгает по дереву B-Tree к нужной записи за O(log N).
3. Читает ровно 20 строк с диска.
ИТОГ: Время запроса ВСЕГДА составляет 2-5 мс вне зависимости от глубины страницы!
```

### ✅ Production-Grade: Эталонный Keyset Cursor на Prisma
```typescript
interface KeysetPaginationParams {
  cursor?: string; // id последнего элемента
  take: number;
}

export async function getOrdersKeyset({ cursor, take = 20 }: KeysetPaginationParams) {
  const safeTake = Math.min(Math.max(take, 1), 100); // Ограничение сверху

  const items = await db.order.findMany({
    take: safeTake + 1, // Берем +1 для проверки наличия следующей страницы
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { id: 'desc' }, // Детерминированная сортировка по уникальному полю
    select: {
      id: true,
      amount: true,
      status: true,
      createdAt: true,
    }
  });

  const hasNextPage = items.length > safeTake;
  const resultItems = hasNextPage ? items.slice(0, safeTake) : items;
  const nextCursor = hasNextPage ? resultItems[resultItems.length - 1].id : null;

  return {
    items: resultItems,
    nextCursor,
    hasNextPage,
  };
}
```

---

## 3. Transaction Escape: Запрет сетевых вызовов внутри транзакций

Тягчайшая архитектурная ошибка — удерживать открытую ACID-транзакцию во время обращения к внешнему сетевому сервису:

```typescript
// ❌ СМЕРТЕЛЬНЫЙ АНТИПАТТЕРН: Транзакция блокирует строки на 5 секунд!
await db.$transaction(async (tx) => {
  // 1. Блокируем баланс юзера
  const user = await tx.user.findUnique({ where: { id: userId } });

  // 💥 ОШИБКА: Сетевой вызов внутри транзакции!
  // Если провайдер отвечает 5 секунд, строка пользователя заблокирована 5 секунд!
  // Все остальные параллельные действия этого юзера или админки встают колом!
  const providerResult = await fetch('https://provider.com/order', { ... });

  // 2. Списываем баланс
  await tx.user.update({ where: { id: userId }, data: { balance: user.balance - cost } });
});
```

### ✅ Production-Grade (Списание до, компенсация/возврат при сбое):
1. **Транзакция 1 (короткая, 5 мс):** Проверяем и замораживаем/списываем средства в БД, создаем запись в `ProviderOutbox`. Транзакция закрыта! Соединение с БД освобождено.
2. **Вне транзакции:** Выполняем сетевой вызов к поставщику.
3. **Транзакция 2 (короткая, 5 мс):** 
   - Если успешно: подтверждаем статус заказа `IN_PROGRESS`.
   - Если провайдер упал: инициируем компенсационную транзакцию (`WalletOps.refund`) с возвратом средств.

---

## 4. Чеклист готовности базы данных

1. [ ] В коде нет обращений к `db.*` внутри циклов `for/forEach/map`.
2. [ ] В пагинациях отсутствует `OFFSET` (заменен на Keyset Cursor).
3. [ ] В `findMany` всегда указан явный `take` (запрещены неограниченные выборки).
4. [ ] Внутри транзакций (`$transaction`, `tx.*`) отсутствуют вызовы `fetch`, `setTimeout`, обращение к сторонним API.
5. [ ] Поля, участвующие в `WHERE`, `ORDER BY` и связях, покрыты композитными B-Tree индексами.
