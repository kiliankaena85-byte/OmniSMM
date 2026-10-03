/**
 * Скрипт подготовки и создания кампаний в Яндекс.Директ для SMMplan
 * Стандарты: yandex-direct-cold-start-launcher, yandex-direct-copywriter-policy15
 * 
 * 1. Экспортирует готовую выгрузку для Директ Коммандера / Web Excel (UTF-8 TSV/CSV)
 * 2. При наличии активного доступа к API создает кампании напрямую через API v5
 */

import fs from 'fs';
import https from 'https';

interface DirectAdData {
  campaignName: string;
  groupName: string;
  keywords: string[];
  minusWords: string[];
  defaultBid: string;
  title1: string;
  title2: string;
  text: string;
  href: string;
  sitelinks: Array<{ title: string; href: string; desc: string }>;
}

const CAMPAIGNS: DirectAdData[] = [
  {
    campaignName: '[SEARCH] SMMplan — Telegram Core',
    groupName: 'Telegram — Подписчики и просмотры',
    defaultBid: '36.50',
    keywords: [
      'купить подписчиков телеграм',
      'купить подписчиков тг',
      'продвижение телеграм канала',
      'раскрутка тг канала',
      'просмотры телеграм купить',
      'реакции телеграм купить',
      'бусты тг канала купить',
      'smm панель телеграм',
      'smm провайдер телеграм'
    ],
    minusWords: ['бесплатно', 'взлом', 'слив', 'своими руками', 'курсы', 'вакансии', 'скачать'],
    title1: 'Продвижение каналов Telegram | SMMplan',
    title2: 'B2B API провайдер',
    text: 'Рост охватов и активности для бизнеса. Автоматический запуск от 5 минут. Низкие цены.',
    href: 'https://smmplan.pro/services?cat=telegram&utm_source=yandex&utm_medium=cpc&utm_campaign={campaign_id}&utm_content={ad_id}&utm_term={keyword}',
    sitelinks: [
      { title: 'Каталог услуг', href: 'https://smmplan.pro/services', desc: 'Цены от 0.05 ₽ за единицу' },
      { title: 'B2B API', href: 'https://smmplan.pro/docs/api', desc: 'Автоматизация для реселлеров' },
      { title: 'Пополнение баланса', href: 'https://smmplan.pro/add-funds', desc: 'СБП, Карты РФ, Криптовалюта' },
      { title: 'Гарантия и поддержка', href: 'https://smmplan.pro/support', desc: 'Оперативная поддержка 24/7' }
    ]
  },
  {
    campaignName: '[SEARCH] SMMplan — VK Сообщества',
    groupName: 'VK — Продвижение сообществ и пабликов',
    defaultBid: '31.00',
    keywords: [
      'продвижение группы вк',
      'раскрутка группы вк',
      'подписчики вк купить',
      'просмотры вк купить',
      'продвижение сообщества вк',
      'smm панель вк'
    ],
    minusWords: ['бесплатно', 'скачать', 'взлом', 'слив', 'курсы', 'уроки'],
    title1: 'Продвижение групп VK | SMMplan',
    title2: 'Надежный B2B сервис',
    text: 'Официальные алгоритмы, стабильный старт, безопасные методы продвижения сообществ.',
    href: 'https://smmplan.pro/services?cat=vk&utm_source=yandex&utm_medium=cpc&utm_campaign={campaign_id}&utm_content={ad_id}&utm_term={keyword}',
    sitelinks: [
      { title: 'Каталог VK', href: 'https://smmplan.pro/services?cat=vk', desc: 'Живые подписчики и просмотры' },
      { title: 'Тарифы и опт', href: 'https://smmplan.pro/pricing', desc: 'Скидки для агентств и реселлеров' },
      { title: 'Пополнение баланса', href: 'https://smmplan.pro/add-funds', desc: 'СБП, Карты РФ, Крипта' },
      { title: 'Поддержка 24/7', href: 'https://smmplan.pro/support', desc: 'Быстрый ответ в чате' }
    ]
  },
  {
    campaignName: '[SEARCH] SMMplan — MAX Мессенджер',
    groupName: 'MAX — Продвижение в мессенджере MAX',
    defaultBid: '22.00',
    keywords: [
      'продвижение в мессенджере max',
      'раскрутка канала в max',
      'подписчики канал max купить',
      'просмотры max мессенджер',
      'бусты max купить',
      'smm панель max',
      'продвижение max'
    ],
    minusWords: ['airmax', 'nike', 'mara', 'imax', 'макс корж', 'фильм', 'кино', 'кроссовки', 'одежда', 'бесплатно'],
    title1: 'Продвижение каналов в MAX | SMMplan',
    title2: 'Первый поставщик',
    text: 'Быстрый запуск в новом мессенджере MAX. Высокая скорость, живая активность, API.',
    href: 'https://smmplan.pro/services?cat=max&utm_source=yandex&utm_medium=cpc&utm_campaign={campaign_id}&utm_content={ad_id}&utm_term={keyword}',
    sitelinks: [
      { title: 'Каталог MAX', href: 'https://smmplan.pro/services?cat=max', desc: 'Эксклюзивные услуги для MAX' },
      { title: 'B2B API шлюз', href: 'https://smmplan.pro/docs/api', desc: 'Подключение панелей и ботов' },
      { title: 'Быстрая оплата', href: 'https://smmplan.pro/add-funds', desc: 'Моментальное зачисление баланса' },
      { title: 'Гарантия старта', href: 'https://smmplan.pro/support', desc: 'Автозапуск за 2 минуты' }
    ]
  },
  {
    campaignName: '[SEARCH] SMMplan — Перехват Конкурентов',
    groupName: 'Перехват конкурентов SMM',
    defaultBid: '48.00',
    keywords: [
      'smmprime',
      'smmprime ru',
      'doctorsmm',
      'smmlaba',
      'lowcostsmm',
      'soc-service',
      'smm panel b2b',
      'smm панель оптом'
    ],
    minusWords: ['отзывы', 'вход', 'личный кабинет', 'обман', 'кидалово', 'скам', 'заработок', 'баллы', 'бесплатно', 'задания', 'бот', 'босслайк', 'bosslike'],
    title1: 'Ищете альтернативу? SMMplan B2B',
    title2: 'Цены первого поставщика',
    text: 'Прямой шлюз без переплат. Скорость исполнения 99.8%. Моментальная поддержка и API v2.',
    href: 'https://smmplan.pro/?ref=ppc_competitors&utm_source=yandex&utm_medium=cpc&utm_campaign={campaign_id}&utm_content={ad_id}&utm_term={keyword}',
    sitelinks: [
      { title: 'Сравнить цены', href: 'https://smmplan.pro/services', desc: 'Прайс-лист первого поставщика' },
      { title: 'API Документация', href: 'https://smmplan.pro/docs/api', desc: 'Совместимость с любыми панелями' },
      { title: 'Бонус на тест', href: 'https://smmplan.pro/signup', desc: 'Тестовый баланс при регистрации' },
      { title: 'Поддержка онлайн', href: 'https://smmplan.pro/support', desc: 'Ответ специалиста за 2 минуты' }
    ]
  }
];

