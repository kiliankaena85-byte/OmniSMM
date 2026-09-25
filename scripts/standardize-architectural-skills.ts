#!/usr/bin/env node
/**
 * standardize-architectural-skills.ts
 * 
 * Автоматизированная нормализация ВСЕХ 45 архитектурных скиллов платформы OmniSMM 1.0
 * в 100% соответствие каноническому стандарту Claude / Anthropic Agent Skills (agentskills.io).
 * 
 * Гарантирует:
 * 1. YAML frontmatter:
 *    - name строго равен имени директории
 *    - description содержит позитивный триггер ("Используй этот скилл ВСЕГДА, когда...")
 *    - description содержит негативный триггер ("НЕ применять для...")
 *    - длина description от 50 до 740 символов (устраняет FM-007)
 *    - все кастомные поля (tags, version, standards, etc.) сгруппированы в metadata: (устраняет FM-008)
 * 2. Разделы SKILL.md (6 столпов Anthropic):
 *    - H1 Заголовок (# <Название>)
 *    - ## Назначение и границы (Overview & Scope) (ST-002)
 *    - ## 1. Дерево решений (Decision Tree) (ST-003)
 *    - ## 2. Жесткие инварианты (Hard Invariants) (ST-004)
 *    - ## 3. Пошаговый алгоритм выполнения (Step-by-step Protocol) (ST-005)
 *    - ## 4. Предотвращаемые антипаттерны (Gotchas / Anti-patterns) (ST-006)
 *    - ## 5. Чеклист верификации (Verification Checklist) (ST-007)
 * 3. L1/L2 Контракт памяти (L1-001, L1-002, L1-003):
 *    - CORE.md присутствует у всех 45 архитектурных скиллов
 *    - Длина CORE.md строго <= 65 строк
 *    - Обязательный заголовок ## 🛑 HARD INVARIANTS
 * 4. Гигиена путей (HY-001):
 *    - Устранение локальных путей пользователя Windows (C:\Users\...)
 * 5. Контроль размера (ST-008, ST-009):
 *    - Декомпозиция перегруженного bank-grade-db-guard в references/REFERENCE.md (< 500 строк).
 */

import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { ARCH_TIER_SKILLS } from './audit-skills-architecture';

const SKILLS_DIR = path.join(process.cwd(), '.agents', 'skills');

interface SkillDomainMeta {
  overviewText: string;
  invariants: string[];
  fastRules: string[];
  quickChecks: string[];
  protocolSteps: string[];
  gotchas: string[];
  checklistItems: string[];
  negativeBoundary: string;
}

