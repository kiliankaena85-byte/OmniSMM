export interface LegalFallback {
  title: string;
  html: string;
}

export const legalNoticeComment = `<!-- ЮРИДИЧЕСКИЙ СТАТУС: ENTERPRISE IRONCLAD v5.1 — Экспертиза gsd-legal-defense-team -->`;

export const aiDraftStampHtml = `
<div class="mt-8 p-4 bg-muted/50 rounded-xl border border-border text-xs text-muted-foreground font-mono flex items-center justify-between flex-wrap gap-2">
  <span>Действующая редакция: Август 2026 г. (152-ФЗ, 54-ФЗ, 115-ФЗ, ЗоЗПП)</span>
  <span class="font-bold text-foreground">Юридическая служба {{SITE_NAME}}</span>
</div>
`;

export const FALLBACK_TERMS_HTML = `
${legalNoticeComment}
<div class="mb-6 p-4 bg-muted/50 rounded-xl border border-border text-xs text-muted-foreground flex items-center justify-between flex-wrap gap-2">
  <span>Редакция от 29 августа 2026 года</span>
  <span class="font-bold text-primary">Публичная оферта (ст. 437 ГК РФ)</span>
</div>

<p class="font-semibold text-foreground text-sm leading-relaxed mb-6">
  Настоящий документ является публичной офертой <strong>{{COMPANY_NAME}}</strong> (далее — «Исполнитель») в соответствии со ст. 437 Гражданского кодекса РФ (ГК РФ) заключить Договор возмездного оказания информационно-технических услуг на изложенных ниже условиях с любым дееспособным лицом (далее — «Заказчик»).
</p>

<h3 class="text-base sm:text-lg font-extrabold text-foreground mt-6 mb-3 border-b border-border/60 pb-2">
  1. Предмет договора и Порядок акцепта
</h3>
<div class="space-y-3 text-xs sm:text-sm leading-relaxed text-foreground/90">
  <p><strong>1.1.</strong> Исполнитель оказывает Заказчику информационно-технические услуги по доставке метрик активности (просмотры, реакции, подписчики и др.) на общедоступные страницы в социальных сетях через платформу <strong>{{SITE_NAME}}</strong>, Telegram-бот <strong>{{TELEGRAM_BOT}}</strong> или API, а Заказчик оплачивает Услуги.</p>
  <p><strong>1.2.</strong> Полным и безоговорочным принятием (Акцептом) настоящей Оферты (ст. 438 ГК РФ) признается любое из действий: регистрация или авторизация на Сайте/боте, внесение аванса на Баланс или отправка заказа по API.</p>
  <p><strong>1.3.</strong> Согласно ст. 160 ГК РФ и Федеральному закону № 63-ФЗ действия Заказчика в интерфейсе признаются простой электронной подписью (ПЭП). Логи сервера, IP-адреса и системные отметки времени являются надлежащими письменными доказательствами (ст. 75 ГПК РФ, ст. 89 АПК РФ).</p>
</div>

<h3 class="text-base sm:text-lg font-extrabold text-foreground mt-6 mb-3 border-b border-border/60 pb-2">
  2. Регламент оказания услуг и Технические требования
</h3>
<div class="space-y-3 text-xs sm:text-sm leading-relaxed text-foreground/90">
  <p><strong>2.1.</strong> В соответствии со ст. 706 ГК РФ Исполнитель вправе привлекать к исполнению третьих лиц (технологических субподрядчиков и операторов телекоммуникационных мощностей).</p>
  <p><strong>2.2. Требования к целевому объекту:</strong> продвигаемый профиль или публикация обязаны быть открытыми (общедоступными) на весь период выполнения. Запрещается изменять логин профиля (username/ссылку) или удалять публикацию до завершения заказа. При нарушении данных условий услуга считается оказанной надлежащим образом.</p>
  <p><strong>2.3.</strong> Оказываемые Услуги носят информационный характер и не направлены на неправомерный доступ к компьютерной информации или нарушение функционирования ЭВМ (ст. 272, 273 УК РФ).</p>
  <p><strong>2.4.</strong> Для услуг с отметкой «Гарантия / Refill» Исполнитель обеспечивает бесплатное довнесение списанных показателей в течение гарантийного срока (от 30 дней). По тарифам «Без гарантии» претензии по списаниям алгоритмами соцсетей не принимаются.</p>
</div>

<h3 class="text-base sm:text-lg font-extrabold text-foreground mt-6 mb-3 border-b border-border/60 pb-2">
  3. Стоимость, Оплата и Фискализация (54-ФЗ)
</h3>
<div class="space-y-3 text-xs sm:text-sm leading-relaxed text-foreground/90">
  <p><strong>3.1.</strong> Цены номинируются в российских рублях (RUB) и отображаются в каталоге сервиса. Оплата производится на условиях 100% авансирования через доступные банковские шлюзы (ЮKassa, Robokassa, СБП, банковские карты, безналичный расчет для API).</p>
  <p><strong>3.2.</strong> Исполнитель применяет УСН (гл. 26.2 НК РФ, без НДС). Кассовый чек формируется в момент совершения платежа и направляется на email Заказчика (Федеральный закон № 54-ФЗ).</p>
</div>

<h3 class="text-base sm:text-lg font-extrabold text-foreground mt-6 mb-3 border-b border-border/60 pb-2">
  4. Порядок возврата денежных средств
</h3>
<div class="space-y-3 text-xs sm:text-sm leading-relaxed text-foreground/90">
  <p><strong>4.1. Автоматический возврат на баланс:</strong> при технической ошибке (ERROR) или отмене заказа до старта (CANCELED) 100% суммы незамедлительно возвращается на баланс пользователя без комиссий. При частичном выполнении (PARTIAL) возврат рассчитывается строго за недоставленный объем.</p>
  <p><strong>4.2. Вывод неизрасходованного аванса:</strong> в соответствии со ст. 782 ГК РФ и ст. 32 Закона РФ «О защите прав потребителей» при одностороннем отказе Заказчика возврат остатка средств производится за вычетом фактически понесенных расходов Исполнителя (ФПР: комиссии эквайринга, чеки 54-ФЗ, налоги УСН по ст. 346.17 НК РФ, транзакционные издержки). Размер удержания ФПР составляет <strong>от 15% до 40%</strong> в зависимости от метода оплаты и периода нахождения средств (20% для API).</p>
  <p><strong>4.3. Требования 115-ФЗ:</strong> возврат осуществляется исключительно по тем же платежным реквизитам, с которых было произведено пополнение, в срок до 10 рабочих дней. Вывод средств на реквизиты третьих лиц категорически запрещен.</p>
</div>

<h3 class="text-base sm:text-lg font-extrabold text-foreground mt-6 mb-3 border-b border-border/60 pb-2">
  5. Запрещенные тематики (Zero Tolerance)
</h3>
<div class="space-y-3 text-xs sm:text-sm leading-relaxed text-foreground/90">
  <p><strong>5.1.</strong> Запрещено использовать сервис для продвижения материалов, нарушающих законодательство РФ: экстремизм, терроризм, насилие (ст. 282 УК РФ); политическая агитация, выборы и референдумы (ст. 141 УК РФ); фишинг, мошенничество, вредоносное ПО (ст. 159.6, 272 УК РФ); наркотические вещества; порнография; масс-репортинг и клевета.</p>
  <p><strong>5.2.</strong> При выявлении нарушений Исполнитель вправе немедленно заблокировать аккаунт без возврата средств (ст. 15 ГК РФ возмещение убытков).</p>
</div>

<h3 class="text-base sm:text-lg font-extrabold text-foreground mt-6 mb-3 border-b border-border/60 pb-2">
  6. Ответственность и Форс-Мажор (ст. 401 ГК РФ)
</h3>
<div class="space-y-3 text-xs sm:text-sm leading-relaxed text-foreground/90">
  <p><strong>6.1.</strong> Исполнитель не несет ответственности за сбои во внешних соцсетях (Telegram, VK, YouTube) и действия их модерации. Instagram и Facebook принадлежат компании Meta Platforms Inc., признанной экстремистской и запрещенной в РФ.</p>
  <p><strong>6.2.</strong> Совокупная ответственность Исполнителя ограничена стоимостью конкретного спорного заказа.</p>
</div>

<h3 class="text-base sm:text-lg font-extrabold text-foreground mt-6 mb-3 border-b border-border/60 pb-2">
  7. Конфиденциальность, Претензии и Разрешение споров
</h3>
<div class="space-y-3 text-xs sm:text-sm leading-relaxed text-foreground/90">
  <p><strong>7.1.</strong> Обработка персональных данных ведется в соответствии с Федеральным законом № 152-ФЗ на серверах на территории РФ.</p>
  <p><strong>7.2. Претензионный порядок:</strong> досудебный порядок урегулирования споров обязателен. Претензии направляются на <strong>{{SUPPORT_EMAIL}}</strong> (срок рассмотрения — до 30 календарных дней, по требованиям возврата — до 10 рабочих дней).</p>
  <p><strong>7.3. Подсудность:</strong> для API-клиентов споры рассматриваются в Арбитражном суде по месту нахождения Исполнителя; для потребителей-физических лиц — в соответствии с законодательством РФ о защите прав потребителей.</p>
</div>

<div class="bg-card p-5 rounded-xl border border-border/80 mt-6 text-xs font-mono grid grid-cols-1 sm:grid-cols-2 gap-2">
  <p><strong>Исполнитель:</strong> {{COMPANY_NAME}}</p>
  <p><strong>ИНН:</strong> {{COMPANY_INN}}</p>
  <p><strong>ОГРНИП / ОГРН:</strong> {{COMPANY_OGRNIP}}</p>
  <p><strong>Адрес:</strong> {{COMPANY_ADDRESS}}</p>
  <p><strong>Email:</strong> {{SUPPORT_EMAIL}}</p>
  <p><strong>Telegram:</strong> {{TELEGRAM_BOT}}</p>
</div>
`;

