# СПЕЦИФИКАЦИЯ (CDD-TDD — RAC-2026)
# Архитектура банковского логирования, распределенного трейсинга и отказоустойчивого алертинга (Bank-Grade Logging & Observability Triad)

> **Статус:** APPROVED FOR IMPLEMENTATION (Human Approval Gate)  
> **Версия:** 1.0.0 (OmniSMM 1.0 RAC-2026)  
> **Дата:** 23.09.2026  
> **Контур:** Tier 1 (Банковский аудит, распределенный трейсинг, защита от шторма алертов, безопасность PII)  
> **Методология:** SDD (Spec-Driven Development) + TDD (Test-Driven Development)

---

## 1. Контекст и архитектурная мотивация

Платформа OmniSMM 1.0 (обслуживающая витрины SMMplan и SMMflux) обрабатывает финансовые транзакции, распределенные фоновые очереди BullMQ, взаимодействие с внешними шлюзами платежей и десятками провайдеров накрутки. 

В высоконагруженной распределенной среде отсутствие сквозного контекста и жесткого контроля алертинга создает 4 критических риска:
1. **Alert Storm & CrashLoop Amplification:** При сбое Redis или крахе сети неконтролируемый цикл перезапуска процессов (CrashLoop) отправляет тысячи однотипных алертов в Telegram/Email, вызывая блокировку ботов по Rate Limit Telegram API (429 Too Many Requests) и когнитивную слепоту дежурных инженеров.
2. **Context Loss в распределенных очередях:** При постановке задач в BullMQ теряется идентификатор трейса (`traceId`), тенант (`tenantId`) и сессионный контекст. Фоновый воркер исполняет задачу в изоляции, делая невозможным сквозной поиск логов по цепочке: `User Action -> Server Action -> BullMQ Queue -> Worker -> External Provider -> Webhook`.
3. **CWE-209 & PII Leakage в ошибках:** Сырые ошибки БД (Prisma Client, PostgreSQL), сетевых шлюзов и внешних API содержат SQL-запросы, учетные данные, системные пути (`/var/app/...` / `d:\SMM_plan_2\...`), хэши или приватные токены. Прямой вывод таких сообщений нарушает PCI DSS v4.0.1 и 152-ФЗ.
4. **Недетерминированный саппорт (Human-Centric Gap):** Клиенты при возникновении сбоя видят общее сообщение «Произошла ошибка», без уникального компактного кода обращения, что увеличивает время локализации инцидента первой линией поддержки до десятков минут.

---

## 2. Четыре архитектурных столпа (4 Pillars of Bank-Grade Observability)

### Столп 1: Forensics & Distributed Tracing (Сквозной контекст выполнения)
- **Идемпотентный TraceContext:** Каждый запрос, Server Action или фоновая задача помечается уникальным идентификатором `traceId` (формат `trc_<base36_timestamp>_<hex>`).
- **Сквозная передача через очереди (BullMQ Telemetry Bridge):** При постановке задачи в BullMQ (`queue.add`) контекст `traceId` и `tenantId` автоматически упаковывается в `job.data.metadata.traceId`.
- **Автоматическое восстановление в Worker:** При захвате джобы процессором воркера контекст восстанавливается в `AsyncLocalStorage` (`logContextStorage` и `runWithTenant`), гарантируя, что все логи воркера автоматически наследуют родительский `traceId` и `tenantId`.

### Столп 2: Zero-Drop Structured Logs (Безопасный структурированный журнал)
- **Loki/Promtail совместимый JSON:** Все логи пишутся в чистом машиночитаемом JSON с полями: `level`, `time`, `service`, `env`, `traceId`, `tenantId`, `component`, `msg`.
- **PII-01 / PII-02 Masking Filter:** Вся входящая полезная нагрузка проходит сквозной санитайзер `redactSensitiveTokens` и `sanitizeLogObject` (маскирование паролей, Bearer-токенов, API ключей провайдеров, номеров карт, email `u***@domain.com`, connection strings `postgres://...` и `redis://...`).
- **Fail-Safe Logging:** Ошибки логирования не должны ломать основной поток исполнения бизнес-логики.

