import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding rich set of mock tickets...');

  // 1. Get or create a API user
  let apiUser = await prisma.user.findFirst({
    where: { email: 'api_client@smmplan.pro' },
    include: { apiConfig: true }
  });
  if (!apiUser) {
    apiUser = await prisma.user.create({
      data: {
        email: 'api_client@smmplan.pro',
        role: 'USER',
        balance: 4500000, // 45,000 RUB
        totalSpent: 12500000, // 125,000 RUB
        apiConfig: {
          create: {
            isApiEnabled: true,
            prioritySupport: true,
            webhookUrl: 'https://webhook.site/api-test'
          }
        }
      },
      include: { apiConfig: true }
    });
  }

  // 2. Get or create a normal user
  let normalUser = await prisma.user.findFirst({
    where: { email: 'standard_user@gmail.com' }
  });
  if (!normalUser) {
    normalUser = await prisma.user.create({
      data: {
        email: 'standard_user@gmail.com',
        role: 'USER',
        balance: 12000, // 120 RUB
        totalSpent: 45000, // 450 RUB
      }
    });
  }

  // Clear existing tickets for both test users to avoid duplicates
  await prisma.ticket.deleteMany({
    where: {
      userId: { in: [apiUser.id, normalUser.id] }
    }
  });

  const now = Date.now();

  // Seed 12 tickets
  const ticketData = [
    {
      userId: apiUser.id,
      subject: 'Заказ #4521 завис в статусе В работе',
      status: 'OPEN' as const,
      source: 'WEB' as const,
      createdAt: new Date(now - 1000 * 60 * 60 * 2), // 2 hours ago
      messages: [
        { sender: 'USER' as const, text: 'Здравствуйте! Заказ #4521 завис в статусе В работе уже более 4 часов. Проверьте, пожалуйста.' },
        { sender: 'STAFF' as const, text: 'Здравствуйте! Проверяем. Задержка на стороне провайдера. Ожидайте обновления.' }
      ]
    },
    {
      userId: apiUser.id,
      subject: 'Вопрос по пополнению через USDT',
      status: 'PENDING' as const,
      source: 'TELEGRAM' as const,
      createdAt: new Date(now - 1000 * 60 * 60 * 24), // 1 day ago
      messages: [
        { sender: 'USER' as const, text: 'Пытаюсь пополнить баланс через Cryptobot в USDT, но ссылка выдает ошибку. Можете прислать счет вручную?' },
        { sender: 'STAFF' as const, text: 'Приветствуем! Пришлите скриншот ошибки. Счет вручную выставить не можем, но поможем разобраться.' }
      ]
    },
    {
      userId: normalUser.id,
      subject: 'Сбой в накрутке лайков Instagram',
      status: 'CLOSED' as const,
      source: 'WEB' as const,
      createdAt: new Date(now - 1000 * 60 * 60 * 72), // 3 days ago
      resolvedAt: new Date(now - 1000 * 60 * 60 * 68),
      messages: [
        { sender: 'USER' as const, text: 'Накрутка лайков остановилась на 50%. Заказ отмечен как выполненный.' },
        { sender: 'STAFF' as const, text: 'Здравствуйте! Вернули средства за недовыполненную часть заказа на ваш баланс. Приятного дня!' },
        { sender: 'USER' as const, text: 'Спасибо, баланс обновился.' }
      ]
    },
    {
      userId: apiUser.id,
      subject: 'Счета-фактуры и закрывающие документы за май',
      status: 'OPEN' as const,
      source: 'EMAIL' as const,
      createdAt: new Date(now - 1000 * 60 * 60 * 4), // 4 hours ago
      messages: [
        { sender: 'USER' as const, text: 'Добрый день! Вышлите закрывающие документы по договору API за прошлый месяц. ИНН компании 7701234567.' }
      ]
    },
    {
      userId: normalUser.id,
      subject: 'Отмена зависшего заказа Telegram #1042',
      status: 'OPEN' as const,
      source: 'TELEGRAM' as const,
      createdAt: new Date(now - 1000 * 60 * 60 * 6), // 6 hours ago
      messages: [
        { sender: 'USER' as const, text: 'Отмените заказ #1042. Слишком долго идет накрутка подписчиков.' }
      ]
    },
    {
      userId: normalUser.id,
      subject: 'Заявка на докрутку просмотров YouTube',
      status: 'PENDING' as const,
      source: 'WEB' as const,
      createdAt: new Date(now - 1000 * 60 * 60 * 30), // 30 hours ago
      messages: [
        { sender: 'USER' as const, text: 'Списались просмотры на видео. Делал заказ с гарантией 30 дней. Ссылка: youtube.com/watch?v=123' },
        { sender: 'STAFF' as const, text: 'Здравствуйте. Запустили докрутку. Ожидайте выполнения в течение суток.' }
      ]
    },
    {
      userId: apiUser.id,
      subject: 'Не пришли средства при оплате по СБП',
      status: 'OPEN' as const,
      source: 'WEB' as const,
      createdAt: new Date(now - 1000 * 60 * 60 * 1), // 1 hour ago
      messages: [
        { sender: 'USER' as const, text: 'Оплатил 15 000 рублей по СБП 20 минут назад. Деньги на баланс кабинета api_client@smmplan.pro до сих пор не зачислились.' }
      ]
    },
    {
      userId: normalUser.id,
      subject: 'Ошибка лимитов на накрутку Telegram',
      status: 'CLOSED' as const,
      source: 'TELEGRAM' as const,
      createdAt: new Date(now - 1000 * 60 * 60 * 96), // 4 days ago
      resolvedAt: new Date(now - 1000 * 60 * 60 * 90),
      messages: [
        { sender: 'USER' as const, text: 'Пишет что лимит превышен при заказе. Почему?' },
        { sender: 'STAFF' as const, text: 'Здравствуйте. На данной услуге лимит 10 000 штук в сутки на один канал. Пожалуйста, попробуйте заказать завтра.' }
      ]
    },
    {
      userId: normalUser.id,
      subject: 'Вопрос по API интеграции',
      status: 'CLOSED' as const,
      source: 'EMAIL' as const,
      createdAt: new Date(now - 1000 * 60 * 60 * 120), // 5 days ago
      resolvedAt: new Date(now - 1000 * 60 * 60 * 115),
      messages: [
        { sender: 'USER' as const, text: 'Добрый день. Где найти документацию по вашему API для интеграции с нашим сайтом?' },
        { sender: 'STAFF' as const, text: 'Здравствуйте. Документация доступна в вашем личном кабинете в разделе Настройки -> API.' }
      ]
    },
    {
      userId: apiUser.id,
      subject: 'Проблема с автоплатежом с корпоративной карты',
      status: 'PENDING' as const,
      source: 'EMAIL' as const,
      createdAt: new Date(now - 1000 * 60 * 60 * 48), // 2 days ago
      messages: [
        { sender: 'USER' as const, text: 'Не сработал автоплатеж для пополнения баланса. Ошибка авторизации карты.' },
        { sender: 'STAFF' as const, text: 'Здравствуйте. Уточните банк-эмитент карты. Проверим логи эквайринга.' }
      ]
    },
    {
      userId: apiUser.id,
      subject: 'Накрутка просмотров на пост не запускается',
      status: 'OPEN' as const,
      source: 'TELEGRAM' as const,
      createdAt: new Date(now - 1000 * 60 * 60 * 5), // 5 hours ago
      messages: [
        { sender: 'USER' as const, text: 'Привет. Пост t.me/channel/123 просмотры не пошли. Заказ оформлен час назад.' }
      ]
    },
    {
      userId: normalUser.id,
      subject: 'Сбой в платежной форме YooKassa',
      status: 'OPEN' as const,
      source: 'WEB' as const,
      createdAt: new Date(now - 1000 * 60 * 60 * 12), // 12 hours ago
      messages: [
        { sender: 'USER' as const, text: 'Выдает техническую ошибку при клике на оплату картой РФ. Это у вас или у банка проблемы?' }
      ]
    }
  ];

  for (const t of ticketData) {
    const { userId, subject, status, source, createdAt, resolvedAt, messages } = t;
    await prisma.ticket.create({
      data: {
        userId,
        subject,
        status,
        source,
        createdAt,
        resolvedAt,
        messages: {
          create: messages.map((m, idx) => ({
            sender: m.sender,
            text: m.text,
            createdAt: new Date(createdAt.getTime() + idx * 60 * 1000)
          }))
        }
      }
    });
  }

  console.log('✅ 12 diverse mock tickets seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
