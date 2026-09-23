# Original User Request

## Initial Request — 2026-06-07T07:13:22Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview

Generate a comprehensive Knowledge Base consisting of approximately 50 SEO-optimized, highly valuable articles for Smmplan. The articles must cover various social networks, provide tangible value to clients, and be substantial in length to rank well in search engines.

Working directory: d:/SMM_plan_2/src/data/knowledge
Integrity mode: development

## Requirements

### R1. Content Generation & Deep Integration
Generate ~50 unique articles. Based on focus-group research, the topics must not be generic SEO spam. They must tie into actual Smmplan platform mechanics to solve real client pains:
- Explain order statuses (PENDING_CHECK, PARTIAL, ERROR).
- Explain Drip-Feed (капельная накрутка) and why it's safe.
- Explain the difference between services with and without 'Refill' (Гарантия).
- Explain Telegram Smart Bind and why it's useful.
- Explain TargetType link validation errors (Channel vs Post).

### R2. Volume & Network Distribution
- **Network distribution:** 
  - **Telegram**: 5-7 articles.
  - **VK (ВКонтакте)**: 5-7 articles.
  - **Instagram, YouTube, TikTok**: At least 3 articles each.
- **Word count:** Every single article must contain **strictly NO LESS than 500 words**.

### R3. Quality Standards
- **Uniqueness:** You may use external resources for research, but the final output must be 100% unique. Do not blindly copy-paste internet articles.

### R4. Output Format
Save the articles as `.mdx` or `.md` files (with appropriate frontmatter containing title, category, seo_keywords, etc.) directly into the project's knowledge base directory (`d:/SMM_plan_2/src/data/knowledge`). 

## Acceptance Criteria

### Content Quality & Volume
- [ ] There are approximately 50 generated articles.
- [ ] Telegram and VK have 5-7 articles each; others have at least 3.
- [ ] Every article file contains `> 500` words (must be verified programmatically via a word-counting script).

### Uniqueness & Value Verification (AI Marketer Audit)
- [ ] The generated articles must be passed through a strict **AI Marketer / Editor Agent** to verify:
   1) The text doesn't sound like "AI water" (watered down fluff).
   2) It correctly references Smmplan features (Refill, Partial, Drip-feed, etc).
   3) It provides real SEO value and structure (H2, H3, bullet points).
- [ ] Any article failing the AI Marketer audit must be rewritten before final submission.

## Follow-up — 2026-06-07T07:16:52Z

Urgent Requirement Update from User:
In addition to the current requirements, please add a new category/theme of articles specifically for absolute beginners. These articles must cover:
1. Why people need to boost/fake engagement (накрутка) for their resource or channel in the first place.
2. How boosting impacts organic promotion and algorithms.
3. Why social networks actively fight against such boosting methods (and how to avoid penalties, tying back to our Drip-Feed and safety features).

Please ensure at least 3-4 articles are dedicated to this "Beginner/Philosophy of SMM" section.

## Follow-up — 2026-06-07T07:21:27Z

URGENT: The user has approved the final Content Strategy! 
Please generate EXACTLY the 50 articles listed below, maintaining the minimum 500-word requirement and AI Marketer checks.

### Блок 1: Философия SMM и Базовые концепции (5 статей)
1. Зачем нужна накрутка на старте проекта: психология "пустого зала".
2. Как стартовый буст влияет на органические алгоритмы (Снежный ком).
3. Почему соцсети борются с накрутками и как работает теневой бан.
4. Живые люди vs Боты: что выбрать для разных задач.
5. Безопасность аккаунта: как не получить блокировку при продвижении.

### Блок 2: Продвижение в Telegram (7 статей)
6. Как безопасно накрутить подписчиков в Telegram-канал.
7. Разница между ссылками на канал (CHANNEL) и на конкретный пост (POST) при заказах.
8. Зачем нужны реакции на посты в Telegram и как они повышают доверие.
9. Премиум-подписчики Telegram: как они влияют на поиск внутри мессенджера.
10. Как работает система "Smart Bind" для Telegram-пользователей в Smmplan.
11. Накрутка просмотров на старые посты: зачем это нужно рекламодателям.
12. Автопросмотры в Telegram: настройка автоматического продвижения.

