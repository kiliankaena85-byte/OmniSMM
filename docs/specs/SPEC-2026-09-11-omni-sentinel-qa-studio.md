# SPEC-2026-09-11: Omni-Sentinel QA Studio (Автономный сквозной инспектор качества)

## 1. Контекст и Проблематика
Разработчики и операторы регулярно выполняют рутинные ручные действия при проверке работоспособности платформы OmniSMM 1.0 (SMMplan / SMMflux):
- Открытие страниц в браузере и ручной поиск ошибок в DevTools Console (`console.error`, гидратация React 19).
- Проверка сетевых запросов на наличие 404 (битые статические ассеты) и 500 (сбои Server Actions / Route Handlers).
- Ручной поиск горизонтального скролла на мобильных устройствах без понимания, какой именно DOM-элемент распирает контейнер.
- Авторизация под разными аккаунтами (Гость, Клиент SMMplan, Клиент SMMflux, Поддержка, Владелец).

Цель спецификации — формализовать контракт автономной QA-студии **Omni-Sentinel QA**, выполняющей 4-векторную проверку в headless-браузере и генерирующей наглядный интерактивный HTML-отчет с доказательными скриншотами.

## 2. Архитектурные Требования и Инварианты

### 2.1. Изоляция и Производительность
- Скрипты располагаются строго в директории `scripts/qa-sentinel/`.
- Не загрязняют продуктовый бандл Next.js (`devDependencies` Playwright, TSX, Jose).
- Поддержка быстрого режима (`--quick`) для быстрой верификации за 10–15 секунд и полного режима (`--full`) для предрелизной сертификации.

### 2.2. Матрица Векторов Проверки (4-Sensory Audit)
1. **Runtime & Console Guard**:
   - Перехват 100% `console.error` и `pageerror` (неперехваченные исключения JS).
   - Фильтрация шума: игнорирование известных некритичных внешних ресурсов (Yandex Metrika блокировка в dev, favicon.ico).
   - Детекция ошибок гидратации React 19: поиск паттернов `Hydration failed`, `Text content does not match`, `did not match`.
2. **Network Traffic Inspector**:
   - Перехват всех сетевых ответов `response.status() >= 400`.
   - Разделение на критические (500 Internal Server Error, сбои Server Actions) и информационные (404 на опциональные статические файлы).
3. **DOM & Geometry Guard (Zero Horizontal Scroll)**:
   - Проверка основного инварианта: `document.documentElement.scrollWidth <= window.innerWidth`.
   - Если обнаружен горизонтальный скролл (`overflow > 0`), алгоритм обходит DOM-дерево и находит конкретные элементы с `rect.right > window.innerWidth`.
   - Для каждого элемента формируется точный CSS-селектор (например: `div.table-container > table.w-[1200px]`), ширина и величина выхода за экран в пикселях.
4. **Touch Target & Accessibility (WCAG 2.2 AA)**:
   - На мобильных вьюпортах (ширина <= 480px) проверяются интерактивные элементы (`button`, `a[href]`, `input`).
   - Предупреждение, если габариты меньше 44x44px (за исключением inline-ссылок в тексте).

### 2.3. Матрица Ролей и Экранов
- **GUEST (Гость)**:
  * SMMplan Landing (`/`) — Desktop (1920x1080) и Mobile (390x844)
  * Каталог услуг (`/services` или `/catalog`)
  * Страница входа (`/login`)
- **USER_SMMPLAN (Пользователь B2C SMMplan)**:
  * Дашборд заказов (`/dashboard`) — Desktop и Mobile
  * Пополнение баланса (`/dashboard/add-funds`)
  * Мои заказы (`/dashboard/orders`)
- **USER_FLUX (Пользователь SMMflux)**:
  * Дашборд витрины Flux (`/dashboard` с кукой `x_tenant=flux`)
- **SUPPORT (Оператор поддержки)**:
  * Саппорт-центр / чаты (`/support`)
- **OWNER / ADMIN (Владелец платформы)**:
  * Административный дашборд (`/admin/dashboard`)
  * Финансовый центр и сверка (`/admin/finance`)

## 3. Схема Данных (TypeScript DTO)

```typescript
export interface OverflowElementInfo {
  selector: string;
  tagName: string;
  className: string;
  boundingWidth: number;
  overflowAmount: number;
}

export interface DomInspectionResult {
  hasHorizontalScroll: boolean;
  scrollWidth: number;
  innerWidth: number;
  overflowPixels: number;
  overflowElements: OverflowElementInfo[];
  hydrationErrorDetected: boolean;
  hydrationErrorMessage?: string;
  smallTouchTargetsCount: number;
}

export interface ScreenCheckResult {
  id: string;
  name: string;
  role: 'GUEST' | 'USER_SMMPLAN' | 'USER_FLUX' | 'SUPPORT' | 'OWNER';
  tenantId: string;
  path: string;
  viewport: { width: number; height: number; name: string };
  screenshotPath: string;
  consoleErrors: string[];
  consoleWarnings: string[];
  failedNetworkRequests: Array<{ url: string; status: number; method: string }>;
  domMetrics: DomInspectionResult;
  durationMs: number;
  status: 'PASS' | 'WARN' | 'FAIL';
}

export interface QASentinelSummary {
  timestamp: string;
  targetUrl: string;
  totalScreens: number;
  passedScreens: number;
  warnScreens: number;
  failedScreens: number;
  totalConsoleErrors: number;
  totalFailedRequests: number;
  totalOverflowIssues: number;
  totalDurationMs: number;
  verdict: 'EXCELLENT' | 'STABLE_WITH_WARNINGS' | 'CRITICAL_DEFECTS';
  screens: ScreenCheckResult[];
}
```

## 4. Требования к Отчету (`.planning/qa_reports/index.html`)
1. **Автономность**: HTML не требует внешних CDN для стилей (встроенный легковесный CSS).
2. **Интерактивность**:
   - Фильтрация по статусам (`All`, `Only Failures`, `Only Warnings`).
   - Фильтрация по типам устройств (`All`, `Mobile`, `Desktop`).
   - Просмотр скриншотов с возможностью открытия в полном размере.
   - Детализация по каждому экрану: список селекторов распирающих элементов, трейсы ошибок консоли, сетевые 4xx/5xx.
