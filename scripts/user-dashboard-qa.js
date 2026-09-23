import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
import { chromium } from 'playwright';

const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Папка для сохранения скриншотов
const screenshotsDir = 'C:/Users/Артём/.gemini/antigravity/brain/05da5888-d80c-4551-9edc-59620cba9876/dashboard_screenshots';

const dashboardPages = [
  { name: 'dashboard_home', path: '/dashboard' },
  { name: 'new_order', path: '/dashboard/new-order' },
  { name: 'orders_history', path: '/dashboard/orders' },
  { name: 'add_funds', path: '/dashboard/add-funds' },
  { name: 'transactions', path: '/dashboard/transactions' },
  { name: 'tickets', path: '/dashboard/tickets' },
  { name: 'referrals', path: '/dashboard/referrals' },
  { name: 'settings', path: '/dashboard/settings' },
  { name: 'smart_drip', path: '/dashboard/smart-drip' }
];

async function seedDashboardData(userId) {
  console.log('🌱 Очистка старых данных e2e пользователя...');
  
  // Каскадное удаление старых данных e2e юзера
  await prisma.commission.deleteMany({ where: { referrerId: userId } });
  await prisma.payment.deleteMany({ where: { userId } });
  await prisma.order.deleteMany({ where: { userId } });
  await prisma.ticket.deleteMany({ where: { userId } });

  console.log('🌱 Наполнение базы данных тестовыми данными для личного кабинета...');

  // 1. Сеть и категория
  let network = await prisma.network.findFirst({ where: { slug: 'telegram' } });
  if (!network) {
    network = await prisma.network.create({ data: { name: 'Telegram', slug: 'telegram', isActive: true } });
  }

  let category = await prisma.category.findFirst({ where: { networkId: network.id } });
  if (!category) {
    category = await prisma.category.create({
      data: { name: 'Подписчики Telegram', sort: 1, networkId: network.id }
    });
  }

  // 2. Провайдер
  let provider = await prisma.provider.findFirst({ where: { name: 'E2E Test Provider' } });
  if (!provider) {
    provider = await prisma.provider.create({
      data: { name: 'E2E Test Provider', apiUrl: 'http://test.local', apiKey: 'test_key' }
    });
  }

  // 3. Услуга
  let service = await prisma.service.findFirst({ where: { name: 'Telegram Подписчики (Эконом)' } });
  if (!service) {
    service = await prisma.service.create({
      data: {
        name: 'Telegram Подписчики (Эконом)',
        categoryId: category.id,
        providerId: provider.id,
        rate: 1.5,
        minQty: 10,
        maxQty: 10000,
        isActive: true,
        targetType: 'CHANNEL',
        externalId: 'mock_tg_sub_econom'
      }
    });
  }

  // 4. Заказ
  console.log('🌱 Создание тестового заказа...');
  await prisma.order.create({
    data: {
      userId,
      serviceId: service.id,
      providerId: provider.id,
      quantity: 100,
      status: 'PENDING',
      charge: 1500n, // 15.00 RUB
      providerCost: 500n,
      link: 'https://t.me/testchannel'
    }
  });

  // 5. Тикет (чат поддержки)
  console.log('🌱 Создание тестового тикета...');
  await prisma.ticket.create({
    data: {
      userId,
      subject: 'Не пришли подписчики',
      status: 'OPEN',
      messages: {
        create: [
          { text: 'Здравствуйте, создал заказ вчера, но подписчики все еще не пришли.', sender: 'USER' },
          { text: 'Приветствуем! Сейчас проверим статус выполнения у провайдера.', sender: 'STAFF' }
        ]
      }
    }
  });

  // 6. Платеж (вместо транзакции)
  console.log('🌱 Создание тестового платежа...');
  await prisma.payment.create({
    data: {
      userId,
      amount: 500_00n, // 500.00 RUB
      status: 'SUCCEEDED',
      gateway: 'yookassa',
      gatewayId: 'tx_yookassa_12345'
    }
  });

  // 7. Реферал (приглашенный пользователь)
  const refEmail = 'invited-friend@test.com';
  let referralUser = await prisma.user.findFirst({ where: { email: refEmail } });
  if (!referralUser) {
    referralUser = await prisma.user.create({
      data: {
        email: refEmail,
        balance: 0n,
        role: 'USER'
      }
    });
  }

  // Обновляем/создаем выплату рефералу (через комиссию)
  await prisma.commission.deleteMany({ where: { referrerId: userId } });
  
  console.log('🌱 Создание реферальной выплаты (комиссии)...');
  await prisma.commission.create({
    data: {
      orderId: 'fake_order_id_123',
      referrerId: userId,
      amount: 120_00n, // 120.00 RUB
      status: 'PAID'
    }
  });
  
  // Убеждаемся, что связь реферала настроена
  await prisma.user.update({
    where: { id: referralUser.id },
    data: { referredById: userId }
  });
}