### Блок 3: Продвижение ВКонтакте (VK) (6 статей)
13. Алгоритмы Умной Ленты ВК 2026: как лайки и репосты поднимают охваты.
14. Почему ВКонтакте списывает подписчиков и превращает их в "собачек".
15. Как накрутка участников в группу ВК помогает в SEO (Яндекс/Google).
16. Просмотры на клипы ВКонтакте: быстрый старт для видеоконтента.
17. Накрутка опросов и голосований ВК: нюансы и безопасность.
18. Гарантия (Refill) на услуги ВК: как работает авто-докрутка при отписках.

### Блок 4: Instagram, YouTube, TikTok (10 статей)
19. Instagram: Капельная накрутка (Drip-Feed) лайков для имитации живого роста.
20. Instagram: Теневой бан в Инстаграме — как выйти и не попасть снова.
21. Instagram: Просмотры Reels: почему важна скорость набора первых 1000 просмотров.
22. YouTube: Как набрать часы просмотров для включения монетизации.
23. YouTube: Алгоритм YouTube Shorts: как удержание аудитории влияет на показы.
24. YouTube: Безопасные лайки и комментарии для продвижения видео в Топ.
25. TikTok: Секрет попадания в "Рекомендации" (FYP) через стартовый буст.
26. TikTok: Зрители на прямые эфиры (Стримы): как поднять трансляцию в топ.
27. TikTok: Почему TikTok списывает лайки и алгоритмы защиты.
28. Общее: Сравнение алгоритмов продвижения коротких видео (Reels vs Shorts vs TikTok).

### Блок 5: Механика работы с платформой Smmplan (12 статей)
29. Статусы заказов: что значат PENDING_CHECK, IN_PROGRESS и COMPLETED.
30. Ошибка CANCELED: почему заказ был отменен и как это исправить.
31. PARTIAL: что такое частичный возврат и как рассчитывается сумма компенсации.
32. Гарантия на услуги: как нажать кнопку Refill (Докрутка) и сколько ждать.
33. Drip-Feed (Капельная накрутка): Подробная инструкция по настройке.
34. Ошибка TargetType: почему нельзя заказывать подписчиков по ссылке на пост.
35. Почему скорость выполнения заказа (ETA) может меняться.
36. Как правильно оформить тикет в поддержку, чтобы получить ответ за 5 минут.
37. Массовый заказ (Mass Order): как запускать 100 заказов одновременно.
38. Автоматические заказы (Subscriptions): как настроить автолайки на новые посты.
39. Ограничения и лимиты соцсетей: сколько можно крутить в день.
40. Разница между серверами: почему цена на "одинаковые" услуги отличается.

### Блок 6: Финансы, API и Реселлинг (10 статей)
41. Как пополнить баланс Smmplan банковской картой РФ, СБП или Yookassa.
42. Инструкция по пополнению криптой (USDT/Bitcoin) без скрытых комиссий.
43. Реферальная программа: как зарабатывать пассивный доход на приглашениях.
44. API Smmplan: Подробное руководство для реселлеров.
45. Как открыть свою SMM-панель и подключить нас как провайдера.
46. Уровни цен и скидок: как получить статус оптовика (API).
47. Возвраты средств (Refunds): политика отмены неверных заказов.
48. Что делать, если платеж завис или не поступил на баланс.
49. Бонусная система: как получить +5% к каждому пополнению.
50. Мультивалютность: почему цены в каталоге пересчитываются по курсу ЦБ РФ.

Please acknowledge receipt of this message and ensure the team is writing files into `d:/SMM_plan_2/src/data/knowledge`.

## Follow-up — 2026-06-07T07:22:08Z

