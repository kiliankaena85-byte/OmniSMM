# Smmplan Lite: Отчетная Стратегия Тестирования (ISO/IEC/IEEE 29119)
**Ревизия 2026.1** | Разработала: QA & SecOps Архитектура ИИ

## 1. Введение
Настоящий документ описывает математически доказуемый подход к автоматизированному тестированию проекта Smmplan Lite, обеспечивающий отказоустойчивость, защиту от регрессий и соблюдение мировых стандартов разработки SaaS.

## 2. Уровни тестирования (Test Levels)
*   **Unit & Integration (Vitest v4):** 
    *   *Покрытие (Thresholds):* `100% Branches`, `100% Functions`, `100% Lines` для критических доменов (Списание средств, Начисление рефералов, Алгоритмы цен).
    *   *Инструменты:* Vitest, Prisma Mocking, React Testing Library.
    *   *CI Gate:* Ни один коммит не пропустит логику с покрытием ниже 100%. Мы не допускаем математическую лень.
*   **End-to-End (Playwright):** 
    *   Симулирование пользовательских потоков (Регистрация по Magic Link -> Пополнение -> Создание заказа -> Выполнение).

## 3. Требования к Тестовым Окружениям
1.  **Test Environment (TE-1):** In-memory SQLite / изолированная PostgreSQL (в зависимости от CI) для скоростного прогона Prisma unit tests.
2.  **Staging (TE-2):** Полное зеркало продакшена. Содержит Redis, BullMQ workers.

## 4. Отрабатываемые сценарии угроз (Threat Modeling)
1.  **Гонка данных (Race Condition):** Покрытие Payment Gateways (YooKassa / CryptoBot) стресс-тестами (отправка 1000 webhook оплат одновременно).
2.  **State Manipulation:** Попытки отправить на клиент внутренние поля Prisma (например, `providerCost`). Проверяется через Zod + Type-safe DTO tests.
3.  **Data Escaping:** Тестирование `dangerouslySetInnerHTML` и React JSX DOM injection.

## 5. Ответственности Команды
*   **SDET Automation:** Обеспечение зелёных Pipeline в GitHub Actions / GitLab CI.
*   **SecOps:** Поиск и анализ 0-day уязвимостей в зависимостях (`npm audit`).