export const FALLBACK_REFUND_HTML = `
${legalNoticeComment}
<div class="mb-6 p-4 bg-muted/50 rounded-xl border border-border text-xs text-muted-foreground">
  Редакция от 29 августа 2026 года
</div>

<h3 class="text-base font-bold text-foreground mt-6 mb-3">1. Автоматический возврат на баланс (100%)</h3>
<p class="text-xs sm:text-sm leading-relaxed text-foreground/90">
  При отмене заказа до начала выполнения (CANCELED), технической ошибке провайдера (ERROR) или таймауте денежные средства в полном объеме (100%) мгновенно возвращаются на баланс аккаунта без комиссий. При частичном выполнении (PARTIAL) возврат рассчитывается строго за недоставленный объем.
</p>

<h3 class="text-base font-bold text-foreground mt-6 mb-3">2. Вывод остатка аванса на банковские реквизиты (ФПР)</h3>
<p class="text-xs sm:text-sm leading-relaxed text-foreground/90">
  В соответствии со ст. 782 ГК РФ и ст. 32 Закона РФ «О защите прав потребителей» при добровольном отказе от услуг возврат неизрасходованного остатка аванса производится за вычетом фактически понесенных расходов Исполнителя (ФПР: комиссии банковского эквайринга, чеки 54-ФЗ, налоги УСН по ст. 346.17 НК РФ и транзакционные издержки).
</p>
<p class="text-xs sm:text-sm leading-relaxed text-foreground/90 mt-2">
  <strong>Размер удержания ФПР составляет от 15% до 40%</strong> от суммы возвращаемого остатка в зависимости от платежного метода и периода нахождения средств на счете (для API — 20%). При необходимости Заказчик вправе запросить документальный расчет затрат через службу заботы.
</p>

<h3 class="text-base font-bold text-foreground mt-6 mb-3">3. Регламент и Безопасность выплат (115-ФЗ)</h3>
<p class="text-xs sm:text-sm leading-relaxed text-foreground/90">
  Возврат производится строго по тем же реквизитам (на ту же карту или счет), с которых поступил платеж (требование 115-ФЗ). Срок обработки заявления и выплаты — до 10 рабочих дней (ст. 16.1 ЗоЗПП).
</p>
<p class="text-xs sm:text-sm leading-relaxed text-foreground/90 mt-4">
  По вопросам возвратов: <strong>{{SUPPORT_EMAIL}}</strong> | Telegram: <strong>{{TELEGRAM_BOT}}</strong>
</p>

<div class="bg-card p-5 rounded-xl border border-border/80 mt-6 text-xs font-mono grid grid-cols-1 sm:grid-cols-2 gap-2">
  <p><strong>Исполнитель:</strong> {{COMPANY_NAME}}</p>
  <p><strong>ИНН:</strong> {{COMPANY_INN}}</p>
  <p><strong>ОГРНИП / ОГРН:</strong> {{COMPANY_OGRNIP}}</p>
  <p><strong>Адрес:</strong> {{COMPANY_ADDRESS}}</p>
  <p><strong>Email:</strong> {{SUPPORT_EMAIL}}</p>
  <p><strong>Telegram:</strong> {{TELEGRAM_BOT}}</p>
</div>

${aiDraftStampHtml}
`;