### Столп 3: Actionable Alerting & Token Bucket Debouncer (Умная защита от шторма алертов)
- **Two-Tier Architecture:** Первичный слой дебаунсинга в Redis (`SET EX NX` + sliding window threshold).
- **In-Memory Token Bucket Fallback:** При недоступности, сбое соединения или падении Redis дебаунсер **НЕ ПАДАЕТ** и **НЕ ВЫЗЫВАЕТ Alert Storm**. Активируется локальный ограничитель Token Bucket с гарантированным окном тишины (Silence Window = 5 минут на инцидент).
- **Deduplication & Occurrence Tracking:** Во время действия окна тишины последующие всплески одинаковых ошибок аккумулируют счетчик `occurrences`, позволяя дежурному инженеру видеть реальный масштаб инцидента («Повторов за окно тишины: 142») без забивания канала связи.
- **Tenant-Aware Routing:** Telegram-карточки четко разделяют инциденты на ядро OmniSMM 1.0 (Core Engine), витрину SMMplan (`smmplan.pro`) и витрину SMMflux (`smmflux.ru`).

### Столп 4: Human-Centric Errors (Dual-Faced Error Architecture & REF-XXXX-YYYY)
- **User-Facing Presentation (Public Face):** Клиент видит предельно вежливое, понятное, компактное сообщение с четким действием (Retry, Switch Gateway, Contact Support) и гарантированно безопасный код обращения вида:
  ```text
  Код обращения: REF-DB01-8A2F
  ```
- **Forensic Investigation (Internal Face):** В защищенный серверный лог по коду `REF-XXXX-YYYY` пишется полный дамп: оригинальный стектрейс, сырой `Error.cause`, параметры окружения, `traceId`, `tenantId`, с отфильтрованными PII. Оператор техподдержки по коду `REF-XXXX-YYYY` за 2 секунды находит точную причину в Grafana/Loki.

---

## 3. Матрица 7 векторов инцидентов (Incident Vectors Matrix)

| № | Вектор инцидента | Источник / Триггер | Ограничитель / Защита | Public Face (`REF-XXXX-YYYY`) | Forensic Action Plan |
|---|---|---|---|---|---|
| 1 | **Database & Connection Drops** | PostgreSQL restart, pool exhaustion, Prisma statement timeout | Token Bucket per error code; Silence Window 5 min | `REF-DB01-XXXX`<br/>*«Временная задержка связи с базой данных»* | Проверить пул соединений в `docker-compose.yml`, статус контейнера `smmplan_lite_db`. |
| 2 | **Payment Gateways & Webhooks** | YooKassa / Robokassa signature mismatch, webhook drop, timeout | Critical Immediate Alert (P0); Deduplication window 2h | `REF-PAYM-XXXX`<br/>*«Шлюз оплаты временно недоступен»* | Проверить секретный ключ вебхука, сверку баланса шлюза и SSL-сертификаты. |
| 3 | **Provider Supply & SMM APIs** | Недостаточно средств у поставщика, 402, 429, таймаут шлюза | Circuit Breaker + Provider Cooldown, Debounce 2h | `REF-PROV-XXXX`<br/>*«Тариф проходит калибровку скорости»* | Пополнить лицевой счет провайдера, переключить резервный маршрут в админке. |
| 4 | **Edge & Network Proxy** | 502 Bad Gateway, разрыв Tailscale Funnel, сбой сетевого маршрута | Threshold trigger (5 сбоев / 1 мин); Silence 5 min | `REF-NETW-XXXX`<br/>*«Ошибка сетевого соединения с сервером»* | Проверить статус службы Tailscale, сетевой биндинг `0.0.0.0:3000`. |
| 5 | **BullMQ & Queue Exhaustion** | Dead Letter Queue (DLQ), исчерпание 5 попыток воркера | Financial queues = P0 Alert; Maintenance = P1 Deduplicated | `REF-SYST-XXXX`<br/>*«Заказ поставлен в безопасную очередь»* | Инспекция задачи в админке `dead-letter-queue`, запуск повторной обработки. |
| 6 | **Concurrency & ACID Integrity** | Попытка изменения `LedgerEntry`, нарушение неотрицательности баланса | Fail-Closed Transaction, Immediate P0 Security Alert | `REF-FINC-XXXX`<br/>*«Операция отклонена политикой неизменяемости»* | Аудит журналов `admin_audit_logs`, проверка инвариантов ExactMath BigInt. |
| 7 | **Auth & Security** | Брутфорс, попытка SSRF к приватным IP, подделка CSRF/сессий | Local Sliding Window Limiter (Anti-DDoS / SSRF Guard) | `REF-AUTH-XXXX`<br/>*«Запрос отклонен системой безопасности»* | Блокировка IP в RateLimit, аудит подозрительных запросов в Nginx/Proxy. |

