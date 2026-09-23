---
name: legal-localization
description: "Legal Localization: правовые требования по рынкам (GDPR, 152-ФЗ, CCPA, ADA, FTC, ICP China, MENA культурные требования). Активировать при проектировании для EU/Россия/США/MENA/China рынков, при cookie consent, при privacy policy, при маркировке рекламы, при ICP. ALWAYS activate for legal compliance, GDPR, 152-FZ, CCPA, ICP, cookie consent, privacy policy, ad labeling, VAT display. Use this skill to scan, check, and validate when auditing or implementing this topic."
version: 1.0.0
---

# Legal Localization — правовые требования по рынкам

## When to activate

- Проектирование для EU/Россия/США/MENA/China рынков
- Нужен cookie consent banner
- Настройка privacy policy и согласий
- Маркировка рекламы для РФ
- ICP license для Китая
- Пользователь упоминает GDPR, 152-ФЗ, CCPA, cookie consent, privacy, ICP

## ЕВРОПЕЙСКИЙ СОЮЗ

### GDPR
- Cookie consent banner (ОБЯЗАТЕЛЬНО)
- Privacy policy на языке пользователя
- Right to erasure (право на удаление)
- Data export функция
- Consent must be freely given, specific, informed, unambiguous

### VAT Display
- Цены должны отображать налог
- "49.99 EUR incl. VAT" или "41.17 + 8.82 VAT"
- Различается по стране EU

### Withdrawal Rights
- 14-day return policy для digital goods
- Текст на сайте на местном языке

### Accessibility (EAA с 28 июня 2025)
- WCAG 2.1 AA для всех продуктов в EU
- Применяется к: веб-сайты, мобильные приложения, электронные книги, banking

## РОССИЯ

### 152-ФЗ «О персональных данных»
- Персональные данные граждан РФ храниться ТОЛЬКО на серверах в РФ
- Форма согласия на обработку ПД
- Политика конфиденциальности на русском языке
- Уведомление Роскомнадзора об обработке ПД

### НДС 20%
- Цены для РФ рынка: отображать с НДС
- Для ИП/ООО: возможность ввести ИНН

### Маркировка рекламы (с 2022)
- "Реклама" или "Рекл." на рекламных материалах
- ИНН рекламодателя
- Токен ОРИД в URL
- Применяется к: таргетированная реклама, инфлюенсеры, email-рассылки

## США

### CCPA (California)
- "Do Not Sell My Personal Information" link
- Opt-out механизм
- Применяется к компаниям с revenue > $25M или данными > 100K потребителей

### ADA Title III
- Accessibility compliance
- WCAG 2.1 AA standard
- Частные иски возможны

### FTC Rules
- "Ad" / "Sponsored" labels на рекламе
- No dark patterns (active enforcement)
- Disclosures должны быть clear and conspicuous

## БЛИЖНИЙ ВОСТОК (арабские страны)

### Культурные требования
- Нет откровенных изображений
- Халяльные опции для food products
- Исламский calendar option в датах
- Пятница-суббота = weekend (не суббота-воскресенье)

### Локальные платежи
- mada (Saudi Arabia)
- KNET (Kuwait)
- Fawry (Egypt)
- Нельзя ограничиваться только VISA/MC

## КИТАЙ

### ICP License
- Обязательна для коммерческих сайтов
- Процесс: 2-4 месяца получения
- Без ICP сайт может быть заблокирован

### Заблокировано
- Google services (Analytics, Fonts, Maps)
- Facebook, Twitter
- Многие CDN-сервисы

### Замены
- Google Analytics -> Baidu Analytics
- Google Fonts -> Сервировать локально
- Map -> Baidu Maps / Amap

### Платежи
- WeChat Pay, Alipay (ОБЯЗАТЕЛЬНО)
- VISA/MC — незначительная доля

### ICP Footer
- Номер в footer обязательно для всех страниц

## Design Checklist по рынкам

### EU Launch
- [ ] Cookie consent banner с granular options
- [ ] Privacy policy на каждом языке EU
- [ ] Right to erasure UI
- [ ] Data export функция
- [ ] VAT display в ценах
- [ ] WCAG 2.1 AA compliance

### Russia Launch
- [ ] Сервера в РФ для ПД
- [ ] Форма согласия на обработку ПД
- [ ] Политика конфиденциальности на русском
- [ ] НДС 20% в ценах
- [ ] ИНН поле для B2B
- [ ] Маркировка рекламы

### US Launch
- [ ] "Do Not Sell" link (CCPA)
- [ ] WCAG 2.1 AA compliance (ADA)
- [ ] "Ad" labels на sponsored content
- [ ] No dark patterns audit

### MENA Launch
- [ ] Скромные изображения
- [ ] Халяльные опции
- [ ] Islamic calendar option
- [ ] Пятница-суббота weekend
- [ ] Локальные платёжные методы

### China Launch
- [ ] ICP License получена
- [ ] Нет Google/Facebook зависимостей
- [ ] WeChat Pay + Alipay
- [ ] ICP номер в footer
- [ ] Baidu Analytics вместо GA

## Step-by-step execution protocol

1. **Identify target markets:** Определить целевые рынки и их правовые требования
2. **Create compliance checklist:** Составить чеклист по каждому рынку
3. **Design cookie consent:** Спроектировать cookie banner для EU/CCPA
4. **Design privacy UI:** Согласия, erasure, export
5. **Add VAT/tax display:** Настроить отображение налогов в ценах
6. **Add market-specific elements:** ICP footer, ad labels, локальные платежи
7. **Legal review:** Проверить с юристом для каждого рынка
8. **Test compliance:** Функциональное тестирование всех обязательных элементов

## Scope boundaries

### DOES
- Рекомендовать правовые требования по рынкам
- Проектировать UI для compliance (cookie consent, privacy, labels)
- Составлять чеклисты для каждого рынка
- Рекомендовать замены заблокированных сервисов

### DOES NOT
- Юридическая консультация (только awareness и чеклисты)
- Заменять юридический review
- Оформлять ICP License или другие юридические документы
- Гарантировать compliance (только рекомендации)

## Error handling

| Scenario | Response |
|----------|----------|
| Нет бюджета на юридический review | Приоритизировать: GDPR + местный закон = minimum, отложить менее критичные |
| Cookie consent замедляет сайт | Загружать banner асинхронно, не блокировать рендеринг |
| ICP License не получена для Китая | Не запускать на материковом Китае, сначала Hong Kong |
| Нет серверов в РФ для 152-ФЗ | Использовать Yandex Cloud или Selectel для ПД, остальные данные можно хранить где угодно |

## References

- [SMMplan Design Specification](file:///d:/SMM_plan_2/docs/design_specification.md)
- [SMMplan Legal Audits](file:///d:/SMM_plan_2/production_readiness_audit.md)