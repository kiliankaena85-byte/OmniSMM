---
name: owasp-asvs-sentinel
description: "Используй этот скилл ВСЕГДА, когда Архитектурный скилл
  кибербезопасности, пентест-иммунитета и верификации стандартов OWASP Top
  10:2025 и OWASP ASVS v4.0.3 Level 2 для платформы OmniSMM 1.0 (SMMplan /
  SMMflux). Используй этот скилл ВСЕГДА, когда разрабатываются или
  модифицируются: аутентификация, сессии, токены, права доступа (RBAC), Server
  Actions, платежные вебхуки, Content-Security-Policy (CSP) в src/proxy.ts,
  заголовки безопасности, Rate Limiting по RFC 9331, IDOR-защита доменных
  сущностей и криптографические операции. Предотвращает утечки PII (152-ФЗ /
  GDPR), Broken Object Level Authorization, Timing Attacks на HMAC-по. НЕ
  применять для настройки визуальных анимаций Tailwind CSS."
---

# SKILL: owasp-asvs-sentinel — Пентест-иммунитет и аудит OWASP ASVS v4.0.3

## Назначение и границы (Overview & Scope)
Скилл `owasp-asvs-sentinel` обеспечивает соблюдение стандартов кибербезопасности OWASP ASVS v4.0.3 Level 2 и OWASP Top 10:2025/2026 в платформе OmniSMM.

---

> **Статус:** Обязательный стандарт кибербезопасности платформы OmniSMM 1.0 (BGS-2026 / RAC-2026).  
> **Нормативная база:** OWASP Top 10:2025 (A01-A10), OWASP ASVS v4.0.3 Level 2, PCI DSS v4.0.1 (Req 3.4, 6.4, 8.3, 10.2), RFC 9116 (security.txt), RFC 9331 (RateLimit), 152-ФЗ / GDPR.

---

## 1. Дерево решений (Decision Tree)

```mermaid
flowchart TD
    Start(["Проверка безопасности модуля / эндпоинта"]) --> CheckType{"Какой тип компонента проверяется?"}
    
    CheckType -->|"API / Server Action"| API_Check["Анализ эндпоинта / Action"]
    CheckType -->|"Платежный вебхук"| Webhook_Check["Анализ вебхука шлюза"]
    CheckType -->|"Сессии и RBAC"| Auth_Check["Анализ авторизации"]
    CheckType -->|"HTTP-заголовки / Proxy"| Header_Check["src/proxy.ts"]

    %% API Checks
    API_Check --> IDOR_Guard{"Есть проверка владения ресурсом (IDOR)?"}
    IDOR_Guard -->|"Нет"| BanIDOR["КРИТИЧЕСКИЙ ДЕФЕКТ: Добавить Guest-Proof проверку userId!"]
    IDOR_Guard -->|"Да"| Rate_Guard{"Есть Rate Limiting (RFC 9331)?"}
    Rate_Guard -->|"Нет"| AddRate["Внедрить sliding-window RateLimit через Redis"]
    Rate_Guard -->|"Да"| DTO_Guard{"Исключены ли хэши, пароли, себестоимость провайдера?"}
    DTO_Guard -->|"Нет"| StripDTO["Очистить DTO через Zod-схему (whitelisting)"]
    DTO_Guard -->|"Да"| API_Pass(["API аудит пройден"])

    %% Webhook Checks
    Webhook_Check --> FailClosed{"Проверка подписи Fail-Closed?"}
    FailClosed -->|"Нет (Fail-Open if secret...)"| BanFailOpen["ЗАПРЕТ: При отсутствии секрета возвращать 500/401!"]
    FailClosed -->|"Да"| TimingSafe{"Используется crypto.timingSafeEqual?"}
    TimingSafe -->|"Нет (=== или ==)"| FixTiming["ЗАПРЕТ: Заменить на timingSafeEqual(bufA, bufB)!"]
    TimingSafe -->|"Да"| StatusGuard{"Статусы заказов защищены от повторной перезаписи?"}
    StatusGuard -->|"Нет"| FixLifecycle["Ограничить мутации только статусами IN_PROGRESS"]
    StatusGuard -->|"Да"| Webhook_Pass(["Вебхук валидирован"])

    %% Auth Checks
    Auth_Check --> PrivilegeCheck{"Может ли сотрудник выдать права выше своих (Grant Ceiling)?"}
    PrivilegeCheck -->|"Да"| FixGrantCeiling["ЗАПРЕТ: Проверить ранг исполнителя перед мутацией ролей!"]
    PrivilegeCheck -->|"Нет"| SelfRoleCheck{"Может ли изменить роль самому себе?"}
    SelfRoleCheck -->|"Да"| BanSelfRole["ЗАПРЕТ: admin.id === targetUserId блокируется!"]
    SelfRoleCheck -->|"Нет"| Auth_Pass(["RBAC валидирован"])

    %% Header Checks
    Header_Check --> CSP_Strict{"CSP использует Nonce + strict-dynamic?"}
    CSP_Strict -->|"Содержит 'unsafe-inline' / 'unsafe-eval'"| FixCSP["Зачистить unsafe-директивы, оставить 'nonce-*'"]
    CSP_Strict -->|"Да"| SecHeaders{"Включены HSTS, no-sniff, SAMEORIGIN?"}
    SecHeaders -->|"Да"| Sec_Pass(["Заголовки валидированы"])
```

