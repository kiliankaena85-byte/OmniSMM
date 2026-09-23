# Handoff Report: VK Refill Guarantee Article Outline

## 1. Observation
- The user requested a detailed outline for an article titled "Гарантия (Refill) на услуги ВК: как работает авто-докрутка при отписках."
- The article must be > 500 words and written in Russian.
- Required frontmatter: `title`, `category (VK)`, `seo_keywords`.
- Smmplan-specific mechanics must be integrated naturally: `TargetType`, `Drip-Feed`, `PENDING_CHECK`, `PARTIAL`, `Refill`.
- Based on `rg` search in Smmplan's codebase and knowledge base (`src/data/knowledge`), we observe that:
  - `TargetType` logic (e.g. `src/utils/target-type.ts`) differentiates between `POST` and `CHANNEL`.
  - `PENDING_CHECK` is the pre-flight status where `TargetType` validation and provider queueing occur.
  - `Drip-Feed` is used to split large orders into smaller chunks to emulate organic behavior.
  - `PARTIAL` is triggered when a provider cannot complete an order fully, leading to a partial refund.
  - `Refill` is managed via background workers (`BullMQ` `refillQueue`) to track drops and restore metrics.

## 2. Logic Chain
1. **Goal Alignment:** To meet the "No AI water" constraint, the outline is structured heavily around Smmplan's actual technical architecture.
2. **Pre-flight (PENDING_CHECK & TargetType):** Before discussing Refill, we must explain how Smmplan minimizes drops at the start. Validating the URL (`TargetType`) during `PENDING_CHECK` ensures we don't send channel followers to a post, which would result in errors or immediate drops.
3. **Execution (Drip-Feed):** To further prevent VK algorithm strikes, `Drip-Feed` provides gradual delivery.
4. **Post-completion (Refill & PARTIAL):** Even with precautions, VK deletes bots ("dogs"). Here, the `Refill` (гарантия) mechanic kicks in, checking the current count against the baseline. If an order cannot be fully completed or refilled due to provider constraints, it switches to `PARTIAL`, safeguarding the user's budget.
5. **SEO & Frontmatter:** I have included the requested frontmatter tags and SEO keywords relevant to VK promotion and refills.

## 3. Caveats
- I did not write the final article body, only the structured outline and strategy per constraints.
- The outline assumes the final writer will expand on each bullet point to reach the >500 words limit.

## 4. Conclusion
The comprehensive outline for the VK Refill article is provided below. It meets all technical and formatting constraints.

---

### Detailed Article Outline

**Frontmatter:**
```yaml
title: "Гарантия (Refill) на услуги ВК: как работает авто-докрутка при отписках."
category: "VK"
seo_keywords: ["гарантия refill вк", "списания подписчиков вк", "авто-докрутка вконтакте", "smmplan гарантия", "накрутка без списаний", "drip-feed вк"]
```

**H1: Гарантия (Refill) на услуги ВК: как работает авто-докрутка при отписках**

**Введение (Вводная проблематика)**
- Боль каждого SMM-специалиста: жесткие алгоритмы ВКонтакте. Массовые блокировки ботов ("собачки") и списания (дропы) подписчиков.
- Обычные накрутки без гарантии — это деньги на ветер.
- Презентация решения: архитектура Smmplan и услуги с пометкой **Refill (Гарантия)**.

**H2: Этап 1. Защита до старта: Валидация TargetType и статус PENDING_CHECK**
- Объяснение того, что защита от списаний начинается еще до старта накрутки.
- **PENDING_CHECK**: Что происходит сразу после нажатия кнопки "Заказать". Почему заказ не стартует мгновенно?
- **TargetType валидация**: Система автоматически проверяет тип ссылки (канал/группа, пост, история). Если отправить трафик подписчиков на ссылку поста, ВК воспримет это как аномалию. Интеллектуальный фильтр Smmplan предотвращает такие ошибки на старте, отклоняя неверные форматы.

**H2: Этап 2. Умное распределение трафика с помощью Drip-Feed**
- Как избежать радаров ВКонтакте во время выполнения заказа.
- Механика **Drip-Feed** (капельная накрутка): вместо залива 10 000 подписчиков за час, система разбивает заказ на органические партии (например, по 500 в день).
- Итог: плавный график роста не триггерит алгоритмы ВК, радикально снижая процент будущих списаний.

**H2: Этап 3. Неизбежные чистки ВК и алгоритм Refill (Авто-докрутки)**
- Признание реальности: ВК все равно периодически проводит массовые чистки ("purges"). 
- Как работает **Refill**:
  - Фиксация базового показателя (baseline) до старта.
  - Фоновые воркеры платформы постоянно мониторят ваш счетчик после завершения заказа (`COMPLETED`).
  - При просадке счетчика ниже целевого значения, активируется кнопка Refill (или автоматическая докрутка).
  - Провайдер бесплатно доставляет недостающий объем трафика.

**H2: Этап 4. Что если провайдер не справляется? Статус PARTIAL**
- Честность платформы: иногда из-за обновлений алгоритмов ВК провайдер технически не может безопасно докрутить весь объем.
- Переход заказа в статус **PARTIAL** (Частично выполнено).
- Автоматический перерасчет и моментальный возврат (refund) неизрасходованных средств на баланс клиента. Бюджет защищен.

**H2: Вывод (Заключение)**
- Краткий итог: почему долгосрочное продвижение ВКонтакте возможно только с инструментами вроде `Refill` и `Drip-Feed`.
- Smmplan — это не просто перепродажа, а Enterprise-инфраструктура, где статусы и валидации (`PENDING_CHECK`, `TargetType`, `PARTIAL`) работают как единый щит для защиты бюджета и репутации сообщества.

---

## 5. Verification Method
- Ensure the frontmatter is correctly formatted at the top of the output file.
- Check that all terms (`TargetType`, `Drip-Feed`, `PENDING_CHECK`, `PARTIAL`, `Refill`) are logically connected in the generated article text without hallucinated Smmplan logic.
- Verify the final word count is >500 words when the actual text is written based on this outline.