URGENT ADDITION FROM USER (TELEGRAM CLUSTER):
The user has requested to add the following highly specialized topics to the Telegram block. These are crucial for API and arbitrage clients. Please add them to your backlog of articles to write (making it 53 articles total, or replacing 3 generic ones):

51. Как продвигаются Телеграм-каналы с нуля: органический поиск (Global Search) и привлечение аудитории.
52. Как люди ищут и попадают в Телеграм-каналы (SEO внутри мессенджера, каталоги, инвайты).
53. Как работают аналитические сервисы TGStat и Telemetr: алгоритмы детекта накрутки и специальные услуги Smmplan для безопасного обхода этих сервисов (высококачественный трафик без метки "ботовод").

Ensure these are covered with the same deep technical detail and >500 words per article.

## 2026-06-07T11:08:00Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt > get user approval > delegate to teamwork_preview

Investigate the "something went wrong" error in the current magic link login flow and fully implement a robust password-based fallback authentication architecture that works even when the SMTP server is down or misconfigured. You must write automated tests for your solution.

Working directory: d:\SMM_plan_2
Integrity mode: development

## Requirements

### R1. Root Cause Analysis & Fix
Analyze the codebase to determine why the magic link login currently throws a "something went wrong" error. Fix the root cause of this error so that magic links work correctly when SMTP is available.

### R2. Implement Fallback Password Authentication
Fully implement a password-based fallback login mechanism for both the Admin Panel and User Dashboard. Crucially, this fallback must allow administrators to log in **without relying on an SMTP server**. 
- Add necessary database fields (e.g., passwordHash) via Prisma.
- Update the UI forms to accept a password.
- Implement the backend logic to verify the password securely.

### R3. Automated Testing
Write automated tests (e.g., unit or integration tests) to verify that both the magic link (when SMTP works) and the password fallback (when SMTP fails) function correctly. 

## Acceptance Criteria

### Diagnostics & Fix
- [ ] The root cause of the "something went wrong" error is fixed.

### Architecture Proposal & Implementation
- [ ] Prisma schema is updated with a password hash field.
- [ ] Users and admins can successfully log in using a password instead of a magic link.
- [ ] The solution does not break existing Next.js / NextAuth or custom auth boundaries.

### Verification
- [ ] Automated tests are written.
- [ ] Tests successfully pass, programmatically proving that the password login mechanism works independently of the SMTP server.

## Follow-up — 2026-06-09T14:57:26+03:00

Визуальный аудит и устранение багов мобильной верстки (для экранов от 320px до 480px) на сайте Smmplan, включая проверку перекрытий элементов, отступов, адаптивности и соответствия премиальному дизайн-манифесту.

Working directory: d:\\SMM_plan_2
Integrity mode: development

## Requirements

### R1. Mobile Viewport Layout Audit
- Использовать Playwright или браузерные средства для визуального обхода основных экранов (лендинг, мастер заказа, личный кабинет пользователя, настройки профиля) в разрешении мобильных устройств (ширина 320px - 480px).
- Выявить все случаи наложения текста, вырезания элементов, отсутствия адаптивности, некорректного контраста и проблем с интерактивными элементами (touch targets < 44px).

### R2. Visual & Semantic Style Compliance
- Исправить найденные визуальные баги, строго соблюдая цветовую палитру и семантические токены Tailwind CSS 4.0.0 (избегать инлайновых `text-white`, `bg-black`, использовать семантические токены вроде `text-foreground`, `bg-background` из `globals.css`).
- Убедиться, что элементы соответствуют премиальному качестве (плавные анимации, сбалансированные отступы, корректная кириллическая типографика).

### R3. Automated Visual Verification
- Настроить/обновить скриншотные тесты Playwright для ключевых мобильных экранов с целью фиксации отсутствия регрессии.
- Все тесты должны проходить без ошибок линтинга (`npm run lint` и `npx tsc --noEmit`).

## Acceptance Criteria

