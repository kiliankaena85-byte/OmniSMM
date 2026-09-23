# Observation
I read the task requirements in `task_explorer.md` and the scope in `SCOPE.md`.
The goal is to draft an outline for VK Article 17: "Накрутка опросов и голосований ВК: нюансы и безопасность."
The article must be in Russian, aim for > 500 words, include specific Markdown frontmatter, and naturally integrate Smmplan mechanics (TargetType, Drip-Feed, PENDING_CHECK, PARTIAL, Refill/Гарантия) without "AI water" clichés.

# Logic Chain
1. To avoid clichés ("в современном мире"), the introduction should jump straight to the functional value of VK polls.
2. The article structure should logically cover types of polls, safety measures, order processing, and guarantees.
3. Smmplan mechanics integration:
   - **TargetType**: Explain this in the section about submitting the correct link to a poll. Users often make mistakes; Smmplan automatically validates the link format.
   - **Drip-Feed**: Natural fit for the "Safety" section. Explain how gradual delivery of votes prevents algorithmic detection.
   - **PENDING_CHECK**: Belongs in a section about execution speed. Explains why some high-quality providers take time to start.
   - **PARTIAL**: Fits in a section about incomplete orders. Reassures users that if the system can't deliver all votes (e.g., due to VK limits), they get an automatic partial refund.
   - **Refill/Гарантия**: Fits in a "Protection against drops" section, explaining how to secure results if VK deletes some votes.

# Caveats
No caveats. The outline is robust and provides enough structure to easily exceed 500 words when expanded by the Worker agent.

# Conclusion
The draft outline is ready for the Worker agent to expand into the full article.

# Verification Method
1. Read `d:\SMM_plan_2\.agents\sub_orch_vk_article_17\explorer_1_handoff.md`.
2. Check that all 5 Smmplan mechanics are present in the outline.
3. Verify that the required Markdown frontmatter is specified.
4. The Reviewer agent will verify the final text length and lack of "AI water".

---

## Draft Outline for VK Article 17

**Frontmatter Setup:**
```markdown
---
title: "Накрутка опросов и голосований ВК: нюансы и безопасность"
category: "VK"
seo_keywords: ["накрутка опросов вк", "накрутка голосований вконтакте", "безопасная накрутка опросов", "голоса вк", "smmplan"]
---
```

**Section 1: Введение (без шаблонных фраз)**
- Прямой переход к сути: зачем бизнесу и авторам нужна победа в опросах ВКонтакте (формирование социального доказательства, выигрыш в конкурсах, управление мнением аудитории).
- Ошибки новичков: почему массовая и быстрая заливка дешевых ботов убивает аккаунт и приводит к дисквалификации.

**Section 2: Типы опросов ВК и специфика ссылок**
- Разница между открытыми (публичными) и анонимными голосованиями. Особенности накрутки для каждого типа.
- Где размещен опрос: на стене, в обсуждениях группы, в личном профиле.
- **Интеграция Smmplan (TargetType)**: Объяснить распространенную проблему — пользователи часто вставляют некорректные ссылки (например, на саму группу вместо поста с опросом). Система Smmplan использует `TargetType link validation`: алгоритм до старта проверяет формат URL, чтобы исключить запуск заказа "в пустоту" и трату баланса.

**Section 3: Безопасность и обход спам-фильтров**
- Как алгоритмы ВКонтакте распознают накрутку (анализ скорости прироста голосов, отсутствие сопутствующей активности).
- **Интеграция Smmplan (Drip-Feed)**: Использование функции капельной подачи. Рассказать, как настроить постепенное поступление голосов (например, по 10-20 голосов в час), что имитирует естественную органическую динамику и снижает риск списаний до минимума.

**Section 4: Процесс выполнения: статусы и задержки**
- Реалии качественной накрутки: почему голоса не всегда появляются мгновенно.
- **Интеграция Smmplan (PENDING_CHECK)**: Пояснить статус `PENDING_CHECK`. Качественные провайдеры с живыми исполнителями могут требовать времени на верификацию задания. Это нормальный этап, подтверждающий ручную обработку или подготовку сетки аккаунтов.

**Section 5: Гарантии, списания и частичные выполнения**
- Причины списаний голосов ВКонтакте (удаление "собачек", зачистка ботов соцсетью).
- Что делать, если заказ остановился на полпути.
- **Интеграция Smmplan (PARTIAL)**: Статус `PARTIAL` защищает клиента. Если провайдер не смог доставить полный объем голосов из-за лимитов базы, заказ переходит в статус PARTIAL, и остаток средств автоматически возвращается на баланс.
- **Интеграция Smmplan (Refill/Гарантия)**: Важность выбора услуг с гарантией. Если часть голосов спишется, кнопка `Refill` обеспечит бесплатную докрутку до заказанного объема в течение гарантийного периода.

**Section 6: Заключение**
- Краткое резюме: накрутка голосований требует аккуратности, правильных ссылок и постепенности.
- Рекомендация комбинировать голоса с лайками и просмотрами на самом посте для создания органичной картины активности.