async function main() {
  console.log('🚀 Запуск скрипта генерации скриншотов личного кабинета...');

  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // 1. Создание/обновление тестового пользователя (роль USER для чистоты эксперимента)
  const email = 'e2e-dashboard-tester@test.com';
  console.log(`👤 Настройка пользователя ${email}...`);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      role: 'USER',
      isActive: true,
      isDeleted: false,
      balance: 15000_00n // 15,000.00 RUB
    },
    create: {
      email,
      role: 'USER',
      isActive: true,
      isDeleted: false,
      balance: 15000_00n
    }
  });

  // Наполнение тестовыми данными
  await seedDashboardData(user.id);

  // 2. Создание сессии в БД
  console.log('🔑 Создание сессии и токена JWT...');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      expiresAt,
      userAgent: 'dashboard-qa-tester',
      ipAddress: '127.0.0.1'
    }
  });

  // 3. Генерация JWT
  const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-for-dev-only-v2';
  const encodedKey = new TextEncoder().encode(jwtSecret);
  const sessionToken = await new SignJWT({ sessionId: session.id, userId: user.id, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey);

  // 4. Запуск Chromium Playwright
  console.log('🌐 Запуск браузера Chromium...');
  const browser = await chromium.launch({ headless: true });
  const baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3001';

  // Десктопный контекст
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1
  });
  await desktopContext.addCookies([
    {
      name: 'session_token',
      value: sessionToken,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax'
    }
  ]);

  // Мобильный контекст
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1'
  });
  await mobileContext.addCookies([
    {
      name: 'session_token',
      value: sessionToken,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax'
    }
  ]);

  const desktopPage = await desktopContext.newPage();
  const mobilePage = await mobileContext.newPage();

  // Функция захвата скриншотов
  const capturePages = async (pageInstance, modeName) => {
    console.log(`🤖 Съемка экранов в режиме: ${modeName}...`);
    
    // Внедряем CSS для стабильности
    await pageInstance.addInitScript(() => {
      const style = document.createElement('style');
      style.innerHTML = `
        *, *::before, *::after {
          transition: none !important;
          animation: none !important;
          caret-color: transparent !important;
        }
      `;
      document.head.appendChild(style);
    });

    for (const pageMeta of dashboardPages) {
      const targetUrl = `${baseUrl}${pageMeta.path}`;
      console.log(`📸 [${modeName}] Загрузка: ${targetUrl}...`);

      try {
        await pageInstance.goto(targetUrl, { waitUntil: 'load', timeout: 20000 });
        await pageInstance.waitForTimeout(2000); // Даем время для гидратации

        // Скрываем динамические данные времени/баланса и графики
        try {
          await pageInstance.addStyleTag({
            content: `
              .recharts-responsive-container, svg.recharts-surface, .dynamic-chart, .financial-chart, .orders-chart {
                visibility: hidden !important;
                opacity: 0 !important;
              }
              .timestamp, .date-display, .createdAt-cell, .uuid-display {
                visibility: hidden !important;
              }
            `
          });
        } catch (styleErr) {
          console.warn(`⚠️ Ошибка применения стилей на ${pageMeta.path}:`, styleErr.message);
        }

        const filename = `${pageMeta.name}_${modeName}.png`;
        const savePath = path.resolve(screenshotsDir, filename);

        await pageInstance.screenshot({ path: savePath, fullPage: false });
        console.log(`✔️ Сохранено: ${filename}`);
      } catch (err) {
        console.error(`❌ Ошибка захвата ${pageMeta.path}:`, err.message);
      }
    }
  };

  // Выполняем съемку для десктопа и мобильного
  await capturePages(desktopPage, 'desktop');
  await capturePages(mobilePage, 'mobile');

  // Закрываем контексты и браузер
  await desktopContext.close();
  await mobileContext.close();
  await browser.close();

  console.log('🎉 Скриншоты успешно сгенерированы!');
  process.exit(0);
}

main().catch(err => {
  console.error('⛔ Ошибка выполнения скрипта:', err);
  process.exit(1);
});