### Visual Density & WCAG 2.2 AA Compliance
- [ ] Все кнопки и интерактивные элементы в мобильной версии имеют размер области клика (touch target) не менее 44x44px.
- [ ] Отсутствуют перекрытия текстовых контейнеров, обрезка текста или выход блоков за ширину экрана (нет горизонтального скролла страницы).
- [ ] Цветовой контраст текста относительно фона составляет не менее 4.5:1 для обычного текста.

### Technical & System Integrity
- [ ] Нет инлайновых стилей цветов (все цвета берутся из `@theme` в `globals.css`).
- [ ] Проект успешно проходит сборку (`npm run build`) и линтинг (`npm run lint`).
- [ ] Playwright-тесты для мобильных разрешений успешно проходят локально.

## Follow-up — 2026-06-25T13:26:05+03:00

Расширение библиотеки примеров ответов для службы поддержки Smmplan (Smmplan Support Examples Library) до исчерпывающего обучающего руководства, содержащего более 50 кейсов, с использованием параллельных агентов-исследователей и юристов.

Working directory: d:\SMM_plan_2
Integrity mode: benchmark

## Requirements

### R1. Создание библиотеки из 50+ практических кейсов
Агенты должны разработать и наполнить файл `smmplan_support_examples_library.md` в папке артефактов, содержащий не менее 50 уникальных конфликтных кейсов. Каждый кейс должен соответствовать структуре «Двойного Ядра» (Dual-Core):
- Реалистичное агрессивное входящее обращение клиента (включая нецензурную лексику, капс, шантаж).
- Юридическая квалификация и внутреннее объяснение для саппорта (ссылки на ГК, УК, КоАП РФ, оферту Smmplan).
- Маркетингово-симбиотический шаблон ответа (клиентоориентированность, сглаживание углов, предложение докрутки/бонусов, сохранение денег в системе).

Кейсы должны быть распределены по 5 категориям:
1. **Telegram:** Накрутка каналов/групп/ботов, отписки, задержки бустов.
2. **VK / Instagram / TikTok:** Списания, ограничения лимитов социальных сетей, блокировки.
3. **Ошибки шлюзов оплаты:** Задержки платежей, ошибки эквайринга, возвраты на карту.
4. **Сложные претензии:** Угрозы налоговой (ФНС), Роскомнадзором (РКН), блокировкой доменов за спам.
5. **Юридический экстремизм:** Угрозы исками за «накрутку», требования компенсаций за утерянные каналы, угрозы DDoS.

### R2. Проверка целостности и сборка
Все изменения должны пройти автоматическую проверку типов (`npx tsc --noEmit`) и проверку комплаенса (`check-compliance.js`). Файл библиотеки не должен содержать пустых шаблонных скобок вида `[...]`.

## Acceptance Criteria

### Качество и полнота контента
- [ ] Файл `smmplan_support_examples_library.md` содержит не менее 50 пронумерованных кейсов с четким разделением по 5 категориям (минимум 10 кейсов на каждую категорию).
- [ ] Каждый кейс содержит три обязательных элемента: Сообщение клиента -> Юридический разбор -> Симбиоз-ответ.
- [ ] В ответах саппорта отсутствуют фразы с признанием вины платформы; проблемы аргументируются внешними факторами.

### Техническая проверка
- [ ] Запуск `npx tsc --noEmit` в рабочей директории завершается с кодом `0` (без ошибок компиляции).
- [ ] Скрипт `node .agent/skills/gsd-russian-legal-watchdog/scripts/check-compliance.js` выдает вердикт `AUDIT SUCCESS`.

## Follow-up — 2026-06-09T12:01:25Z

## Расширенная спецификация аудита (v2)

Промпт был существенно расширен. Передай оркестратору следующие дополнения к текущему плану:

### 1. Полный перечень экранов (20 штук)
Кроме лендинга и мастера заказа, необходимо проверить:
- `/login` — авторизация
- `/dashboard` — дашборд пользователя (включая `sidebar-nav.tsx`)
- `/dashboard/settings` — настройки профиля и `PasswordCard.tsx`
- `/dashboard/orders` — история заказов
- `/dashboard/add-funds` — пополнение баланса
- `/knowledge`, `/academy` — база знаний
- Все модалы: `PaymentGatewaySelectionModal`, `MassConfirmEmailModal`, `VisualLinkGuideModal`
- Компоненты внутри лендинга: `FAQ.tsx`, `Reviews.tsx`, `WhyUs.tsx`, `MegaFooter.tsx`, `TrustBar.tsx`

### 2. Конкретные HOT SPOTS (зоны повышенного риска)
1. **`MobileWizard.tsx`** (950 строк / 46 КБ) — самый сложный компонент, высокий риск overflow и z-index конфликтов.
2. **`StickyCheckoutBar.tsx`** — проверить safe-area-inset для iPhone с вырезом, кнопка оплаты не должна перекрываться.
3. **`PlatformLinkGuideDrawer.tsx`** — недавно исправлен (скрыта mock-карта через `hidden md:flex`), подтвердить корректность.
4. **`DynamicPayloadWarnings.tsx`** (22 КБ) — длинные предупреждения могут overflow.
5. **`VisualLinkGuideModal.tsx`** (50 КБ) — модал визуального руководства, проверить viewport boundaries.
6. **Header.tsx** — три кнопки (Кабинет + Выйти + Бургер) должны помещаться в 320px.

### 3. Классификация дефектов
Каждый найденный баг — через severity:
- 🔴 P0 (Critical) — невозможно совершить действие
- 🟠 P1 (Major) — серьезная визуальная проблема
- 🟡 P2 (Minor) — косметика
- 🟢 P3 (Enhancement) — улучшение премиальности

### 4. Обязательные AI-скиллы для прочтения
Перед началом работы агенты должны прочитать SKILL.md следующих скиллов:
- `gsd-premium-audit` — аудит премиальности
- `ru-cyrillic-typography` — кириллическая типографика  
- `ru-visual-culture` — визуальная культура CIS
- `gsd-ui-review` — 6-pillar visual audit
- `gsd-tailwind-v4-manifest` — правила Tailwind 4

### 5. Три разрешения для тестирования
Все экраны проверить при: **320px** (iPhone SE), **390px** (iPhone 14), **430px** (iPhone 15 Pro Max).

### 6. Deliverables
- Markdown-отчёт со всеми дефектами (severity + скриншоты до/после + файл:строка)
- Код-фиксы всех P0 и P1 дефектов
- [ ] `npm run lint` = 0 errors, `npx tsc --noEmit` = clean

## Follow-up — 2026-07-03T21:27:12Z

