---
name: copywriting-ux-writing
description: "Слова как интерфейс: CTA тексты, hero заголовки, error messages, microcopy. Слова конвертируют больше чем визуал. Активировать при написании CTA, заголовков, error messages, onboarding текстов, при формулировке value proposition. ALWAYS activate for CTA copy, hero headlines, error messages, microcopy, UX writing, when words impact conversion. Use this skill to scan, check, and validate when auditing or implementing this topic."
version: 1.0.0
---

# Copywriting / UX Writing — слова как интерфейс

## When to activate

- Пишутся CTA тексты для кнопок
- Формулируются заголовки hero section
- Создаются error messages и empty states
- Проектируется onboarding с текстовым сопровождением
- Нужна формулировка value proposition
- Пользователь спрашивает «какой текст написать»

## Принцип: текст = интерфейс

Слова конвертируют больше, чем визуал. Кнопка «Начать бесплатно» конвертирует на 30%+ лучше чем «Зарегистрироваться». Заголовок с конкретным результатом бьёт generic claim каждый раз.

## CTA Formula

#### Результат > Действие

| Плохо (действие) | Хорошо (результат) |
|-------------------|---------------------|
| Зарегистрироваться | Начать бесплатно |
| Отправить форму | Получить аудит |
| Купить | Попробовать 14 дней |
| Скачать | Получить доступ |
| Подписаться | Присоединиться к 2,847 командам |

## Hero Headline Formula

#### [Кто] + [Результат] + [Без боли]

- «Маркетинговые команды закрывают на 40% больше сделок — без ручной отчётности»
- «Разработчики деплоят в 3 раза быстрее — без настройки CI/CD»
- «Финансовые команды экономят 12 часов в неделю — без Excel-хаков»

## Error Messages

#### Принцип: помоги, не обвиняй

| Плохо | Хорошо |
|-------|--------|
| Invalid input | Введите email в формате name@example.com |
| Error 500 | Что-то пошло не так. Попробуйте ещё раз через минуту |
| Required field | Нам нужно ваше имя, чтобы отправить результаты |
| Unauthorized | Войдите в аккаунт, чтобы увидеть эту страницу |

## Запрещённые слова (Anti-Slop)

- «Seamless», «Next-Gen», «Revolutionize», «Unleash», «Elevate»
- «Cutting-edge», «Game-changing», «World-class»
- «Empower», «Leverage», «Synergy»
- Generic числа: «99.99%», «50%», «100%»
- Em-dash в заголовках (—)

## Step-by-step execution protocol

1. **Identify copy context**: Определить где будет текст (CTA / hero / error / onboarding)
2. **Map to JTBD**: Связать текст с «job» элемента (из jtbd-design skill)
3. **Apply formula**: Использовать соответствующую формулу (CTA / headline / error)
4. **Check anti-slop**: Убедиться что нет запрещённых слов и паттернов
5. **A/B variants**: Предложить 2-3 варианта для A/B тестирования
6. **Localize check**: Проверить что текст переводим (если i18n в scope)
7. **Tone consistency**: Сверить с tone of voice из client-dna
8. **Measure**: Определить метрику для оценки эффективности текста

## Scope boundaries

### DOES
- Формулировать CTA тексты, заголовки, error messages, microcopy
- Применять формулы результат > действие
- Проверять тексты на anti-slop паттерны
- Связывать тексты с JTBD и бизнес-контекстом

### DOES NOT
- Писать длинный маркетинговый copy (landing page body)
- Заменять профессионального copywriter для сложных проектов
- Создавать brand voice с нуля (используйте client-dna)
- Переводить тексты (используйте i18n skill)

## Error handling

| Scenario | Response |
|----------|----------|
| Клиент хочет «Seamless experience» в CTA | Предложить альтернативу с конкретным результатом, объяснить почему generic хуже |
| Нет данных для конкретных чисел в headline | Не использовать числа, формулировать через результат без цифр |
| Error message требует технического контекста | Показать ошибку + пояснение для разработчика в details |
| Несколько вариантов CTA для A/B теста | Предложить 3 варианта с разным подходом (результат / социальное доказательство / urgency) |

## References

- [SMMplan Design Specification](file:///d:/SMM_plan_2/docs/design_specification.md)
- [SMMplan Legal Audits](file:///d:/SMM_plan_2/production_readiness_audit.md)