# Справочник 09: 30 Смертных Грехов на Техревью и Чеклист Сдачи Кода

> **Стандарт:** OmniSMM Production Readiness Standard (v2026)  
> **Назначение:** Практический чеклист самопроверки инженера перед коммитом в Git, код-ревью техлида или сдачей тестового задания на позицию Senior/Lead.

---

## ЧАСТЬ 1. 30 Смертных Грехов «Лабораторного» Кода

Если в вашем коде встречается хотя бы один из этих пунктов — на серьезном техревью это **автоматический No-Hire или отклонение Pull Request**:

### Категория A: Память и Рантайм (Memory & Runtime)
1. ❌ Чтение файла целиком в память через `fs.readFile()` или `Buffer.concat()` без лимита размера.
2. ❌ Создание глобального `new Map()` или массива для кеширования без ограничения размера (`maxSize`) и TTL.
3. ❌ Отсутствие очистки интервалов (`clearInterval`), таймеров и подписок (`emitter.off()`).
4. ❌ Удержание ссылок на гигантские структуры внутри долгоживущих замыканий (Closures).
5. ❌ Цепочки из 4+ методов массивов (`.filter().map().filter().reduce()`) на каждом входящем HTTP-запросе (создание тысяч короткоживущих объектов $\to$ GC Churn).

### Категория B: Процессор и Планировщик (CPU & Event Loop)
6. ❌ Поиск через `.find()`, `.indexOf()`, `.includes()` внутри другого цикла (скрытый $O(N^2)$).
7. ❌ Использование `JSON.parse(JSON.stringify(bigObj))` для глубокого клонирования на горячем пути.
8. ❌ Регулярные выражения со вложенными квантификаторами (`/(x+x+)+y/`), уязвимые к ReDoS.
9. ❌ Выполнение криптографии (Argon2, scrypt, RSA-генерация) синхронно в основном потоке Event Loop.
10. ❌ Отсутствие уступки потока (`setImmediate`) при тяжелых математических или аналитических вычислениях.

### Категория C: Next.js и Границы Сериализации (RSC Boundary)
11. ❌ Передача сырых моделей Prisma (`db.user.findUnique()`) прямо в `props` Client Component (`'use client'`).
12. ❌ Отсутствие Keyset-пагинации при передаче списков на клиент (рендеринг 5000 DOM-элементов).
13. ❌ Сериализация BigInt в JSON без предварительной нормализации в строку.
14. ❌ Импорт тяжелых библиотек (`lodash`, `moment`, `recharts`, `blocknote`) без точечного импорта или `dynamic()`.
15. ❌ Директива `"use server"` внутри страниц `page.tsx` (ломает билд Next.js).

### Категория D: Сеть и I/O (Network & Sockets)
16. ❌ Вызов `fetch()` без детерминированного `AbortSignal.timeout(ms)`.
17. ❌ Повтор запросов (Retries) с постоянным интервалом без Exponential Backoff и Full Jitter (Thundering Herd).
18. ❌ Повторная отправка запросов при клиентских ошибках 4xx (400, 401, 403, 422).
19. ❌ Отсутствие Circuit Breaker при взаимодействии с нестабильными сторонними API.
20. ❌ Игнорирование Backpressure при чтении/записи стримов (использование `.pipe()` вместо `pipeline`).

### Категория E: База Данных (Database & Persistence)
21. ❌ Запросы к базе данных внутри циклов `for/map` (N+1 проблема).
22. ❌ Использование `OFFSET` для глубокой пагинации в архивных и транзакционных таблицах.
23. ❌ Удержание открытой транзакции БД во время внешних HTTP-вызовов (Transaction Escape).
24. ❌ Запуск сотен параллельных запросов через нелимитированный `Promise.all(ids.map(...))`.
25. ❌ Выборка всей таблицы `SELECT *` без ограничения полей `select: { ... }`.

### Категория F: Конкурентность и Надежность (Concurrency & Reliability)
26. ❌ Изменение баланса или статусов через схему TOCTOU (Read-Modify-Write) без Row-Level Locks (`SELECT FOR UPDATE`).
27. ❌ Отсутствие ключей идемпотентности (`idempotencyKey`) на финансовых и изменяющих состояние операциях.
28. ❌ Проглатывание ошибок через `catch (e) {}` или `catch { return null; }`.
29. ❌ Вывод паролей, токенов, номеров карт в сырые логи через `console.log(payload)`.
30. ❌ Отсутствие перехвата `SIGTERM` / `SIGINT` и сброса незавершенных транзакций (No Graceful Shutdown).

---

## ЧАСТЬ 2. 5 Золотых Вопросов Senior-инженера перед началом кодинга

Прежде чем написать хотя бы одну строку кода, настоящий инженер отвечает на 5 вопросов:

1. **Каков теоретический и практический максимум входящих данных ($N_{max}$)?**  
   *Что произойдет с этой функцией, если придет не 10 записей, а 500 000? Упадет ли она по RAM или CPU?*
2. **Что произойдет, если внешняя система (БД, чужой API, диск) зависнет на 30 секунд или упадет?**  
   *Зависнет ли сервер вместе с ней? Отвалится ли по таймауту? Не повесит ли это пул сокетов?*
3. **Может ли этот код быть вызван параллельно двумя потоками/пользователями для одной и той же сущности?**  
   *Что будет, если нажать на кнопку дважды с разницей в 1 миллисекунду? Не возникнет ли гонка (Race Condition)?*
4. **Что увидит дежурный инженер в логах в 3 часа ночи при сбое этого кода?**  
   *Будет ли понятна причина сбоя? Есть ли там `traceId`? Не утекли ли туда персональные данные клиентов?*
5. **Как этот сервис переживет перезапуск контейнера (Rolling Update в Kubernetes/Docker)?**  
   *Прервет ли он пользовательский платеж на полуслове или даст ему корректно завершиться?*

---

## ЧАСТЬ 3. Архитектура Graceful Shutdown (Эталонный шаблон)

```typescript
// src/lib/lifecycle/graceful-shutdown.ts
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

let isShuttingDown = false;

export function setupGracefulShutdown(server: { close: (cb: () => void) => void }) {
  const handleSignal = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`Received ${signal}. Starting Graceful Shutdown...`);

    // 1. Останавливаем прием новых входящих соединений
    server.close(() => {
      logger.info('HTTP server closed for new requests.');
    });

    // 2. Устанавливаем защитный таймаут на принудительное завершение
    const forceExitTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timed out. Forcing exit...');
      process.exit(1);
    }, 15000); // 15 секунд grace period

    try {
      // 3. Закрываем воркеры и консьюмеры очередей
      // await worker.close();

      // 4. Закрываем пулы соединений с базой и Redis
      await db.$disconnect();
      await redis.quit();

      clearTimeout(forceExitTimeout);
      logger.info('Graceful shutdown completed cleanly.');
      process.exit(0);
    } catch (err) {
      logger.error('Error during graceful shutdown', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => handleSignal('SIGTERM'));
  process.on('SIGINT', () => handleSignal('SIGINT'));
}
```
