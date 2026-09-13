# SPEC-2026-09-13: Интеграция Yandex SmartCaptcha в аутентификацию (SDD-TDD 2026)

## 1. Контекст и Цель
Защита форм аутентификации (Magic Link, вход по паролю, регистрация) от автоматизированного перебора (brute-force), спама и регистрации ботов с помощью сервиса **Yandex SmartCaptcha**.

## 2. Жесткие Инварианты
1. **Server-Side Validation:** Токен проверяется на бэкенде через \https://smartcaptcha.yandexcloud.net/validate\.
2. **Fail-Closed & Env Awareness:**
   - При наличии \SMARTCAPTCHA_SERVER_KEY\ проверка токена обязательна.
   - При отсутствии токена возвращается \{ success: false, error: Пожалуйста, пройдите проверку капчи }\.
   - Если серверный ключ не настроен (локальная разработка/тесты без ключей), пропускается с логированием предупреждения.
3. **CSP Strict Compliance:** Домены \smartcaptcha.yandexcloud.net\ уже добавлены в \script-src\, \connect-src\, \rame-src\ в \src/proxy.ts\.
4. **Theme Support:** Автоматическая адаптация под темную/светлую тему оформления.
5. **Zero-Props-Loss & Backward Compatibility:** Формы авторизации продолжают работать во всех существующих тестах (мокируемый сервис валидации).

## 3. Архитектура Модулей
- \src/services/security/smartcaptcha.service.ts\: Серверная валидация токена.
- \src/components/auth/SmartCaptchaWidget.tsx\: Клиентский React-компонент загрузки и рендера капчи.
- \src/actions/auth/request-magic-link.ts\: Проверка капчи перед генерацией ссылки.
- \src/actions/auth/password-login.ts\: Проверка капчи при входе по паролю.
- \src/actions/auth/password-register.ts\: Проверка капчи при регистрации.
- \src/app/(auth)/login/login-form.tsx\: Встраивание виджета в UI.

## 4. План Верификации
- \src/__tests__/security/smartcaptcha.test.ts\ (100% PASS).
- \
px tsc --noEmit\ (0 ошибок).
- \
ode scripts/check-bundle-secrets.mjs\ (0 утечек).