export const FALLBACK_PRIVACY_HTML = `
${legalNoticeComment}
<div class="mb-6 p-4 bg-muted/50 rounded-xl border border-border text-xs text-muted-foreground">
  Политика конфиденциальности (Федеральный закон № 152-ФЗ)
</div>

<div class="space-y-4 text-xs sm:text-sm leading-relaxed text-foreground/90">
  <p><strong>1. Правовые основания:</strong> Обработка персональных данных осуществляется <strong>{{COMPANY_NAME}}</strong> на основании ст. 6 Федерального закона № 152-ФЗ для исполнения договора-оферты и требований Федерального закона № 54-ФЗ (кассовые чеки).</p>
  <p><strong>2. Состав обрабатываемых данных:</strong> Email (для чеков и уведомлений), Telegram ID (при авторизации), IP-адрес и технические куки (для безопасности и антифрода). Оператор <strong>не собирает</strong> биометрию и специальные категории данных, а также <strong>не хранит</strong> данные банковских карт (обработка идет на стороне сертифицированных банковских шлюзов ЮKassa/Robokassa по стандарту PCI DSS Level 1).</p>
  <p><strong>3. Локализация в РФ (ч. 5 ст. 18 152-ФЗ):</strong> Базы данных расположены исключительно на серверах на территории Российской Федерации с шифрованием каналов связи (TLS 1.3).</p>
  <p><strong>4. Права субъекта данных:</strong> Запрос на уточнение или отзыв согласия направляется на <strong>{{PRIVACY_EMAIL}}</strong> и исполняется в срок до 10 рабочих дней.</p>
</div>

<div class="bg-card p-5 rounded-xl border border-border/80 mt-6 text-xs font-mono grid grid-cols-1 sm:grid-cols-2 gap-2">
  <p><strong>Оператор ПДн:</strong> {{COMPANY_NAME}}</p>
  <p><strong>ИНН:</strong> {{COMPANY_INN}}</p>
  <p><strong>ОГРНИП / ОГРН:</strong> {{COMPANY_OGRNIP}}</p>
  <p><strong>Адрес:</strong> {{COMPANY_ADDRESS}}</p>
  <p><strong>Email по ПДн:</strong> {{PRIVACY_EMAIL}}</p>
  <p><strong>Поддержка:</strong> {{SUPPORT_EMAIL}}</p>
</div>

${aiDraftStampHtml}
`;