---

## 4. Контракты компонентов и интерфейсы

### 4.1. `P0AlertDebouncer` (Token Bucket Fallback)
```typescript
export interface DebounceResult {
  shouldSend: boolean;
  occurrences: number;
  inSilenceWindow: boolean;
  usedFallback: boolean;
}

export class P0AlertDebouncer {
  // Token Bucket In-Memory Fallback: Silence Window = 300s (5 min)
  static shouldSendAlert(alertKey: string, cooldownSeconds?: number): Promise<boolean>;
  static checkThresholdTrigger(key: string, windowSeconds: number, thresholdLimit: number): Promise<{ count: number; shouldTrigger: boolean }>;
  static checkDeduplicatedAlert(alertKey: string, cooldownSeconds?: number): Promise<{ shouldSend: boolean; occurrences: number }>;
  static resetLock(alertKey: string): Promise<void>;
  static resetAllInMemory(): void;
}
```

### 4.2. `BullMQ Telemetry Bridge`
```typescript
export interface JobMetadata {
  traceId: string;
  tenantId?: string;
  enqueuedAt?: string;
  parentSpanId?: string;
}

// Queue.add wraps data with metadata: { traceId, tenantId }
// Worker automatically runs inside:
withTelemetryContext({ traceId, tenantId, component }, async () => { ... });
```

### 4.3. `DualFacedErrorSanitizer`
```typescript
export interface UserFacingError {
  refCode: string; // Формат: /^REF-[A-Z0-9]{4}-[A-Z0-9]{4}$/
  title: string;
  message: string;
  actionLabel?: string;
  actionType?: 'RETRY' | 'SWITCH_GATEWAY' | 'SUPPORT_CHAT' | 'CHOOSE_ANALOG';
}

export interface ForensicReport {
  refCode: string;
  traceId: string;
  tenantId?: string;
  category: string;
  sanitizedStack?: string;
  rawMessage: string;
  timestamp: string;
}
```

---

## 5. План верификации (TDD Acceptance Gate)
- **Unit Suite:** `src/__tests__/unit/bank-grade-logging.test.ts`
- **Проверки:**
  1. Token Bucket Fallback при offline Redis: 1-й алерт проходит, следующие 100 за 5 минут подавляются (`shouldSend === false`).
  2. Накопление счетчика `occurrences` в fallback-режиме без потерь данных.
  3. Сквозная передача `traceId` и `tenantId` через BullMQ job metadata и восстановление `AsyncLocalStorage` в воркере.
  4. Формирование кода `REF-XXXX-YYYY` и гарантированное маскирование PII/паролей в forensic-логах.
  5. Прохождение `npx tsc --noEmit` (0 ошибок).