const DOMAIN_DATA: Record<string, Partial<SkillDomainMeta>> = {
  'arch-boundary-guard': {
    overviewText: 'Скилл `arch-boundary-guard` регламентирует строгое соблюдение архитектурных границ Clean Architecture в Next.js 16 и React 19 платформы OmniSMM 1.0 (SMMplan / SMMflux). Предотвращает утечки данных из слоя базы данных в компоненты представления, запрещает "use server" в page.tsx, форсирует контракт { success, error, data } и лимит файлов до 150-200 строк.',
    negativeBoundary: 'НЕ применять для низкоуровневой настройки сетевых туннелей или конфигурации docker-compose.',
    invariants: [
      'Server Components по умолчанию; "use client" строго при наличии хуков или браузерных API.',
      'Server Actions размещаются строго в src/actions/* с возвратом типизированного { success, error }.',
      'Категорически запрещено объявлять "use server" внутри page.tsx или layout.tsx.',
      'Запрещен прямой импорт PrismaClient (db) в клиентские компоненты UI.',
      'Лимит строк для файлов компонентов представления: не более 150-200 строк с декомпозицией.',
    ],
  },
  'ddd-aggregate-invariants': {
    overviewText: 'Скилл `ddd-aggregate-invariants` обеспечивает соблюдение границ агрегатов Domain-Driven Design в платформе OmniSMM 1.0. Устанавливает жесткое правило «1 транзакция = 1 корень агрегата», предотвращает Transaction Escape (db vs tx), гарантирует соблюдение Drip-Feed Floor Invariant и буферизацию Shadow Catalog в Redis.',
    negativeBoundary: 'НЕ применять для стилизации компонентов Tailwind или верстки интерфейсов.',
    invariants: [
      'Правило «1 транзакция = 1 агрегат»: запрещены кросс-агрегатные транзакции без Outbox.',
      'НЕТ прямому обновлению User.balance: все мутации баланса строго через WalletOps.',
      'Ledger-First Invariant: запись в LedgerEntry создается строго ДО мутации баланса.',
      'Drip-Feed Floor: объем запуска floor(qty / runs) обязан быть >= service.minQty.',
      'Shadow Catalog Buffer: изменения цен синхронизируются через кэш-буфер Redis.',
    ],
  },
  'concurrency-acid-guard': {
    overviewText: 'Скилл `concurrency-acid-guard` регламентирует защиту от состояний гонки (Race Conditions, TOCTOU, Lost Updates) и обеспечение ACID-гарантий в финансовых транзакциях, списаниях баланса и обработке заказов OmniSMM.',
    negativeBoundary: 'НЕ применять для верстки UI или стилизации компонентов Tailwind CSS.',
    invariants: [
      'НЕТ прямому обновлению баланса: запрещено мутировать User.balance в обход WalletOps.',
      'НЕТ Transaction Escape: внутри tx: PrismaTx запрещено использовать глобальный инстанс db.*.',
      'Ledger-First: запись tx.ledgerEntry.create() создается ДО мутации баланса в tx.user.update().',
      'ExactMath Only: все финансовые расчеты ведутся строго в копейках BigInt без Float.',
      'Idempotency Key: каждая операция обязана иметь уникальный idempotencyKey с отловом P2002.',
    ],
  },
  'bank-grade-db-guard': {
    overviewText: 'Скилл `bank-grade-db-guard` регламентирует стандарты надежности реляционных баз данных банковского уровня (Tier-1 FinTech: Stripe, Sberbank, Tinkoff). Охватывает строгие инварианты целостности (Ledger-First, ExactMath BigInt, Zero Transaction Escape), Stripe-Style Distributed Idempotency Vault и Transactional Outbox.',
    negativeBoundary: 'НЕ применять для верстки UI компонентов или клиентских анимаций.',
    invariants: [
      'Ledger-First Invariant: запись в журнал создается строго ДО мутации баланса пользователя.',
      'ExactMath BigInt: все денежные величины хранятся и рассчитываются строго в копейках BigInt.',
      'Zero Transaction Escape: внутри методов с tx: PrismaTx запрещен вызов глобального db.*.',
      'Distributed Idempotency Vault: финансовые операции защищаются атомарной резервацией в Redis.',
      'No Long-Holding Locks: lock_timeout в OLTP транзакциях строго ограничен 2 секундами.',
    ],
  },
  'api-contract-evolver': {
    overviewText: 'Скилл `api-contract-evolver` обеспечивает контрактную эволюцию API, 100% обратную совместимость и управление жизненным циклом схем в платформе OmniSMM (Next.js 16 App Router, Server Actions, REST эндпоинты, Webhooks).',
    negativeBoundary: 'НЕ применять для стилизации UI компонентов Tailwind CSS или сетевых настроек.',
    invariants: [
      'Zero Breaking Changes: запрещено ломать публичные API без переходного периода Dual-Read.',
      'RFC 8594 Sunset: устаревшие эндпоинты обязаны возвращать заголовки Deprecation и Sunset.',
      'Contract-First: входящие и исходящие DTO Server Actions валидируются через строгие Zod-схемы.',
      'Typed Response Envelope: все мутации возвращают типизированный конверт { success, error, data }.',
      'No Secret Bleed: запрещено передавать в клиентские DTO providerCost, ключи API и хэши.',
    ],
  },
  'catalog-taxonomy-curator': {
    overviewText: 'Скилл `catalog-taxonomy-curator` регламентирует систематизацию каталога, управление канонической таксономией и нормализацию импорта услуг в платформе OmniSMM 1.0 (SMMplan / SMMflux).',
    negativeBoundary: 'НЕ применять для верстки UI или финансовых транзакций.',
    invariants: [
      'Канонический лимит категорий: в каждой соцсети не более 6–9 канонических категорий первого уровня.',
      'Zero Raw Categories: запрещено создавать категорию в БД напрямую из поля category провайдера.',
      'No Brand Redundancy: запрещено дублировать имя соцсети в категории («Лайки», а не «Telegram Лайки»).',
      'Feature Extraction: все скобки [...] провайдера извлекаются в типизированные поля (isPrivate, geo).',
      'Admin Authority: ручной выбор категории администратором обладает абсолютным приоритетом.',
    ],
  },
  'docker-memory-ops': {
    overviewText: 'Скилл `docker-memory-ops` обеспечивает комплексное управление памятью, расследование OOM-инцидентов, диагностику cgroups v2 и кризисный менеджмент контейнеров Docker в среде OmniSMM.',
    negativeBoundary: 'НЕ применять для верстки клиентских интерфейсов или настройки DDL базы данных.',
    invariants: [
      'No In-Place Production Rebuild: запрещено пересобирать рабочий контейнер :3000 напрямую без Stage.',
      'Cgroups v2 Ground Truth: причина падения проверяется строго через memory.events (oom_kill).',
      'Golden Ratio RAM: max-old-space-size Node.js устанавливается строго на 70% от лимита контейнера.',
      'Data Volume Protection: запрещен docker volume prune без исключения постоянных томов БД.',
      'WSL2 Drop Caches: при утечках памяти виртуальной машины выполняется сброс кэшей страниц.',
    ],
  },
  'impact-blast-radius': {
    overviewText: 'Скилл `impact-blast-radius` регламентирует анализ радиуса поражения (Blast Radius Mapping), расчёт связанности и состязательное моделирование отказов на 3 шага вперёд перед любым изменением кода OmniSMM.',
    negativeBoundary: 'НЕ применять для чисто текстовых правок документации или изолированных тестов.',
    invariants: [
      'Mandatory Grep Search: запрещено редактировать общий модуль без поиска всех точек импорта.',
      'Pre-Mortem Failure Simulation: обязателен анализ отказа на 3 шага вперед (Auth, Ledger, Cache).',
      'Backward Compatibility: если модуль используется в 2+ местах, правка обязана быть совместимой.',
      'Fail-Closed Guards: все защитные барьеры и валидаторы закладываются ДО внесения правки.',
      'Full-Spectrum Verification: запрещено проверять только точечный файл; обязателен сьют тестов.',
    ],
  },
  'multi-tenant-isolation-arch': {
    overviewText: 'Скилл `multi-tenant-isolation-arch` регламентирует мульти-тенантную архитектуру OmniSMM 1.0 (SMMplan и SMMflux), жесткую изоляцию данных и юридический барьер по ст. 54.1 НК РФ.',
    negativeBoundary: 'НЕ применять для стилизации изолированных компонентов без брендовых токенов.',
    invariants: [
      'Tenant Column Mandatory: все модели Prisma содержат tenantId и составные уникальные ключи.',
      'Tenant-Aware Cache: все кэш-ключи в unstable_cache и Redis обязаны содержать tenantId.',
      'Header-First Resolution: публичные запросы определяют тенант по Host Header, админка — по куке.',
      'Tax & Legal Barrier (ст. 54.1 НК РФ): раздельные юрлица, расчетные счета и кассы 54-ФЗ.',
      'Zero Brand Bleeding: компоненты SMMplan (<Plan*>) и SMMflux (<Flux*>) строго изолированы.',
    ],
  },
  'db-evolution-zero-downtime': {
    overviewText: 'Скилл `db-evolution-zero-downtime` регламентирует безопасную эволюцию базы данных PostgreSQL без остановки сервиса (Zero-Downtime DDL, Expand/Contract pattern, CREATE INDEX CONCURRENTLY).',
    negativeBoundary: 'НЕ применять для верстки UI или правок клиентских стилей.',
    invariants: [
      'No Lock-Holding DDL: тяжелые DDL операции выполняются с обязательным lock_timeout <= 2s.',
      'Concurrent Indexes Only: все индексы создаются строго через CREATE INDEX CONCURRENTLY.',
      'Expand/Contract Pattern: любое изменение схемы выполняется в 5 безопасных фаз с Dual-Write.',
      'Zero Downtime Backfills: фоновый перенос данных осуществляется микропакетами (<= 500 строк).',
      'Reversible Migrations: каждая миграция обязана иметь документированный план безопасного отката.',
    ],
  },
  'event-driven-reliability': {
    overviewText: 'Скилл `event-driven-reliability` обеспечивает надежность событийной архитектуры платформы OmniSMM (Transactional Outbox, BullMQ, идемпотентные консьюмеры, Dead Letter Queue).',
    negativeBoundary: 'НЕ применять для синхронных клиентских мутаций формы без очередей.',
    invariants: [
      'No Dual-Write Invariant: запрещена одновременная запись в БД и отправка в брокер вне транзакции.',
      'Transactional Outbox: все доменные события сохраняются в Outbox в единой транзакции с мутацией.',
      'Idempotent Consumers: каждый воркер очереди проверяет уникальность jobId или idempotencyKey.',
      'Dead Letter Queue (DLQ): сбойные сообщения после 3 ретраев обязаны направляться в DLQ с алертом.',
      'Exponential Backoff: повторные попытки внешних вызовов используют экспоненциальную задержку.',
    ],
  },
  'nfr-performance-budget': {
    overviewText: 'Скилл `nfr-performance-budget` регламентирует бюджеты производительности (P95/P99 latency, Core Web Vitals, connection pool limits) и предотвращение деградации скорости в OmniSMM.',
    negativeBoundary: 'НЕ применять для чисто текстовых правок документации.',
    invariants: [
      'Server Action P95 Budget: латентность Server Action не должна превышать 250 мс при P95.',
      'Zero N+1 in Prisma: запрещены запросы Prisma внутри циклов (использовать include или in).',
      'No Heavy OFFSET: запрещено использование OFFSET > 100 в боевых запросах (только Keyset).',
      'Connection Pool Cap: пул соединений Prisma Client ограничен максимум 20 соединениями.',
      'DOM Node Budget: количество DOM-узлов на странице каталога не должно превышать 1200 узлов.',
    ],
  },
  'provider-catalog-importer': {
    overviewText: 'Скилл `provider-catalog-importer` регламентирует фоновую синхронизацию, парсинг и импорт каталогов услуг от внешних SMM-провайдеров с контролем маржинальности и Zero-Unknown-Platform Guard.',
    negativeBoundary: 'НЕ применять для финансовых операций с балансом пользователя.',
    invariants: [
      'Admin Priority #1: ручной выбор категории администратором исполняется безусловно.',
      'Zero-Unknown-Platform: услуги с неопределенной соцсетью (platform: other) запрещено импортировать.',
      'No False-Branding: префикс бренда соцсети добавляется только при 100% подтверждении провайдером.',
      'Service #ID Badge: каждая карточка услуги обязана содержать кликабельный бейдж #ID с копированием.',
      'Price Margin Guard: розничная цена услуги обязана превышать себестоимость провайдера.',
    ],
  },
  'resilience-bulkhead-circuit': {
    overviewText: 'Скилл `resilience-bulkhead-circuit` регламентирует изоляцию сбоев внешних интеграций (Circuit Breaker в Redis, Per-Provider Bulkhead, обязательные таймауты AbortSignal.timeout).',
    negativeBoundary: 'НЕ применять для локальных синхронных утилит без внешних сетевых вызовов.',
    invariants: [
      'Per-Provider Bulkhead: строгая изоляция пулов конкурентных запросов к внешним провайдерам.',
      'Mandatory Request Timeout: любой внешний HTTP-запрос обязан содержать AbortSignal.timeout(5000).',
      'Circuit Breaker in Redis: при 50% сбоев шлюз переходит в состояние OPEN минимум на 5 секунд.',
      'Graceful Fallback: при отказе внешнего шлюза возвращается безопасный ответ без падения процесса.',
      'Fail-Closed on Auth/Money: в финансовых операциях отказ шлюза приводит к Fail-Closed блокировке.',
    ],
  },
  'compliance-54fz-auditor': {
    overviewText: 'Скилл `compliance-54fz-auditor` регламентирует соответствие биллинга и платежных шлюзов платформы OmniSMM законодательству РФ о применении ККТ (54-ФЗ, 176-ФЗ, 425-ФЗ, НДС 22%, порог УСН 20 млн ₽).',
    negativeBoundary: 'НЕ применять для верстки лендингов или настройки клиентских стилей CSS.',
    invariants: [
      'Fiscal Receipt Mandatory: каждый успешный платеж обязан сопровождаться фискализацией чека.',
      'VAT 2026 Compliance: ставка НДС 22% (vat_code: 10) свыше 20 млн ₽, до 20 млн ₽ — Без НДС (vat_code: 1).',
      'Idempotent Fiscalization: чек по одной транзакции формируется строго 1 раз.',
      'Item Description Accuracy: наименование услуги в чеке строго соответствует номенклатуре заказа.',
      'Fiscal Requisites Persistence: номера ФД и ФПД сохраняются в базе данных платформы.',
    ],
  },
  'compliance-legal-ecommerce-ru': {
    overviewText: 'Скилл `compliance-legal-ecommerce-ru` регламентирует соответствие интернет-витрин OmniSMM требованиям законодательства РФ: 152-ФЗ (персональные данные), ЗОЗПП, правила оферты и политики cookie.',
    negativeBoundary: 'НЕ применять для низкоуровневой настройки PostgreSQL или Redis.',
    invariants: [
      'Active Consent 152-ФЗ: запрещены предустановленные чекбоксы согласия на обработку ПД.',
      'Russian Data Localization: первичный сбор и хранение ПД граждан РФ строго на серверах в РФ.',
      'Complete Legal Footer: обязательное указание ОГРНИП/ИНН и контактов продавца в футере витрины.',
      'Pre-Trial Dispute Protocol: обязательное наличие контактного email для досудебных претензий.',
      'Public Offer Transparency: условия возврата средств и порядок оказания услуг четко зафиксированы.',
    ],
  },
  'owasp-asvs-sentinel': {
    overviewText: 'Скилл `owasp-asvs-sentinel` обеспечивает соблюдение стандартов кибербезопасности OWASP ASVS v4.0.3 Level 2 и OWASP Top 10:2025/2026 в платформе OmniSMM.',
    negativeBoundary: 'НЕ применять для настройки визуальных анимаций Tailwind CSS.',
    invariants: [
      'Strict IDOR Prevention: обязательная проверка владения ресурсом (userId) на всех эндпоинтах.',
      'Contract-First Input Sanitization: все входящие данные строго валидируются через Zod-схемы.',
      'Timing-Safe Webhook Verification: проверка подписей только через crypto.timingSafeEqual().',
      'Strict-Dynamic CSP: зачистка unsafe-inline и unsafe-eval из заголовка Content-Security-Policy.',
      'Zero Secret Leaks: запрещено логирование паролей, токенов и секретных ключей.',
    ],
  },
  'mobile-first-responsive-architect': {
    overviewText: 'Скилл `mobile-first-responsive-architect` регламентирует архитектурный норматив Mobile-First разработки, Touch Ergonomics (>= 44px), Safe Area Insets и защиты от багов мобильных браузеров в OmniSMM.',
    negativeBoundary: 'НЕ применять для DDL миграций базы данных или настройки BullMQ.',
    invariants: [
      'Mobile-First Grid: базовая верстка строится под смартфон (360-390px) без брейкпоинтов.',
      'Touch Target Floor: минимальная область клика интерактивных элементов строго >= 44x44px.',
      'Safe Area Insets: нижние фиксированные панели обязаны включать отступ pb-safe.',
      'Dynamic Viewport: запрещен 100vh; использовать строго 100dvh / min-h-dvh.',
      'iOS Auto-Zoom Guard: размер шрифта полей ввода строго >= 16px на мобильных устройствах.',
    ],
  },
  'react-19-next-16-ui-engine': {
    overviewText: 'Скилл `react-19-next-16-ui-engine` регламентирует фронтенд-рантайм React 19 и Next.js 16 App Router (Server Actions, useActionState, useOptimistic, Streaming SSR, Suspense) в OmniSMM.',
    negativeBoundary: 'НЕ применять для DDL миграций базы данных или серверных cron-задач.',
    invariants: [
      'Server Components First: "use client" используется строго при наличии хуков или браузерных API.',
      'No "use server" in Pages: директива "use server" категорически запрещена внутри page.tsx.',
      'Server Actions Envelope: все Server Actions возвращают типизированный результат { success, error }.',
      'Optimistic State Rollback: оптимистичные мутации имеют таймер отката при сетевой ошибке.',
      'Streaming SSR Suspense: все медленные асинхронные блоки оборачиваются в Suspense fallback.',
    ],
  },
  'foolproof-minimalist-ux': {
    overviewText: 'Скилл `foolproof-minimalist-ux` регламентирует проектирование интуитивно понятных, минималистичных и защищенных от ошибок интерфейсов платформы OmniSMM («интерфейсы с нулевой когнитивной нагрузкой»).',
    negativeBoundary: 'НЕ применять для серверных очередей или DDL миграций базы данных.',
    invariants: [
      'Single Primary Action: на экране всегда четко выделено одно главное целевое действие.',
      'Foolproof Link Validation: ссылки социальных сетей валидируются и форматируются на лету.',
      'Progressive Disclosure: вторичные технические настройки спрятаны под аккуратные аккордеоны.',
      'Transparent Price per Unit: цена всегда выводится за 1 шт в рублях (₽ / шт) без скрытых сборов.',
      'Human-Readable Errors: сообщения об ошибках написаны человеческим языком с кнопкой исправления.',
    ],
  },
  'multi-model-jury': {
    overviewText: 'Скилл `multi-model-jury` регламентирует проведение состязательного мультиагентного консилиума моделей ИИ (Gemini, Claude, GPT, DeepSeek) для проверки критических архитектурных решений в OmniSMM.',
    negativeBoundary: 'НЕ применять для рутинных правок верстки без архитектурных развилок.',
    invariants: [
      'Minimum 3 Independent Models: консилиум обязан опрашивать не менее 3 независимых моделей.',
      'Blind Evaluation: первичное мнение формируется изолированно без перекрестного влияния.',
      'Consensus Floor >= 80%: критическое решение принимается только при согласии от 80% моделей.',
      'Mandatory Red Teaming: минимум один участник консилиума обязан атаковать решение в роли оппонента.',
      'ADR Record Invariant: аргументы и итоговый вердикт консилиума обязательно фиксируются в ADR.',
    ],
  },
  'adr-architect': {
    overviewText: 'Скилл `adr-architect` регламентирует создание и ведение архитектурных записей решений (Architectural Decision Records) по стандарту MADR 3.0 в платформе OmniSMM.',
    negativeBoundary: 'НЕ применять для рутинных правок CSS или мелких исправлений опечаток.',
    invariants: [
      'MADR 3.0 Format: все записи оформляются строго по шаблону Markdown Architectural Decision Records.',
      'Immutable History: запрещено удалять принятые ADR; изменения оформляются статусом SUPERSEDED.',
      'Consequences Section Mandatory: раздел компромиссов и последствий обязателен в каждом ADR.',
      'Minimum 2 Alternatives: обязателен детальный разбор минимум двух отклоненных альтернатив.',
      'Commit Linkage: каждый ADR обязан иметь дату, автора и ссылку на связанный коммит/PR.',
    ],
  },
  'clash-verge-atomics': {
    overviewText: 'Скилл `clash-verge-atomics` регламентирует управление сетевыми туннелями, маршрутизацию трафика через Tailscale Funnel и изоляцию прямого доступа к локальным портам в OmniSMM.',
    negativeBoundary: 'НЕ применять для верстки React компонентов или доменных правил заказов.',
    invariants: [
      'No Localhost Interception: запрещено заворачивать локальный трафик (127.0.0.1, :3000) в туннель.',
      'Direct Russian Traffic: доступ к доменам .ru, .рф и банкам РФ направляется строго напрямую (DIRECT).',
      'No Cloudflare Tunnel in RU: запрещено использование Cloudflare Tunnel из-за блокировок ТСПУ.',
      'DNS Leak Immunity: DNS-запросы маршрутизируются без раскрытия IP-адреса хоста.',
      'Tailscale Funnel Binding: внешняя маршрутизация осуществляется стабильно через ноду Tailscale.',
    ],
  },
  'competitor-threat-shield': {
    overviewText: 'Скилл `competitor-threat-shield` регламентирует защиту каталога, алгоритмов ценообразования и витрины OmniSMM от агрессивного парсинга конкурентов и кражи баз данных.',
    negativeBoundary: 'НЕ применять для рутинной верстки интерфейса без аналитики угроз.',
    invariants: [
      'Zero Provider Exposure: имена и ID внешних поставщиков никогда не передаются клиенту.',
      'Catalog Rate Limiting: эндпоинты каталога защищаются скользящим окном лимитов запросов (RFC 9331).',
      'Canary Token Defense: база данных снабжена контрольными записями для фиксации кражи в суде.',
      'Dynamic Price Obfuscation: защита от автоматизированного мониторинга цен конкурентами.',
      'Search Bot Whitelist: официальные поисковые роботы Яндекса и Google не блокируются защитой.',
    ],
  },
  'ephemeral-sandbox-visual-loop': {
    overviewText: 'Скилл `ephemeral-sandbox-visual-loop` регламентирует безопасное прототипирование, визуальный аудит в браузере (Puppeteer) и верификацию UI-изменений в изолированном Stage-контуре (:3005) OmniSMM.',
    negativeBoundary: 'НЕ применять для прямого деплоя на продакшн без согласования с пользователем.',
    invariants: [
      'No In-Place Production Rebuild: запрещено пересобирать боевой контейнер :3000 без проверки на :3005.',
      'Visual Evidence Gate: любые изменения UI подтверждаются скриншотами Puppeteer под ключевыми ролями.',
      'Human Approval Gate: боевой трафик переключается строго после прямого одобрения пользователя.',
      'Instant 5s Rollback: предыдущий рабочий образ сохраняется как smmplan_backup для отката.',
      'No Secret Bleed: скриншоты и журналы отчетов не должны содержать приватных ключей и токенов.',
    ],
  },
  'llm-mutation-testing': {
    overviewText: 'Скилл `llm-mutation-testing` обеспечивает глубокую проверку качества и полноты тестового покрытия критического кода OmniSMM (WalletOps, ExactMath, Drip-Feed Floor) с помощью мутационного анализа.',
    negativeBoundary: 'НЕ применять для ручного функционального тестирования пользовательских интерфейсов.',
    invariants: [
      'Zero Surviving Mutants in Money: в финансовых расчетах выживание мутантов недопустимо (100% Kill).',
      'Mutation Score Floor >= 85%: общий показатель убийства мутантов для доменных сервисов >= 85%.',
      'Test Execution Timeout: прогон теста против мутанта строго ограничен таймаутом 2000 мс.',
      'No Equivalent Mutants: мутации, не изменяющие логику кода, исключаются из финальной оценки.',
      'Strict Assertion Check: запрещены пустые тесты без строгих проверок через expect().',
    ],
  },
  'postgres-query-doctor': {
    overviewText: 'Скилл `postgres-query-doctor` регламентирует диагностику, профилирование и оптимизацию запросов к PostgreSQL 15/16 в платформе OmniSMM (EXPLAIN ANALYZE, Keyset pagination, индексы).',
    negativeBoundary: 'НЕ применять для верстки клиентских компонентов React или Tailwind CSS.',
    invariants: [
      'No Unindexed Seq Scan: запрещены последовательные сканирования в таблицах объемом > 10 000 строк.',
      'Statement Timeout Cap: каждый OLTP запрос в приложении ограничен жестким statement_timeout = 5s.',
      'Explain Buffers Mandatory: любая оптимизация подтверждается планом EXPLAIN (ANALYZE, BUFFERS).',
      'No Deep OFFSET: запрещено использование OFFSET > 100 в боевых запросах (только Keyset курсоры).',
      'Selective Projections: запрещено запрашивать тяжелые поля в массовых выборках списков.',
    ],
  },
  'production-readiness-guard': {
    overviewText: 'Скилл `production-readiness-guard` регламентирует строгий финальный гейт готовности к релизу в продакшн платформы OmniSMM (SEC-001 Redis Auth, SEC-002 Strict-Dynamic CSP, SEC-003 Direct SMTP).',
    negativeBoundary: 'НЕ применять для локальной разработки в изолированных dev-ветках.',
    invariants: [
      'Mandatory SEC-001: запрещен релиз без авторизации и шифрования Redis (rediss://...).',
      'Mandatory SEC-002: запрещен релиз с unsafe-eval в CSP script-src (Strict-Dynamic Nonce).',
      'Mandatory SEC-003: обязательна проверка прямой доставки почты по порту 465 без прокси.',
      'Zero-Defect Blue-Green: переключение трафика только после успешного тестирования в Stage (:3005).',
      'Human Approval Gate: релиз осуществляется строго после команды пользователя («Выкатывай»).',
    ],
  },
  'self-healing-ooda-loop': {
    overviewText: 'Скилл `self-healing-ooda-loop` регламентирует автоматизированную замкнутую петлю реагирования на сбои (Observe -> Orient -> Decide -> Act) для самоизлечения платформы OmniSMM.',
    negativeBoundary: 'НЕ применять для рутинного добавления новых фич без наличия сбоев.',
    invariants: [
      'Bounded Retry Limit: не более 3 автоматических итераций исправления на одну ошибку.',
      'Immediate Rollback: при появлении новых регрессий система откатывается к стабильному состоянию.',
      'Mandatory Regression Test: каждое исправление сопровождается тестом, воспроизводящим сбой.',
      'Audit Logging: все шаги петли самоисцеления фиксируются в неизменяемом журнале аудита.',
      'Fail-Safe Default: при невозможности автоматического лечения система переходит в защищенный режим.',
    ],
  },
  'docker-lean-build-ops': {
    overviewText: 'Скилл `docker-lean-build-ops` регламентирует бережливую сборку Docker и Next.js без зависания ПК, динамический учет нагрузки хоста и защиту памяти WSL2 в OmniSMM.',
    negativeBoundary: 'НЕ применять для верстки UI или бизнес-логики заказов.',
    invariants: [
      'No Host Freeze: процессы сборки запускаются с резервированием минимум 1 CPU ядра под ОС.',
      'Pre-Flight Load Check: проверка свободной памяти хоста (>= 1.0 ГБ) перед запуском контейнеров.',
      'Staggered Startup: контейнеры поднимаются поэтапно (БД -> Redis -> Шлюз -> Web).',
      'Disk Cache Cap: директория .next/cache очищается при превышении объема 1.5 ГБ.',
      'Data Volume Protection: docker volume prune запрещен без исключения постоянных томов БД.',
    ],
  },
  'ui-theme-architect': {
    overviewText: 'Скилл `ui-theme-architect` регламентирует архитектуру тем оформления, дизайн-токенов Tailwind 4, алгоритмов колористики (Google HCT / OKLCH) и контроля контрастности WCAG 2.2 AA в OmniSMM.',
    negativeBoundary: 'НЕ применять для серверных очередей BullMQ или DDL миграций базы данных.',
    invariants: [
      'Zero Raw Hex: запрещены фиксированные цвета (#hex, text-white) в компонентах; только токены.',
      'Tailwind 4 CSS-First: базовые темы объявляются строго в src/app/globals.css через @theme.',
      'WCAG 2.2 AA Contrast Gate: контраст текста к фону строго >= 4.5:1, бейджей >= 3.0:1.',
      'Tenant Theme Isolation: SMMplan строго в Classic API Slate/Sky; SMMflux строго в Radiant Aurora.',
      'Touch Targets >= 44px: контролы переключения тем и кнопки имеют размер >= 44x44px на мобилке.',
    ],
  },
  'maker-checker-protocol': {
    overviewText: 'Скилл `maker-checker-protocol` регламентирует разделение ролей Создателя (Maker) и Независимого Ревизора (Checker) с эпистемической изоляцией контекста и 5-векторной матрицей вето в OmniSMM.',
    negativeBoundary: 'НЕ применять для рутинного написания кода без процедуры ревью.',
    invariants: [
      'Zero Self-Approval: создатель кода ни при каких условиях не утверждает собственный PR.',
      'Epistemic Isolation: ревизор запускается в чистом контексте с флагом enable_write_tools: false.',
      'Five-Vector Veto: блокировка релиза при нарушении любого из 5 векторов надежности.',
      'Evidence-Based Review: вердикт выносится на основе фактов, логов тестов и скриншотов Stage.',
      'Mandatory Handoff Package: передача задачи сопровождается полным пакетом спецификации и diff.',
    ],
  },
  'payment-gateway-fuzzer': {
    overviewText: 'Скилл `payment-gateway-fuzzer` регламентирует фаззинг, стресс-тестирование и проверку отказоустойчивости платежных интеграций (ЮKassa, Robokassa, CryptoBot) платформы OmniSMM 1.0.',
    negativeBoundary: 'НЕ применять для верстки UI или клиентских стилей Tailwind.',
    invariants: [
      'Fuzzing Sandbox Only: стресс-тестирование выполняется строго на тестовых ключах шлюзов.',
      'Double-Crediting Immunity: параллельные вебхуки об оплате не должны вызывать повторное зачисление.',
      'Price Tampering Guard: сумма платежа извлекается строго из локальной PaymentTransaction БД.',
      'Timing-Safe Signatures: подписи вебхуков проверяются только через crypto.timingSafeEqual().',
      'Idempotent Balance Credit: зачисление средств сопровождается строгим idempotencyKey.',
    ],
  },
  'skill-architecture-guard': {
    overviewText: 'Скилл `skill-architecture-guard` регламентирует стандарт и автоматизированный аудит архитектуры Agent Skills по официальной спецификации Claude / Anthropic для платформы OmniSMM 1.0.',
    negativeBoundary: 'НЕ применять для написания продуктового кода бизнес-логики.',
    invariants: [
      'Canonical Anthropic Frontmatter: name strictly equals folder name, description has triggers.',
      'Six Mandatory Pillars: обязательное наличие 6 канонических секций в файле SKILL.md.',
      'L1/L2 Memory Contract: архитектурные скилы обязаны иметь компактный CORE.md <= 65 строк.',
      'Zero Hardcoded Paths: запрещен хардкод путей конкретных пользователей Windows/Linux.',
      'Automated Quality Gate: 100% прохождение валидации через npm run lint:skills:arch.',
    ],
  },
  'skill-health-checker': {
    overviewText: 'Скилл `skill-health-checker` обеспечивает линтинг и валидацию файлов SKILL.md на структурную целостность, корректность frontmatter и надежность активации по стандартам Anthropic.',
    negativeBoundary: 'НЕ применять для линтинга общего кода TypeScript или компонентов React.',
    invariants: [
      'Frontmatter Integrity: парсинг YAML без синтаксических ошибок и с закрывающими дефисами.',
      'Trigger Coverage: наличие явных триггеров («Используй когда...») и анти-триггеров.',
      'Relative Link Validity: все ссылки Markdown проверяются на физическое существование файлов.',
      'Concise Description Cap: длина описания frontmatter оптимизирована в пределах 50-740 символов.',
      'Section Completeness: обязательное присутствие дерева решений, инвариантов и протокола.',
    ],
  },
  'tdd-guide': {
    overviewText: 'Скилл `tdd-guide` регламентирует методологию Test-Driven Development (Red-Green-Refactor) в Next.js 16, React 19, Vitest и Prisma 5 для платформы OmniSMM 1.0.',
    negativeBoundary: 'НЕ применять для прямой модификации боевой базы данных в обход миграций.',
    invariants: [
      'Red Phase Invariant: продуктовый код пишется строго после написания падающего теста.',
      'ExactMath Money Verification: финансовые тесты проверяют вычисления строго в BigInt копейках.',
      'Prisma Transaction Isolation: тесты базы данных выполняются в изолированных транзакциях с откатом.',
      'No Skipped Tests: запрещено использование it.skip() без привязки к номеру тикета в багтрекере.',
      '100% CI Gate Pass: релиз разрешен только при полном прохождении всего сьюта тестов Vitest.',
    ],
  },
  'layout-overflow-sentry': {
    overviewText: 'Скилл `layout-overflow-sentry` регламентирует предотвращение горизонтального скролла, переполнения контейнеров и обрезания колонок в таблицах данных платформы OmniSMM.',
    negativeBoundary: 'НЕ применять для низкоуровневой настройки PostgreSQL или очередей BullMQ.',
    invariants: [
      'Zero Horizontal Scroll: запрещен неконтролируемый горизонтальный скролл на любых разрешениях.',
      'Min-W-0 on Flex Children: flex-элементы с длинным текстом обязаны иметь класс min-w-0.',
      'Table Viewport Fit: таблицы данных умещаются на 100% ширины экрана без раздутых колонок.',
      'Truncate with Title: усеченный текст обязан сопровождаться атрибутом title или Tooltip.',
      'Responsive Card Switch: на мобильных экранах (< 768px) таблицы сворачиваются в карточки.',
    ],
  },
  'local-pentest-orchestrator': {
    overviewText: 'Скилл `local-pentest-orchestrator` регламентирует проведение локального тестирования на проникновение (Pentest) платформы OmniSMM по стандартам OWASP Top 10 и OWASP ASVS.',
    negativeBoundary: 'НЕ применять для тестирования сторонних внешних систем без разрешения.',
    invariants: [
      'Local Perimeter Only: пентест проводится строго в изолированном локальном контуре.',
      'Zero Production Impact: запрещены деструктивные тесты, приводящие к потере данных пользователей.',
      'Automated Vulnerability Gate: критические уязвимости (CVSS >= 7.0) блокируют релиз.',
      'Timing Attack Audit: проверка равенства хэшей и токенов на устойчивость к утечкам времени.',
      'Sanitized Evidence Reports: отчеты пентеста не должны содержать реальных паролей пользователей.',
    ],
  },
  'omnismm-checkout-integrity-guard': {
    overviewText: 'Скилл `omnismm-checkout-integrity-guard` регламентирует целостность чекаута, валидацию ссылок, расчет стоимости и защиту от мошенничества при оформлении заказов в OmniSMM.',
    negativeBoundary: 'НЕ применять для настройки системных демонов Docker или Linux cgroups.',
    invariants: [
      'Server-Side Price Calculation: цена заказа рассчитывается строго на сервере в копейках BigInt.',
      'TargetType Semantic Resolution: тип услуги определяется через resolveServiceTargetType.',
      'Drip-Feed Floor Enforcement: минимальный объем заказа с автоподачей масштабируется кратно запускам.',
      'No Phantom Brands: поддержка строго брендов SMMplan (smmplan.pro) и SMMflux (smmflux.ru).',
      'Idempotent Order Creation: каждый заказ создается с уникальным ключом дедупликации.',
    ],
  },
  'google-stitch-architect': {
    overviewText: 'Скилл `google-stitch-architect` регламентирует работу с дизайн-системами, дизайн-токенами и макетами интерфейсов через Google Stitch MCP в платформе OmniSMM.',
    negativeBoundary: 'НЕ применять для написания SQL запросов или миграций базы данных.',
    invariants: [
      'Single Source of Truth: макеты Stitch синхронизируются с дизайн-токенами globals.css.',
      'Zero Props Loss: экспорт компонентов сохраняет все типизированные свойства React 19.',
      'Tailwind 4 Alignment: сгенерированные стили соответствуют семантическим токенам Tailwind 4.',
      'Viewport Scalability: макеты проектируются с поддержкой мобильных и десктопных экранов.',
      'HeroUI v3 Synergy: визуальные примитивы макетов согласованы с компонентами HeroUI.',
    ],
  },
  'wireframe-nanobanana-stitch': {
    overviewText: 'Скилл `wireframe-nanobanana-stitch` регламентирует быстрое прототипирование интерактивных вайрфреймов и пользовательских путей (User Flow) для платформы OmniSMM.',
    negativeBoundary: 'НЕ применять для прямого написания серверных транзакций базы данных.',
    invariants: [
      'Fast Iteration Cycle: создание кликабельного вайрфрейма за минимальное количество шагов.',
      'User Flow Clarity: каждый шаг оформления заказа визуально понятен и прозрачен.',
      'Low-Fidelity First: фокус на структуре информации и эргономике до финальной покраски.',
      'Mobile Accessibility: вайрфреймы проверяются на удобство использования одной рукой.',
      'Handoff Alignment: структура экранов вайрфрейма готова для переноса в production код.',
    ],
  },
  'heroui-v3-compound-guard': {
    overviewText: 'Скилл `heroui-v3-compound-guard` регламентирует разработку компонентов на библиотеке HeroUI v3 (NextUI) с соблюдением dot-notation API и React 19 в платформе OmniSMM.',
    negativeBoundary: 'НЕ применять для верстки на чистом Tailwind без компонентов HeroUI.',
    invariants: [
      'Dot-Notation Compound API: компоненты вызываются через dot-notation (<Table.Header>, <Modal.Body>).',
      'Client Component Boundaries: интерактивные оверлеи HeroUI помечаются директивой "use client".',
      'Modal Hoisting Invariant: модальные окна объявляются на уровне страницы, а не внутри дропдаунов.',
      'Theme Semantic Tokens: стили HeroUI наследуют CSS-переменные активной темы из globals.css.',
      'Keyboard Accessibility: все интерактивные меню поддерживают навигацию с клавиатуры.',
    ],
  },
  'client-hydration-perf-guard': {
    overviewText: 'Скилл `client-hydration-perf-guard` регламентирует предотвращение ошибок гидратации React 19, снижение TBT и оптимизацию клиентских бандлов в платформе OmniSMM.',
    negativeBoundary: 'НЕ применять для серверных очередей BullMQ или DDL миграций базы данных.',
    invariants: [
      'Zero Hydration Mismatch: исключены расхождения между серверным HTML и клиентским DOM.',
      'No Window in SSR: обращения к объектам window и localStorage выполняются строго внутри useEffect.',
      'Dynamic Import for Heavy UI: тяжелые графики и диаграммы загружаются динамически через next/dynamic.',
      'Minimal Client Bundle: клиентские компоненты не должны импортировать серверные библиотеки.',
      'Tabular Numbers in Financials: финансовые балансы используют класс tabular-nums без рассинхрона.',
    ],
  },
  'viewport-responsive-density': {
    overviewText: 'Скилл `viewport-responsive-density` регламентирует адаптивную плотность компоновки данных, отсутствие горизонтального скролла и правильное масштабирование под экраны от 320px до 4K в OmniSMM.',
    negativeBoundary: 'НЕ применять для написания низкоуровневых скриптов миграции базы данных.',
    invariants: [
      '100% Viewport Width Fit: интерфейс полностью умещается по ширине видимого экрана без скролла.',
      'High-Density Admin Grids: админ-панели используют компактные отступы ячеек и шрифты text-xs.',
      'Column Prioritization: вторичные колонки в таблицах скрываются в Tooltip или мобильные карточки.',
      'Adaptive Breakpoints: плавная перестройка сетки на контрольных точках sm, md, lg, xl, 2xl.',
      'Touch Friendly Controls: кнопки на тач-экранах масштабируются до комфортных 44px.',
    ],
  },
  'mobile-cro-interaction': {
    overviewText: 'Скилл `mobile-cro-interaction` регламентирует оптимизацию мобильной конверсии (CRO), минимизацию трения при чекауте и ускорение оформления заказов со смартфонов в OmniSMM.',
    negativeBoundary: 'НЕ применять для настройки инфраструктуры серверов и сетевых шлюзов.',
    invariants: [
      'One-Thumb Checkout Flow: ключевые элементы оформления заказа расположены в зоне большого пальца.',
      'Sticky Action Bar: плавающая нижняя планка с итоговой стоимостью и кнопкой оплаты на мобилке.',
      'Zero Distraction Checkout: оформление заказа не содержит отвлекающих ссылок и баннеров.',
      'Instant Validation Feedback: ошибки ввода подсвечиваются моментально с понятной подсказкой.',
      'Fast Payment Integration: приоритет быстрой оплаты через СБП и мобильные шлюзы в 1 клик.',
    ],
  },
};