The goal is to test and verify all critical user flows of SMMplan in the local production environment (http://localhost:3000) using a browser-driven agent. The agent will interact with the real site, verify SSE connections, support limits, and Loss Prevention guards, producing screenshots and videos for visual proof.

Working directory: d:/SMM_plan_2
Integrity mode: development

## Requirements

### R1. Client Registration & Ordering Flow
- Register a new client user at http://localhost:3000/login (or signup page).
- Log in, navigate the cabinet, and place a new order using one of the imported Vexboost services (Instagram or Telegram).
- Verify the balance decrement and order state progression (should become PENDING/IN_PROGRESS).

### R2. Ticket Support & SSE Flow
- Create a support ticket as the client user.
- Log in as the support operator (support@smmplan.test / SupportPassword2026!).
- Access the operator tickets workspace at http://localhost:3000/operator/tickets.
- Send a reply and verify real-time message delivery (via SSE) and change ticket status to CLOSED.

### R3. Loss Prevention & Support Limits Verification
- As support operator, attempt to cancel an active order (IN_PROGRESS) whose service has `isCancelEnabled = false`. Verify that the cancellation is blocked and the specific warning message is displayed.
- Verify support compensation limit guards (e.g. attempting to refund beyond daily support limits is blocked).

## Acceptance Criteria

### Visual Evidence & Reporting
- Save browser videos (WebP) or screenshots of the user flow steps into the artifacts directory.
- Verify client ordering decrements balance correctly.
- Verify support operator sees the ticket and reply is sent successfully.
- Verify Loss Prevention error message appears upon active order cancellation attempt by SUPPORT.
- Produce a structured markdown walkthrough report summarizing the verification status of all tested flows.

## 2026-09-11T05:25:49Z

Разработать и внедрить полный комплект из 11 специализированных архитектурных скиллов (Architectural Skills Suite) для AI-ассистентов платформы OmniSMM в директории `.agents/skills/` с параллельным распределением задач по 4 доменным кластерам.

Working directory: c:/Users/Shadow/Documents/SMM/.agents/skills
Integrity mode: development

## Requirements

### R1. Кластер 1 — Доменные границы и системный дизайн (Domain & Boundary Cluster)
Создать 3 скилла с полным описанием, деревьями решений, антипаттернами и чеклистами:
- `arch-boundary-guard`: Защита границ слоев (Hexagonal/Clean Architecture), предотвращение спагетти-зависимостей, разделение DTO <-> Domain <-> DB Model, контроль размера компонентов и Server Actions.
- `ddd-aggregate-invariants`: Инварианты агрегатов, транзакционная граница «1 транзакция = 1 агрегат», запрет мутации дочерних сущностей в обход корня агрегата.
- `adr-architect`: Формат MADR (Context, Decision, Consequences, Alternatives), аудит существующих решений и предотвращение регрессий и «архитектурной амнезии».

### R2. Кластер 2 — Распределенные данные, транзакции и надежность (Distributed & Concurrency Cluster)
Создать 3 скилла для критических сценариев работы с данными:
- `concurrency-acid-guard`: Защита от состояний гонки (TOCTOU, Lost Updates), Row-Level Locking (`SELECT ... FOR UPDATE`), Ledger-First, ExactMath, детекция Transaction Escape (`db` vs `tx`), паттерны идемпотентности.
- `db-evolution-zero-downtime`: Паттерн Expand/Contract для миграций PostgreSQL без простоя, безопасные DDL, детекция блокировок таблиц.
- `event-driven-reliability`: Transactional Outbox, защита от Dual-Write, идемпотентные консьюмеры (BullMQ), Dead-Letter Queue (DLQ) с экспоненциальным backoff.

### R3. Кластер 3 — Отказоустойчивость, изоляция и мульти-тенантность (Resilience & Multi-Tenant Cluster)
Создать 2 скилла для изоляции сбоев и тенантов:
- `resilience-bulkhead-circuit`: Circuit Breaker (Closed/Open/Half-Open), Bulkhead per-tenant/per-provider, изоляция пулов коннектов, обязательные сетевые таймауты (`AbortSignal.timeout`), Graceful Degradation.
- `multi-tenant-isolation-arch`: Полная изоляция тенантов (OmniSMM / SMMplan / SMMflux), tenant-aware кэширование, RLS / обязательный скоупинг `where: { tenantId }`, барьер ст. 54.1 НК РФ для юрлиц и касс.

### R4. Кластер 4 — Контракты API, аудит влияния и производительность (API, Blast Radius & NFR Cluster)
Создать 3 скилла для долгосрочной стабильности кодовой базы:
- `api-contract-evolver`: Contract-First подход, детекция Breaking Changes в схемах и DTO до слияния, версионирование и плавное устаревание (Deprecation).
- `impact-blast-radius`: Анализ радиуса поражения (Blast Radius Mapping), расчет связанности (Afferent/Efferent coupling), моделирование отказа на 3 шага вперед (Pre-Mortem Failure Simulation).
- `nfr-performance-budget`: Контроль нефункциональных требований (P95/P99 latency budget, детекция N+1 запросов в Prisma, Tree-shaking, лимиты пула соединений).

### R5. Каталогизация и документация
- Создать единый реестр `.agents/skills/INDEX.md` с описанием каждого скилла, ключевыми словами для триггера, сценариями применения и кросс-ссылками.

## Acceptance Criteria

### Структурная полнота
- [ ] Для всех 11 скиллов создана отдельная директория в `c:/Users/Shadow/Documents/SMM/.agents/skills/<skill-name>/` с валидным файлом `SKILL.md`.
- [ ] Каждый `SKILL.md` содержит корректный YAML frontmatter (`name`, `description`).
- [ ] Каждый скилл содержит 4 обязательных раздела: 
  1. *Дерево решений (Decision Tree / Flowchart)*
  2. *Жесткие инварианты и табу (Hard Invariants & Anti-Patterns)*
  3. *Премортем-анализ и моделирование отказов (Failure Scenarios)*
  4. *Чеклист верификации (Verification Checklist)*
- [ ] Создан файл `c:/Users/Shadow/Documents/SMM/.agents/skills/INDEX.md` с полным реестром всех 11 скиллов.

### Качество и отсутствие дефектов
- [ ] Тексты скиллов точно адаптированы под реальный стек проекта: Next.js 16 (App Router), React 19, Tailwind 4, Prisma 5, PostgreSQL, BullMQ, Redis, Vitest.
- [ ] Отсутствуют заглушки `TODO`, плейсхолдеры и битые относительные ссылки.

## 2026-09-14T05:29:03Z

Комплексный аналитический аудит, классификация пограничных сценариев (edge cases) и разработка спецификации с интерактивным опросником для валидатора ссылок, многокатегорийных услуг и динамических полей заказа платформы SMMplan/OmniSMM.

Working directory: c:\Users\Shadow\Documents\SMM
Integrity mode: development

## Reference Materials
- Архитектура валидатора: `src/services/link-engine/` (`unified-link-engine.ts`, `link-rules-registry.ts`, `link-canonicalizer.ts`, `link-domain-router.ts`)
- Семантика типов услуг: `src/utils/target-type-mapper.ts` (`resolveServiceTargetType`)
- Текущие схемы и орхестратор: `src/components/landing/order-engine/useCheckoutOrchestrator.ts`, `src/actions/order/checkout.ts`, `prisma/schema.prisma`
- Существующие стресс- и unit-тесты: `src/__tests__/unit/unified-link-engine.test.ts`, `src/__tests__/stress/link-validator-stress.test.ts`

## Requirements

### R1. Систематизация пограничных случаев (Edge Cases Matrix)
Провести глубокий аудит базы данных услуг и каталога соцсетей (Telegram, VK, YouTube, Instagram, TikTok, Twitch, Rutube, Дзен, X/Twitter, Discord и др.) и составить полную таксономическую матрицу нестандартных типов услуг:
1. **Многокатегорийная применимость (1 ссылка -> N категорий):** например, ссылка на канал Telegram подходит под «Подписчики», «Просмотры на будущие посты», «Реакции», «Бусты/Голоса». Описать правила разрешения конфликтов, приоритеты и интерфейс выбора намерения пользователя.
2. **Автоматические и подписочные услуги:** услуги с интервалами, авто-просмотрами на X будущих публикаций, отслеживанием стримов/онлайна.
3. **Закрытые и приватные сущности:** приватные Telegram-каналы/чаты (`t.me/+hash`, `t.me/joinchat/...`), закрытые профили Instagram/VK, пригласительные ссылки Discord.
4. **Услуги с динамическими дополнительными полями ввода:**
   - Пользовательские комментарии (список строк, разделители, минимальное/максимальное количество строк, валидация цензуры/эмодзи).
   - Выбор эмодзи/реакций (одиночные, множественные, кастомные).
   - Медиагруппы и альбомы (ссылки на конкретное фото/видео внутри карусели).
   - Опросы и голосования (номер/текст варианта ответа).
   - Списки логинов (для услуг упоминаний/рассылок).
5. **Специфика форматов URL соцсетей:** истории/сториз (`/s/`), форумные топики (`/topic/`), клипы/Reels/Shorts, прямые эфиры/трансляции, репосты/реплаи.

### R2. Интерактивный опросник и протокол согласования (User Elicitation Guide)
Разработать исчерпывающий структурированный опросник для владельца продукта / оператора по каждому спорному или неоднозначному пограничному случаю:
- Для каждого сценария сформулировать: описание ситуации, почему возникает развилка, возможные варианты поведения системы (UX визарда, валидация бэкенда, ошибки и подсказки), рекомендуемый вариант и последствия для смежных контуров (биллинг, провайдеры API, автодоставка).
- Опросник должен быть готов к проведению интерактивной сессии согласования бизнес-логики.

### R3. Спецификация контрактов и архитектуры (Specification Document)
Создать спецификацию в `docs/specs/SPEC-2026-LINK-EDGE-CASES.md`, формализующую:
- DTO и Zod-схемы для всех кастомных полей ввода (`customData`, `comments`, `reactions`, `targetPosts`).
- Инварианты совместимости типов ссылок и категорий (`isLinkCompatibleWithCategory`).
- Поведение 4-шагового визарда заказа при пересечении категорий и вводе сложных ссылок.
- Ограничения безопасности (SSRF, ReDoS, XSS в комментариях, лимиты памяти).

### R4. Набор верификационных тест-кейсов и векторов (Test Vector Suite)
Сформировать структурированный эталонный набор верификационных данных (не менее 60 тестовых векторов):
- Позитивные ссылки и параметры для каждого пограничного типа.
- Негативные ссылки с проверкой корректности и понятности сообщений об ошибках.
- Граничные условия для дополнительных полей (пустые строки, оверквоты, спецсимволы).
- Подготовить тест-сьют для Vitest (`src/__tests__/unit/edge-cases-matrix.test.ts`), готовый к исполнению.

## Acceptance Criteria

### Полнота матрицы (Coverage)
- [ ] Охвачены все активные платформы и категории каталога без пробелов.
- [ ] Каждый пограничный случай категоризирован по уровню критичности (Critical, Major, Minor) с четким описанием входов и выходов.

### Готовность опросника (Actionable Elicitation)
- [ ] Опросник разбит по тематическим блокам с готовыми вариантами выбора и критериями приемки.
- [ ] Отсутствуют открытые «размытые» вопросы без вариантов решений.

### Качество спецификации (Spec Integrity)
- [ ] Документ спецификации оформлен в `docs/specs/SPEC-2026-LINK-EDGE-CASES.md` согласно регламенту SDD/RAC-2026.
- [ ] Zod-схемы и интерфейсы TypeScript строго типизированы (strict mode, no any).

### Верифицируемость (Test Harness)
- [ ] Создан воспроизводимый датасет верификационных векторов.
- [ ] Написаны и задокументированы тесты соответствия контрактам в Vitest.

## 2026-09-14T21:56:42Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: [none — teamwork routes from the description]

Implement an explicit warning toast when a user pastes multiple links on the B2C landing page, replacing the current silent truncation behavior.

Working directory: e:\SMM

## Requirements

### R1. Prevent Silent Data Loss
When a user pastes text containing multiple lines or links into `HeroInput.tsx` or `MobileStep1Link.tsx`, the system currently silently discards all but the first line. Change this behavior so that if multiple lines are detected during a paste event, a clear toast notification is shown to the user informing them that only the first link was kept for quick checkout, and directing them to use their dashboard for mass orders.

### R2. Adhere to SIL-2026 Zero-Regression Protocol
Ensure that single links, emails, and bare handles continue to paste perfectly. Do not re-introduce the legacy `UniversalOrderForm` into the B2C landing page. Update any tests if necessary to ensure `vitest` passes without errors.

## Acceptance Criteria

### UX & Functionality
- [ ] Pasting a multi-line string triggers a specific toast warning.
- [ ] The first link of the pasted text is successfully set in the input field.
- [ ] Single links, emails, and handles are processed normally without the multi-line toast.
- [ ] `tsc --noEmit` and `vitest` pass with zero regressions.
