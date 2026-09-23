# Справочник 01: Память, V8 Heap и Потоковая Обработка (Streaming Architecture)

> **Стандарт:** OmniSMM Production Readiness Standard (v2026)  
> **Ключевой инвариант:** `INV-PROD-01` — Любая обработка данных $> 64$ Кб обязана выполняться с константным потреблением памяти $O(1)$ RAM.

---

## 1. Анатомия V8 Heap и физика OOM (Out Of Memory)

В среде Node.js память процесса разделена на несколько изолированных областей:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        NODE.JS PROCESS MEMORY                          │
│                                                                        │
│  ┌─────────────────────────── V8 HEAP ──────────────────────────────┐  │
│  │                                                                 │  │
│  │  ┌────────────── NEW SPACE (1-64 MB) ─────────────┐             │  │
│  │  │  [ Semi-space From ]  ───>  [ Semi-space To ]  │ (Scavenge)  │  │
│  │  └───────────────────────┬────────────────────────┘             │  │
│  │                          │ 2x survived                          │  │
│  │                          ▼                                      │  │
│  │  ┌────────────── OLD SPACE (До max-old-space) ────┐             │  │
│  │  │  Живущие объекты, замыкания, тяжелые структуры │ (Mark-Sweep)│  │
│  │  └────────────────────────────────────────────────┘             │  │
│  │                                                                 │  │
│  │  ┌────────── LARGE OBJECT SPACE ──────────┐  ┌── CODE SPACE ──┐ │  │
│  │  │  Объекты больше страницы памяти         │  │ JIT-компиляция │ │  │
│  │  └────────────────────────────────────────┘  └────────────────┘ │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────── C++ / OFF-HEAP ──────────────────────────┐  │
│  │  Buffer allocations, TLS-контексты, libuv threadpool & sockets   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Почему «простой скрипт» валит контейнер в Docker:
1. **Scavenge GC:** Короткоживущие объекты (результаты промежуточных `.map()`, `.filter()`, мелкие строки) очищаются сверхбыстро (1-2 мс).
2. **Promotion в Old Space:** Если алгоритм держит ссылки на массив строк при чтении 200 МБ файла, объекты переживают 2 цикла сборки и переводятся в Old Space.
3. **Stop-the-World Пауза (Mark-Sweep & Compact):** Очистка Old Space требует полной остановки Event Loop. Задержки (Latency Spikes) подскакивают до 500-2000 мс. Приложение перестает отвечать на пинги Kubernetes/Docker (`/api/health`).
4. **Exit 137 (OOMKilled):** Если куча превышает лимит cgroup контейнера (например, 384 МБ в `smmplan_web`), ядро Linux принудительно убивает процесс по сигналу `SIGKILL`.

---

## 2. Антипаттерн vs Production-Grade: Чтение и парсинг файлов

### ❌ Антипаттерн (Лабораторный код):
```typescript
// ПАДЕНИЕ: Читает весь 500 МБ CSV-файл в память.
// Аллокация: 500 МБ Buffer + 500 МБ String + Массив из 2 000 000 строк = 2.5 ГБ RAM!
import fs from 'node:fs/promises';

export async function processReport(filePath: string) {
  const fileContent = await fs.readFile(filePath, 'utf-8'); // 💥 OOM на контейнере 384МБ
  const lines = fileContent.split('\n');
  const results = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const [id, amount, status] = line.split(',');
    results.push({ id, amount: Number(amount), status });
  }

  return results;
}
```

### ✅ Production-Grade (Стримы + Backpressure + O(1) RAM):
```typescript
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';

export async function processReportStream(filePath: string, onRow: (row: any) => Promise<void>) {
  // Чанки читаются строго по 64 Кб (highWaterMark). 
  // Потребление RAM фиксировано ~2-4 МБ вне зависимости от того, весит файл 10 МБ или 100 ГБ!
  const fileStream = createReadStream(filePath, { 
    highWaterMark: 64 * 1024,
    encoding: 'utf-8' 
  });

  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let processedCount = 0;

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const [id, amount, status] = trimmed.split(',');
    await onRow({ id, amount: Number(amount), status });
    processedCount++;
  }

  return { processedCount };
}
```

---

## 3. Физика Backpressure (Обратное Давление)

Когда источник данных (например, быстрый SSD или сеть 10 Гбит/с) производит данные быстрее, чем потребитель (медленная запись в базу данных или внешний API) успевает их переваривать, возникает **буферное раздувание (Buffer Bloat)**.

```
[ Источник данных: 100 МБ/с ] ───> [ Очередь в RAM: РАСТЕТ БЕСКОНЕЧНО ] ───> [ Потребитель: 2 МБ/с ]
                                                  💥 OOM
```

### Правило управления Backpressure:
Если метод `.write(chunk)` возвращает `false`, это означает, что внутренний буфер переполнен (`highWaterMark` достигнут). **Запись обязана быть приостановлена до события `'drain'`.**

```typescript
// Безопасная потоковая выгрузка в HTTP-ответ со сбросом Backpressure
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';

export async function exportOrdersToCsv(cursorStream: NodeJS.ReadableStream, responseWritable: NodeJS.WritableStream) {
  const csvTransformer = new Transform({
    objectMode: true,
    transform(order, encoding, callback) {
      const line = `${order.id},${order.amount},${order.createdAt.toISOString()}\n`;
      callback(null, line);
    }
  });

  // pipeline автоматически обрабатывает:
  // 1. Приостановку чтения при переполнении буфера записи (Backpressure)
  // 2. Уничтожение стримов при ошибке или обрыве связи клиентом (Memory Leak Prevention)
  await pipeline(
    cursorStream,
    csvTransformer,
    responseWritable
  );
}
```

---

## 4. Чеклист самоконтроля по памяти (Memory Hygiene Checklist)

1. [ ] В кодовой базе нет `fs.readFile()` для файлов, размер которых может превышать 64 КБ.
2. [ ] Все итерации по большим наборам данных из БД используют курсоры (`findMany({ cursor, take })`), а не выгружают таблицу целиком.
3. [ ] Пайплайны объединения потоков используют `stream/promises.pipeline`, а не сырой `.pipe()`.
4. [ ] В глобальных объектах отсутствуют растущие массивы или нелимитированные `new Map()`.
5. [ ] При работе с Buffer всегда явно задается кодировка или размер аллокации.