---

## 2. Жесткие инварианты безопасности (Hard Invariants)

1. **Guest-Proof IDOR Invariant:**
   * Если сущность принадлежит пользователю (`item.userId`), доступ разрешается СТРОГО при соблюдении условия:
   ```typescript
   if (item.userId && (!sessionUser || item.userId !== sessionUser.id)) {
     return { success: false, error: 'Access denied' };
   }
   ```
2. **Timing-Safe HMAC Invariant:**
   * Проверка любых подписей вебхуков (ЮKassa, Robokassa, CryptoBot, Telegram) обязана использовать строго `crypto.timingSafeEqual` с буферами одинаковой длины для защиты от Side-Channel Timing Attacks:
   ```typescript
   const a = Buffer.from(calculatedSignature, 'hex');
   const b = Buffer.from(headerSignature, 'hex');
   if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
     return new Response('Invalid signature', { status: 403 });
   }
   ```
3. **Fail-Closed Webhook Guard:**
   * Запрещены конструкции вида `if (secret && signature) { verify() }`. Если переменная секрета не задана в окружении, вебхук обязан немедленно падать с ошибкой 500 и алертом в Telegram, а не пропускать запрос.
4. **Grant Ceiling & Self-Role Protection:**
   * Ни один сотрудник платформы не может назначить роль себе (`operator.id === targetUser.id`).
   * Ни один сотрудник не может назначить права, превышающие его собственный максимальный ранг доступа.
5. **Strict-Dynamic CSP:**
   * Директива `script-src` в `src/proxy.ts` генерирует криптографический `x-nonce` (`crypto.randomUUID()`) на каждый запрос и передает его в заголовки и компоненты Next.js.

---

## 3. Чеклист верификации пентест-устойчивости

- [ ] Все входные параметры роутов и Server Actions валидируются через строгие схемы Zod (с отсечением нежелательных полей `.strip()`).
- [ ] Отсутствуют утечки приватных ключей провайдеров (`provider.apiKey`, `secretKey`, `authHash`) в клиентских DTO.
- [ ] Ошибки базы данных Prisma маскируются (клиент получает «Внутренняя ошибка сервиса», а не полный стек-трейс с именами таблиц).
- [ ] Лимиты запросов (Rate Limits) отдают заголовки `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` по RFC 9331.
- [ ] Файл `public/.well-known/security.txt` оформлен строго по стандарту RFC 9116.

---

## Пошаговый алгоритм выполнения (Step-by-step Protocol)
1. **Шаг 1:** Анализ контекста задачи и определение границ влияния.
2. **Шаг 2:** Проверка соответствия архитектурным инвариантам.
3. **Шаг 3:** Реализация изменений с соблюдением контрактов.
4. **Шаг 4:** Верификация через автоматические тесты и линтеры.
5. **Шаг 5:** Документирование и сохранение точки стабильности.

---

## Предотвращаемые антипаттерны (Gotchas / Bad vs Good)
❌ **Плохо:** Игнорирование архитектурных инвариантов ради быстрой реализации.
- ✅ **Хорошо:** Строгое соблюдение чистоты слоев и контрактов платформы.
❌ **Плохо:** Отсутствие автоматических тестов на граничные условия.
- ✅ **Хорошо:** Покрытие сценариев тестами до выкатки изменений.
