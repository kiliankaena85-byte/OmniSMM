# Handoff Report: VK Article 18 Outline

## 1. Observation
- The task requires drafting an outline for an article titled "Гарантия (Refill) на услуги ВК: как работает авто-докрутка при отписках."
- The article must be written in Russian, exceed 500 words, and be saved to `d:\SMM_plan_2\src\data\knowledge\vk_refill_guarantee_explained.md`.
- It must include markdown frontmatter with `title`, `category`, and `seo_keywords`.
- "AI water" is strictly prohibited.
- Smmplan mechanics must be integrated naturally, specifically: `TargetType` link validation, `Drip-Feed`, `PENDING_CHECK`, `PARTIAL`, and `Refill`/Гарантия.

## 2. Logic Chain
- **Frontmatter**: Needs precise SEO keywords and correct categorization to match the task constraints.
- **Introduction**: Must dive straight into the problem (VK algorithm cleans up bots/dogs) without cliché phrases.
- **Section 1 (Refill Mechanism)**: Explains the core concept of warranty and automatic replenishment.
- **Section 2 (Order Lifecycle & TargetType)**: Integrates `TargetType` link validation (e.g., `CHANNEL` for groups) and the `PENDING_CHECK` status, demonstrating the technical rigor of Smmplan's workers monitoring the counter.
- **Section 3 (PARTIAL status)**: Explains how Smmplan handles edge cases where the provider can't fulfill the complete refill, moving the order to `PARTIAL` and refunding the difference based on `pricePerUnitRub`.
- **Section 4 (Drip-Feed)**: Positions `Drip-Feed` as a preventative measure to reduce initial drop-offs, making the Refill process smoother and safer.
- **Section 5 (FAQ & Edge Cases)**: Covers practical questions to ensure the word count naturally exceeds 500 words without padding. Emphasizes the rule that changing a link invalidates the Refill tracking.

## 3. Caveats
- The outline assumes standard Smmplan architecture (BullMQ workers, Prisma, Next.js UI) is running behind the scenes, though the article is targeted at the end-user, so technical terms (`PENDING_CHECK`, `TargetType`, `PARTIAL`) are explained from a business/value perspective.
- Word count requirement (> 500 words) will apply to the final implementation, not the outline itself.

## 4. Conclusion
The proposed outline and frontmatter fully satisfy the requirements and provide a solid foundation for the implementation agent to generate a high-quality, technically accurate, and user-friendly article.

### Proposed Frontmatter:
```yaml
---
title: "Гарантия (Refill) на услуги ВК: как работает авто-докрутка при отписках"
category: "VK"
seo_keywords:
  - "ВК накрутка с гарантией"
  - "refill ВКонтакте"
  - "авто-докрутка ВК"
  - "отписки ВКонтакте"
  - "гарантия от списаний"
---
```

### Proposed Outline:
1. **Введение (Без воды)**
   - Проблема алгоритмических чисток ВК ("собачки", списания).
   - Суть услуги Refill (Гарантия): защита инвестиций в продвижение.
2. **Как работает валидация и старт (TargetType)**
   - Строгая проверка ссылки на старте (`TargetType: CHANNEL` для пабликов, `POST` для записей). Почему нельзя ошибаться форматом.
3. **Механизм мониторинга и статус PENDING_CHECK**
   - Переход заказа в статус `PENDING_CHECK` после завершения наливки.
   - Как фоновые воркеры Smmplan мониторят счетчик и фиксируют просадки.
4. **Активация докрутки (Refill)**
   - Периоды гарантии (30, 60 дней) и автоматическое возобновление работы (или появление кнопки Refill).
5. **Частичное выполнение и статус PARTIAL**
   - Что делать, если лимиты ВК не позволяют докрутить объем.
   - Переход в `PARTIAL` и автоматический перерасчет баланса с точностью до единицы.
6. **Защита от списаний: синергия Refill и Drip-Feed**
   - Почему капельная подача (`Drip-Feed`) снижает риск агрессивных списаний.
   - Как настроить runs (партии) и intervals (интервалы) вместе с гарантией.
7. **Частые ошибки пользователей (FAQ)**
   - Смена URL группы (сброс трекинга).
   - Запуск двух услуг на одну ссылку (конфликт мониторинга).

## 5. Verification Method
- The implementation agent should verify the output file path (`d:\SMM_plan_2\src\data\knowledge\vk_refill_guarantee_explained.md`).
- Run `wc -w` on the generated content to ensure it exceeds 500 words.
- Review the generated article to ensure terms like `TargetType`, `PENDING_CHECK`, `PARTIAL`, `Refill`, and `Drip-Feed` are present and correctly contextualized.
