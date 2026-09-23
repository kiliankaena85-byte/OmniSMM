import { ClusterArticle } from './telegram';

export const chooseClusters: ClusterArticle[] = [
  {
    slug: 'chto-takoe-smm-panel',
    title: 'Что такое SMM-панель и как она работает',
    metaTitle: 'Что такое SMM-панель: принцип работы | SMMplan',
    excerpt: 'Подробный разбор понятия SMM-панели: архитектура агрегации провайдеров, автоматический заказ цифровых услуг, прозрачность цен.',
    network: 'general',
    category: 'Безопасность соцсетей',
    parentPillar: 'how-to-choose-smm-panel',
    readTimeMinutes: 5,
    faq: [
      {
        question: 'Как работает SMM-панель?',
        answer: 'Панель выступает удобным веб-интерфейсом и агрегатором лучших провайдеров услуг с защитой качества.',
      },
    ],
    contentHtml: `
      <p>SMM-панель — это сервис автоматического заказа цифровых услуг продвижения. Полный чек-лист выбора смотрите в материале <a href="/knowledge/how-to-choose-smm-panel">Как выбрать SMM-панель: чеклист 2026</a>.</p>

      <h2>Принцип работы платформы</h2>
      <p>Платформа связывает пользователя и провайдеров через единый безопасный интерфейс с гарантией Refill (<a href="/knowledge/glossary/provider">Словарь Провайдеров</a>).</p>

      <p>Протестировать функционал можно на странице <a href="/services">Каталог Услуг</a>. Главный гайд — <a href="/knowledge/how-to-choose-smm-panel">Как выбрать SMM-панель: чеклист 2026</a>.</p>
    `,
  },
  {
    slug: 'ceny-smm-panel',
    title: 'Цены в SMM-панелях: как формируется наценка',
    metaTitle: 'Цены в SMM-панелях: расчет наценки | SMMplan',
    excerpt: 'Из чего состоит стоимость услуг в SMM-панелях: кросс-курсы валют, розничная наценка (Markup), цены за 1 штуку без скрытых комиссий.',
    network: 'general',
    category: 'Биллинг и Лимиты',
    parentPillar: 'how-to-choose-smm-panel',
    readTimeMinutes: 4,
    faq: [
      {
        question: 'Почему в SMMplan цены указываются за 1 штуку?',
        answer: 'Отображение цены за 1 штуку устраняет путаницу и скрытые переплаты при заказе гибких объемов.',
      },
    ],
    contentHtml: `
      <p>Прозрачность ценообразования — наш главный стандарт. Детальный разбор читайте в гайде <a href="/knowledge/how-to-choose-smm-panel">Как выбрать SMM-панель: чеклист 2026</a> и <a href="/knowledge/glossary/markup">Термине Наценка</a>.</p>

      <h2>Формула расчета цен</h2>
      <p>Базовый тариф провайдера умножается на наценку с пересчетом в рубли. Перейдите в <a href="/services">Каталог Услуг</a> для просмотра цен. Главная статья — <a href="/knowledge/how-to-choose-smm-panel">Как выбрать SMM-панель: чеклист 2026</a>.</p>
    `,
  },
  {
    slug: 'eta-skorost',
    title: 'Скорость выполнения заказов: что такое ETA',
    metaTitle: 'ETA в SMM-панелях: прогнозирование скорости | SMMplan',
    excerpt: 'Что означает показатель ETA при заказе услуг: расчет центилей P50 и P90 на основе 100+ прошлых заказов, защита от задержек.',
    network: 'general',
    category: 'Безопасность соцсетей',
    parentPillar: 'how-to-choose-smm-panel',
    readTimeMinutes: 4,
    faq: [
      {
        question: 'Что значат показатели P50 и P90?',
        answer: 'P50 — медианное время выполнения 50% заказов, P90 — худший случай для 90% заказов.',
      },
    ],
    contentHtml: `
      <p>Показатель ETA отражает реальную скорость услуги. Руководство по выбору панелей — <a href="/knowledge/how-to-choose-smm-panel">Как выбрать SMM-панель: чеклист 2026</a> и <a href="/knowledge/glossary/eta">Термин ETA</a>.</p>

      <h2>Преимущества прозрачной оценки времени</h2>
      <p>Вы всегда знаете оринетировочный срок закрутки. Оценить услуги можно в <a href="/services">Каталоге</a>. Основной чек-лист — <a href="/knowledge/how-to-choose-smm-panel">Как выбрать SMM-панель: чеклист 2026</a>.</p>
    `,
  },
  {
    slug: 'garantii-vozvraty',
    title: 'Гарантии и возвраты в SMM-панелях',
    metaTitle: 'Гарантии и возвраты в SMM-панелях | SMMplan',
    excerpt: 'Как работают гарантийные периоды (Refill) и условия возврата средств на баланс при невыполнении или отмене заказов.',
    network: 'general',
    category: 'Безопасность соцсетей',
    parentPillar: 'how-to-choose-smm-panel',
    readTimeMinutes: 4,
    faq: [
      {
        question: 'Что происходит если услуга отменена?',
        answer: 'Средства за невыполненную часть заказа автоматически возвращаются на баланс аккаунта.',
      },
    ],
    contentHtml: `
      <p>Гарантия докрутки (Refill) защищает результат продвижения. Читайте правила в материале <a href="/knowledge/how-to-choose-smm-panel">Как выбрать SMM-панель: чеклист 2026</a> и <a href="/knowledge/glossary/refill">Словаре Refill</a>.</p>

      <h2>Условия автоматического возврата</h2>
      <p>Если заказ отменен системой, средства за сбойные единицы зачисляются обратно. Список услуг с гарантией — в <a href="/services">Каталоге</a>. Полный обзор — <a href="/knowledge/how-to-choose-smm-panel">Как выбрать SMM-панель: чеклист 2026</a>.</p>
    `,
  },
  {
    slug: 'bezopasnost-smm-panel',
    title: 'Безопасность SMM-панели: как не потерять деньги',
    metaTitle: 'Безопасность SMM-панели: защита от списаний | SMMplan',
    excerpt: 'Главные правила безопасного использования SMM-панелей: защита от завышения цен (Quarantine), платежные шлюзы, сохранение паролей.',
    network: 'general',
    category: 'Безопасность соцсетей',
    parentPillar: 'how-to-choose-smm-panel',
    readTimeMinutes: 5,
    faq: [
      {
        question: 'Нужно ли передавать пароль от аккаунта?',
        answer: 'Нет, для заказа услуг продвижения требуется только публичная ссылка на канал или пост.',
      },
    ],
    contentHtml: `
      <p>Защита средств и аккаунтов клиентов — наш безусловный приоритет. Изучите чек-лист <a href="/knowledge/how-to-choose-smm-panel">Как выбрать SMM-панель: чеклист 2026</a> и функцию <a href="/knowledge/glossary/quarantine">Карантин</a>.</p>

      <h2>Инструменты защиты SMMplan</h2>
      <p>Эластичный Карантин предотвращает списания по аномальным ценам. Перейдите в <a href="/services">Каталог Проверенных Услуг</a>. Чек-лист безопасности — <a href="/knowledge/how-to-choose-smm-panel">Как выбрать SMM-панель: чеклист 2026</a>.</p>
    `,
  },
];
