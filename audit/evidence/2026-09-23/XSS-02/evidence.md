# Доказательство исправления XSS-02 (JSON-LD собирается без экранирования)

## 1. До исправления
В нескольких компонентах и страницах (`src/app/page.tsx`, `src/app/academy/[slug]/page.tsx`, `src/components/ab-test/FluxFAQ.tsx`, `src/components/ab-test/FluxReviews.tsx`) разметка `application/ld+json` сериализовалась с помощью `JSON.stringify(...)` напрямую в HTML-атрибут `dangerouslySetInnerHTML={{ __html: ... }}` без экранирования символа `<`.
Если входные данные (название услуги, вопрос FAQ, отзыв или заголовок статьи) содержали строку `</script><script>alert(1)</script>`, парсер HTML браузера преждевременно закрывал открытый тег `<script type="application/ld+json">` и выполнял внедрённый тег `<script>`, приводя к XSS.

## 2. Правки
Во всех файлах генерации JSON-LD добавлено обязательное экранирование `<` на безопасную Unicode-последовательность `\u003c`:
- `src/app/page.tsx`: добавлен `.replace(/</g, '\\u003c')`
- `src/app/academy/[slug]/page.tsx`: добавлен `.replace(/</g, '\\u003c')`
- `src/components/ab-test/FluxFAQ.tsx`: добавлен `.replace(/</g, '\\u003c')`
- `src/components/ab-test/FluxReviews.tsx`: добавлен `.replace(/</g, '\\u003c')`
- Создан модульный тест `src/__tests__/unit/json-ld-xss-escape.test.ts`.

## 3. После исправления
Прогон теста:
```bash
npx dotenv -e .env.test -- npx vitest run src/__tests__/unit/json-ld-xss-escape.test.ts
```
Вывод:
```
 ✓ src/__tests__/unit/json-ld-xss-escape.test.ts (1 test) 34ms
 Test Files  1 passed (1)
      Tests  1 passed (1)
```
Результат:
Все 8 файлов проекта, содержащие `application/ld+json`, экранируют символ `<` с помощью `\u003c`, делая невозможным преждевременное закрытие тега `<script>` в HTML-документе.
