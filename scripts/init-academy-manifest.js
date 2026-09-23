const fs = require('fs');
const path = require('path');
const dir = path.resolve(__dirname, '../project-docs/academy-engine');
fs.mkdirSync(path.join(dir, 'modules'), { recursive: true });

const bible = `# 📖 MASTER BIBLE: Академия Поддержки и Клиентского Сервиса SMMplan (v2026)

## 🎯 1. Миссия и Целевая Аудитория
- **Цель руководства:** Сформировать несокрушимый стандарт работы поддержки уровня Tier-1 Enterprise.
- **Для кого:** Операторы поддержки (Junior/Middle/Senior), тимлиды, AI-ассистенты саппорта, риск-менеджеры.
- **Главный KPI саппорта:** Время первого ответа < 60 сек, решение вопроса < 3 мин, 0 необоснованных кассовых возвратов, 0 юридических самооговоров, 98%+ CSAT.

---

## 🗣️ 2. Tone of Voice & Речевой Кодекс
- **Стиль общения:** Вежливый, эмпатичный, деловой, спокойный, заботливый, экспертный.
- **ПРАВИЛО №1 (Эмпатия + Факты):** Сначала признаем эмоции клиента («Понимаем ваши переживания»), затем даем четкое техническое решение и юридическое обоснование.
- **ПРАВИЛО №2 (Запрещенный сленг):** КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО писать клиентам: «боты», «накрутка», «наши сервера сломались», «провайдер сдох».
- **ПРАВИЛО №3 (Легитимная терминология ОКВЭД 63.11):** Писать: «маршрутизация трафика исполнителей», «автоматизация показателей», «алгоритмические корректировки социальной сети», «докрутка по гарантии (Refill)».

---

## ⚖️ 3. Железные Юридические и Финансовые Ограничения (Non-Negotiables)
1. **152-ФЗ «О персональных данных»:**
   - Никаких паролей и API-ключей в открытые чаты. Только одноразовые 15-минутные Magic Links.
   - Смена почты — строго по экспресс-протоколу (< 1000 ₽) или по банковской выписке (> 3000 ₽).
2. **54-ФЗ «О применении ККТ»:**
   - Никаких возвратов по СБП с личных карт саппорта! Возврат — строго через ЮKassa/Robokassa на исходный платеж с фискальным чеком «Возврат прихода».
3. **CFO Margin Protection:**
   - На тарифах «Без гарантии» (No Refill) возврат за списания соцсети НЕ производится (п. 4.2 Оферты).
   - Goodwill-бонусы — строго по лимитам SupportBalancePolicy (до 100 ₽ новичку, до 500 ₽ за сбой).
4. **402-ФЗ «О бухгалтерском учете»:**
   - При удалении профиля (152-ФЗ) бухгалтерские чеки и проводки архивируются ровно на 5 лет.
`;

fs.writeFileSync(path.join(dir, 'MASTER_BIBLE.md'), bible, 'utf8');