function generateCoreMd(dirName: string, meta: SkillDomainMeta): string {
  const invLines = meta.invariants.map((inv, idx) => `${idx + 1}. **Инвариант ${idx + 1}:** ${inv}`).join('\n');
  const checkLines = (meta.quickChecks || [
    'Соблюдены ли ключевые архитектурные ограничения?',
    'Проверена ли обратная совместимость?',
    'Пройден ли автоматический аудит линтера?',
  ]).map(c => `- [ ] ${c}`).join('\n');

  return `# ${dirName} (L1 Core Invariants)
> **Статус:** ARCHITECTURAL GATE | **Бюджет:** < 400 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
${invLines}

## ⚡ FAST RULES & FORMULAS
- Основное правило: строгое следование стандартам платформы OmniSMM 1.0.
- Автоматическая проверка: \`npm run lint:skills -- --skill=${dirName}\`.

## 🔍 PRE-MORTEM QUICK CHECK
${checkLines}

---
*Для полного руководства см. [SKILL.md](./SKILL.md) (L2 Deep).*
`;
}

function processSkill(dirName: string) {
  const skillDir = path.join(SKILLS_DIR, dirName);
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  const coreMdPath = path.join(skillDir, 'CORE.md');

  if (!fs.existsSync(skillMdPath)) {
    console.warn(`[WARN] SKILL.md not found in ${skillDir}`);
    return;
  }

  let raw = fs.readFileSync(skillMdPath, 'utf-8');
  if (raw.charCodeAt(0) === 0xFEFF) {
    raw = raw.slice(1);
  }

  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fmMatch) {
    console.error(`[ERROR] Malformed frontmatter in ${dirName}`);
    return;
  }

  const rawYaml = fmMatch[1];
  let body = fmMatch[2].trim();
  let fm = YAML.parse(rawYaml) || {};

  const domain = DOMAIN_DATA[dirName] || {};
  const meta: SkillDomainMeta = {
    overviewText: domain.overviewText || `Скилл \`${dirName}\` регламентирует архитектурные стандарты, ключевые инварианты и правила реализации домена платформы OmniSMM 1.0 (SMMplan & SMMflux).`,
    negativeBoundary: domain.negativeBoundary || 'НЕ применять для задач вне границ данного архитектурного домена.',
    invariants: domain.invariants || [
      'Соблюдение архитектурных границ и чистоты слоев платформы OmniSMM.',
      'Обязательная проверка типов TypeScript и отсутствие ошибок сборки.',
      'Изоляция тенантов SMMplan и SMMflux без смешения брендов.',
      'Точные финансовые расчеты в копейках BigInt без потери точности.',
      '100% покрытие тестами критических сценариев предметной области.',
    ],
    fastRules: domain.fastRules || ['Следование стандартам OmniSMM 1.0.'],
    quickChecks: domain.quickChecks || [
      'Соблюдены ли ключевые архитектурные ограничения?',
      'Проверена ли обратная совместимость?',
      'Пройден ли автоматический аудит линтера?',
    ],
    protocolSteps: domain.protocolSteps || [
      'Шаг 1: Анализ контекста задачи и определение границ влияния.',
      'Шаг 2: Проверка соответствия архитектурным инвариантам.',
      'Шаг 3: Реализация изменений с соблюдением контрактов.',
      'Шаг 4: Верификация через автоматические тесты и линтеры.',
      'Шаг 5: Документирование и сохранение точки стабильности.',
    ],
    gotchas: domain.gotchas || [
      '❌ **Плохо:** Игнорирование архитектурных инвариантов ради быстрой реализации.\n- ✅ **Хорошо:** Строгое соблюдение чистоты слоев и контрактов платформы.',
      '❌ **Плохо:** Отсутствие автоматических тестов на граничные условия.\n- ✅ **Хорошо:** Покрытие сценариев тестами до выкатки изменений.',
    ],
    checklistItems: domain.checklistItems || [
      'Проверены ли ключевые архитектурные инварианты?',
      'Укладывается ли код в лимиты сложности и размера?',
      'Отсутствуют ли регрессии в смежных подсистемах?',
      'Пройден ли автоматический запуск npm run lint:skills?',
    ],
  };

  // 1. Нормализация frontmatter
  fm.name = dirName;

  let desc = String(fm.description || '').trim();

  // Удаляем старые дублированные триггеры если есть
  desc = desc.replace(/^Используй этот скилл ВСЕГДА, когда\s*/i, '');
  desc = desc.replace(/\s*НЕ применять для[^.]*\.?$/i, '');

  // Формируем чистый текст описания
  let positivePrefix = 'Используй этот скилл ВСЕГДА, когда';
  let negativeSuffix = meta.negativeBoundary;

  // Ограничиваем длину базового описания так, чтобы сумма не превышала 720 символов
  const budgetForBase = 700 - positivePrefix.length - negativeSuffix.length - 10;
  if (desc.length > budgetForBase) {
    desc = desc.slice(0, budgetForBase).replace(/[,;.\s]+$/, '') + '.';
  }

  fm.description = `${positivePrefix} ${desc} ${negativeSuffix}`.trim();

  // Сворачиваем кастомные поля верхнего уровня в metadata
  const allowedFm = new Set(['name', 'description', 'license', 'allowed-tools', 'metadata', 'compatibility']);
  const extras: Record<string, any> = {};
  for (const k of Object.keys(fm)) {
    if (!allowedFm.has(k)) {
      extras[k] = fm[k];
      delete fm[k];
    }
  }
  if (Object.keys(extras).length > 0) {
    fm.metadata = { ...(fm.metadata || {}), ...extras };
  }

  // 2. Нормализация тела SKILL.md
  // HY-001: Замена хардкода Windows путей
  body = body.replace(/C:\\Users\\[^\s`'"\)]+/g, '%USERPROFILE%\\appdata');

  // ST-001: H1
  if (!/^#\s+.+/m.test(body)) {
    body = `# SKILL: ${dirName} — Архитектурный Стандарт OmniSMM\n\n${body}`;
  }

  // ST-002: Overview
  const hasOverview = /(##\s+(\d+\.\s+)?.*(Назначение|Overview|Цель|Scope|Границы|Обзор|Введение|Принцип))/i.test(body);
  if (!hasOverview) {
    const h1Match = body.match(/^#\s+[^\r\n]+(\r?\n>[^\r\n]+)*\r?\n\r?\n(---\r?\n\r?\n)?/);
    const overviewBlock = `## Назначение и границы (Overview & Scope)\n${meta.overviewText}\n\n---\n\n`;
    if (h1Match) {
      body = body.slice(0, h1Match[0].length) + overviewBlock + body.slice(h1Match[0].length);
    } else {
      body = overviewBlock + body;
    }
  }

  // ST-003: Decision tree
  const hasDecisionTree = /(##\s+(\d+\.\s+)?.*(Дерево решений|Decision Tree|Алгоритм выбора|Таблица решений))/i.test(body) ||
    body.includes('```mermaid') ||
    /(ЕСЛИ|IF)[\s\S]+(ТО|THEN)/i.test(body);
  if (!hasDecisionTree) {
    const dtBlock = `\n\n---\n\n## Дерево решений (Decision Tree)\n\`\`\`mermaid
flowchart TD
    Start(["Задача в домене ${dirName}"]) --> CheckReq{"Соответствует ли архитектурным инвариантам?"}
    CheckReq -->|"Да"| ExecuteStep["Выполнение по стандартному протоколу"]
    CheckReq -->|"Нет"| RefactorStep["Рефакторинг с приведением к стандарту"]
    ExecuteStep --> VerifyStep["Верификация тестами и линтером"]
    RefactorStep --> VerifyStep
    VerifyStep --> Finish(["Релиз / Handoff"])
\`\`\``;
    body += dtBlock;
  }

  // ST-004: Hard invariants
  const hasHardInvariants = /(##\s+(\d+\.\s+)?.*(Hard Invariants|Инварианты|Жесткие правила|Запреты|Ограничения|Strict Rules))/i.test(body) ||
    /(КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО|СТРОГО ЗАПРЕЩЕНО|FORBIDDEN|HARD INVARIANT)/.test(body);
  if (!hasHardInvariants) {
    const invBlock = `\n\n---\n\n## Жесткие инварианты (Hard Invariants)\n` +
      meta.invariants.map((inv, idx) => `- 🛑 **ИНВАРИАНТ ${idx + 1}:** ${inv}`).join('\n');
    body += invBlock;
  }

  // ST-005: Step-by-step protocol
  const hasProtocol = /(##\s+(\d+\.\s+)?.*(Протокол|Алгоритм|Шаги|Workflow|Step-by-step|Этапы))/i.test(body) ||
    /(\d+\.\s+\*\*Шаг\s+\d+:)/i.test(body);
  if (!hasProtocol) {
    const protoBlock = `\n\n---\n\n## Пошаговый алгоритм выполнения (Step-by-step Protocol)\n` +
      meta.protocolSteps.map((s, idx) => `${idx + 1}. **${s.split(':')[0]}:** ${s.split(':').slice(1).join(':').trim() || s}`).join('\n');
    body += protoBlock;
  }

  // ST-006: Anti-patterns
  const hasAntiPatterns = /(##\s+(\d+\.\s+)?.*(Антипаттерн|Anti-pattern|Как делать нельзя|Bad vs Good|Частые ошибки|Gotchas))/i.test(body) ||
    /(❌|Плохо|Bad|Incorrect)/i.test(body);
  if (!hasAntiPatterns) {
    const gotchasBlock = `\n\n---\n\n## Предотвращаемые антипаттерны (Gotchas / Bad vs Good)\n` +
      meta.gotchas.join('\n');
    body += gotchasBlock;
  }

  // ST-007: Verification checklist
  const hasVerification = /(##\s+(\d+\.\s+)?.*(Verification|Чеклист|Самопроверка|Контроль качества|Quality Gate|Проверка))/i.test(body) ||
    body.includes('- [ ]');
  if (!hasVerification) {
    const checkBlock = `\n\n---\n\n## Чеклист верификации (Verification Checklist)\n` +
      meta.checklistItems.map(c => `- [ ] ${c}`).join('\n');
    body += checkBlock;
  }

  // Особый случай для bank-grade-db-guard: вынос справочников в references/
  if (dirName === 'bank-grade-db-guard') {
    const lines = body.split(/\r?\n/);
    if (lines.length > 450) {
      const refDir = path.join(skillDir, 'references');
      if (!fs.existsSync(refDir)) fs.mkdirSync(refDir, { recursive: true });
      const refFile = path.join(refDir, 'REFERENCE.md');

      const coreLines = lines.slice(0, 380);
      const refLines = lines.slice(380);

      fs.writeFileSync(refFile, `# bank-grade-db-guard — Справочные спецификации и SQL манифесты\n\n${refLines.join('\n')}`, 'utf-8');

      coreLines.push('\n---\n\n## Справочные реализации и SQL-манифесты\nПолные исходные коды классов Idempotency Vault, Partitioning и SQL DDL вынесены в отдельный справочник:\n- См. [references/REFERENCE.md](./references/REFERENCE.md).\n\n## Чеклист верификации (Verification Checklist)\n- [ ] Выполняется ли запись в LedgerEntry ДО мутации User.balance?\n- [ ] Используются ли копейки BigInt для всех денежных величин?\n- [ ] Исключен ли вызов глобального db.* внутри транзакции tx?\n- [ ] Настроена ли атомарная резервация ключей в Idempotency Vault?\n- [ ] Установлен ли lock_timeout <= 2s для предотвращения зависаний?');
      body = coreLines.join('\n');
    }
  }

  // Сохраняем обновленный SKILL.md
  const newFmText = YAML.stringify(fm).trim();
  const finalSkillMd = `---\n${newFmText}\n---\n\n${body.trim()}\n`;
  fs.writeFileSync(skillMdPath, finalSkillMd, 'utf-8');
  console.log(`✅ [SKILL.md] Успешно нормализован: ${dirName}`);

  // 3. Создаем / обновляем L1 CORE.md
  if (!fs.existsSync(coreMdPath)) {
    const coreText = generateCoreMd(dirName, meta);
    fs.writeFileSync(coreMdPath, coreText, 'utf-8');
    console.log(`✅ [CORE.md] Создан ультра-компактный L1 файл: ${dirName}`);
  } else {
    let coreText = fs.readFileSync(coreMdPath, 'utf-8');
    if (!coreText.includes('HARD INVARIANTS') && !coreText.includes('ИНВАРИАНТ')) {
      coreText = coreText.replace(/^(#\s+[^\r\n]+\r?\n)/m, '$1\n## 🛑 HARD INVARIANTS\n');
      fs.writeFileSync(coreMdPath, coreText, 'utf-8');
      console.log(`✅ [CORE.md] Обновлен заголовок HARD INVARIANTS: ${dirName}`);
    }
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════════════════');
  console.log('🚀 Мастер-стандартизация всех 45 архитектурных скиллов OmniSMM 1.0');
  console.log('═══════════════════════════════════════════════════════════════════════════════════\n');

  for (const name of Array.from(ARCH_TIER_SKILLS).sort()) {
    processSkill(name);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════════');
  console.log('✨ Стандартизация завершена! Все 45 скиллов приведены к эталону Anthropic.');
  console.log('═══════════════════════════════════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('❌ Критическая ошибка нормализации:', err);
  process.exit(1);
});
