import { ClusterArticle } from './telegram';

export const apiClusters: ClusterArticle[] = [
  {
    slug: 'kak-poluchit-api-kluch',
    title: 'Как получить API-ключ SMM-панели',
    metaTitle: 'Как получить API-ключ SMM-панели | SMMplan',
    excerpt: 'Пошаговая инструкция по созданию API-ключа в SMMplan: безопасное хранение, авторизация запросов, валидация префикса smm_.',
    network: 'api',
    category: 'Биллинг и Лимиты',
    parentPillar: 'smm-api-guide',
    readTimeMinutes: 4,
    faq: [
      {
        question: 'Где находится раздел создания ключа?',
        answer: 'В личном кабинете пользователя во вкладке «Настройки → API».',
      },
    ],
    contentHtml: `
      <p>API-ключ служит персональным идентификатором вашего аккаунта при автоматизации. Главное руководство по интеграции читайте в статье <a href="/knowledge/smm-api-guide">SMM API для агентств и реселлеров</a>.</p>

      <h2>Инструкция по генерации ключа</h2>
      <ol>
        <li>Авторизуйтесь в личном кабинете на SMMplan.</li>
        <li>Перейдите в Настройки → Раздел API.</li>
        <li>Нажмите «Сгенерировать ключ» и скопируйте значение с префиксом <code>smm_</code>.</li>
      </ol>

      <p>Получить ключ можно в разделе <a href="/dashboard/settings/api">Настройки API</a>. Изучите полную документацию в <a href="/knowledge/smm-api-guide">SMM API для агентств и реселлеров</a>.</p>
    `,
  },
  {
    slug: 'api-metod-add',
    title: 'SMM API: создание заказа (метод add)',
    metaTitle: 'SMM API метод add: создание заказа | SMMplan',
    excerpt: 'Подробный разбор метода add в SMM API v2: передаваемые параметры, одиночные и пакетные заказы add_multi, формат ответа.',
    network: 'api',
    category: 'Биллинг и Лимиты',
    parentPillar: 'smm-api-guide',
    readTimeMinutes: 5,
    faq: [
      {
        question: 'Какие обязательные параметры метода add?',
        answer: 'Параметры key, action=add, service, link и quantity.',
      },
    ],
    contentHtml: `
      <p>Метод <code>add</code> является главным эндпоинтом отправки заказов. Подробно обо всех действиях читайте в материале <a href="/knowledge/smm-api-guide">SMM API для агентств и реселлеров</a>.</p>

      <h2>Пример запроса cURL</h2>
      <pre><code>curl -X POST https://test.smmplan.pro/api/v2 \\
  -d "key=smm_your_key&action=add&service=101&link=https://t.me/example&quantity=500"</code></pre>

      <p>Перейти к управлению доступом можно в <a href="/dashboard/settings/api">Разделе API</a>. Базовый гайд — <a href="/knowledge/smm-api-guide">SMM API для агентств и реселлеров</a>.</p>
    `,
  },
  {
    slug: 'api-status-zakaza',
    title: 'SMM API: проверка статуса заказа',
    metaTitle: 'SMM API метод status: проверка заказа | SMMplan',
    excerpt: 'Как отслеживать статус исполнения заказов через API: действия status, пакетные запросы до 100 ID, интерпретация ответов.',
    network: 'api',
    category: 'Биллинг и Лимиты',
    parentPillar: 'smm-api-guide',
    readTimeMinutes: 4,
    faq: [
      {
        question: 'Сколько заказов можно проверить за один запрос?',
        answer: 'До 100 заказов при передаче их ID через запятую в параметре order.',
      },
    ],
    contentHtml: `
      <p>Метод <code>status</code> возвращает текущую стадию обработки заказа (PENDING, IN_PROGRESS, COMPLETED). Читайте полную документацию <a href="/knowledge/smm-api-guide">SMM API для агентств и реселлеров</a>.</p>

      <h2>Пакетный статус</h2>
      <p>Передавайте до 100 ID через запятую для оптимизации запросов (<a href="/knowledge/glossary/eta">ETA</a>).</p>

      <p>Управление API доступно в <a href="/dashboard/settings/api">Настройках API</a>. Справочник действий — <a href="/knowledge/smm-api-guide">SMM API для агентств и реселлеров</a>.</p>
    `,
  },
  {
    slug: 'api-refill',
    title: 'SMM API: докрутка (refill) заказов',
    metaTitle: 'SMM API метод refill: автоматическая гарантия | SMMplan',
    excerpt: 'Автоматическая компенсация оттока показателей через API: действия refill и refill_status, работа по гарантийному периоду.',
    network: 'api',
    category: 'Биллинг и Лимиты',
    parentPillar: 'smm-api-guide',
    readTimeMinutes: 4,
    faq: [
      {
        question: 'Как часто можно запрашивать refill через API?',
        answer: 'Раз в 24 часа по заказам с активной гарантией Refill.',
      },
    ],
    contentHtml: `
      <p>Метод <code>refill</code> запускает восстановление показателей. Полное описание смотрите в <a href="/knowledge/smm-api-guide">SMM API для агентств и реселлеров</a> и в термине <a href="/knowledge/glossary/refill">Refill в словаре</a>.</p>

      <h2>Статусы докрутки</h2>
      <p>Отслеживайте стадию через action=refill_status. Генерация ключа — <a href="/dashboard/settings/api">Настройки API</a>. Главная статья — <a href="/knowledge/smm-api-guide">SMM API для агентств и реселлеров</a>.</p>
    `,
  },
  {
    slug: 'reselling-smm',
    title: 'Как заработать на реселлинге SMM-услуг',
    metaTitle: 'Заработок на реселлинге SMM-услуг | SMMplan',
    excerpt: 'Построение бизнеса на реселлинге SMM-услуг: настройка маржинальности (Markup), интеграция через API, автоматический контроль цен.',
    network: 'api',
    category: 'Биллинг и Лимиты',
    parentPillar: 'smm-api-guide',
    readTimeMinutes: 5,
    faq: [
      {
        question: 'Какую маржу можно устанавливать на услуги?',
        answer: 'Обычно реселлеры устанавливают наценку (Markup) от 30% до 200% к оптовой стоимости.',
      },
    ],
    contentHtml: `
      <p>Реселлинг SMM-услуг — готовая модель API-бизнеса. Руководство по интеграции читайте в статье <a href="/knowledge/smm-api-guide">SMM API для агентств и реселлеров</a> и <a href="/knowledge/glossary/markup">Термине Наценка</a>.</p>

      <h2>Преимущества партнерской модели SMMplan</h2>
      <p>Мы берем на себя автоматический контроль цен, систему Карантина (<a href="/knowledge/glossary/quarantine">Quarantine</a>) и поддержку бесперебойной сети.</p>

      <p>Создать ключ для подключения вашей панели можно в <a href="/dashboard/settings/api">Личном кабинете API</a>. Главная документация — <a href="/knowledge/smm-api-guide">SMM API для агентств и реселлеров</a>.</p>
    `,
  },
];
