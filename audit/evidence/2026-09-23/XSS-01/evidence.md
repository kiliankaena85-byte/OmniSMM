# Доказательство исправления XSS-01 (Реквизиты компании подставляются в HTML юридических документов)

## 1. До исправления
В `src/actions/order/legal.ts` и `src/components/legal/LegalPageContent.tsx` данные настроек компании (`COMPANY_NAME`, `COMPANY_INN`, `COMPANY_OGRNIP`, `COMPANY_ADDRESS`, `SUPPORT_EMAIL`, `PRIVACY_EMAIL`, `SITE_NAME`, `TELEGRAM_BOT`) напрямую заменялись через `.replace()` / `.replaceAll()` в шаблон HTML без экранирования спецсимволов HTML (`<`, `>`, `"`, `'`, `&`).
В результате, если администратор или злоумышленник с доступом к настройкам сохранял реквизиты, содержащие HTML/JS (`<img src=x onerror=alert(1)>` или теги `<script>`, `<iframe>`), данная разметка внедрялась в тело юридических документов оферты и политики конфиденциальности, приводя к хранимой XSS.

## 2. Правки
1. `src/lib/sanitize.ts`:
   - Реализована и экспортирована функция `escapeHtml(str)` для безопасного экранирования спецсимволов HTML (`&`, `<`, `>`, `"`, `'`).
2. `src/actions/order/legal.ts`:
   - Все параметры настроек компании экранируются через `escapeHtml()` перед подстановкой в плейсхолдеры шаблона `{{...}}`.
3. `src/components/legal/LegalPageContent.tsx`:
   - Все параметры настроек компании экранируются через `escapeHtml()` перед вызовом `replaceAll()` и `sanitizeArticleHtml()`.
4. Создан автоматический модульный тест `src/__tests__/unit/legal-xss-prevention.test.ts`.

## 3. После исправления
Прогон теста:
```bash
npx dotenv -e .env.test -- npx vitest run src/__tests__/unit/legal-xss-prevention.test.ts
```
Вывод:
```
 ✓ src/__tests__/unit/legal-xss-prevention.test.ts (3 tests) 39ms
 Test Files  1 passed (1)
      Tests  3 passed (3)
```
Результат компиляции TypeScript:
```bash
npx tsc --noEmit
# Exit code 0
```
Внедрённые HTML-теги нейтрализуются в безопасные сущности (`&lt;img ...&gt;`, `&lt;script&gt;...&lt;/script&gt;`) и не выполняются браузером.
