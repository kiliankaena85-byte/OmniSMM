# Node.js 20+ & Next.js 16 Memory Tuning in Docker

## 1. Структура памяти V8 в контейнере

Рантайм Node.js построен на движке Google V8. Память процесса разделена на:
1. **New Space (Semi-space):** Зона молодых объектов (до нескольких десятков мегабайт). Очищается быстрыми сборками Scavenge.
2. **Old Space (Pointer & Data):** Объекты, пережившие несколько циклов GC. Очищается тяжелой фазой Mark-Sweep-Compact.
3. **Large Object Space:** Объекты размером более $128\text{KB}$ (буферы, большие JSON).
4. **Code Space:** Скомпилированный JIT-код функций.
5. **External Memory & Buffers:** `Buffer.from()`, `ArrayBuffer`, криптографические контексты OpenSSL — аллоцируются в C++ куче за пределами V8 heap.

---

## 2. «Правило 75%» (The 75% V8 Heap Rule)

По умолчанию современные версии Node.js пытаются читать лимиты cgroups, однако V8 Garbage Collector не знает, сколько памяти нужно для C++ буферов, сокетов, потоков и самого рантайма.

### Катастрофа при дефолтных настройках:
Если в Docker задан лимит `--memory 1024m`, а в Node.js ничего не задано, V8 может отложить полный Mark-Sweep до момента, пока размер кучи не достигнет ~950MB. В этот момент любая сетевая операция или загрузка файла вызывает аллокацию внешнего `Buffer`, суммарное потребление превышает 1024MB, и **ядро Linux моментально шлет `SIGKILL` (Exit 137)**. Приложение не успевает даже напечатать лог об ошибке!

### Правильная настройка:
Всегда выставляйте размер Old Space равным **70–75%** от жесткого лимита памяти контейнера через переменную окружения `NODE_OPTIONS`:

| Лимит Docker (`--memory`) | `NODE_OPTIONS` значение | Буфер на C++/PageCache/Рантайм |
| :--- | :--- | :--- |
| **512 MB** (Worker / Bot) | `--max-old-space-size=384` | 128 MB |
| **1 GB** (Next.js App) | `--max-old-space-size=768` | 256 MB |
| **2 GB** (High Load API) | `--max-old-space-size=1536` | 512 MB |
| **4 GB** (Heavy Analytics) | `--max-old-space-size=3072` | 1024 MB |

### Конфигурация в `docker-compose.yml`:
```yaml
services:
  app:
    image: smmplan_app
    environment:
      - NODE_OPTIONS=--max-old-space-size=768 --diagnostic-report-on-fatalerror --diagnostic-report-path=/tmp/reports
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 768M
```

---

## 3. Топ-5 утечек памяти в Next.js 16 App Router & Standalone

### 1. Множественные инстансы PrismaClient
**Симптом:** Постоянный линейный рост памяти на 20–50MB в час при каждом обращении к БД.
**Причина:** В Next.js при hot reload или повторном импорте создаются новые подключения к PostgreSQL, удерживающие соединения и кэш метаданных.
**Решение:** Строго использовать глобальный singleton:
```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
```

### 2. Утечка замыканий в Server Actions
**Симптом:** Память подскакивает при выполнении пользовательских действий и никогда не падает.
**Причина:** Замыкание тяжелых объектов (например, больших массивов заказов или сырых логов) в долгоживущих промисах, глобальных обработчиках событий (`EventEmitter.on`) или интервалах `setInterval` без `clearInterval`.

### 3. Очереди BullMQ и накопление завершенных Job
**Симптом:** Worker-контейнер раздувается до лимита за 6–12 часов работы.
**Причина:** В BullMQ по умолчанию завершенные и проваленные задачи могут оставаться в памяти Redis и кэшироваться воркером.
**Решение:** Настройка `removeOnComplete` и `removeOnFail`:
```typescript
const defaultJobOptions = {
  removeOnComplete: { count: 100, age: 3600 }, // хранить не более 100 задач или 1 час
  removeOnFail: { count: 500, age: 86400 * 3 }, // ошибки хранить до 3 дней
};
```

### 4. Неограниченный кэш `unstable_cache` и `fetch`
**Симптом:** Next.js потребляет всё больше памяти по мере посещения пользователями разных страниц.
**Причина:** Кэширование страниц и тяжелых JSON-ответов провайдеров в оперативной памяти сервера без TTL.
**Решение:** Всегда указывать `revalidate` и ограничивать размер сохраняемых сущностей.

### 5. Утечка памяти при стриминге файлов и загрузках
**Симптом:** Мгновенный краш при загрузке юзером файла > 15MB.
**Причина:** Использование `await req.arrayBuffer()` или `fs.readFileSync()`, загружающего весь файл целиком в V8 heap.
**Решение:** Использовать потоковый стриминг через `stream.pipeline` и запись во временный каталог на диске (или в `tmpfs`).

---

## 4. Снятие Heap Snapshot из работающего контейнера

Если контейнер потребляет много памяти, но еще не упал, можно выгрузить слепок кучи:
```bash
# Выполнить из скрипта:
bash scripts/node-heap-snapshot.sh <container_name>
```

Скрипт подключается к процессу Node.js, выполняет генерацию файла `.heapsnapshot` через встроенный модуль `v8.writeHeapSnapshot()` и копирует его на хост. Полученный файл открывается в Chrome DevTools (вкладка **Memory -> Load**), где сразу виден конструктор объектов, удерживающих Retained Size.
