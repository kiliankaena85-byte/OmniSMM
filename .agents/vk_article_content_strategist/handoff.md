# Handoff Report: VK Article Strategy & Outline

## 1. Observation
- **Goal**: Draft an outline for a 500+ word SEO article: "Почему ВКонтакте списывает подписчиков и превращает их в собачек".
- **Target path**: `d:\SMM_plan_2\src\data\knowledge\vk_deleted_followers_dogs.md`.
- **Constraints**: 
  1. No "AI water" (fluff, generic filler). 
  2. Must integrate specific Smmplan mechanics: `TargetType` link validation, `Drip-Feed`, `PENDING_CHECK`, `PARTIAL`, `Refill/Гарантия`.
  3. Must address customer pain points.

## 2. Logic Chain
1. **Pain Point Identification**: Customers buy VK followers, but VK's algorithms quickly ban cheap bots (turning them into "dogs") and remove them. The customer loses money and ruins their group's reputation.
2. **Mechanics Mapping to Pain Points**:
   - *Pain*: "I bought followers, but my group was private/link was wrong, and the money was wasted." -> **Solution**: `PENDING_CHECK` (pre-flight validation of group status) and `TargetType` validation (ensuring the link actually points to a channel/group, not a post).
   - *Pain*: "VK banned my group because 10,000 bots joined in 5 minutes." -> **Solution**: `Drip-Feed` (smart pacing to emulate organic growth and bypass velocity filters).
   - *Pain*: "Half the bots got banned midway through the order." -> **Solution**: `PARTIAL` status (the system halts the order, charges only for successful deliveries, and refunds the rest automatically).
   - *Pain*: "I lost 20% of the followers a week later." -> **Solution**: `Refill / Гарантия` (automatic restoration of dropped metrics).
3. **Outline Structure**: The article must open with the specific problem (why VK does this), explain the technical reasons (algorithms), and present Smmplan's architectural safeguards as the ultimate solution to protect the user's budget.

## 3. Caveats
- This is a strategy and outline document. The final >500-word Russian article must be written and placed in `d:\SMM_plan_2\src\data\knowledge\vk_deleted_followers_dogs.md` by the implementer.
- The tone should be technical yet accessible (API/operator-centric), avoiding generic marketing clichés.

## 4. Conclusion
Below is the proposed strategy and outline for the implementer to follow:

### Article Strategy
**Core Message**: Stop buying raw bots that get banned. Smmplan isn't just a reseller; it's an engineering layer that protects your budget from VK's aggressive anti-spam algorithms using smart mechanics.
**Tone**: Direct, analytical, solution-oriented. 
**SEO Keywords**: накрутка подписчиков ВК, списания ВКонтакте, собачки ВК, почему ВК списывает подписчиков, безопасная накрутка.

### Proposed Outline

**H1: Почему ВКонтакте списывает подписчиков и превращает их в «собачек» (и как этого избежать)**

**Введение (The Pain)**
- Описание проблемы: вы заказываете подписчиков, а через день вместо них — кладбище удалённых страниц («собачек»).
- Как это вредит алгоритмам ВК (падение охватов, риск теневого бана).

**H2: Как работают алгоритмы ВК: 3 причины массовых списаний**
1. **Аномальная скорость (Velocity filters)**: Резкий скачок с 10 до 1000 подписчиков за час.
2. **Мусорный трафик**: Аккаунты без аватарок, созданные 5 минут назад, которые массово вступают в сотни групп.
3. **Ошибки старта**: Попытка налить трафик в закрытую группу или по кривой ссылке (алгоритмы расценивают это как сбой или фрод).

**H2: Как архитектура Smmplan защищает ваш бюджет и группу**
*(В этом блоке продаем фичи платформы как инженерные решения)*
- **Умный старт (PENDING_CHECK и TargetType)**: Мы не льем в пустоту. До старта система проверяет вашу ссылку (`TargetType` validation) — точно ли это группа, а не пост? Открыта ли она? Если есть ошибка, заказ блокируется, а деньги остаются на балансе.
- **Имитация органики (Drip-Feed)**: Обход алгоритмов ВК. Вместо лавины ботов мы используем Drip-Feed — порционная подача. Например, 1000 подписчиков равномерно распределяются на 5 дней. ВК видит это как естественный рост.
- **Честный расчет (Статус PARTIAL)**: Если во время выполнения провайдер начинает сбоить или ВК запускает массовую чистку, Smmplan останавливает заказ и переводит его в статус `PARTIAL`. Вы платите только за фактически вступивших, остаток мгновенно возвращается на баланс.

**H2: Что делать со списаниями? (Гарантия)**
- Отписки неизбежны, но вы не должны платить дважды. Объяснение работы механики `Refill (Гарантия)`.
- Если часть аудитории списали, автоматический Refill восстановит объем без дополнительных доплат в рамках гарантийного периода.

**H3: Заключение**
- Главная мысль: умная архитектура важнее дешевых цен. Smmplan берет на себя техническую защиту вашего профиля.

## 5. Verification Method
- **Implementation**: Inspect the generated markdown file at `d:\SMM_plan_2\src\data\knowledge\vk_deleted_followers_dogs.md`.
- **Criteria**: Verify the word count is >500. Search the document for the exact terms: `TargetType`, `Drip-Feed`, `PENDING_CHECK`, `PARTIAL`, `Refill`. Ensure the tone aligns with the "No AI water" constraint.
