# Handoff Report: Outline & Strategy for VK Article

## 1. Observation
The user requested an outline and strategy for an SEO article titled "Почему ВКонтакте списывает подписчиков и превращает их в собачек" (length > 500 words). The target path for the final article is `d:\SMM_plan_2\src\data\knowledge\vk_deleted_followers_dogs.md`. We must avoid "AI water" and natively integrate Smmplan mechanics (TargetType link validation, Drip-Feed, PENDING_CHECK, PARTIAL, Refill/Гарантия).

## 2. Logic Chain
To create a high-quality, deeply technical SEO article that avoids typical AI fluff, the outline is structured to focus on VK's actual anti-fraud algorithms, moving seamlessly into how Smmplan's architectural safeguards counteract these algorithms.
- **Introduction**: Establish the difference between normal unsubs and algorithmic bans ("dogs").
- **VK Algorithms**: Explain behavior analysis, IP tracking, and trust scores.
- **Smmplan Integration**:
  - `TargetType`: Routing accuracy prevents formatting anomalies.
  - `Drip-Feed`: Evades velocity filters (spike detection).
  - `PENDING_CHECK` & `PARTIAL`: Graceful failure without brute-forcing low-quality bots.
  - `Refill`: SLA-based recovery for algorithmic drops.
- **Conclusion**: Actionable advice for group admins.

## 3. Caveats
- The outline does not contain the full text, only the structure and strategy. The final text must ensure deep technical accuracy regarding VK's current ML algorithms.
- Smmplan features need to be described as technical capabilities (API, architecture), not just marketing buzzwords.

## 4. Conclusion
### Outline: Почему ВКонтакте списывает подписчиков и превращает их в "собачек"

1. **Введение: Анатомия "собачек" и списаний**
   - Что такое "собачка" (удаленная или замороженная страница).
   - Разница между органической отпиской и алгоритмической чисткой (списанием).
   
2. **Как работают антифрод-алгоритмы ВКонтакте**
   - Анализ графа связей и паттернов поведения (Velocity Checks, резкие всплески).
   - Оценка Trust Score аккаунтов (возраст, активность, IP/Fingerprint).
   - Шэдоубан и пессимизация пабликов за резкие скачки низкокачественного трафика.

3. **Почему появляются "собачки" при накрутке**
   - Использование дешевых бот-сетей с заблокированными IP.
   - Массовые подписки без эмуляции задержки пользователя (Human typing/reading delay).
   
4. **Инженерный подход к безопасности: Механики Smmplan**
   - **Строгая валидация TargetType**: Система `TargetType` (`CHANNEL`, `POST`) гарантирует правильную маршрутизацию трафика. Ошибочные типы ссылок часто триггерят фильтры соцсетей; точная валидация Smmplan исключает аномальное поведение API провайдеров.
   - **Drip-Feed (Капельная подача)**: Обход алгоритмов всплеска активности. Smmplan разбивает пул подписок на микро-партии с рандомизированными задержками, математически эмулируя органический вирусный рост.
   - **Статусы PENDING_CHECK и PARTIAL**: Защита от "грязной" докрутки. Если алгоритмы ВК начинают агрессивно резать трафик ("шторм"), Smmplan не форсирует добавление ботов. Заказ переходит в `PENDING_CHECK` для анализа, а затем в `PARTIAL` — пользователь получает возврат средств за невыполненную часть, сохраняя качество паблика.
   - **Гарантия и Refill (Докрутка)**: Архитектурное решение проблемы отписок. Автоматический запрос на Refill восполняет потери через заданные интервалы, поддерживая метрики без риска пессимизации.

5. **Практические рекомендации для владельцев пабликов**
   - Очистка сообщества от "собачек" перед стартом кампаний (повышение ER).
   - Комбинация Drip-Feed и белой таргетированной рекламы.

### Strategy
- **Tone**: Technical, analytical, API-focused. No emotional "AI water" like "В современном мире соцсетей...".
- **Focus**: Treat VK's algorithm as a software constraint and Smmplan as the architectural solution.
- **SEO**: Use natural keywords related to VK drops, shadowbans, and safe promotion.

## 5. Verification Method
- Inspect the file `d:\SMM_plan_2\.agents\article_draft\handoff.md` to verify the outline is comprehensive.
- Review the final markdown article once generated to ensure all specified mechanics (TargetType, Drip-Feed, PENDING_CHECK, PARTIAL, Refill) are integrated logically.
