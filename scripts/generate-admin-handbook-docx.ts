import * as fs from 'fs';
import * as path from 'path';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  ShadingType,
} from 'docx';

async function generateHandbookDocx() {
  console.log('📄 Generating OmniSMM Admin Desk Handbook DOCX...');

  const tableBorder = {
    top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
  };

  const createCell = (text: string, isHeader = false, widthPercent = 25) => {
    return new TableCell({
      width: { size: widthPercent, type: WidthType.PERCENTAGE },
      shading: isHeader ? { fill: 'F1F5F9', type: ShadingType.CLEAR } : undefined,
      margins: { top: 120, bottom: 120, left: 140, right: 140 },
      borders: tableBorder,
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text,
              bold: isHeader,
              size: isHeader ? 20 : 19,
              font: 'Calibri',
              color: isHeader ? '0F172A' : '334155',
            }),
          ],
        }),
      ],
    });
  };

  const createH1 = (text: string) => {
    return new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 180 },
      children: [
        new TextRun({
          text,
          bold: true,
          size: 32,
          font: 'Calibri',
          color: '1E3A8A',
        }),
      ],
    });
  };

  const createH2 = (text: string) => {
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 280, after: 120 },
      children: [
        new TextRun({
          text,
          bold: true,
          size: 26,
          font: 'Calibri',
          color: '334155',
        }),
      ],
    });
  };

  const createH3 = (text: string) => {
    return new Paragraph({
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 200, after: 80 },
      children: [
        new TextRun({
          text,
          bold: true,
          size: 22,
          font: 'Calibri',
          color: '0F172A',
        }),
      ],
    });
  };

  const createP = (text: string, bold = false) => {
    return new Paragraph({
      spacing: { before: 60, after: 100, line: 276 },
      children: [
        new TextRun({
          text,
          bold,
          size: 21,
          font: 'Calibri',
          color: '1E293B',
        }),
      ],
    });
  };

  const createBullet = (boldPrefix: string, text: string) => {
    return new Paragraph({
      bullet: { level: 0 },
      spacing: { before: 40, after: 60, line: 260 },
      children: [
        new TextRun({
          text: boldPrefix + ' ',
          bold: true,
          size: 21,
          font: 'Calibri',
          color: '0F172A',
        }),
        new TextRun({
          text,
          size: 21,
          font: 'Calibri',
          color: '334155',
        }),
      ],
    });
  };

  const createCallout = (title: string, content: string, type: 'NOTE' | 'WARN' | 'CRIT' = 'NOTE') => {
    const borderColor = type === 'CRIT' ? 'E11D48' : type === 'WARN' ? 'D97706' : '2563EB';
    const bgColor = type === 'CRIT' ? 'FFF1F2' : type === 'WARN' ? 'FFFBEB' : 'EFF6FF';

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      margins: { top: 100, bottom: 100, left: 100, right: 100 },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 100, type: WidthType.PERCENTAGE },
              shading: { fill: bgColor, type: ShadingType.CLEAR },
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                left: { style: BorderStyle.SINGLE, size: 24, color: borderColor },
              },
              margins: { top: 140, bottom: 140, left: 180, right: 180 },
              children: [
                new Paragraph({
                  spacing: { after: 60 },
                  children: [
                    new TextRun({
                      text: `[${type}] ${title}`,
                      bold: true,
                      size: 21,
                      font: 'Calibri',
                      color: borderColor,
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: content,
                      size: 20,
                      font: 'Calibri',
                      color: '1E293B',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });
  };

  const doc = new Document({
    creator: 'OmniSMM Engineering Team',
    title: 'Настольная книга администратора OmniSMM 1.0',
    description: 'Полное пошаговое руководство по всем разделам, экранам, функциям и настройкам платформы',
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch = 1440 twips
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'OmniSMM 1.0 • Настольная книга администратора (ГОСТ ЕСПД 19.505-79)',
                    size: 17,
                    font: 'Calibri',
                    color: '94A3B8',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Конфиденциально • Для служебного пользования | Страница ',
                    size: 17,
                    font: 'Calibri',
                    color: '94A3B8',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 17,
                    font: 'Calibri',
                    color: '94A3B8',
                  }),
                  new TextRun({
                    text: ' из ',
                    size: 17,
                    font: 'Calibri',
                    color: '94A3B8',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 17,
                    font: 'Calibri',
                    color: '94A3B8',
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // ── ТИТУЛЬНЫЙ ЛИСТ ──
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 720, after: 200 },
            children: [
              new TextRun({
                text: 'ПЛАТФОРМА УПРАВЛЕНИЯ SMM-СЕРВИСАМИ OMNISMM 1.0',
                bold: true,
                size: 24,
                font: 'Calibri',
                color: '64748B',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 300 },
            children: [
              new TextRun({
                text: 'НАСТОЛЬНАЯ КНИГА И ТЕХНИЧЕСКИЙ РЕГЛАМЕНТ АДМИНИСТРАТОРА',
                bold: true,
                size: 38,
                font: 'Calibri',
                color: '0F172A',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 600 },
            children: [
              new TextRun({
                text: 'Исчерпывающее пошаговое руководство по всем экранам, вкладкам, функциям и аварийным регламентам для витрин SMMplan (smmplan.pro) и SMMflux (smmflux.ru)',
                size: 22,
                font: 'Calibri',
                color: '475569',
              }),
            ],
          }),

          createCallout(
            'Статус документа',
            'Официальный эксплуатационный регламент в соответствии с ГОСТ ЕСПД 19.505-79. Обязателен к исполнению дежурными сменами, администраторами и операторами службы поддержки.',
            'NOTE'
          ),

          new Paragraph({ spacing: { before: 400, after: 200 }, children: [] }),

          // ── ТОМ 1 ──
          createH1('ТОМ 1. Системные настройки и безопасность (/admin/settings)'),
          createP(
            'Раздел системных настроек является ядром платформы OmniSMM 1.0. Он управляет конфигурацией магазинов, секретами Vault (шифрование AES-256-GCM), онлайн-кассами, Telegram-ботом P0, прокси-пулами и ролями сотрудников.'
          ),

          createH2('1.1. Бренд и Витрина (?tab=system)'),
          createP('Экран базовой конфигурации магазина, юридических реквизитов РФ и аварийного режима.'),
          createBullet(
            'Аварийный рубильник (KillSwitch):',
            'Большой тумблер в верхней карточке. При активации витрина мгновенно переводится в HTTP 503 Maintenance Mode. Клиентские запросы блокируются, но авторизованный персонал сохраняет полный доступ в /admin.'
          ),
          createBullet(
            'Название и описание сайта:',
            'Поля siteName и siteDescription формируют SEO-теги <title>, meta-description и тексты почтовых уведомлений.'
          ),
          createBullet(
            'Контактные адреса:',
            'contactSupportEmail (поддержка клиентов) и contactPrivacyEmail (официальные запросы по 152-ФЗ).'
          ),
          createBullet(
            'Юридические реквизиты РФ:',
            'Наименование ИП/ООО, ИНН (10/12 цифр), ОГРН/ОГРНИП, юридический адрес. Обязательны для выгрузки в онлайн-чеки по закону 54-ФЗ.'
          ),
          createBullet(
            'Налоговый режим (УСН) и НДС 22% (425-ФЗ):',
            'Выбор между "УСН Доходы 6%" и "УСН Доходы-Расходы 15%". Система автоматически проверяет лимит 20 млн ₽: до порога передается vat_code: 1 (Без НДС), выше порога — vat_code: 10 (НДС 22%).'
          ),

          createH2('1.2. Каталог и Цены (?tab=catalog)'),
          createBullet(
            'Глобальная наценка (%):',
            'Базовый процент наценки к себестоимости провайдеров (по умолчанию +40%). Розничная цена = Себестоимость × (1 + Наценка / 100).'
          ),
          createBullet(
            'Синхронизация курсов ЦБ РФ:',
            'Ежедневный опрос API cbr.ru для валют USD, EUR, KZT. Спред конвертации (+2.5%) защищает от курсовой волатильности.'
          ),
          createBullet(
            'Карантин дрифта цен (Price Quarantine):',
            'Если провайдер поднял цену более чем на 30%, услуга немедленно блокируется от продажи в минус и переходит в /admin/catalog/quarantine.'
          ),

          createH2('1.3. Кассы, Платежные шлюзы и AI (?tab=integrations)'),
          createBullet(
            'ЮKassa (Банковские карты МИР/Visa/MC, СБП):',
            'Ввод Shop ID и Secret Key. Кнопка "Проверить подключение ЮKassa" делает контрольный пинг API. Вебхук: https://<domain>/api/webhooks/yookassa.'
          ),
          createBullet(
            'Robokassa:',
            'Ввод Merchant Login, Пароль 1 (для инициализации) и Пароль 2 (для проверки подписи вебхука SHA-256).'
          ),
          createBullet(
            'CryptoBot (USDT, TON, BTC):',
            'API Token из бота @CryptoBot. Проверка вебхука выполняется строго через timingSafeEqual.'
          ),
          createBullet(
            'Gemini AI (gemini-3-flash):',
            'Интеграция с Google AI Studio. Используется для авто-подсказок операторам саппорта с учетом условий публичной оферты.'
          ),
          createBullet(
            'Корпоративный SMTP (Порт 465 SSL):',
            'Хост, логин, пароль приложения. Кнопка "Отправить тестовое письмо" верифицирует доставку без локальных прокси.'
          ),

          createH2('1.4. Telegram-бот и P0-алерты (?tab=telegram)'),
          createP('Регламент настройки оповещений дежурной смены:'),
          createBullet('Шаг 1:', 'Зарегистрировать бота в @BotFather, получить токен HTTP API.'),
          createBullet('Шаг 2:', 'Создать служебный канал P0 Alerts, добавить бота администратором.'),
          createBullet('Шаг 3:', 'Вставить токен и ID канала в настройках и нажать "Сохранить и активировать".'),
          createBullet(
            'Сброс ошибки 409 Conflict:',
            'При ошибке "terminated by other getUpdates" нажать кнопку "Сбросить повисший вебхук", которая вызывает deleteWebhook({ drop_pending_updates: true }).'
          ),

          createH2('1.5. Прокси провайдеров (?tab=proxy)'),
          createP(
            'Пул SOCKS5/HTTP прокси для маршрутизации API-запросов к внешним шлюзам. Формат: ip:port:username:password. Кнопка "Проверить пинг" замеряет время отклика узла.'
          ),

          createH2('1.6. Ключи витрин Storefront API (?tab=storefront)'),
          createP(
            'Выпуск токенов для внешних витрин, мобильных приложений и партнеров-реселлеров. Поддерживается белый список IP и лимит запросов в минуту (Rate Limiting).'
          ),

          createH2('1.7. Команда и ролевая матрица RBAC (?tab=team)'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createCell('Роль', true, 20),
                  createCell('Назначение', true, 30),
                  createCell('Права и полномочия', true, 50),
                ],
              }),
              new TableRow({
                children: [
                  createCell('OWNER'),
                  createCell('Владелец платформы'),
                  createCell('Полный доступ ко всем модулям, секретам Vault, кассам и правам сотрудников.'),
                ],
              }),
              new TableRow({
                children: [
                  createCell('ADMIN'),
                  createCell('Управляющий смены'),
                  createCell('Заказы, каталог, провайдеры, тикеты, CMS. Заблокирован доступ к секретам Vault.'),
                ],
              }),
              new TableRow({
                children: [
                  createCell('SUPPORT'),
                  createCell('Специалист поддержки'),
                  createCell('Тикеты, повтор заказов, компенсации в пределах суточного лимита (до 1500 ₽).'),
                ],
              }),
              new TableRow({
                children: [
                  createCell('ACCOUNTANT'),
                  createCell('Бухгалтер'),
                  createCell('Просмотр Леджера, P&L, подтверждение B2B заявок на баланс по платежным поручениям.'),
                ],
              }),
            ],
          }),

          createH2('1.8. Шаблоны ответов саппорта (?tab=templates)'),
          createP(
            'База быстрых макросов (шорткаты /drop, /stuck, /counter_lag) с динамическими переменными {userName}, {orderId}, {serviceName}.'
          ),

          createH2('1.9. Неизменяемый журнал аудита (?tab=audit)'),
          createP(
            'Каждое административное действие (изменение баланса, тарифа, токена) фиксируется в журнале с указанием IP, роли и снимка изменений (Diff).'
          ),

          new Paragraph({ spacing: { before: 300, after: 100 }, children: [] }),

          // ── ТОМ 2 ──
          createH1('ТОМ 2. Мульти-Тенантность, Бренды и CMS'),
          createH2('2.1. Мульти-Тенантность (/admin/tenants)'),
          createP(
            'Платформа OmniSMM 1.0 обслуживает два бренда: SMMplan (smmplan.pro) и SMMflux (smmflux.ru). Пользователи, балансы, заказы и промокоды строго изолированы. В шапке админки доступен глобальный переключатель сайтов.'
          ),
          createH2('2.2. Страницы CMS (/admin/pages)'),
          createP(
            'Редактирование правовых документов (Оферта /terms, Политика 152-ФЗ /privacy, FAQ /faq, Контакты /contacts) в формате Markdown с автоматическим сбросом кэша.'
          ),
          createH2('2.3. Статьи блога и База знаний (/admin/knowledge)'),
          createP(
            'Создание SEO-оптимизированных статей для поисковиков с категориями, обложками и расчетом времени чтения.'
          ),
          createH2('2.4. Переключатели фичей Feature Flags (/admin/system/features)'),
          createP(
            'Мгновенное переключение функционала без пересборки Docker: enable_drip_feed, enable_smart_drip, enable_crypto_payments, enable_referral_system.'
          ),

          new Paragraph({ spacing: { before: 300, after: 100 }, children: [] }),

          // ── ТОМ 3 ──
          createH1('ТОМ 3. Операционный центр (Заказы, Drip-Feed и Саппорт)'),
          createH2('3.1. Сводка дашборда (/admin/dashboard)'),
          createBullet('Выручка (Gross):', 'Сумма всех входящих платежей клиентов.'),
          createBullet('Себестоимость (COGS):', 'Сумма, списанная внешними провайдерами за исполнение заказов.'),
          createBullet('Чистая прибыль (Net Profit):', 'Выручка минус COGS, операционные расходы OPEX и налог УСН.'),
          createBullet('Обязательства (Liabilities):', 'Сумма балансов клиентов плюс стоимость незавершенных заказов.'),

          createH2('3.2. Реестр заказов (/admin/orders)'),
          createP('Жизненный цикл и кнопки управления:'),
          createBullet('Retry (Повторить):', 'Повторная отправка заказа провайдеру при сетевом таймауте.'),
          createBullet('Failover (Сменить провайдера):', 'Перепривязка заказа к альтернативному поставщику без доплаты.'),
          createBullet('Cancel & Refund:', 'Полный возврат средств на баланс с созданием проводки в Леджере.'),
          createBullet('PARTIAL (Частичный возврат):', 'Автоматический расчет и возврат сдачи за недокрученный объем.'),

          createH2('3.3. Умный Drip-Feed и Refills (/admin/smart, /admin/refills)'),
          createBullet(
            'Drip-Feed Floor Invariant:',
            'Объем одного запуска [Quantity / Runs] строго >= service.minQty. Запрещено отправлять заказы меньше минимума провайдера.'
          ),
          createBullet('Refill (Докрутка):', 'Обработка гарантийных заявок клиентов при списаниях со стороны соцсетей.'),

          createH2('3.4. Центр поддержки и тикеты (/admin/tickets)'),
          createBullet('SLA 15 минут:', 'Норматив времени первого ответа дежурного оператора.'),
          createBullet('Скрытые заметки 🔒:', 'Внутренняя служебная переписка между операторами, невидимая клиенту.'),
          createBullet('Матрица Goodwill:', '100% возврат для новичков, скидки для VIP, аргументированный отказ для абьюзеров.'),

          new Paragraph({ spacing: { before: 300, after: 100 }, children: [] }),

          // ── ТОМ 4 ──
          createH1('ТОМ 4. Каталог услуг и Провайдеры API'),
          createH2('4.1. Каталог услуг (/admin/catalog)'),
          createBullet('Цена строго ₽ / шт:', 'В интерфейсе всегда отображается цена за 1 единицу, а не за 1000 шт.'),
          createBullet('Бейдж #ID:', 'Кликабельный номер услуги для мгновенного копирования и точного поиска.'),
          createBullet('resolveServiceTargetType:', 'Семантический резолвер типов ссылок (канал, пост, группа, бот).'),

          createH2('4.2. Мастер импорта Cherry-Pick (/admin/providers/import)'),
          createBullet(
            'Приоритет №1 (Выбор администратора):',
            'Ручной маппинг категории администратором исполняется безусловно. Авто-сплит полностью отключается.'
          ),
          createBullet(
            'Zero-Unknown-Platform Guard:',
            'Если соцсеть не опознана на 100%, импорт услуги категорически блокируется.'
          ),

          createH2('4.3. Провайдеры API и Circuit Breaker (/admin/providers)'),
          createBullet('CLOSED (Штатно):', 'Ошибок < 5 подряд, трафик разрешен.'),
          createBullet('OPEN (Авария):', 'Шлюз изолирован, заказы направляются на резервных поставщиков.'),
          createBullet('HALF-OPEN (Тест):', 'Через 60 секунд отправляется 1 проверочный запрос.'),

          new Paragraph({ spacing: { before: 300, after: 100 }, children: [] }),

          // ── ТОМ 5 ──
          createH1('ТОМ 5. Финансы, Бухгалтерский Леджер и Казначейство'),
          createH2('5.1. Бухгалтерский Леджер (/admin/transactions)'),
          createBullet('Ledger-First:', 'Запись tx.ledgerEntry.create() создается ДО мутации tx.user.update().'),
          createBullet('ExactMath BigInt:', 'Все суммы рассчитываются в неделимых целочисленных копейках.'),
          createBullet('Transaction Escape Guard:', 'Запрещено использование глобального db.* внутри транзакций WalletOps.'),

          createH2('5.2. Казначейство и B2B счета (/admin/finance/treasury)'),
          createBullet('Сверка эквайринга:', 'Сопоставление баланса в ЮKassa с суммой проводок в Леджере.'),
          createBullet('B2B заявки:', 'Подтверждение безналичных пополнений юрлиц по номеру платежного поручения.'),
          createBullet('Чеки 54-ФЗ:', 'Передача фискальных признаков и расчет ставки НДС 22% по 425-ФЗ.'),

          new Paragraph({ spacing: { before: 300, after: 100 }, children: [] }),

          // ── ТОМ 6 ──
          createH1('ТОМ 6. Клиенты, Антифрод и Аварийные регламенты (Runbooks)'),
          createH2('6.1. База клиентов и CRM (/admin/clients)'),
          createP('CRM-профиль: история пополнений, заказов, LTV, блокировка аккаунта и деперсонализация по 152-ФЗ.'),

          createH2('6.2. Аварийные регламенты (Runbooks DR-01...DR-06)'),
          createBullet('DR-01 (Сбой БД Postgres):', 'Проверка свободного места на диске df -h и перезапуск контейнера.'),
          createBullet('DR-02 (Зависание Telegram 409):', 'Сброс вебхука кнопкой "Сбросить повисший вебхук" в /admin/settings.'),
          createBullet('DR-03 (Падение провайдера):', 'Групповой Failover зависших заказов на резервного поставщика.'),
          createBullet('DR-04 (Обнуление баланса провайдера):', 'Пополнение счета провайдера и перезапуск заказов через Retry.'),
          createBullet('DR-05 (Компрометация сотрудника):', 'Немедленный сброс роли до USER и инвалидация всех сессий в Redis.'),
          createBullet('DR-06 (Аварийный KillSwitch):', 'Включение режима техработ в /admin/settings для изоляции платформы.'),

          new Paragraph({ spacing: { before: 400 }, children: [] }),
          createCallout(
            'Заключение и подписи',
            'Настоящий регламент утвержден руководством платформы OmniSMM 1.0. Действителен для всех операторов и администраторов смен.',
            'NOTE'
          ),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  
  // Save to docs/manual/
  const docsDir = path.join(process.cwd(), 'docs', 'manual');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  const docsFilePath = path.join(docsDir, 'OMNISMM_ADMIN_DESK_HANDBOOK_2026.docx');
  fs.writeFileSync(docsFilePath, buffer);
  console.log(`✅ Saved DOCX to: ${docsFilePath}`);

  // Save to public/manual/ for direct browser download
  const publicDir = path.join(process.cwd(), 'public', 'manual');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  const publicFilePath = path.join(publicDir, 'OMNISMM_ADMIN_DESK_HANDBOOK_2026.docx');
  fs.writeFileSync(publicFilePath, buffer);
  console.log(`✅ Saved public DOCX to: ${publicFilePath} (Size: ${buffer.length} bytes)`);
}

generateHandbookDocx().catch((err) => {
  console.error('❌ Failed to generate handbook DOCX:', err);
  process.exit(1);
});