export const FALLBACK_COOKIES_HTML = `
${legalNoticeComment}
<div class="mb-6 p-4 bg-muted/50 rounded-xl border border-border text-xs text-muted-foreground">
  Политика использования файлов Cookie
</div>

<p class="text-xs sm:text-sm leading-relaxed text-foreground/90 mb-4">
  Сервис {{SITE_NAME}} использует технические файлы Cookie исключительно для поддержания защищенной сессии авторизации (<code>session_token</code>, <code>csrf_token</code>) и корректной маршрутизации витрин (<code>x_admin_tenant</code>).
</p>
<p class="text-xs sm:text-sm leading-relaxed text-foreground/90">
  Для аналитики быстродействия может применяться Яндекс.Метрика с обезличиванием IP. Сторонние рекламные трекеры и скрытый фингерпринтинг не используются. Вопросы: <strong>{{PRIVACY_EMAIL}}</strong>.
</p>

${aiDraftStampHtml}
`;

export const FALLBACK_SERVICE_RULES_HTML = `
${legalNoticeComment}
<div class="mb-6 p-4 bg-muted/50 rounded-xl border border-border text-xs text-muted-foreground">
  Правила сервиса {{SITE_NAME}} и Ограничения контента
</div>

<h3 class="text-base font-bold text-foreground mt-4 mb-2">1. Регламент выполнения (SLA)</h3>
<p class="text-xs sm:text-sm leading-relaxed text-foreground/90">
  Старт заказа: от 0 до 30 минут с момента оплаты. Стандартное время выполнения: от 1 до 72 часов в зависимости от объема.
</p>

<h3 class="text-base font-bold text-foreground mt-6 mb-2">2. Запрещенные тематики (Zero Tolerance)</h3>
<p class="text-xs sm:text-sm leading-relaxed text-foreground/90">
  Категорически запрещено продвижение объектов, содержащих: призывы к экстремизму и насилию (ст. 282 УК РФ); политическую агитацию и выборы (ст. 141 УК РФ); фишинг, мошенничество, вредоносное ПО (ст. 159.6, 272 УК РФ); наркотические вещества; порнографию; масс-репортинг и клеветнические отзывы. При нарушении аккаунт блокируется без возврата средств (ст. 15 ГК РФ).
</p>

<h3 class="text-base font-bold text-foreground mt-6 mb-2">3. Дисклеймеры</h3>
<p class="text-xs sm:text-sm leading-relaxed text-foreground/90">
  Instagram и Facebook принадлежат Meta Platforms Inc., признанной экстремистской организацией и запрещенной в РФ (решение Тверского районного суда г. Москвы от 21.03.2022).
</p>

${aiDraftStampHtml}
`;

export const LEGAL_FALLBACKS: Record<string, LegalFallback> = {
  terms: { title: 'Договор публичной оферты', html: FALLBACK_TERMS_HTML },
  privacy: { title: 'Политика конфиденциальности', html: FALLBACK_PRIVACY_HTML },
  refund: { title: 'Политика возврата', html: FALLBACK_REFUND_HTML },
  cookies: { title: 'Политика использования файлов Cookie', html: FALLBACK_COOKIES_HTML },
  'service-rules': { title: 'Правила сервиса', html: FALLBACK_SERVICE_RULES_HTML },
};

export function getLegalFallback(slug: string): LegalFallback | null {
  return LEGAL_FALLBACKS[slug] || null;
}