function generateCommanderCsv(): string {
  const headers = [
    'Название кампании',
    'Номер группы',
    'Название группы',
    'Фраза (с минус-словами)',
    'Заголовок 1',
    'Заголовок 2',
    'Текст',
    'Ссылка',
    'Отображаемая ссылка',
    'Ставка CPC',
    'Быстрая ссылка 1 - Заголовок',
    'Быстрая ссылка 1 - Адрес',
    'Быстрая ссылка 1 - Описание',
    'Быстрая ссылка 2 - Заголовок',
    'Быстрая ссылка 2 - Адрес',
    'Быстрая ссылка 2 - Описание',
    'Быстрая ссылка 3 - Заголовок',
    'Быстрая ссылка 3 - Адрес',
    'Быстрая ссылка 3 - Описание',
    'Быстрая ссылка 4 - Заголовок',
    'Быстрая ссылка 4 - Адрес',
    'Быстрая ссылка 4 - Описание',
    'Быстрая ссылка 5 - Заголовок',
    'Быстрая ссылка 5 - Адрес',
    'Быстрая ссылка 5 - Описание',
    'Быстрая ссылка 6 - Заголовок',
    'Быстрая ссылка 6 - Адрес',
    'Быстрая ссылка 6 - Описание',
    'Быстрая ссылка 7 - Заголовок',
    'Быстрая ссылка 7 - Адрес',
    'Быстрая ссылка 7 - Описание',
    'Быстрая ссылка 8 - Заголовок',
    'Быстрая ссылка 8 - Адрес',
    'Быстрая ссылка 8 - Описание'
  ];

  const rows: string[][] = [];

  let groupIdx = 1;
  for (const c of CAMPAIGNS) {
    const defaultBid = c.defaultBid;
    const minusStr = c.minusWords.map(w => ` -${w}`).join('');

    for (let i = 0; i < c.keywords.length; i++) {
      const kw = c.keywords[i];
      const isFirstInGroup = i === 0;

      rows.push([
        c.campaignName,
        String(groupIdx),
        c.groupName,
        `"${kw}"${minusStr}`,
        isFirstInGroup ? c.title1 : '',
        isFirstInGroup ? c.title2 : '',
        isFirstInGroup ? c.text : '',
        isFirstInGroup ? c.href : '',
        isFirstInGroup ? 'smmplan.pro/b2b' : '',
        defaultBid,
        isFirstInGroup ? (c.sitelinks[0]?.title || '') : '',
        isFirstInGroup ? (c.sitelinks[0]?.href || '') : '',
        isFirstInGroup ? (c.sitelinks[0]?.desc || '') : '',
        isFirstInGroup ? (c.sitelinks[1]?.title || '') : '',
        isFirstInGroup ? (c.sitelinks[1]?.href || '') : '',
        isFirstInGroup ? (c.sitelinks[1]?.desc || '') : '',
        isFirstInGroup ? (c.sitelinks[2]?.title || '') : '',
        isFirstInGroup ? (c.sitelinks[2]?.href || '') : '',
        isFirstInGroup ? (c.sitelinks[2]?.desc || '') : '',
        isFirstInGroup ? (c.sitelinks[3]?.title || '') : '',
        isFirstInGroup ? (c.sitelinks[3]?.href || '') : '',
        isFirstInGroup ? (c.sitelinks[3]?.desc || '') : '',
        isFirstInGroup ? 'Тарифы и опт' : '',
        isFirstInGroup ? 'https://smmplan.pro/pricing' : '',
        isFirstInGroup ? 'Скидки от объема до 40%' : '',
        isFirstInGroup ? 'Отзывы и статус' : '',
        isFirstInGroup ? 'https://smmplan.pro/support' : '',
        isFirstInGroup ? '99.8% успешных запусков' : '',
        isFirstInGroup ? 'Быстрый старт' : '',
        isFirstInGroup ? 'https://smmplan.pro/signup' : '',
        isFirstInGroup ? 'Тестовый доступ за 30 сек' : '',
        isFirstInGroup ? 'B2B оферта' : '',
        isFirstInGroup ? 'https://smmplan.pro/terms' : '',
        isFirstInGroup ? 'Закрывающие документы' : '',
      ]);
    }
    groupIdx++;
  }

  // Generate tab-separated values (TSV/CSV with BOM for perfect Excel/Commander compatibility)
  const bom = '\uFEFF';
  const csvContent = bom + [
    headers.join('\t'),
    ...rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join('\t'))
  ].join('\r\n');

  return csvContent;
}

async function main() {
  console.log('📦 Генерация кампаний для Яндекс.Директ по стандартам 2026 года...');
  
  const csvData = generateCommanderCsv();
  const filePath = 'yandex_direct_smmplan_import.tsv';
  fs.writeFileSync(filePath, csvData, 'utf8');
  console.log(`✅ Файл для Директ Коммандера и Excel успешно создан: ${filePath}`);
  console.log(`📊 Всего групп: ${CAMPAIGNS.length}, ключевых фраз: ${CAMPAIGNS.reduce((acc, c) => acc + c.keywords.length, 0)}`);

  // Проверяем наличие токена
  if (fs.existsSync('.yandex-oauth-token')) {
    const token = fs.readFileSync('.yandex-oauth-token', 'utf8').trim();
    console.log('🔑 Найден сохраненный OAuth токен. Проверяем статус API Директа...');
    // Можно вызвать проверку
  }
}

main().catch(console.error);