const manifest = {
  projectTitle: 'Академия Клиентского Сервиса и Операционной Безопасности SMMplan',
  version: '2.0.0',
  projectBible: 'MASTER_BIBLE.md',
  masterOutputFile: 'project-docs/SUPPORT_ACADEMY_MASTER_2026.md',
  nodes: [
    // МОДУЛЬ 1
    {
      id: 'mod1-sec1-order-lifecycle',
      module: 'МОДУЛЬ 1: Жизненный цикл заказа и технические аномалии',
      section: '1.1 Механика статусов заказа и транзакции в базе данных (Prisma/PostgreSQL)',
      status: 'PENDING',
      file: 'modules/mod01_orders.md'
    },
    {
      id: 'mod1-sec2-counter-lag',
      module: 'МОДУЛЬ 1: Жизненный цикл заказа и технические аномалии',
      section: '1.2 Аномалия Counter Lag (кэш CDN мобильных приложений Telegram, Instagram, TikTok)',
      status: 'PENDING',
      file: 'modules/mod01_orders.md'
    },
    {
      id: 'mod1-sec3-stuck-orders',
      module: 'МОДУЛЬ 1: Жизненный цикл заказа и технические аномалии',
      section: '1.3 Зависшие заказы (Stuck in Progress) и регламент отмены/ресинхронизации',
      status: 'PENDING',
      file: 'modules/mod01_orders.md'
    },
    {
      id: 'mod1-sec4-private-profiles',
      module: 'МОДУЛЬ 1: Жизненный цикл заказа и технические аномалии',
      section: '1.4 Закрытые аккаунты (Private Profile) и юридически чистые инструкции клиенту',
      status: 'PENDING',
      file: 'modules/mod01_orders.md'
    },
    {
      id: 'mod1-sec5-link-formats',
      module: 'МОДУЛЬ 1: Жизненный цикл заказа и технические аномалии',
      section: '1.5 Ошибки в формате ссылок (Wrong Link Format) и валидация по типам услуг',
      status: 'PENDING',
      file: 'modules/mod01_orders.md'
    },

    // МОДУЛЬ 2
    {
      id: 'mod2-sec1-drop-mechanics',
      module: 'МОДУЛЬ 2: Гарантии, Списания (Drop) и Политика Лояльности',
      section: '2.1 Алгоритмические чистки социальных сетей: разница No Refill vs Refill',
      status: 'PENDING',
      file: 'modules/mod02_refills_goodwill.md'
    },
    {
      id: 'mod2-sec2-lifetime-trap',
      module: 'МОДУЛЬ 2: Гарантии, Списания (Drop) и Политика Лояльности',
      section: '2.2 Ловушка «вечной гарантии» (Lifetime Trap) и перекупщики провайдеров',
      status: 'PENDING',
      file: 'modules/mod02_refills_goodwill.md'
    },
    {
      id: 'mod2-sec3-goodwill-matrix',
      module: 'МОДУЛЬ 2: Гарантии, Списания (Drop) и Политика Лояльности',
      section: '2.3 Матрица компенсаций Goodwill: сегментация клиентов по LTV и лимиты оператора',
      status: 'PENDING',
      file: 'modules/mod02_refills_goodwill.md'
    },
    {
      id: 'mod2-sec4-refill-execution',
      module: 'МОДУЛЬ 2: Гарантии, Списания (Drop) и Политика Лояльности',
      section: '2.4 Регламент запуска Refill в 1 клик и работа со спорными докрутками',
      status: 'PENDING',
      file: 'modules/mod02_refills_goodwill.md'
    },

    // МОДУЛЬ 3
    {
      id: 'mod3-sec1-billing-ledger',
      module: 'МОДУЛЬ 3: Финансовая безопасность, Эквайринг и Налоги',
      section: '3.1 Архитектура биллинга (BigInt копейки, LedgerEntry, WalletOps) и кассовый аудит',
      status: 'PENDING',
      file: 'modules/mod03_finance_54fz.md'
    },
    {
      id: 'mod3-sec2-payment-methods',
      module: 'МОДУЛЬ 3: Финансовая безопасность, Эквайринг и Налоги',
      section: '3.2 Платежные методы (СБП, Карты МИР, Зарубежные карты, Crypto, API р/с)',
      status: 'PENDING',
      file: 'modules/mod03_finance_54fz.md'
    },
    {
      id: 'mod3-sec3-ghost-webhooks',
      module: 'МОДУЛЬ 3: Финансовая безопасность, Эквайринг и Налоги',
      section: '3.3 Зависшие платежи эквайринга (Ghost Webhooks) и ручная квалификация за 10 сек',
      status: 'PENDING',
      file: 'modules/mod03_finance_54fz.md'
    },
    {
      id: 'mod3-sec4-card-refunds-54fz',
      module: 'МОДУЛЬ 3: Финансовая безопасность, Эквайринг и Налоги',
      section: '3.4 Двухстадийный возврат средств на карту, ст. 32 ЗоЗПП и фискальные чеки 54-ФЗ',
      status: 'PENDING',
      file: 'modules/mod03_finance_54fz.md'
    },

    // МОДУЛЬ 4
    {
      id: 'mod4-sec1-zero-knowledge-api',
      module: 'МОДУЛЬ 4: Безопасность профилей, Доступы и 152-ФЗ',
      section: '4.1 Стандарт безопасности Zero-Knowledge (SHA-256 хэширование API-ключей)',
      status: 'PENDING',
      file: 'modules/mod04_security_152fz.md'
    },
    {
      id: 'mod4-sec2-express-recovery',
      module: 'МОДУЛЬ 4: Безопасность профилей, Доступы и 152-ФЗ',
      section: '4.2 30-секундный экспресс-поиск по ссылке при опечатке в email (< 1000 ₽)',
      status: 'PENDING',
      file: 'modules/mod04_security_152fz.md'
    },
    {
      id: 'mod4-sec3-vip-verification',
      module: 'МОДУЛЬ 4: Безопасность профилей, Доступы и 152-ФЗ',
      section: '4.3 Двухуровневая верификация крупных сумм (> 3000 ₽ / VIP) по чекам 54-ФЗ',
      status: 'PENDING',
      file: 'modules/mod04_security_152fz.md'
    },
    {
      id: 'mod4-sec4-magic-links-sessions',
      module: 'МОДУЛЬ 4: Безопасность профилей, Доступы и 152-ФЗ',
      section: '4.4 Magic Links (15 минут) и экстренный сброс сессий взломщика (Force Logout)',
      status: 'PENDING',
      file: 'modules/mod04_security_152fz.md'
    },
    {
      id: 'mod4-sec5-right-to-be-forgotten',
      module: 'МОДУЛЬ 4: Безопасность профилей, Доступы и 152-ФЗ',
      section: '4.5 Право на забвение (ст. 21 152-ФЗ) и 5-летний архив по ст. 29 402-ФЗ',
      status: 'PENDING',
      file: 'modules/mod04_security_152fz.md'
    },

    // МОДУЛЬ 5
    {
      id: 'mod5-sec1-legal-deescalation',
      module: 'МОДУЛЬ 5: Юридическая самооборона, Претензии и Конфликтология',
      section: '5.1 Угрозы полицией (ст. 159 УК РФ), судом и Роскомнадзором: алгоритм деэскалации',
      status: 'PENDING',
      file: 'modules/mod05_legal_defense.md'
    },
    {
      id: 'mod5-sec2-consumer-fraud',
      module: 'МОДУЛЬ 5: Юридическая самооборона, Претензии и Конфликтология',
      section: '5.2 Потребительский экстремизм и вымогательство (ст. 163 УК РФ): защита сервиса',
      status: 'PENDING',
      file: 'modules/mod05_legal_defense.md'
    },

    // МОДУЛЬ 6
    {
      id: 'mod6-sec1-corporate-invoices-vat',
      module: 'МОДУЛЬ 6: API, Оптовики, Реселлеры и ЭДО (Диадок / СБИС)',
      section: '6.1 Автоматическое выставление счетов юрлицам/ИП по ИНН (DaData) с НДС 22% / УСН',
      status: 'PENDING',
      file: 'modules/mod06_api_resellers.md'
    },
    {
      id: 'mod6-sec2-api-diadoc-api',
      module: 'МОДУЛЬ 6: API, Оптовики, Реселлеры и ЭДО (Диадок / СБИС)',
      section: '6.2 Обмен УПД в Диадок/СБИС и подключение реселлеров по API v2',
      status: 'PENDING',
      file: 'modules/mod06_api_resellers.md'
    }
  ]
};

fs.writeFileSync(path.join(dir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2), 'utf8');
console.log('INIT_SUCCESS: Master Bible and 21-node Manifest generated.');
