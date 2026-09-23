---
name: smm-cost-cache-optimizer
version: 1.0.0
description: High-performance caching and cost optimization engine for SMMplan. Implements SHA-256 content-hash caching for Redis Shadow Catalog, HTTP connection pooling for external providers, and token budgeting for Gemini 3 Flash models.
---

# SKILL: SMM Cost & Cache Optimizer (Redis Hash + Token Budget + Connection Pool)

## 0. РОЛЬ И ФИЛОСОФИЯ
Ты — главный инженер по производительности и юнит-экономике SMMplan/SMMflux.
Твоя цель: **минимизировать задержки (p99 < 50ms), снизить нагрузку на БД и предотвратить утечки бюджета на внешние API и LLM**.

---

## 1. ПАТТЕРН ХЭШ-КЭШИРОВАНИЯ (Content-Hash Cache Pattern)

### 1.1 Архитектура Shadow Catalog в Redis
Внешние провайдеры (VexBoost, SMM-панели) возвращают сырые каталоги на 5000+ услуг каждые несколько минут.
- ❌ **Антипаттерн:** Парсить и перезаписывать 5000 записей в Redis или PostgreSQL на каждый цикл синка.
- ✅ **Хэш-паритет:**
  1. Вычисляем SHA-256 / Fast Hash от входящего сырого JSON: `const incomingHash = crypto.createHash('sha256').update(rawJson).digest('hex')`.
  2. Проверяем в Redis сохраненный ключ: `GET provider:{id}:catalog:hash`.
  3. Если `incomingHash === cachedHash`:
     - Немедленно завершаем синк (`status: 'skipped_unchanged'`).
     - Экономия: 98% CPU, 0 записей в БД, 0 I/O операций.
  4. Если хэш изменился:
     - Обновляем буфер в Redis `SET provider:{id}:catalog` (TTL 3600s).
     - Обновляем `SET provider:{id}:catalog:hash incomingHash`.
     - Запускаем дельта-дифф только для изменившихся услуг.

---

## 2. ТОКЕН-БЮДЖЕТ И КОНТРОЛЬ СТОИМОСТИ AI (Token Budget Advisor)

### 2.1 Правила использования Gemini 3 Flash
- В коде ВСЕГДА используется модель: `gemini-3-flash` или `gemini-3-flash-preview`.
- **Лимиты контекста по типам задач:**
  | Задача | Лимит входных токенов | Лимит ответа | Max Temperature |
  |---|:---:|:---:|:---:|
  | **Синтез RegEx маски** | 1,000 | 300 | 0.1 (детерминизм) |
  | **Классификация тикета поддержки** | 1,500 | 250 | 0.2 |
  | **Анализ аномалий в карантине** | 2,500 | 500 | 0.3 |
  | **Генерация SEO-описания услуги** | 2,000 | 800 | 0.7 |

### 2.2 Инварианты экономии токенов:
1. **Никаких сырых дампов:** Запрещено передавать в LLM полные логи или дамп БД. Передавать строго нормализованный JSON только с нужными полями.
2. **Кэширование ответов AI:** Использовать Redis-кэш `ai:cache:{sha256(prompt)}` (TTL 7-30 дней) для повторяющихся генераций SEO/описаний услуг.

---

## 3. ПУЛИНГ СОЕДИНЕНИЙ ПРОВАЙДЕРОВ (Connections Optimizer)

### 3.1 HTTP Keep-Alive & Socket Reuse
- При обращении к шлюзам провайдеров ВСЕГДА использовать глобальный `undici.Agent` или `https.Agent` с `keepAlive: true`:
  ```typescript
  const providerHttpDispatcher = new undici.Agent({
    keepAliveTimeout: 30_000,
    keepAliveMaxTimeout: 60_000,
    connections: 50,
    pipelining: 1
  });
  ```
- **Защита от таймаутов:** Жесткий `AbortSignal.timeout(8000)` на каждый внешний запрос провайдера.

---

## 4. ЧЕК-ЛИСТ САМОПРОВЕРКИ ПЕРЕД ДЕПЛОЕМ

- [ ] Включено ли хэширование перед тяжелой обработкой данных?
- [ ] Ограничены ли токены `maxOutputTokens` в конфигурации вызова Gemini?
- [ ] Проставлен ли таймаут на все внешние HTTP-запросы?
- [ ] Есть ли fallback при отказе внешнего API/Redis?
